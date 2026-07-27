// ════════════════════════════════════════════════════════════════
// GOOGLE OAUTH — full authorize + callback + token-exchange flow.
//
// Setup:
//   1. Create an OAuth client at https://console.cloud.google.com/apis/credentials
//      - Type: Web application
//      - Authorized redirect URI: https://<project>.functions.supabase.co/google-oauth
//      - Enable Gmail API + Google Sheets API on the project
//   2. Set secrets:
//      supabase secrets set GOOGLE_CLIENT_ID=....apps.googleusercontent.com
//      supabase secrets set GOOGLE_CLIENT_SECRET=...
//      supabase secrets set APP_URL=https://yourdomain.com
//
// Flow:
//   GET /google-oauth?action=authorize&user=<uuid>&provider=gmail|google_sheets
//     → 302 redirect to Google's consent screen
//   GET /google-oauth?action=callback&code=...&state=<user|provider>
//     → exchanges code for tokens, stores them in integrations.metadata,
//       then redirects back to APP_URL/app/integrations?connected=<provider>
//
// Tokens are stored encrypted-at-rest by Supabase; refresh is automatic on fetch.
//
// Deploy:  supabase functions deploy google-oauth
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".functions.supabase.co")}/google-oauth`;

// Per-provider scopes — each consent screen asks only for what that app needs.
function scopesFor(provider: string): string {
  const base = ["https://www.googleapis.com/auth/userinfo.email", "openid"];
  if (provider === "gmail") return [...base, "https://www.googleapis.com/auth/gmail.readonly"].join(" ");
  if (provider === "google_drive") return [...base, "https://www.googleapis.com/auth/drive.file"].join(" ");
  return [...base, "https://www.googleapis.com/auth/spreadsheets.readonly"].join(" "); // google_sheets (default)
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });

  // Service-role client for writing integration state
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "authorize";

  try {
    // ─── Not configured → clear error ─────────────────────────
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(
        JSON.stringify({
          error: "Google OAuth not configured.",
          hint: "Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET secrets, and enable Gmail + Sheets APIs in Google Cloud.",
        }),
        { status: 503, headers: { ...cors(), "Content-Type": "application/json" } }
      );
    }

    // ─── AUTHORIZE: redirect to Google consent ────────────────
    if (action === "authorize") {
      const userId = url.searchParams.get("user");
      const provider = url.searchParams.get("provider") || "gmail";
      const permission = url.searchParams.get("permission") || "read_only";
      if (!userId) {
        return new Response(JSON.stringify({ error: "Missing user id" }), {
          status: 400, headers: { ...cors(), "Content-Type": "application/json" },
        });
      }

      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: scopesFor(provider),
        access_type: "offline",      // request a refresh token
        prompt: "consent",           // force consent so refresh token is returned
        state: `${userId}|${provider}|${permission}`,
      });
      return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
    }

    // ─── CALLBACK: exchange code → tokens, persist ────────────
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") || "";
      const [userId, provider, permission] = state.split("|");

      if (!code || !userId) {
        return Response.redirect(`${APP_URL}/app/integrations?error=missing_code`, 302);
      }

      // Exchange authorization code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return Response.redirect(`${APP_URL}/app/integrations?error=token_exchange&detail=${encodeURIComponent(err.slice(0, 200))}`, 302);
      }

      const tokens = await tokenRes.json();

      // Fetch the user's Google email so we can label the connection
      let connectedEmail = "";
      if (tokens.access_token) {
        try {
          const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            connectedEmail = profile.email || "";
          }
        } catch { /* non-fatal */ }
      }

      // Persist the connection + tokens (service role bypasses RLS)
      const { error } = await supabase.from("integrations").upsert({
        user_id: userId,
        provider: provider || "gmail",
        status: "connected",
        label: provider === "google_sheets" ? "Google Sheets" : "Gmail",
        metadata: {
          connected_email: connectedEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
          scope: tokens.scope || SCOPES,
          connected_at: new Date().toISOString(),
        },
        last_synced_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: "user_id,provider" });

      if (error) {
        return Response.redirect(`${APP_URL}/app/connect-apps?error=db&detail=${encodeURIComponent(error.message)}`, 302);
      }

      // Also store in connected_apps (the new, richer data model)
      const appSlug = provider === "google_sheets" ? "google-sheets" : provider === "google_drive" ? "google-drive" : provider;
      const appName = provider === "google_sheets" ? "Google Sheets" : provider === "google_drive" ? "Google Drive" : "Gmail";
      await supabase.from("connected_apps").upsert({
        user_id: userId,
        app_slug: appSlug,
        app_name: appName,
        provider_email: connectedEmail,
        permission_mode: permission || "read_only",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        scopes_granted: (tokens.scope || SCOPES).split(" "),
        status: "connected",
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "user_id,app_slug" });

      // Audit log
      await supabase.rpc("log_integration_event", {
        p_user_id: userId, p_app_slug: appSlug, p_action_type: "oauth_success",
        p_metadata: { email: connectedEmail, permission_mode: permission },
      });

      return Response.redirect(`${APP_URL}/app/connect-apps?connected=${appSlug}`, 302);
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use ?action=authorize or ?action=callback" }), {
      status: 400, headers: { ...cors(), "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...cors(), "Content-Type": "application/json" },
    });
  }
});
