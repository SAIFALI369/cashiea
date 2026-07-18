// ════════════════════════════════════════════════════════════════
// QUICKBOOKS OAUTH — scaffold for QuickBooks Online integration.
//
// Setup:
//   1. Create an app at https://developer.intuit.com → My Apps
//   2. Redirect URI: https://<project>.functions.supabase.co/quickbooks-oauth
//   3. Set secrets:
//      supabase secrets set QB_CLIENT_ID=...
//      supabase secrets set QB_CLIENT_SECRET=...
//      supabase secrets set APP_URL=https://yourdomain.com
//
// Flow (mirrors google-oauth):
//   GET /quickbooks-oauth?action=authorize&user=<uuid>
//     → 302 to Intuit consent
//   GET /quickbooks-oauth?action=callback&code=...&state=<user>
//     → exchanges, stores tokens, redirects back
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CLIENT_ID = Deno.env.get("QB_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("QB_CLIENT_SECRET");
const APP_URL = Deno.env.get("APP_URL") || "http://localhost:5173";
const REDIRECT_URI = `${Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".functions.supabase.co")}/quickbooks-oauth`;
const SCOPE = "com.intuit.quickbooks.accounting";

function cors() {
  return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, OPTIONS" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "authorize";

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return new Response(JSON.stringify({
      error: "QuickBooks OAuth not configured.",
      hint: "Set QB_CLIENT_ID + QB_CLIENT_SECRET and create an app at developer.intuit.com.",
    }), { status: 503, headers: { ...cors(), "Content-Type": "application/json" } });
  }

  try {
    if (action === "authorize") {
      const userId = url.searchParams.get("user");
      if (!userId) return new Response(JSON.stringify({ error: "Missing user id" }), { status: 400, headers: { ...cors(), "Content-Type": "application/json" } });
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        scope: SCOPE,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        state: userId,
      });
      return Response.redirect(`https://appcenter.intuit.com/connect/oauth2?${params}`, 302);
    }

    if (action === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const realmId = url.searchParams.get("realmId"); // QuickBooks company ID
      if (!code || !state) return Response.redirect(`${APP_URL}/app/integrations?error=missing_code`, 302);

      const basic = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);
      const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return Response.redirect(`${APP_URL}/app/integrations?error=token_exchange&detail=${encodeURIComponent(err.slice(0, 200))}`, 302);
      }
      const tokens = await tokenRes.json();

      await supabase.from("integrations").upsert({
        user_id: state,
        provider: "quickbooks",
        status: "connected",
        label: "QuickBooks Online",
        metadata: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          realm_id: realmId,
          expires_at: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
          connected_at: new Date().toISOString(),
        },
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });

      return Response.redirect(`${APP_URL}/app/integrations?connected=quickbooks`, 302);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...cors(), "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors(), "Content-Type": "application/json" } });
  }
});
