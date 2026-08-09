// ════════════════════════════════════════════════════════════════
// SCAN-RECEIPT — focused Gemini vision extraction for receipts/bills.
// Takes an image, returns structured JSON (vendor, amount, date, category).
// JWT-auth. Uses the same Gemini key pool as the rest of the app.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { callGeminiWithImage } from "../_shared/ai-default.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const { image } = await req.json();
    if (!image || !image.data) return json({ error: "image required" }, 400);

    const res = await callGeminiWithImage(
      SYSTEM,
      "Extract the receipt data from this image. Return ONLY the JSON.",
      image,
      { maxTokens: 600, feature: "scan-receipt" }
    );

    if (!res.ok) return json({ error: res.value }, 502);

    // Parse the JSON from Gemini's response (it might have code fences or preamble).
    const raw = res.value.trim();
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: any = null;
    if (match) { try { parsed = JSON.parse(match[0]); } catch { /* keep null */ } }

    if (!parsed) return json({ error: "Could not parse receipt data", raw }, 502);

    return json({ extracted: parsed });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
