// ════════════════════════════════════════════════════════════════
// GOOGLE OAUTH — authenticated POST initiation + one-time PKCE callback.
// Tokens are stored only in connected_apps and are never returned to the
// browser or written to browser-readable integrations.metadata.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { resolveBusiness } from "../_shared/business.ts";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const APP_URL = (Deno.env.get("APP_URL") || "").replace(/\/+$/, "");
// Canonical Supabase Edge Function URL. Do not use the legacy
// <project>.functions.supabase.co hostname anywhere in the flow.
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth`;

const PROVIDERS = ["gmail", "google_sheets", "google_drive"] as const;
type GoogleProvider = (typeof PROVIDERS)[number];
type PermissionMode = "read_only" | "read_write" | "full_access";

function scopesFor(provider: GoogleProvider, permission: PermissionMode): string {
  const base = ["https://www.googleapis.com/auth/userinfo.email", "openid"];
  if (provider === "gmail") return [...base, "https://www.googleapis.com/auth/gmail.readonly"].join(" ");
  // Drive file selection is now server-mediated. A browser-side Google Picker
  // would require returning an OAuth token to JavaScript, which is forbidden.
  // Read-only Drive metadata/content is fetched only inside integrations-api;
  // the app persists the selected file IDs, never the token.
  if (provider === "google_drive") return [...base, "https://www.googleapis.com/auth/drive.readonly"].join(" ");
  const sheetScope = permission === "read_only"
    ? "https://www.googleapis.com/auth/spreadsheets.readonly"
    : "https://www.googleapis.com/auth/spreadsheets";
  const scopes = [...base, sheetScope];
  if (permission === "full_access") scopes.push("https://www.googleapis.com/auth/drive.file");
  return scopes.join(" ");
}

function randomToken(bytes = 32): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return btoa(String.fromCharCode(...values)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function redirectError(code: string, detail?: string): Response {
  const query = new URLSearchParams({ error: code });
  if (detail) query.set("detail", detail.slice(0, 180));
  return Response.redirect(`${APP_URL}/app/connect-apps?${query.toString()}`, 302);
}

function appSlug(provider: GoogleProvider): string {
  return provider === "google_sheets" ? "google-sheets" : provider === "google_drive" ? "google-drive" : "gmail";
}
function appName(provider: GoogleProvider): string {
  return provider === "google_sheets" ? "Google Sheets" : provider === "google_drive" ? "Google Drive" : "Gmail";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const service = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !SUPABASE_URL || !APP_URL) {
      return json({ error: "Google OAuth is not configured on the server." }, 503);
    }

    const url = new URL(req.url);
    const callback = req.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error") || url.searchParams.has("state"));

    // ─── Authenticated initiation ───────────────────────────────
    if (!callback && req.method === "POST") {
      const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });
      const { data: { user }, error: authError } = await caller.auth.getUser();
      if (authError || !user) return json({ error: "Unauthorized" }, 401);
      const business = await resolveBusiness(service, user.id);
      if (!business?.isOwner) return json({ error: "Only the business owner can connect Google apps" }, 403);

      const body = await req.json().catch(() => ({}));
      const provider = String(body.provider || "gmail") as GoogleProvider;
      if (!PROVIDERS.includes(provider)) return json({ error: "Unsupported Google provider" }, 400);
      const requestedPermission = String(body.permission || "read_only") as PermissionMode;
      if (!["read_only", "read_write", "full_access"].includes(requestedPermission)) return json({ error: "Invalid permission" }, 400);
      const permission: PermissionMode = provider === "gmail" || provider === "google_drive" ? "read_only" : requestedPermission;

      const state = randomToken(32);
      const verifier = randomToken(48);
      const challenge = await pkceChallenge(verifier);
      const { error: stateError } = await service.from("oauth_pending").insert({
        state,
        user_id: user.id,
        provider,
        code_verifier: verifier,
        permission_mode: permission,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (stateError) return json({ error: "Could not start OAuth securely" }, 500);

      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: scopesFor(provider, permission),
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    }

    // Reject the old GET /?action=authorize&user=... flow rather than trusting
    // a user id in a query string.
    if (!callback) return json({ error: "Use an authenticated POST to start OAuth" }, 405);

    // ─── One-time callback ──────────────────────────────────────
    const callbackError = url.searchParams.get("error");
    if (callbackError) {
      // Google sends the same state on an explicit denial. Consume it just as
      // we consume a successful callback so a cancelled flow cannot leave a
      // live pending verifier until TTL expiry (or be replayed later).
      const deniedState = url.searchParams.get("state");
      if (deniedState) await service.from("oauth_pending").delete().eq("state", deniedState);
      return redirectError("google_denied", url.searchParams.get("error_description") || callbackError);
    }
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return redirectError("missing_code");

    const { data: pending } = await service.from("oauth_pending")
      .select("state,user_id,provider,code_verifier,permission_mode,expires_at")
      .eq("state", state)
      .maybeSingle();
    // Consume before exchanging: a callback URL can never be replayed, even if
    // the provider or network returns an error.
    await service.from("oauth_pending").delete().eq("state", state);
    if (!pending || !pending.code_verifier || (pending.expires_at && new Date(pending.expires_at).getTime() < Date.now())) {
      return redirectError("invalid_or_expired_state");
    }
    const callbackOwner = await resolveBusiness(service, pending.user_id);
    if (!callbackOwner?.isOwner) return redirectError("owner_required");
    const provider = pending.provider as GoogleProvider;
    if (!PROVIDERS.includes(provider)) return redirectError("invalid_provider");
    const permission = (pending.permission_mode || "read_only") as PermissionMode;

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: pending.code_verifier,
      }),
    });
    if (!tokenResponse.ok) return redirectError("token_exchange_failed", await tokenResponse.text());
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return redirectError("missing_access_token");

    let email = "";
    try {
      const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (profileResponse.ok) email = (await profileResponse.json()).email || "";
    } catch { /* account label is non-critical */ }

    const slug = appSlug(provider);
    const { data: existing } = await service.from("connected_apps")
      .select("refresh_token,metadata").eq("user_id", pending.user_id).eq("app_slug", slug).maybeSingle();
    const now = new Date().toISOString();
    const { error: connectionError } = await service.from("connected_apps").upsert({
      user_id: pending.user_id,
      app_slug: slug,
      app_name: appName(provider),
      provider_email: email,
      permission_mode: permission,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || existing?.refresh_token || null,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      scopes_granted: String(tokens.scope || scopesFor(provider, permission)).split(" "),
      status: "connected",
      last_synced_at: now,
      // Reconnecting must not silently discard the owner's selected Drive
      // files. Metadata is non-secret selection state; tokens remain above in
      // the server-only columns.
      metadata: existing?.metadata || {},
      updated_at: now,
    }, { onConflict: "user_id,app_slug" });
    if (connectionError) return redirectError("connection_save_failed", connectionError.message);

    // Keep the old integration index in sync using safe metadata only. The
    // data plane reads connected_apps; this row is not a secret store.
    await service.from("integrations").upsert({
      user_id: pending.user_id,
      provider,
      status: "connected",
      label: appName(provider),
      metadata: { connected_email: email, scope: String(tokens.scope || scopesFor(provider, permission)), connected_at: now },
      last_synced_at: now,
      last_error: null,
    }, { onConflict: "user_id,provider" });
    await service.from("integration_audit_logs").insert({
      user_id: pending.user_id,
      app_slug: slug,
      action_type: "oauth_success",
      status: "success",
      metadata: { email, permission_mode: permission },
    });

    return Response.redirect(`${APP_URL}/app/connect-apps?connected=${encodeURIComponent(slug)}`, 302);
  } catch (error) {
    if (new URL(req.url).searchParams.has("state")) return redirectError("oauth_failed", error instanceof Error ? error.message : String(error));
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
