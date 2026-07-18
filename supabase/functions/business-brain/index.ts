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
import { callGateway } from "../_shared/ai-gateway.ts";

async function callAI(provider: string, systemPrompt: string, prompt: string, maxTokens = 1400): Promise<string> {
  const callers: Record<string, (s: string, p: string) => Promise<{ ok: boolean; status: number; value: string }>> = {
    openai: async (s, p) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: s }, { role: "user", content: p }], temperature: 0.5, max_tokens: maxTokens }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).choices[0].message.content };
    },
    gemini: async (s, p) => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_instruction: { parts: [{ text: s }] }, contents: [{ parts: [{ text: p }] }], generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens } }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).candidates[0].content.parts[0].text };
    },
    anthropic: async (s, p) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: maxTokens, system: s, messages: [{ role: "user", content: p }] }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).content[0].text };
    },
  };
  // Vercel AI Gateway is OpenAI-compatible and routes to any provider/model
  if (provider === "vercel_gateway") {
    return withRetry(() => callGateway(systemPrompt, prompt), 2, 600);
  }
  return withRetry(() => callers[provider || "openai"](systemPrompt, prompt), 2, 600);
}

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
    supabase.from("integrations").select("provider,label,status,metadata,last_synced_at").eq("user_id", userId).eq("status", "connected"),
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
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase.from("profiles").select("ai_provider, api_usage_count, api_usage_limit, trial_ends_at").eq("id", user.id).single();
    const onTrial = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
    const limit = onTrial ? Math.max(profile.api_usage_limit, 500) : profile?.api_usage_limit || 50;
    if (profile && profile.api_usage_count >= limit) return json({ error: "Usage limit reached" }, 429);

    const body = await req.json();
    const mode = body.mode || "learn";
    const provider = profile?.ai_provider || "openai";
    const snap = await gatherSnapshot(supabase, user.id);

    // Owner-learned preferences injected into every prompt
    const learned = snap.recentCorrections.length
      ? `\n\nLEARNED FROM OWNER FEEDBACK (apply these preferences):\n${snap.recentCorrections.map((c: any) => `- ${c.context ? c.context + " → " : ""}${c.correction}`).join("\n")}`
      : "";

    let result: string;
    let extras: Record<string, unknown> = {};

    if (mode === "correct") {
      // Store a correction for future learning (no AI call needed)
      const { category, context, correction } = body;
      if (!correction) return json({ error: "correction is required" }, 400);
      const { data, error: e } = await supabase.from("ai_corrections").insert({
        user_id: user.id, category: category || "prediction",
        context: context || null, correction,
      }).select().single();
      if (e) return json({ error: e.message }, 500);
      return json({ ok: true, correction: data });
    }

    if (mode === "learn") {
      const manualNotes = body.manual_notes ? `\n\nOWNER-PROVIDED NOTES ABOUT THE BUSINESS:\n${body.manual_notes}` : "";
      const integrationList = snap.integrations.length
        ? `\n\nCONNECTED DATA SOURCES: ${snap.integrations.map((i: any) => `${i.provider}${i.metadata?.connected_email ? ` (${i.metadata.connected_email})` : ""}`).join(", ")}`
        : "";
      const sys = `You are the business-learning brain for a retail shop owner. Synthesize a concise but rich "About My Business" summary from their data${learned}. 
Return ONLY valid JSON: {"business_type":"one short phrase","summary":"3-5 sentence overview of what the business is, what it sells, who its customers are, and how it's doing","key_facts":[{"fact":"...","source":"data|owner|integrations","confidence":"high|medium|low"}]}.
Key facts should be specific, useful, and actionable (e.g. "Top product is X", "60% of customers are dormant", "Margin averages Y%"). No markdown.`;
      const prompt = `Business data snapshot:\n${JSON.stringify({ ...snap, existingMemory: snap.existingMemory?.summary }, null, 1)}${manualNotes}${integrationList}`;
      result = await callAI(provider, sys, prompt, 1000);

      // Parse + persist the memory
      const cleaned = result.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      try {
        const parsed = JSON.parse(cleaned);
        const upsert = {
          user_id: user.id,
          summary: parsed.summary,
          business_type: parsed.business_type,
          key_facts: parsed.key_facts || [],
          preferences: snap.existingMemory?.preferences || {},
          last_updated_at: new Date().toISOString(),
        };
        const { data: mem } = await supabase.from("business_memory").upsert(upsert, { onConflict: "user_id" }).select().single();
        extras.memory = mem;
      } catch { /* keep raw result if parse fails */ }

      await supabase.rpc("increment_api_usage", { user_uuid: user.id });
      await supabase.from("activity_logs").insert({ user_id: user.id, action_type: "summary", description: "AI learned about the business", time_saved_minutes: 20, money_saved: 10, provider });
      return json({ result, ...extras });
    }

    if (mode === "predict") {
      const sys = `You are a proactive business assistant. Based on the business data${learned}, propose 3-6 specific actions the owner should take. These are PREDICTIONS — the owner will approve or deny each before anything happens. 
Return ONLY valid JSON: {"predictions":[{"prediction_type":"reorder|followup|invoice|offer|alert|expense|custom","title":"short action title","description":"what to do","rationale":"why (based on the data)","priority":"low|medium|high|urgent"}]}.
Base each prediction on real signals in the data (low stock, dormant customers, overdue payments, trends). Do NOT propose generic advice — be specific with names and numbers.`;
      const prompt = `Business data snapshot:\n${JSON.stringify(snap, null, 1)}`;
      result = await callAI(provider, sys, prompt, 1200);

      // Parse + insert predictions as pending
      const cleaned = result.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      let inserted: any[] = [];
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed.predictions) && parsed.predictions.length) {
          const rows = parsed.predictions.map((p: any) => ({
            user_id: user.id,
            prediction_type: p.prediction_type || "custom",
            title: String(p.title || "Suggested task").slice(0, 200),
            description: p.description || null,
            rationale: p.rationale || null,
            priority: ["low", "medium", "high", "urgent"].includes(p.priority) ? p.priority : "medium",
            status: "pending",
            action_payload: {},
          }));
          const { data } = await supabase.from("ai_predictions").insert(rows).select();
          inserted = data || [];
        }
      } catch { /* keep raw */ }

      await supabase.rpc("increment_api_usage", { user_uuid: user.id });
      await supabase.from("activity_logs").insert({ user_id: user.id, action_type: "summary", description: `AI predicted ${inserted.length} tasks`, time_saved_minutes: 15, money_saved: 8, provider });
      return json({ result, predictions: inserted });
    }

    return json({ error: "Unknown mode. Use learn | predict | correct." }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
