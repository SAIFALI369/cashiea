// ════════════════════════════════════════════════════════════════
// QUICK TASKS — the one-click automation engine behind the Quick-Action Bar.
//
// Read-only reports/drafts are available to active business members. Creating
// an invoice is an owner-only action and is saved as a draft; sending remains a
// separate owner-controlled workflow.
//
// Deploy:  supabase functions deploy quick-tasks
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";
import { resolveBusiness } from "../_shared/business.ts";
import { releaseApiUsage } from "../_shared/usage.ts";

const MAX_TEXT = 8_000;
const MAX_MONEY = 1_000_000_000;
const MAX_QUANTITY = 1_000_000;
const MODES = ["low_stock_alert", "daily_closing", "hindi_bot", "gst_invoice_voice", "custom"] as const;

type QuickTaskMode = (typeof MODES)[number];

function finiteNumber(value: unknown, min: number, max: number): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

function dateBounds(targetDate: string | null): { start: string; end: string } {
  const date = targetDate || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  return {
    start: new Date(`${date}T00:00:00+05:30`).toISOString(),
    end: new Date(`${date}T23:59:59.999+05:30`).toISOString(),
  };
}

function parseInvoiceDraft(raw: string, sourceText: string, isInterstate = false): {
  customerName: string;
  customerPhone: string | null;
  items: Record<string, unknown>[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  isInterstate: boolean;
  hsnSummary: Record<string, unknown>[];
  notes: string | null;
} | null {
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const customerName = cleanText(parsed.customer_name, 200);
    if (!customerName || !Array.isArray(parsed.items) || parsed.items.length < 1 || parsed.items.length > 100) return null;

    const fallbackRate = finiteNumber(parsed.tax_rate ?? 0, 0, 100);
    if (fallbackRate === null) return null;
    const items: Record<string, unknown>[] = [];
    const groups = new Map<string, { hsn: string; rate: number; taxable: number; tax: number }>();
    let subtotal = 0;
    let taxAmount = 0;

    for (const source of parsed.items) {
      const description = cleanText(source?.description || source?.name, 200);
      const quantity = finiteNumber(source?.quantity ?? source?.qty, Number.EPSILON, MAX_QUANTITY);
      const unitPrice = finiteNumber(source?.unit_price, 0, MAX_MONEY);
      const rate = finiteNumber(source?.gst_rate ?? fallbackRate, 0, 100);
      if (!description || quantity === null || unitPrice === null || rate === null) return null;
      const taxable = quantity * unitPrice;
      const tax = taxable * rate / 100;
      const hsn = cleanText(source?.hsn_code, 20);
      subtotal += taxable;
      taxAmount += tax;
      const key = `${hsn}|${rate}`;
      const group = groups.get(key) || { hsn, rate, taxable: 0, tax: 0 };
      group.taxable += taxable;
      group.tax += tax;
      groups.set(key, group);
      items.push({ description, quantity, unit_price: unitPrice, gst_rate: rate, hsn_code: hsn || null });
    }

    subtotal = +subtotal.toFixed(2);
    taxAmount = +taxAmount.toFixed(2);
    const total = +(subtotal + taxAmount).toFixed(2);
    const taxRate = subtotal > 0 ? +(taxAmount / subtotal * 100).toFixed(2) : 0;
    const hsnSummary = Array.from(groups.values()).map((group) => ({
      hsn: group.hsn,
      rate: group.rate,
      taxable: +group.taxable.toFixed(2),
      cgst: isInterstate ? 0 : +(group.tax / 2).toFixed(2),
      sgst: isInterstate ? 0 : +(group.tax / 2).toFixed(2),
      igst: isInterstate ? +group.tax.toFixed(2) : 0,
    }));

    const phone = cleanText(parsed.customer_phone, 40);
    const notes = cleanText(parsed.notes, 1_000) || `Voice: ${sourceText.slice(0, 100)}`;
    return {
      customerName,
      customerPhone: phone || null,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      isInterstate,
      hsnSummary,
      notes,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let usageReserved = false;
  let usageConsumed = false;
  let usageOwner = "";
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const business = await resolveBusiness(service, user.id);
    if (!business) return json({ error: "Your account is not linked to exactly one active business" }, 403);
    const { ownerId, isOwner } = business;
    usageOwner = ownerId;
    const { data: profile, error: profileError } = await service.from("profiles")
      .select("ai_provider, company_name, full_name, gstin, upi_id")
      .eq("id", ownerId).maybeSingle();
    if (profileError || !profile) return json({ error: "Could not load business profile" }, 503);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid JSON body" }, 400);
    const mode = String(body.mode || "") as QuickTaskMode;
    if (!(MODES as readonly string[]).includes(mode)) return json({ error: "Unknown quick-task mode" }, 400);
    if (mode === "gst_invoice_voice" && !isOwner) return json({ error: "Only the business owner can create invoices" }, 403);

    const userText = cleanText(body.text, MAX_TEXT);
    if (["hindi_bot", "gst_invoice_voice", "custom"].includes(mode) && !userText) {
      return json({ error: mode === "gst_invoice_voice" ? "Describe the sale by voice or text first" : "Tell me what you want to do" }, 400);
    }

    const targetDate = body.target_date == null ? null : cleanText(body.target_date, 10);
    if (targetDate && (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate) || Number.isNaN(new Date(`${targetDate}T00:00:00Z`).getTime()))) return json({ error: "target_date must be a real YYYY-MM-DD date" }, 400);
    const { start: dayStart, end: dayEnd } = dateBounds(targetDate);
    const [{ data: todayTx }, { data: allProducts }] = await Promise.all([
      supabase.from("transactions").select("total,items,payment_method").eq("user_id", ownerId).eq("status", "completed").gte("created_at", dayStart).lte("created_at", dayEnd),
      supabase.from("products").select("name,sku,stock_quantity,low_stock_threshold,price,cost").eq("user_id", ownerId).limit(2_000),
    ]);

    const { data: reserved, error: reserveError } = await service.rpc("reserve_api_usage", { p_user_id: ownerId, p_amount: 1 });
    if (reserveError) return json({ error: "AI usage service is unavailable; deploy schema v27 first" }, 503);
    if (!reserved) return json({ error: "Usage limit reached" }, 429);
    usageReserved = true;

    const provider = profile.ai_provider || "groq";
    let result = "";
    let meta: Record<string, unknown> = {};

    if (mode === "low_stock_alert") {
      const low = (allProducts || []).filter((p: any) => Number(p.stock_quantity) <= Number(p.low_stock_threshold));
      meta = { count: low.length, items: low.slice(0, 500).map((p: any) => ({ name: p.name, stock: p.stock_quantity, threshold: p.low_stock_threshold })) };
      if (low.length === 0) {
        result = "✅ All products are well stocked. No reorders needed right now.";
      } else {
        result = await callAIWithFallback(provider, "You are a retail inventory assistant for an Indian shop. Write a clear low-stock alert in friendly Hinglish (Hindi+English mixed in Roman script). Use bullet points. Suggest reorder quantities based on the gap. Sign off as the shop's AI assistant.", `Low-stock items:\n${JSON.stringify(low.slice(0, 100), null, 1)}`, 2500, "quick-tasks");
        usageConsumed = true;
      }
    } else if (mode === "daily_closing") {
      const revenue = (todayTx || []).reduce((sum: number, tx: any) => sum + Number(tx.total || 0), 0);
      const itemCount = (todayTx || []).reduce((sum: number, tx: any) => sum + (Array.isArray(tx.items) ? tx.items.reduce((n: number, item: any) => n + Number(item.quantity || item.qty || 0), 0) : 0), 0);
      const byMethod: Record<string, number> = {};
      (todayTx || []).forEach((tx: any) => { const method = cleanText(tx.payment_method, 30) || "other"; byMethod[method] = (byMethod[method] || 0) + Number(tx.total || 0); });
      meta = { revenue: +revenue.toFixed(2), orders: (todayTx || []).length, itemCount, byMethod };
      result = await callAIWithFallback(provider, "Generate a clean DAILY CLOSING REPORT for an Indian retail shop. Be warm, professional, and concise. Format with clear sections. End with a one-line summary. Use the rupee symbol.", `Target date: ${targetDate || "today"} data:\n- Total revenue: ₹${revenue.toFixed(2)}\n- Orders: ${(todayTx || []).length}\n- Items sold: ${itemCount}\n- By payment method: ${JSON.stringify(byMethod)}\n- Shop name: ${profile.company_name || profile.full_name || "My Shop"}`, 2000, "quick-tasks");
      usageConsumed = true;
    } else if (mode === "hindi_bot") {
      result = await callAIWithFallback(provider, "You are a friendly Hinglish WhatsApp assistant for an Indian retail shop. Hinglish means Hindi and English mixed in Roman script. Reply warmly and naturally to the customer. Keep it short, two to four lines, and use emojis sparingly. Sign off as the shop.", `Customer's message: "${userText}"\n\nShop name: ${profile.company_name || "My Shop"}\n\nWrite a helpful Hinglish reply:`, 300, "quick-tasks");
      usageConsumed = true;
    } else if (mode === "gst_invoice_voice") {
      const aiOut = await callAIWithFallback(provider, "You are a GST billing assistant for an Indian shop. Parse the sale description and return ONLY valid JSON: {customer_name, customer_phone, items:[{description, quantity, unit_price, gst_rate, hsn_code}], tax_rate, is_interstate, notes}. Prices are pre-tax rupees. Never invent missing prices; if an essential detail is missing, return an empty items array.", `Description: "${userText}"\nShop GSTIN: ${profile.gstin || "not set"}`, 2500, "quick-tasks");
      usageConsumed = true;
      const draft = parseInvoiceDraft(aiOut, userText, body.is_interstate === true);
      meta.raw = aiOut.slice(0, 4_000);
      if (!draft) {
        result = "I could not safely turn that into an invoice. Please provide the customer name, item names, quantities, and prices, then try again.";
      } else {
        const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
        const { data: invoice, error: invoiceError } = await service.from("invoices").insert({
          user_id: ownerId,
          invoice_number: invoiceNumber,
          client_name: draft.customerName,
          client_phone: draft.customerPhone,
          items: draft.items,
          subtotal: draft.subtotal,
          discount: 0,
          tax_rate: draft.taxRate,
          tax_amount: draft.taxAmount,
          total: draft.total,
          is_interstate: draft.isInterstate,
          hsn_summary: draft.hsnSummary,
          status: "draft",
          notes: draft.notes,
        }).select("id,invoice_number,total,status").single();
        if (invoiceError) throw invoiceError;
        await service.from("activity_logs").insert({ user_id: ownerId, action_type: "invoice", description: `Quick task created draft invoice ${invoiceNumber} — ₹${draft.total}`, time_saved_minutes: 15, money_saved: 7.5, provider });
        meta.invoice = invoice;
        result = `🧾 Draft GST invoice ${invoiceNumber} created.\nCustomer: ${draft.customerName}\nItems: ${draft.items.length}\nTax (${draft.taxRate}%): ₹${draft.taxAmount.toFixed(2)}\nTotal: ₹${draft.total.toFixed(2)}\n\nReview it in Invoices before sending.`;
      }
    } else {
      const snapshot = {
        todayRevenue: (todayTx || []).reduce((sum: number, tx: any) => sum + Number(tx.total || 0), 0),
        todayOrders: (todayTx || []).length,
        lowStock: (allProducts || []).filter((p: any) => Number(p.stock_quantity) <= Number(p.low_stock_threshold)).slice(0, 100).map((p: any) => p.name),
        shop: profile.company_name || profile.full_name,
      };
      result = await callAIWithFallback(provider, "You are a helpful retail business assistant for an Indian shop owner. Answer clearly in Hinglish or English, matching the owner's language. Be concise and actionable. Do not claim to have performed any write.", `Owner request: "${userText}"\n\nShop context: ${JSON.stringify(snapshot)}`, 2500, "quick-tasks");
      usageConsumed = true;
    }

    await service.from("activity_logs").insert({
      user_id: ownerId,
      action_type: "summary",
      description: `Quick task: ${mode}${userText ? ` — ${userText.slice(0, 50)}` : ""}`,
      time_saved_minutes: 8,
      money_saved: 5,
      provider,
      metadata: meta,
    });
    return json({ result, mode, meta });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  } finally {
    if (usageReserved && !usageConsumed) await releaseApiUsage(
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
      usageOwner,
    );
  }
});
