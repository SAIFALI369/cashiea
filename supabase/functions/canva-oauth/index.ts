// ════════════════════════════════════════════════════════════════
// CANVA CONNECT OAUTH — authenticated PKCE initiation + one-time callback.
// This function is required by the enabled Canva catalog entry; without it the
// UI must not advertise Canva as connectable.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { resolveBusiness } from "../_shared/business.ts";

const SUPABASE_URL = (Deno.env.get("SUPABASE_URL") || "").replace(/\/+$/, "");
const CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET");
const APP_URL = (Deno.env.get("APP_URL") || "").replace(/\/+$/, "");
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/canva-oauth`;
const SCOPES = ["design:meta:read", "design:content:read", "asset:read", "profile"].join(" ");

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
function configured() { return !!(SUPABASE_URL && CLIENT_ID && CLIENT_SECRET && APP_URL); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const service = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (!configured()) return json({ error: "Canva Connect is not configured on the server." }, 503);
    const url = new URL(req.url);
    const callback = req.method === "GET" && (url.searchParams.has("code") || url.searchParams.has("error") || url.searchParams.has("state"));

    if (!callback && req.method === "POST") {
      const caller = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });
      const { data: { user }, error } = await caller.auth.getUser();
      if (error || !user) return json({ error: "Unauthorized" }, 401);
      const business = await resolveBusiness(service, user.id);
      if (!business?.isOwner) return json({ error: "Only the business owner can connect Canva" }, 403);

      const state = randomToken(32);
      const verifier = randomToken(48);
      const challenge = await pkceChallenge(verifier);
      const { error: stateError } = await service.from("oauth_pending").insert({
        state,
        user_id: user.id,
        provider: "canva",
        code_verifier: verifier,
        permission_mode: "read_only",
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      if (stateError) return json({ error: "Could not start Canva OAuth securely" }, 500);

      const params = new URLSearchParams({
        client_id: CLIENT_ID!,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES,
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      return json({ url: `https://www.canva.com/api/oauth/authorize?${params.toString()}` });
    }
    if (!callback) return json({ error: "Use an authenticated POST to start Canva OAuth" }, 405);
    if (url.searchParams.get("error")) return redirectError("canva_denied");

    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return redirectError("missing_code");
    const { data: pending } = await service.from("oauth_pending")
      .select("state,user_id,code_verifier,expires_at")
      .eq("state", state).eq("provider", "canva").maybeSingle();
    await service.from("oauth_pending").delete().eq("state", state);
    if (!pending || !pending.code_verifier || (pending.expires_at && new Date(pending.expires_at).getTime() < Date.now())) {
      return redirectError("invalid_or_expired_state");
    }
    const callbackOwner = await resolveBusiness(service, pending.user_id);
    if (!callbackOwner?.isOwner) return redirectError("owner_required");

    const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
    const tokenResponse = await fetch("https://api.canva.com/rest/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: pending.code_verifier,
      }),
    });
    if (!tokenResponse.ok) return redirectError("token_exchange_failed", await tokenResponse.text());
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) return redirectError("missing_access_token");

    const now = new Date().toISOString();
    const { error: saveError } = await service.from("connected_apps").upsert({
      user_id: pending.user_id,
      app_slug: "canva",
      app_name: "Canva",
      provider_email: null,
      permission_mode: "read_only",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      scopes_granted: String(tokens.scope || SCOPES).split(" "),
      status: "connected",
      last_synced_at: now,
      metadata: {},
      updated_at: now,
    }, { onConflict: "user_id,app_slug" });
    if (saveError) return redirectError("connection_save_failed", saveError.message);

    await service.from("integration_audit_logs").insert({
      user_id: pending.user_id,
      app_slug: "canva",
      action_type: "oauth_success",
      status: "success",
      metadata: { permission_mode: "read_only" },
    });
    return Response.redirect(`${APP_URL}/app/connect-apps?connected=canva`, 302);
  } catch (error) {
    if (new URL(req.url).searchParams.has("state")) return redirectError("oauth_failed", error instanceof Error ? error.message : String(error));
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
