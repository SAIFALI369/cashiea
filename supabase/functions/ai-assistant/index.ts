// ════════════════════════════════════════════════════════════════
// AI ASSISTANT — Natural-language business command console.
// Gathers a snapshot of the user's business data, then lets the AI
// answer questions like "How was business today?", "Who bought
// cement last month?", "Which customers should I follow up?".
// Deploy:  supabase functions deploy ai-assistant
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, corsHeaders, json } from "../_shared/retry.ts";
import { callGateway } from "../_shared/ai-gateway.ts";

async function callAI(provider: string, systemPrompt: string, prompt: string): Promise<string> {
  const callers: Record<string, (s: string, p: string) => Promise<{ ok: boolean; status: number; value: string }>> = {
    openai: async (s, p) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: s }, { role: "user", content: p }], temperature: 0.5, max_tokens: 1200 }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).choices[0].message.content };
    },
    gemini: async (s, p) => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_instruction: { parts: [{ text: s }] }, contents: [{ parts: [{ text: p }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 1200 } }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).candidates[0].content.parts[0].text };
    },
    anthropic: async (s, p) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: 1200, system: s, messages: [{ role: "user", content: p }] }),
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

// Build a compact business snapshot for the AI to reason over
async function buildContext(supabase: any, userId: string): Promise<string> {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000).toISOString();

  const [todayTx, monthTx, products, customers, expenses, lowStock, dormant, suppliers] = await Promise.all([
    supabase.from("transactions").select("*").eq("user_id", userId).eq("status", "completed").gte("created_at", startToday),
    supabase.from("transactions").select("*").eq("user_id", userId).eq("status", "completed").gte("created_at", startMonth),
    supabase.from("products").select("name,sku,category,price,stock_quantity,low_stock_threshold").eq("user_id", userId).limit(100),
    supabase.from("customers").select("name,email,phone,total_spent,total_orders,last_purchase_at").eq("user_id", userId).limit(100),
    supabase.from("expenses").select("*").eq("user_id", userId).gte("date", startMonth),
    supabase.from("products").select("name,stock_quantity,low_stock_threshold").eq("user_id", userId).limit(50),
    supabase.from("customers").select("name,email,total_orders,last_purchase_at").eq("user_id", userId).lt("last_purchase_at", sixtyDaysAgo).limit(50),
    supabase.from("suppliers").select("name,outstanding").eq("user_id", userId).limit(30),
  ]);

  const today = todayTx.data || [];
  const month = monthTx.data || [];
  const todayRevenue = today.reduce((s, t) => s + Number(t.total), 0);
  const monthRevenue = month.reduce((s, t) => s + Number(t.total), 0);

  // Top products this month
  const prodMap: Record<string, { name: string; qty: number; rev: number }> = {};
  month.forEach((t) => (t.items || []).forEach((it) => {
    const k = it.product_id || it.name;
    if (!prodMap[k]) prodMap[k] = { name: it.name, qty: 0, rev: 0 };
    prodMap[k].qty += it.quantity; prodMap[k].rev += it.quantity * it.unit_price;
  }));
  const topProducts = Object.values(prodMap).sort((a, b) => b.rev - a.rev).slice(0, 10);

  const lowStockItems = (lowStock.data || []).filter((p) => p.stock_quantity <= p.low_stock_threshold).slice(0, 15);
  const monthExpenses = (expenses.data || []).filter((e) => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);
  const monthIncome = (expenses.data || []).filter((e) => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);

  return JSON.stringify({
    date: now.toISOString().split("T")[0],
    today: { revenue: +todayRevenue.toFixed(2), orders: today.length, payment_methods: today.reduce((m, t) => { m[t.payment_method] = (m[t.payment_method] || 0) + 1; return m; }, {}) },
    thisMonth: { revenue: +monthRevenue.toFixed(2), orders: month.length, expenses: +monthExpenses.toFixed(2), otherIncome: +monthIncome.toFixed(2) },
    monthProfit: +(monthRevenue - monthExpenses).toFixed(2),
    topProducts: topProducts.map((p) => ({ name: p.name, qty: p.qty, revenue: +p.rev.toFixed(2) })),
    lowStock: lowStockItems.map((p) => ({ name: p.name, stock: p.stock_quantity, reorderAt: p.low_stock_threshold })),
    dormantCustomers: (dormant.data || []).map((c) => ({ name: c.name, email: c.email, orders: c.total_orders, lastPurchase: c.last_purchase_at })),
    productCatalog: (products.data || []).slice(0, 40).map((p) => ({ name: p.name, sku: p.sku, category: p.category, price: p.price, stock: p.stock_quantity })),
    customers: (customers.data || []).slice(0, 40).map((c) => ({ name: c.name, email: c.email, phone: c.phone, spent: +Number(c.total_spent).toFixed(2), orders: c.total_orders, last: c.last_purchase_at })),
    suppliersOwed: (suppliers.data || []).filter((s) => s.outstanding > 0).map((s) => ({ name: s.name, outstanding: s.outstanding })),
  }, null, 1);
}

const SYSTEM = `You are Hostomate's retail business assistant. You receive a JSON snapshot of the shop owner's business data and answer their questions naturally and helpfully.

You can answer questions about: sales/revenue, profit, expenses, top products, slow products, low stock, customer history, dormant customers (for follow-up), suppliers owed, daily summaries, and trends.

Rules:
- Be concise and direct. Use short bullet points and numbers.
- When asked "how was business", give a quick daily briefing: revenue, orders, top items, anything needing attention (low stock, overdue follow-ups).
- If asked who bought a product, scan productCatalog + customers + topProducts.
- Suggest proactive actions (reorder stock, follow up dormant customers) when relevant.
- If the data isn't in the snapshot, say you don't have that specific record rather than guessing.
- Format with light markdown (## headings, **bold**, - bullets). Keep it scannable.`;

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

    const { message, briefing } = await req.json();
    const context = await buildContext(supabase, user.id);

    const userPrompt = briefing
      ? `Generate a concise MORNING BRIEFING for today based on this business snapshot. Include: a greeting, today's tasks (follow-ups, stock, payments due), and a quick status. Snapshot:\n${context}`
      : `Business owner asks: "${message}"\n\nHere is the current business data snapshot:\n${context}\n\nAnswer the owner's question based on this data.`;

    const result = await callAI(profile?.ai_provider || "openai", SYSTEM, userPrompt);

    await supabase.rpc("increment_api_usage", { user_uuid: user.id });
    await supabase.from("activity_logs").insert({
      user_id: user.id, action_type: "summary",
      description: briefing ? "AI briefing generated" : `AI: ${String(message).slice(0, 60)}`,
      time_saved_minutes: 10, money_saved: 5, provider: profile?.ai_provider,
    });

    return json({ reply: result });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
