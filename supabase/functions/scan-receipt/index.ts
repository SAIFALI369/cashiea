// ════════════════════════════════════════════════════════════════
// SCAN-RECEIPT — focused Gemini vision extraction for receipts/bills.
// Takes an image, returns structured JSON (vendor, amount, date, category).
// JWT-auth. The accounting surface is owner-only and uses the owner's AI quota.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { callGeminiWithImage } from "../_shared/ai-default.ts";
import { resolveBusiness } from "../_shared/business.ts";
import { releaseApiUsage } from "../_shared/usage.ts";

const SYSTEM = `You are a receipt and bill scanner for an Indian retail shop. Analyze the image and extract structured data. Return ONLY valid JSON — no markdown, no explanation.

Fields to extract:
- vendor: the merchant/shop/company name (string)
- amount: the TOTAL amount as a number (no currency symbol, no commas)
- date: the date on the receipt in YYYY-MM-DD format (string, or null if not visible)
- category: pick the BEST fit from: utilities, rent, supplies, transport, food, salary, maintenance, marketing, tax, other
- tax_amount: GST/tax amount as a number (or null if not shown)
- payment_method: cash, upi, card, or other (or null)
- items: array of { name: string, price: number } for visible line items (empty array if none)
- confidence: your confidence in the extraction: "high", "medium", or "low"

Return JSON like: {"vendor":"Bihar Power","amount":2400,"date":"2025-08-09","category":"utilities","tax_amount":null,"payment_method":"upi","items":[],"confidence":"high"}`;

const CATEGORIES = new Set(["utilities", "rent", "supplies", "transport", "food", "salary", "maintenance", "marketing", "tax", "other"]);
const PAYMENT_METHODS = new Set(["cash", "upi", "card", "other"]);
const CONFIDENCE = new Set(["high", "medium", "low"]);

function finite(value: unknown, min = 0, max = 1_000_000_000): number | null {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function normalizeReceipt(value: any): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const amount = finite(value.amount);
  if (amount === null) return null;

  const date = value.date == null || value.date === "" ? null : String(value.date).trim();
  if (date !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()))) return null;
  const taxAmount = value.tax_amount == null || value.tax_amount === "" ? null : finite(value.tax_amount);
  if (value.tax_amount != null && value.tax_amount !== "" && taxAmount === null) return null;

  const items = Array.isArray(value.items)
    ? value.items.slice(0, 100).map((item: any) => {
        const name = typeof item?.name === "string" ? item.name.trim().slice(0, 200) : "";
        const price = finite(item?.price);
        return name && price !== null ? { name, price } : null;
      }).filter((item: { name: string; price: number } | null): item is { name: string; price: number } => !!item)
    : [];

  return {
    vendor: typeof value.vendor === "string" ? value.vendor.trim().slice(0, 200) : "",
    amount: Number(amount.toFixed(2)),
    date,
    category: CATEGORIES.has(String(value.category).toLowerCase()) ? String(value.category).toLowerCase() : "other",
    tax_amount: taxAmount === null ? null : Number(taxAmount.toFixed(2)),
    payment_method: PAYMENT_METHODS.has(String(value.payment_method).toLowerCase()) ? String(value.payment_method).toLowerCase() : null,
    items,
    confidence: CONFIDENCE.has(String(value.confidence).toLowerCase()) ? String(value.confidence).toLowerCase() : "low",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let usageReserved = false;
  let usageConsumed = false;
  let usageOwner = "";
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const business = await resolveBusiness(service, user.id);
    if (!business) return json({ error: "Your account is not linked to exactly one active business" }, 403);
    if (!business.isOwner) return json({ error: "Only the business owner can scan accounting receipts" }, 403);
    usageOwner = business.ownerId;

    const body = await req.json().catch(() => null);
    const image = body?.image;
    if (!image || typeof image.data !== "string" || typeof image.mimeType !== "string") return json({ error: "image data and mimeType are required" }, 400);
    const mimeType = image.mimeType.toLowerCase().split(";", 1)[0].trim();
    if (image.data.length === 0 || image.data.length > 14_000_000) return json({ error: "Image is too large; use an image under 10 MB" }, 413);
    if (image.data.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)) return json({ error: "image data is not valid base64" }, 400);
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) return json({ error: "Use a JPEG, PNG, or WebP image" }, 400);

    const { data: reserved, error: reserveError } = await service.rpc("reserve_api_usage", { p_user_id: usageOwner, p_amount: 1 });
    if (reserveError) return json({ error: "AI usage service is unavailable; deploy schema v27 first" }, 503);
    if (!reserved) return json({ error: "Usage limit reached" }, 429);
    usageReserved = true;

    const res = await callGeminiWithImage(
      SYSTEM,
      "Extract the receipt data from this image. Return ONLY the JSON.",
      { data: image.data, mimeType },
      { maxTokens: 4000, feature: "scan-receipt" },
    );
    if (!res.ok) return json({ error: res.value }, 502);
    // A successful provider response consumed the model action even if its
    // output is malformed; only pre-provider failures are refunded.
    usageConsumed = true;

    const raw = res.value.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* return a safe parse error */ }
    }
    const extracted = normalizeReceipt(parsed);
    if (!extracted) return json({ error: "Could not parse receipt data" }, 502);
    return json({ extracted });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  } finally {
    if (usageReserved && !usageConsumed) await releaseApiUsage(
      createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } }),
      usageOwner,
    );
  }
});
