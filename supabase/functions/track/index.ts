// ════════════════════════════════════════════════════════════════
// TRACK — expiring, HMAC-signed email open / click / reply tracking.
//
// Public email clients cannot send a Cashiea JWT, so tracking uses a signed
// token. Raw recipient UUIDs are deliberately not accepted: knowing an ID is
// not authorization to mutate a campaign recipient.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyTrackingToken } from "../_shared/tracking.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const pixelHeaders = { "Content-Type": "image/gif", "Cache-Control": "no-store, private" };

async function sentiment(text: string): Promise<{ label: string; score: number } | null> {
  try {
    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) return null;
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "Classify the sentiment of the email reply. Reply with ONLY JSON: {\"sentiment\":\"positive|negative|neutral\",\"score\":0.0-1.0}" }, { role: "user", content: text.slice(0, 1500) }],
        temperature: 0,
        max_tokens: 60,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;
    const parsed = JSON.parse(raw.trim().replace(/```json|```/g, "").trim());
    const label = ["positive", "negative", "neutral"].includes(parsed.sentiment) ? parsed.sentiment : "neutral";
    const score = Math.max(0, Math.min(1, Number(parsed.score) || 0.5));
    return { label, score };
  } catch {
    return null;
  }
}

async function syncStats(campaignId: string) {
  await supabase.rpc("sync_campaign_stats", { campaign_uuid: campaignId });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("k") || "";
  const requestedType = url.searchParams.get("t");

  if (requestedType === "open" && req.method === "GET") {
    const claims = await verifyTrackingToken(token, "open");
    if (!claims) return new Response(PIXEL, { status: 400, headers: pixelHeaders });

    const { data: recipient } = await supabase
      .from("campaign_recipients")
      .select("campaign_id, status")
      .eq("id", claims.id)
      .maybeSingle();
    if (recipient) {
      await supabase.from("campaign_recipients")
        .update({ status: "opened", opened_at: new Date().toISOString() })
        .eq("id", claims.id)
        .not("status", "in", "(clicked,replied)");
      await syncStats(recipient.campaign_id);
    }
    return new Response(PIXEL, { headers: pixelHeaders });
  }

  if (requestedType === "click" && req.method === "GET") {
    const claims = await verifyTrackingToken(token, "click");
    if (!claims || !claims.dest) return new Response("Invalid or expired link", { status: 400 });

    const { data: recipient } = await supabase
      .from("campaign_recipients")
      .select("campaign_id")
      .eq("id", claims.id)
      .maybeSingle();
    if (!recipient) return new Response("Link not found", { status: 404 });

    await supabase.from("campaign_recipients")
      .update({ status: "clicked", clicked_at: new Date().toISOString() })
      .eq("id", claims.id)
      .neq("status", "replied");
    await syncStats(recipient.campaign_id);
    return Response.redirect(claims.dest, 302);
  }

  if (requestedType === "reply" && req.method === "POST") {
    const claims = await verifyTrackingToken(token, "reply");
    if (!claims) return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 400, headers: { "Content-Type": "application/json" } });
    try {
      const body = await req.json();
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text || text.length > 10_000) {
        return new Response(JSON.stringify({ error: "Reply text is required and must be under 10,000 characters" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const s = await sentiment(text);
      const { data: recipient } = await supabase
        .from("campaign_recipients")
        .select("campaign_id")
        .eq("id", claims.id)
        .maybeSingle();
      if (!recipient) return new Response(JSON.stringify({ error: "Recipient not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

      await supabase.from("campaign_recipients").update({
        status: "replied", replied_at: new Date().toISOString(),
        sentiment: s?.label || null, sentiment_score: s?.score ?? null,
      }).eq("id", claims.id);
      await syncStats(recipient.campaign_id);
      return new Response(JSON.stringify({ ok: true, sentiment: s }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    } catch (e) {
      console.error("[track] reply failed", e);
      return new Response(JSON.stringify({ error: "Could not record reply" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  return requestedType === "open"
    ? new Response(PIXEL, { status: 400, headers: pixelHeaders })
    : new Response("Bad request", { status: 400 });
});
