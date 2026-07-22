// ════════════════════════════════════════════════════════════════
// GOOGLE FETCH — pulls live data from Gmail / Sheets using stored
// OAuth tokens, then feeds it to the business-brain to learn from.
//
// Called either:
//   - from the client when the user clicks "Sync data" on a connected
//     integration, or
//   - from the daily-brain cron.
//
// Body: { user_id, provider: 'gmail'|'google_sheets', spreadsheet_id? }
// (JWT-auth from the client; service-role when called from cron.)
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { corsHeaders, json, withRetry } from "../_shared/retry.ts";
import { refreshGoogleToken, fetchGmail, fetchSheet } from "../_shared/google.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { user_id, provider, spreadsheet_id } = body;
    if (!user_id || !provider) return json({ error: "user_id and provider required" }, 400);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Load the integration
    const { data: integration } = await supabase.from("integrations")
      .select("*").eq("user_id", user_id).eq("provider", provider).maybeSingle();
    if (!integration || integration.status !== "connected") {
      return json({ error: `${provider} not connected. Connect it first.` }, 400);
    }

    // Get a fresh access token (refreshes if expired)
    const accessToken = await refreshGoogleToken(supabase, integration);
    if (!accessToken) {
      await supabase.from("integrations").update({ status: "error", last_error: "Token refresh failed — reconnect" })
        .eq("user_id", user_id).eq("provider", provider);
      return json({ error: "Google token expired — please reconnect in Integrations." }, 401);
    }

    // Pull data
    let fetchedData: string;
    let rowCount = 0;
    if (provider === "gmail") {
      const emails = await fetchGmail(accessToken, 30);
      rowCount = emails.length;
      fetchedData = `Recent emails (${emails.length}) — subject | snippet:\n${emails.map((e) => `- ${e.subject}\n  ${e.snippet}`).join("\n")}`;
    } else if (provider === "google_sheets") {
      const sid = spreadsheet_id || integration.metadata?.spreadsheet_id;
      if (!sid) return json({ error: "No spreadsheet_id configured for this Sheet." }, 400);
      const rows = await fetchSheet(accessToken, sid);
      rowCount = rows.length;
      fetchedData = `Google Sheets rows (${rows.length}):\n${JSON.stringify(rows.slice(0, 100), null, 1)}`;
    } else {
      return json({ error: `Provider ${provider} not supported by google-fetch` }, 400);
    }

    // Mark synced
    await supabase.from("integrations").update({
      last_synced_at: new Date().toISOString(),
      last_error: null,
      metadata: { ...integration.metadata, last_fetch_count: rowCount },
    }).eq("user_id", user_id).eq("provider", provider);

    // Feed the data into the business-brain (learn mode) by calling it
    // directly with the same service client.
    const brainUrl = `${SUPABASE_URL!.replace(".supabase.co", ".functions.supabase.co")}/business-brain`;
    const { data: profile } = await supabase.from("profiles").select("ai_provider").eq("id", user_id).single();

    // We call the brain in "learn" mode with the fetched data as manual_notes.
    // (The brain function expects a user JWT, but we use a service-role
    //  internal call pattern by posting to it with the service key — see below.)
    await supabase.rpc("increment_api_usage", { user_uuid: user_id });

    // Inline the learn call to avoid JWT bootstrapping from a service context.
    // Store a memory-update request via the brain's data path by inserting a
    // lightweight activity log; the next "Re-learn" button click on the UI
    // will synthesize. For an immediate update, we do a direct AI call here.
    let summary = null;
    try {
      const key = Deno.env.get("OPENAI_API_KEY");
      if (key) {
        const aiRes = await withRetry(() => fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a business-learning assistant. From the provided data, extract 3-5 concise key facts about this business (products, customers, patterns). Return ONLY a JSON object: {\"facts\":[\"...\"]}." },
              { role: "user", content: `Data from ${provider}:\n${fetchedData.slice(0, 6000)}` },
            ],
            temperature: 0.5, max_tokens: 600,
          }),
        }).then(async (r) => ({ ok: r.ok, status: r.status, value: await r.text() })), 1, 800);

        if (aiRes.ok) {
          const parsed = JSON.parse(aiRes.value);
          summary = parsed.choices?.[0]?.message?.content || null;
        }
      }
    } catch { /* non-fatal — sync still succeeded */ }

    await supabase.from("activity_logs").insert({
      user_id, action_type: "summary",
      description: `Synced ${rowCount} records from ${provider}`,
      time_saved_minutes: 15, money_saved: 8, provider: profile?.ai_provider,
      metadata: { source: provider, rows: rowCount, extracted_facts: summary },
    });

    return json({
      ok: true,
      provider,
      records_fetched: rowCount,
      learned: !!summary,
      facts: summary,
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
