// ════════════════════════════════════════════════════════════════
// BUSINESS BRAIN — the AI that learns your business & predicts tasks.
//
// Three modes (passed via { mode }):
//   - "learn"  : (re)build the "About My Business" summary from data +
//                integrations + manual notes
//   - "predict": scan the business + produce predictions that wait for
//                the owner to APPROVE or DENY (never auto-execute)
//   - "correct": store an owner correction so future runs adapt
//
// Learning: recent ai_corrections are injected into the prompt so the
// AI adjusts its behavior over time.
//
// Deploy:  supabase functions deploy business-brain
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, corsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";
import { resolveBusiness } from "../_shared/business.ts";
import { releaseApiUsage } from "../_shared/usage.ts";

// AI calls now go through _shared/ai-call.ts (Groq primary + Gemini fallback — identical to Meraj chat).

// ─── Gather a snapshot of the business ──────────────────────────
async function gatherSnapshot(supabase: any, userId: string) {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString();

  const [profile, products, customers, monthTx, suppliers, expenses, integrations, lowStock, dormant, memory, corrections] = await Promise.all([
    supabase.from("profiles").select("company_name, business_type, gstin, ai_provider").eq("id", userId).single(),
    supabase.from("products").select("name,sku,category,price,cost,stock_quantity,low_stock_threshold").eq("user_id", userId).limit(80),
    supabase.from("customers").select("name,total_spent,total_orders,last_purchase_at").eq("user_id", userId).limit(60),
    supabase.from("transactions").select("total,items,created_at,payment_method").eq("user_id", userId).eq("status", "completed").gte("created_at", startMonth).limit(200),
    supabase.from("suppliers").select("name,outstanding").eq("user_id", userId).limit(30),
    supabase.from("expenses").select("type,category,amount,date").eq("user_id", userId).gte("date", startMonth).limit(100),
    supabase.from("integrations").select("provider,label,status,last_synced_at").eq("user_id", userId).eq("status", "connected"),
    supabase.from("products").select("name,stock_quantity,low_stock_threshold").eq("user_id", userId),
    supabase.from("customers").select("name,total_orders,last_purchase_at").eq("user_id", userId).lt("last_purchase_at", sixtyDaysAgo).limit(30),
    supabase.from("business_memory").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("ai_corrections").select("category,context,correction").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
  ]);

  const lowStockItems = (lowStock.data || []).filter((p: any) => p.stock_quantity <= p.low_stock_threshold);
  const monthExpenses = (expenses.data || []).filter((e: any) => e.type === "expense").reduce((s: number, e: any) => s + Number(e.amount), 0);
  const monthRevenue = (monthTx.data || []).reduce((s: number, t: any) => s + Number(t.total), 0);

  return {
    profile: profile.data,
    products: products.data,
    customers: customers.data,
    suppliers: suppliers.data,
    integrations: integrations.data,
    monthRevenue, monthExpenses,
    monthProfit: monthRevenue - monthExpenses,
    lowStock: lowStockItems,
    dormantCustomers: dormant.data,
    existingMemory: memory.data,
    // Recent corrections = the AI's accumulated learning
    recentCorrections: corrections.data || [],
    correctionsCount: (corrections.data || []).length,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 100_000) return json({ error: "Request is too large" }, 413);
  let usageReserved = false;
  let usageConsumed = false;
  let usageOwner = "";
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const business = await resolveBusiness(service, user.id);
    if (!business) return json({ error: "Your account is not linked to exactly one active business" }, 403);
    const { ownerId, isOwner } = business;
    usageOwner = ownerId;
    const { data: profile, error: profileError } = await service
      .from("profiles")
      .select("ai_provider, company_name, full_name")
      .eq("id", ownerId).maybeSingle();
    if (profileError || !profile) return json({ error: "Could not load business profile" }, 503);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid JSON body" }, 400);
    const mode = typeof body.mode === "string" ? body.mode : "learn";
    if (!["learn", "predict", "correct"].includes(mode)) return json({ error: "Unknown mode. Use learn | predict | correct." }, 400);
    if (mode === "learn" && !isOwner) return json({ error: "Only the business owner can update Meraj's business memory" }, 403);
    if (mode === "predict" && !isOwner) return json({ error: "Only the business owner can generate AI predictions" }, 403);
    if (mode === "correct" && !isOwner) return json({ error: "Only the business owner can correct Meraj" }, 403);
    if (mode !== "correct") {
      const { data: reserved, error: reserveError } = await service.rpc("reserve_api_usage", { p_user_id: ownerId, p_amount: 1 });
      if (reserveError) return json({ error: "AI usage service is unavailable; deploy schema v27 first" }, 503);
      if (!reserved) return json({ error: "Usage limit reached" }, 429);
      usageReserved = true;
    }
    const provider = profile.ai_provider || "groq";
    const snap = await gatherSnapshot(service, ownerId);

    // Owner-learned preferences injected into every prompt
    const learned = snap.recentCorrections.length
      ? `\n\nLEARNED FROM OWNER FEEDBACK (apply these preferences):\n${snap.recentCorrections.map((c: any) => `- ${c.context ? c.context + " → " : ""}${c.correction}`).join("\n")}`
      : "";

    let result: string;
    let extras: Record<string, unknown> = {};

    if (mode === "correct") {
      // Store a correction for future learning (no AI call needed)
      const { category, context, correction } = body;
      if (typeof correction !== "string" || !correction.trim() || correction.length > 2000) return json({ error: "correction is required and must be under 2,000 characters" }, 400);
      const safeCategory = typeof category === "string" && ["prediction", "summary", "output"].includes(category) ? category : "prediction";
      const safeContext = typeof context === "string" ? context.slice(0, 2000) : null;
      const { data, error: e } = await service.from("ai_corrections").insert({
        user_id: ownerId, category: safeCategory,
        context: safeContext, correction: correction.trim(),
      }).select().single();
      if (e) return json({ error: e.message }, 500);
      return json({ ok: true, correction: data });
    }

    if (mode === "learn") {
      const manualNotes = typeof body.manual_notes === "string" && body.manual_notes.trim()
        ? `\n\nOWNER-PROVIDED NOTES ABOUT THE BUSINESS:\n${body.manual_notes.trim().slice(0, 5_000)}`
        : "";
      const integrationList = snap.integrations.length
        ? `\n\nCONNECTED DATA SOURCES: ${snap.integrations.map((i: any) => `${i.provider}${i.metadata?.connected_email ? ` (${i.metadata.connected_email})` : ""}`).join(", ")}`
        : "";
      const sys = `You are the business-learning brain for a retail shop owner. Synthesize a concise but rich "About My Business" summary from their data${learned}. 
Return ONLY valid JSON: {"business_type":"one short phrase","summary":"3-5 sentence overview of what the business is, what it sells, who its customers are, and how it's doing","key_facts":[{"fact":"...","source":"data|owner|integrations","confidence":"high|medium|low"}]}.
Key facts should be specific, useful, and actionable (e.g. "Top product is X", "60% of customers are dormant", "Margin averages Y%"). No markdown.`;
      const prompt = `Business data snapshot:\n${JSON.stringify({ ...snap, existingMemory: snap.existingMemory?.summary }, null, 1)}${manualNotes}${integrationList}`;
      result = await callAIWithFallback(provider, sys, prompt, 2500);
      usageConsumed = true;

      // Parse + persist the memory
      const cleaned = result.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        const keyFacts = Array.isArray(parsed.key_facts)
          ? parsed.key_facts.slice(0, 40).map((fact: any) => ({
              fact: String(fact?.fact || fact || "").slice(0, 300),
              source: ["data", "owner", "integrations"].includes(fact?.source) ? fact.source : "data",
              confidence: ["high", "medium", "low"].includes(fact?.confidence) ? fact.confidence : "medium",
            })).filter((fact: any) => fact.fact)
          : [];
        const upsert = {
          user_id: ownerId,
          summary: String(parsed.summary || "").slice(0, 4_000),
          business_type: String(parsed.business_type || "retail").slice(0, 120),
          key_facts: keyFacts,
          preferences: snap.existingMemory?.preferences || {},
          last_updated_at: new Date().toISOString(),
        };
        const { data: mem } = await service.from("business_memory").upsert(upsert, { onConflict: "user_id" }).select().single();
        extras.memory = mem;
      } catch { /* keep raw result if parse fails */ }

      await service.from("activity_logs").insert({ user_id: ownerId, action_type: "summary", description: "AI learned about the business", time_saved_minutes: 20, money_saved: 10, provider });
      return json({ result, ...extras });
    }

    if (mode === "predict") {
      const sys = `You are a proactive business assistant. Based on the business data${learned}, propose 3-6 specific actions the owner should take. These are PREDICTIONS — the owner will approve or deny each before anything happens. 
Return ONLY valid JSON: {"predictions":[{"prediction_type":"reorder|followup|invoice|offer|alert|expense|custom","title":"short action title","description":"what to do","rationale":"why (based on the data)","priority":"low|medium|high|urgent"}]}.
Base each prediction on real signals in the data (low stock, dormant customers, overdue payments, trends). Do NOT propose generic advice — be specific with names and numbers.`;
      const prompt = `Business data snapshot:\n${JSON.stringify(snap, null, 1)}`;
      result = await callAIWithFallback(provider, sys, prompt, 2500);
      usageConsumed = true;

      // Parse + insert predictions as pending
      const cleaned = result.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      let inserted: any[] = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.predictions) && parsed.predictions.length) {
          const rows = parsed.predictions.slice(0, 20).map((p: any) => ({
            user_id: ownerId,
            prediction_type: ["reorder", "followup", "invoice", "offer", "alert", "expense", "custom"].includes(p.prediction_type) ? p.prediction_type : "custom",
            title: String(p.title || "Suggested task").slice(0, 200),
            description: typeof p.description === "string" ? p.description.slice(0, 2000) : null,
            rationale: typeof p.rationale === "string" ? p.rationale.slice(0, 2000) : null,
            priority: ["low", "medium", "high", "urgent"].includes(p.priority) ? p.priority : "medium",
            status: "pending",
            action_payload: {},
          }));
          const { data } = await service.from("ai_predictions").insert(rows).select();
          inserted = data || [];
        }
      } catch { /* keep raw */ }

      await service.from("activity_logs").insert({ user_id: ownerId, action_type: "summary", description: `AI predicted ${inserted.length} tasks`, time_saved_minutes: 15, money_saved: 8, provider });
      return json({ result, predictions: inserted });
    }

  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  } finally {
    if (usageReserved && !usageConsumed) await releaseApiUsage(
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
      usageOwner,
    );
  }
});
