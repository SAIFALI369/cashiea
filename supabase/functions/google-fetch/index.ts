// ════════════════════════════════════════════════════════════════
// GOOGLE FETCH — pulls live Gmail / Sheets data using the token in
// connected_apps, then feeds a bounded summary into business learning.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";
import { refreshGoogleToken, fetchGmail, fetchSheet } from "../_shared/google.ts";
import { releaseApiUsage } from "../_shared/usage.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const serviceClient = createClient(supabaseUrl, serviceKey);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 20_000) return json({ error: "Request is too large" }, 413);
  let usageReserved = false;
  let usageConsumed = false;
  let usageOwner = "";
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid JSON body" }, 400);
    const requestedUserId = body.user_id;
    const provider = String(body.provider || "");
    if (!provider || !["gmail", "google_sheets"].includes(provider)) {
      return json({ error: "provider must be gmail or google_sheets" }, 400);
    }

    // A scheduled service call may select a target owner. A browser JWT may
    // sync only the business owner's connection: connected_apps is deliberately
    // owner-only, and resolving a member's id to a different account here
    // would create an easy cross-tenant confusion bug.
    const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    let targetUserId = "";
    if (serviceKey && bearer === serviceKey) {
      targetUserId = String(requestedUserId || "");
    } else {
      const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: req.headers.get("authorization") || "" } },
      });
      const { data: { user } } = await caller.auth.getUser();
      if (!user) return json({ error: "Unauthorized" }, 401);
      const { data: actor } = await serviceClient.from("profiles")
        .select("id, role, business_owner_id").eq("id", user.id).maybeSingle();
      if (!actor || actor.role !== "owner" || actor.business_owner_id !== null) {
        return json({ error: "Only the business owner can sync connected Google data" }, 403);
      }
      if (requestedUserId && requestedUserId !== user.id) return json({ error: "Unauthorized" }, 401);
      targetUserId = user.id;
    }
    if (!targetUserId || !/^[0-9a-f-]{36}$/i.test(targetUserId)) return json({ error: "A valid owner id is required for a service sync" }, 400);
    usageOwner = targetUserId;

    const appSlug = provider === "google_sheets" ? "google-sheets" : "gmail";
    let { data: connection } = await serviceClient.from("connected_apps")
      .select("*").eq("user_id", targetUserId).eq("app_slug", appSlug).maybeSingle();
    let legacy = false;

    // Rolling-deploy fallback for a legacy row; v27 migrates this data to
    // connected_apps and strips the secrets from integrations.metadata.
    if (!connection) {
      const { data: old } = await serviceClient.from("integrations")
        .select("user_id,provider,status,metadata,last_synced_at,last_error")
        .eq("user_id", targetUserId).eq("provider", provider).maybeSingle();
      if (old) { connection = old as any; legacy = true; }
    }
    if (!connection || connection.status !== "connected") {
      return json({ error: `${provider} not connected. Connect it first.` }, 400);
    }

    const { data: reserved, error: reserveError } = await serviceClient.rpc("reserve_api_usage", { p_user_id: targetUserId, p_amount: 1 });
    if (reserveError) return json({ error: "AI usage service is unavailable; deploy schema v27 first" }, 503);
    if (!reserved) return json({ error: "Usage limit reached" }, 429);
    usageReserved = true;

    const accessToken = await refreshGoogleToken(serviceClient, {
      ...(connection as any),
      provider,
      app_slug: appSlug,
    });
    if (!accessToken) {
      const update = legacy
        ? serviceClient.from("integrations").update({ status: "error", last_error: "Token refresh failed — reconnect" }).eq("user_id", targetUserId).eq("provider", provider)
        : serviceClient.from("connected_apps").update({ status: "token_expired" }).eq("id", connection.id);
      await update;
      return json({ error: "Google token expired — please reconnect in Connect Apps." }, 401);
    }

    let fetchedData: string;
    let rowCount = 0;
    if (provider === "gmail") {
      const emails = await fetchGmail(accessToken, 30);
      rowCount = emails.length;
      fetchedData = `Recent emails (${emails.length}) — subject | snippet:\n${emails.map((email) => `- ${email.subject}\n  ${email.snippet}`).join("\n")}`;
    } else {
      const spreadsheetId = String(body.spreadsheet_id || connection.metadata?.spreadsheet_id || "");
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(spreadsheetId)) return json({ error: "A valid spreadsheet_id is required." }, 400);
      const rows = await fetchSheet(accessToken, spreadsheetId);
      rowCount = rows.length;
      fetchedData = `Google Sheets rows (${rows.length}):\n${JSON.stringify(rows.slice(0, 100), null, 1)}`;
    }

    const nextMetadata = { ...(connection.metadata || {}), last_fetch_count: rowCount };
    if (legacy) {
      await serviceClient.from("integrations").update({ last_synced_at: new Date().toISOString(), last_error: null, metadata: nextMetadata })
        .eq("user_id", targetUserId).eq("provider", provider);
    } else {
      await serviceClient.from("connected_apps").update({ last_synced_at: new Date().toISOString(), status: "connected", metadata: nextMetadata })
        .eq("id", connection.id);
    }

    const { data: profile } = await serviceClient.from("profiles").select("ai_provider").eq("id", targetUserId).single();
    let summary: string | null = null;
    try {
      summary = await callAIWithFallback(
        "groq",
        "You are a business-learning assistant. From the provided data, extract 3-5 concise key facts about this business (products, customers, patterns). Return ONLY a JSON object: {\"facts\":[\"...\"]}.",
        `Data from ${provider}:\n${fetchedData.slice(0, 6000)}`,
        600,
        "google-fetch",
      );
      usageConsumed = true;
    } catch { /* the data sync itself succeeded; refund the unused AI reservation */ }

    await serviceClient.from("activity_logs").insert({
      user_id: targetUserId,
      action_type: "summary",
      description: `Synced ${rowCount} records from ${provider}`,
      time_saved_minutes: 15,
      money_saved: 8,
      provider: profile?.ai_provider,
      metadata: { source: provider, rows: rowCount, extracted_facts: summary },
    });

    return json({ ok: true, provider, records_fetched: rowCount, learned: !!summary, facts: summary });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  } finally {
    if (usageReserved && !usageConsumed) await releaseApiUsage(serviceClient, usageOwner);
  }
});
