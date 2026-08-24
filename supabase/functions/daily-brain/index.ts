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
import { withRetry } from "../_shared/retry.ts";
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
  // Service-role invocation only (from pg_cron or manual trigger).
  // Accepts a service_role JWT (cron sends the project service-role key) OR the
  // service-role key via suffix match — robust across legacy-JWT and new key formats.
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  let isServiceRole = false;
  try { isServiceRole = JSON.parse(atob(bearer.split(".")[1]))?.role === "service_role"; } catch { /* not a JWT */ }
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!isServiceRole && (!expectedKey || !authHeader.endsWith(expectedKey))) {
    return new Response(JSON.stringify({ error: "Unauthorized — service-role only" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const singleUser = body.user_id; // optionally process one user only

    // Pull all users who have opted into the daily briefing (or all active users)
    let query = supabase.from("profiles").select("id, full_name, ai_provider, business_address");
    if (body.opted_in_only !== false) {
      // Default: only users with briefing enabled. If the column doesn't exist yet,
      // fall back to all users.
      query = query.or("daily_briefing.eq.true");
    }
    if (singleUser) query = query.eq("id", singleUser);
    const { data: users } = await query;
    if (!users || users.length === 0) {
      // Fallback: process all users if the opted-in filter returned nothing
      const { data: all } = await supabase.from("profiles").select("id, full_name, ai_provider");
      if (!all || all.length === 0) return new Response(JSON.stringify({ processed: 0 }), { headers: { "Content-Type": "application/json" } });
      users.push(...all);
    }

    let processed = 0;
    let predictionsTotal = 0;
    let emailsSent = 0;

    for (const user of users) {
      try {
        const snap = await gatherSnapshot(user.id);
        const learned = snap.recentCorrections.length
          ? `\n\nLEARNED PREFERENCES:\n${snap.recentCorrections.map((c: any) => `- ${c.correction}`).join("\n")}`
          : "";

        // 1. Generate predictions (pending approval)
        const sys = `You are a proactive retail business assistant. Based on the snapshot${learned}, propose 3-5 specific actions. Return ONLY JSON: {"predictions":[{"prediction_type":"reorder|followup|invoice|offer|alert","title":"...","description":"...","rationale":"...","priority":"low|medium|high|urgent"}]}. Be specific with names and numbers.`;
        const prompt = `Daily snapshot for ${user.full_name || "the owner"}:\n${JSON.stringify(snap, null, 1)}`;
        const result = await callAIWithFallback(user.ai_provider || "openai", sys, prompt, 900);

        let predsCreated = 0;
        try {
          const cleaned = result.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed.predictions) && parsed.predictions.length) {
            const rows = parsed.predictions.map((p: any) => ({
              user_id: user.id, prediction_type: p.prediction_type || "custom",
              title: String(p.title || "Task").slice(0, 200), description: p.description || null,
              rationale: p.rationale || null,
              priority: ["low", "medium", "high", "urgent"].includes(p.priority) ? p.priority : "medium",
              status: "pending", action_payload: {},
            }));
            const { data: inserted } = await supabase.from("ai_predictions").insert(rows).select();
            predsCreated = inserted?.length || 0;
            predictionsTotal += predsCreated;
          }
        } catch { /* keep going */ }

        // 2. Morning briefing email (if Resend configured + user opted in / has email)
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        const email = authUser?.user?.email;
        const optedIn = (user as any).daily_briefing !== false; // default on unless explicitly off

        if (email && optedIn) {
          const briefing = await callAIWithFallback(user.ai_provider || "openai",
            "Write a concise, friendly morning briefing for a shop owner. Use markdown with short bullets and bold headings. Keep it under 150 words.",
            `Snapshot:\n${JSON.stringify({ todayRevenue: snap.todayRevenue, todayOrders: snap.todayOrders, lowStockCount: snap.lowStock.length, dormantCount: snap.dormantCustomers.length, suppliersOwedCount: snap.suppliersOwed.length, newPredictions: predsCreated })}\n\nBe encouraging and specific.`,
            500
          );
          const sent = await deliverBriefing(email, "🌅 Your Cashiea Morning Briefing", briefing);
          if (sent) emailsSent++;
        }

        await supabase.rpc("increment_api_usage", { user_uuid: user.id });
        processed++;
      } catch (err) {
        // One user failing shouldn't abort the batch
        console.error(`daily-brain failed for ${user.id}:`, err.message);
      }
    }

    return new Response(JSON.stringify({
      processed, predictionsCreated: predictionsTotal, emailsSent,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
