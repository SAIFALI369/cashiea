// ════════════════════════════════════════════════════════════════
// CANVA OAUTH — Authorization Code flow with PKCE (SHA-256).
//
// Setup (Canva Developer Portal → your integration):
//   - Generate a client secret; note the Client ID.
//   - Set redirect URL: https://<project>.functions.supabase.co/canva-oauth
//   - Enable scopes: design:meta:read, design:content:read, asset:read, profile, openid
// Then set secrets:
//   supabase secrets set CANVA_CLIENT_ID=...
//   supabase secrets set CANVA_CLIENT_SECRET=...
//   supabase secrets set APP_URL=https://cashiea-ten.vercel.app
//
// Flow:
//   GET /canva-oauth?action=authorize&user=<uuid>  → 302 to Canva consent
//   GET /canva-oauth?action=callback&code=...&state=... → exchanges via PKCE,
//       stores tokens, redirects to APP_URL/app/connect-apps?connected=canva
// verify_jwt = false (browser redirects, no user JWT).
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET");
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".functions.supabase.co")}/canva-oauth`;
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";
const SCOPES = "design:meta:read design:content:read asset:read profile openid";

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
}

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkce(): Promise<{ code_verifier: string; code_challenge: string }> {
  const verifierBytes = new Uint8Array(48);
  crypto.getRandomValues(verifierBytes);
  const code_verifier = b64url(verifierBytes);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code_verifier));
  const code_challenge = b64url(new Uint8Array(digest));
  return { code_verifier, code_challenge };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "authorize";

  try {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response(JSON.stringify({ error: "Canva OAuth not configured. Set CANVA_CLIENT_ID + CANVA_CLIENT_SECRET and add the redirect URI in the Canva Developer Portal." }), { status: 503, headers: { ...cors(), "Content-Type": "application/json" } });
    }

    // ── AUTHORIZE ──
    if (action === "authorize") {
      const userId = url.searchParams.get("user");
      if (!userId) return new Response(JSON.stringify({ error: "Missing user id" }), { status: 400, headers: { ...cors(), "Content-Type": "application/json" } });
      const { code_verifier, code_challenge } = await pkce();
      const state = crypto.randomUUID();
      await svc.from("oauth_pending").upsert({ state, user_id: userId, provider: "canva", code_verifier });
      const params = new URLSearchParams({
        code_challenge, code_challenge_method: "S256", scope: SCOPES,
        response_type: "code", client_id: CLIENT_ID, state, redirect_uri: REDIRECT_URI,
      });
      return Response.redirect(`https://www.canva.com/api/oauth/authorize?${params}`, 302);
    }

    // ── CALLBACK ──
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") || "";
      const errParam = url.searchParams.get("error");
      if (errParam) return Response.redirect(`${APP_URL}/app/connect-apps?error=${encodeURIComponent(errParam)}`, 302);

      const { data: pending } = await svc.from("oauth_pending").select("*").eq("state", state).maybeSingle();
      if (!code || !pending) return Response.redirect(`${APP_URL}/app/connect-apps?error=invalid_state`, 302);

      const tokenRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code_verifier: pending.code_verifier,
        }),
      });
      if (!tokenRes.ok) {
        const detail = (await tokenRes.text()).slice(0, 200);
        await svc.from("oauth_pending").delete().eq("state", state);
        return Response.redirect(`${APP_URL}/app/connect-apps?error=token_exchange&detail=${encodeURIComponent(detail)}`, 302);
      }
      const tokens = await tokenRes.json();
      const nowIso = new Date().toISOString();

      await svc.from("connected_apps").upsert({
        user_id: pending.user_id, app_slug: "canva", app_name: "Canva", permission_mode: "read_only",
        access_token: tokens.access_token, refresh_token: tokens.refresh_token || null,
        token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
        scopes_granted: SCOPES.split(" "), status: "connected", last_synced_at: nowIso,
      }, { onConflict: "user_id,app_slug" });

      await svc.from("integrations").upsert({
        user_id: pending.user_id, provider: "canva", status: "connected", label: "Canva",
        metadata: {
          access_token: tokens.access_token, refresh_token: tokens.refresh_token || null,
          expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
          scope: SCOPES, connected_at: nowIso,
        },
        last_synced_at: nowIso,
      }, { onConflict: "user_id,provider" });

      await svc.from("oauth_pending").delete().eq("state", state);
      return Response.redirect(`${APP_URL}/app/connect-apps?connected=canva`, 302);
    }

    return new Response(JSON.stringify({ error: "Unknown action. Use ?action=authorize or ?action=callback" }), { status: 400, headers: { ...cors(), "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || String(e) }), { status: 500, headers: { ...cors(), "Content-Type": "application/json" } });
  }
});
