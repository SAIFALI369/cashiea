// ════════════════════════════════════════════════════════════════
// QUICK TASKS — the one-click automation engine behind the Quick-Action Bar.
// Each mode is a feature the owner picks (or describes in their own words):
//   - low_stock_alert   : scan inventory, list low-stock items + suggest reorders
//   - daily_closing     : today's sales summary + SMS/WhatsApp-ready text
//   - hindi_bot         : reply to a customer message in Hinglish (Hindi+English in Roman script)
//   - gst_invoice_voice : take a spoken/typed description, generate a GST invoice
//   - custom            : free-form — the AI assistant routes it
//
// Called from the Quick-Action Bar UI. All tasks confirm with the owner
// before doing anything that sends a message.
//
// Deploy:  supabase functions deploy quick-tasks
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRetry, corsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";

// AI calls now go through _shared/ai-call.ts (Groq primary + Gemini fallback — identical to Meraj chat).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase.from("profiles").select("ai_provider, api_usage_count, api_usage_limit, trial_ends_at, company_name, full_name, gstin, upi_id").eq("id", user.id).single();
    const onTrial = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
    const limit = onTrial ? Math.max(profile.api_usage_limit, 500) : profile?.api_usage_limit || 50;
    if (profile && profile.api_usage_count >= limit) return json({ error: "Usage limit reached" }, 429);

    const body = await req.json();
    const mode = body.mode;
    const provider = profile?.ai_provider || "openai";
    const userText = (body.text || "").trim();
    let result = "";
    let meta: Record<string, unknown> = {};

    // ─── Helper to grab data for a given IST day (defaults to today) ──
    // target_date lets owners rerun daily_closing for a past date.
    const targetDate = body.target_date || null;
    const dayStart = targetDate
      ? new Date(targetDate + "T00:00:00+05:30").toISOString()
      : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const dayEnd = targetDate
      ? new Date(targetDate + "T23:59:59+05:30").toISOString()
      : new Date().toISOString();
    let txQuery = supabase.from("transactions").select("total,items,payment_method").eq("user_id", user.id).eq("status", "completed").gte("created_at", dayStart);
    if (targetDate) txQuery = txQuery.lte("created_at", dayEnd);
    const { data: todayTx } = await txQuery;
    const { data: allProducts } = await supabase.from("products").select("name,sku,stock_quantity,low_stock_threshold,price,cost").eq("user_id", user.id);

    if (mode === "low_stock_alert") {
      const low = (allProducts || []).filter((p) => p.stock_quantity <= p.low_stock_threshold);
      meta = { count: low.length, items: low.map((p) => ({ name: p.name, stock: p.stock_quantity, threshold: p.low_stock_threshold })) };
      if (low.length === 0) {
        result = "✅ All products are well stocked. No reorders needed right now.";
      } else {
        result = await callAIWithFallback(provider, `You are a retail inventory assistant for a shop in India. Write a clear low-stock alert in friendly Hinglish (Hindi+English mixed in Roman script). Use bullet points. Suggest reorder quantities based on the gap. Sign off as the shop's AI assistant.`,
          `Low-stock items:\n${JSON.stringify(low, null, 1)}`, 600);
      }
    }

    else if (mode === "daily_closing") {
      const revenue = (todayTx || []).reduce((s, t) => s + Number(t.total), 0);
      const itemCount = (todayTx || []).reduce((s, t) => s + (t.items?.length || 0), 0);
      const byMethod: Record<string, number> = {};
      (todayTx || []).forEach((t) => { byMethod[t.payment_method] = (byMethod[t.payment_method] || 0) + Number(t.total); });
      meta = { revenue, orders: (todayTx || []).length, itemCount, byMethod };
      result = await callAIWithFallback(provider,
        `Generate a clean DAILY CLOSING REPORT for an Indian retail shop. Be warm, professional, and concise. Format with clear sections. End with a one-line summary. Use ₹ symbol.`,
        `Target date: ${targetDate || 'today'} data:\n- Total revenue: ₹${revenue.toFixed(2)}\n- Orders: ${(todayTx || []).length}\n- Items sold: ${itemCount}\n- By payment method: ${JSON.stringify(byMethod)}\n- Shop name: ${profile?.company_name || profile?.full_name || 'My Shop'}`,
        500);
    }

    else if (mode === "hindi_bot") {
      if (!userText) return json({ error: "Paste the customer's message to reply to" }, 400);
      result = await callAIWithFallback(provider,
        `You are a friendly Hinglish WhatsApp assistant for an Indian retail shop. Hinglish = Hindi + English mixed in Roman script (e.g. "Namaste! Aapka order ready hai, please collect kar lijiye."). Reply warmly and naturally to the customer. Keep replies short (2-4 lines) — perfect for WhatsApp. Use emojis sparingly. Sign off as the shop.`,
        `Customer's message: "${userText}"\n\nShop name: ${profile?.company_name || 'My Shop'}\n\nWrite a helpful Hinglish reply:`,
        300);
    }

    else if (mode === "gst_invoice_voice") {
      // userText is the spoken/typed invoice description
      if (!userText) return json({ error: "Describe the sale (by voice or text) first" }, 400);
      const aiOut = await callAIWithFallback(provider,
        `You are a GST billing assistant for an Indian shop. Parse the sale description and return ONLY valid JSON: {"customer_name","customer_phone","items":[{"description","quantity","unit_price"}],"tax_rate" (use 18 for most, 5 for essentials, 0 for unbranded), "notes"}. Calculate subtotal, tax_amount, total in INR. If the spoken amount sounds like rupees, treat it as ₹.`,
        `Description: "${userText}"\nShop GSTIN: ${profile?.gstin || 'not set'}`, 700);
      meta.raw = aiOut;
      // Try to parse + create the invoice
      try {
        const cleaned = aiOut.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleaned);
        const items = parsed.items || [];
        const subtotal = items.reduce((s: number, it: any) => s + (it.quantity || 0) * (it.unit_price || 0), 0);
        const taxRate = parsed.tax_rate || 0;
        const taxAmount = (subtotal * taxRate) / 100;
        const total = subtotal + taxAmount;
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
        const { data: invoice } = await supabase.from("invoices").insert({
          user_id: user.id, invoice_number: invoiceNumber,
          client_name: parsed.customer_name || "Customer", client_phone: parsed.customer_phone || null,
          items, subtotal, tax_rate: taxRate, tax_amount: taxAmount, total, status: "sent",
          notes: parsed.notes || `Voice: ${userText.slice(0, 100)}`,
        }).select().single();
        meta.invoice = invoice;
        result = `🧾 GST Invoice ${invoiceNumber} created!\nCustomer: ${parsed.customer_name || "Customer"}\nItems: ${items.length}\nTax (${taxRate}%): ₹${taxAmount.toFixed(2)}\nTotal: ₹${total.toFixed(2)}`;
      } catch {
        result = `I heard: "${userText}"\n\nRaw AI output:\n${aiOut}`;
      }
    }

    else if (mode === "custom") {
      if (!userText) return json({ error: "Tell me what you want to do" }, 400);
      // Free-form: route through the AI assistant-style reasoning
      const snapshot = {
        todayRevenue: (todayTx || []).reduce((s, t) => s + Number(t.total), 0),
        todayOrders: (todayTx || []).length,
        lowStock: (allProducts || []).filter((p) => p.stock_quantity <= p.low_stock_threshold).map((p) => p.name),
        shop: profile?.company_name || profile?.full_name,
      };
      result = await callAIWithFallback(provider,
        `You are a helpful retail business assistant for an Indian shop owner. Answer their request clearly in Hinglish (Hindi+English mixed in Roman script) or English — match their language. Be concise and actionable.`,
        `Owner request: "${userText}"\n\nShop context: ${JSON.stringify(snapshot)}`, 800);
    }

    else return json({ error: "Unknown mode. Use low_stock_alert | daily_closing | hindi_bot | gst_invoice_voice | custom" }, 400);

    await supabase.rpc("increment_api_usage", { user_uuid: user.id });
    await supabase.from("activity_logs").insert({
      user_id: user.id, action_type: "summary",
      description: `Quick task: ${mode}${userText ? ` — ${userText.slice(0, 50)}` : ""}`,
      time_saved_minutes: 8, money_saved: 5, provider,
      metadata: meta,
    });

    return json({ result, mode, meta });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
