// ════════════════════════════════════════════════════════════════
// DAILY BRAIN (cron) — runs every morning for every active user:
//   1. Optionally syncs connected Google sources
//   2. Generates fresh predictions (pending owner approval)
//   3. Sends a morning-briefing email if the user opted in
//
// Schedule via Supabase pg_cron (see schema-v7.sql):
//   SELECT cron.schedule('daily-brain', '0 7 * * *', $$...$$);
//
// Or trigger manually:
//   curl -X POST .../daily-brain -H "Authorization: Bearer <service-role>"
//
// Deploy:  supabase functions deploy daily-brain
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { releaseApiUsage } from "../_shared/usage.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";
import { refreshGoogleToken, fetchGmail } from "../_shared/google.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// AI calls now go through _shared/ai-call.ts (Groq primary + Gemini fallback — identical to Meraj chat).

async function gatherSnapshot(userId: string) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString();

  const [products, customers, todayTx, suppliers, lowStock, dormant, corrections, pendingPreds] = await Promise.all([
    supabase.from("products").select("name,stock_quantity,low_stock_threshold").eq("user_id", userId).limit(60),
    supabase.from("customers").select("name,total_spent,total_orders,last_purchase_at").eq("user_id", userId).limit(40),
    supabase.from("transactions").select("total,items").eq("user_id", userId).eq("status", "completed").gte("created_at", startToday).limit(50),
    supabase.from("suppliers").select("name,outstanding").eq("user_id", userId).limit(20),
    supabase.from("products").select("name,stock_quantity,low_stock_threshold").eq("user_id", userId),
    supabase.from("customers").select("name,total_orders,last_purchase_at").eq("user_id", userId).lt("last_purchase_at", sixtyDaysAgo).limit(20),
    supabase.from("ai_corrections").select("correction").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
    supabase.from("ai_predictions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending"),
  ]);

  const lowStockItems = (lowStock.data || []).filter((p: any) => p.stock_quantity <= p.low_stock_threshold);
  const todayRevenue = (todayTx.data || []).reduce((s: number, t: any) => s + Number(t.total), 0);

  return {
    todayRevenue, todayOrders: (todayTx.data || []).length,
    lowStock: lowStockItems,
    dormantCustomers: dormant.data,
    suppliersOwed: (suppliers.data || []).filter((s: any) => s.outstanding > 0),
    productsCount: (products.data || []).length,
    customersCount: (customers.data || []).length,
    existingPending: pendingPreds.count || 0,
    recentCorrections: corrections.data || [],
  };
}

async function deliverBriefing(to: string, subject: string, markdown: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return false;
  const html = markdown.replace(/\n/g, "<br>");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  // Service-role invocation only (from pg_cron or a trusted operator).
  // Do not decode an unverified JWT payload: a forged token with role=service_role
  // would otherwise be accepted because this function has verify_jwt=false.
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expectedKey || bearer !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized — service-role only" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid JSON body" }, 400);
    const singleUser = body.user_id == null ? null : String(body.user_id); // optionally process one user only
    if (singleUser && !/^[0-9a-f-]{36}$/i.test(singleUser)) return json({ error: "user_id is invalid" }, 400);
    if (body.opted_in_only !== undefined && typeof body.opted_in_only !== "boolean") return json({ error: "opted_in_only is invalid" }, 400);

    // Pull all users who have opted into the daily briefing (or all active users)
    let query = supabase.from("profiles")
      .select("id, full_name, ai_provider, business_address")
      .eq("role", "owner")
      .is("business_owner_id", null);
    if (body.opted_in_only !== false) {
      // Default: only users with briefing enabled. If the column doesn't exist yet,
      // fall back to all users.
      query = query.or("daily_briefing.eq.true");
    }
    if (singleUser) query = query.eq("id", singleUser);
    const { data: users } = await query;
    if (!users || users.length === 0) {
      // An empty opt-in set is a valid no-op. Never fall back to mailing every
      // account when nobody has opted in.
      return json({ processed: 0, predictionsCreated: 0, emailsSent: 0 });
    }

    let processed = 0;
    let predictionsTotal = 0;
    let emailsSent = 0;

    for (const user of users) {
      let predictionReserved = false;
      let predictionConsumed = false;
      let briefingReserved = false;
      let briefingConsumed = false;
      try {
        const { data: reserved, error: reserveError } = await supabase.rpc("reserve_api_usage", { p_user_id: user.id, p_amount: 1 });
        if (reserveError || !reserved) {
          console.error(`daily-brain usage reservation failed for ${user.id}`);
          continue;
        }
        predictionReserved = true;
        const snap = await gatherSnapshot(user.id);
        const learned = snap.recentCorrections.length
          ? `\n\nLEARNED PREFERENCES:\n${snap.recentCorrections.map((c: any) => `- ${String(c.correction || "").slice(0, 500)}`).join("\n")}`
          : "";

        // 1. Generate predictions (pending approval)
        const sys = `You are a proactive retail business assistant. Based on the snapshot${learned}, propose 3-5 specific actions. Return ONLY JSON: {"predictions":[{"prediction_type":"reorder|followup|invoice|offer|alert","title":"...","description":"...","rationale":"...","priority":"low|medium|high|urgent"}]}. Be specific with names and numbers.`;
        const prompt = `Daily snapshot for ${String(user.full_name || "the owner").slice(0, 120)}:\n${JSON.stringify(snap, null, 1).slice(0, 50_000)}`;
        const result = await callAIWithFallback(user.ai_provider || "openai", sys, prompt, 2500, "daily-brain-predictions");
        predictionConsumed = true;

        let predsCreated = 0;
        try {
          const cleaned = result.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed.predictions) && parsed.predictions.length) {
            const rows = parsed.predictions.slice(0, 20).map((p: any) => ({
              user_id: user.id,
              prediction_type: ["reorder", "followup", "invoice", "offer", "alert", "custom"].includes(p.prediction_type) ? p.prediction_type : "custom",
              title: String(p.title || "Task").slice(0, 200),
              description: typeof p.description === "string" ? p.description.slice(0, 2_000) : null,
              rationale: typeof p.rationale === "string" ? p.rationale.slice(0, 2_000) : null,
              priority: ["low", "medium", "high", "urgent"].includes(p.priority) ? p.priority : "medium",
              status: "pending", action_payload: {},
            }));
            const { data: inserted } = await supabase.from("ai_predictions").insert(rows).select();
            predsCreated = inserted?.length || 0;
            predictionsTotal += predsCreated;
          }
        } catch { /* prediction response was already consumed; keep the user batch moving */ }

        // 2. Morning briefing email (if Resend configured + user opted in / has email)
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        const email = authUser?.user?.email;
        const optedIn = (user as any).daily_briefing !== false;

        if (email && optedIn && Deno.env.get("RESEND_API_KEY") && Deno.env.get("MAIL_FROM")) {
          const { data: briefingReservation, error: briefingReservationError } = await supabase.rpc("reserve_api_usage", { p_user_id: user.id, p_amount: 1 });
          if (briefingReservationError || !briefingReservation) {
            console.error(`daily-brain briefing reservation failed for ${user.id}`);
          } else {
            briefingReserved = true;
            const briefing = await callAIWithFallback(user.ai_provider || "openai",
              "Write a concise, friendly morning briefing for a shop owner. Use markdown with short bullets and bold headings. Keep it under 150 words.",
              `Snapshot:\n${JSON.stringify({ todayRevenue: snap.todayRevenue, todayOrders: snap.todayOrders, lowStockCount: snap.lowStock.length, dormantCount: snap.dormantCustomers.length, suppliersOwedCount: snap.suppliersOwed.length, newPredictions: predsCreated })}\n\nBe encouraging and specific.`,
              500,
              "daily-brain-briefing",
            );
            briefingConsumed = true;
            const sent = await deliverBriefing(email, "🌅 Your Cashiea Morning Briefing", briefing);
            if (sent) emailsSent++;
          }
        }

        processed++;
      } catch (err) {
        // One user failing shouldn't abort the batch.
        console.error(`daily-brain failed for ${user.id}:`, err instanceof Error ? err.message : String(err));
      } finally {
        if (predictionReserved && !predictionConsumed) await releaseApiUsage(supabase, user.id);
        if (briefingReserved && !briefingConsumed) await releaseApiUsage(supabase, user.id);
      }
    }

    return json({ processed, predictionsCreated: predictionsTotal, emailsSent });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
