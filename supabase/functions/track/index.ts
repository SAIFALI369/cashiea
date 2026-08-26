// ════════════════════════════════════════════════════════════════
// TRACK — email open / click / reply tracking (no auth, JWT off)
// Open pixel:   GET /track?e=<recipient_id>&t=open  → 1x1 GIF
// Click link:   GET /track?e=<recipient_id>&t=click&u=<url> → 302 redirect
// Reply webhook: POST /track?e=<recipient_id>&t=reply  { text: "..." }
//   (replies also run sentiment analysis if AI keys are set)
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// 1x1 transparent GIF
const PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));

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
    const raw = (await res.json()).choices[0].message.content.trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    const score = Math.max(0, Math.min(1, Number(parsed.score) || 0.5));
    return { label: parsed.sentiment, score };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("e");
  const type = url.searchParams.get("t");

  if (!id || !type) return new Response("Bad request", { status: 400 });

  if (type === "open") {
    await supabase.from("campaign_recipients").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", id).neq("status", "clicked").neq("status", "replied");
    const { data: r } = await supabase.from("campaign_recipients").select("campaign_id").eq("id", id).single();
    if (r) await supabase.rpc("sync_campaign_stats", { campaign_uuid: r.campaign_id });
    return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
  }

  if (type === "click") {
    // SECURITY: only allow http(s) redirects — blocks javascript:/data: injection
    // (XSS via crafted links) and keeps this endpoint from being abused as an
    // arbitrary-scheme redirector.
    const rawDest = url.searchParams.get("u") || "/";
    const dest = /^https?:\/\//i.test(rawDest) ? rawDest : "/";
    await supabase.from("campaign_recipients").update({ status: "clicked", clicked_at: new Date().toISOString() }).eq("id", id).neq("status", "replied");
    const { data: r } = await supabase.from("campaign_recipients").select("campaign_id").eq("id", id).single();
    if (r) await supabase.rpc("sync_campaign_stats", { campaign_uuid: r.campaign_id });
    return Response.redirect(dest, 302);
  }

  if (type === "reply" && req.method === "POST") {
    try {
      const { text } = await req.json();
      const s = await sentiment(text || "");
      await supabase.from("campaign_recipients").update({
        status: "replied", replied_at: new Date().toISOString(),
        sentiment: s?.label || null, sentiment_score: s?.score ?? null,
      }).eq("id", id);
      const { data: r } = await supabase.from("campaign_recipients").select("campaign_id").eq("id", id).single();
      if (r) await supabase.rpc("sync_campaign_stats", { campaign_uuid: r.campaign_id });
      return new Response(JSON.stringify({ ok: true, sentiment: s }), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  return new Response("Bad request", { status: 400 });
});
