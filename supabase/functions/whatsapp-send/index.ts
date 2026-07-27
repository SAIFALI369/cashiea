// ════════════════════════════════════════════════════════════════
// WHATSAPP SEND — lets the owner (or Meraj) send messages.
//   Body: { to, message }
//         { to, template: { name, language?, components? } }
//         { broadcast: [{ to, message }] }
//
// Reuses the shared _shared/whatsapp.ts sender (same one daily-reports uses).
// Stores each outbound message in whatsapp_messages for the activity log.
// JWT-auth (owner only).
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { sendWhatsAppText, sendWhatsAppTemplate, normalizePhone } from "../_shared/whatsapp.ts";

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

    const body = await req.json();
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const logOutbound = async (to: string, text: string, ok: boolean, errMsg?: string, waId?: string) => {
      try {
        await svc.from("whatsapp_messages").insert({
          user_id: user.id,
          from_phone: null,
          to_phone: normalizePhone(to),
          body: text,
          direction: "outbound",
          status: ok ? "sent" : "failed",
          wa_message_id: waId || null,
          meta: errMsg ? { error: errMsg } : {},
        });
      } catch { /* best-effort */ }
    };

    // ── Broadcast ──
    if (Array.isArray(body.broadcast)) {
      let sent = 0, failed = 0;
      for (const item of body.broadcast) {
        if (!item?.to || !item?.message) continue;
        const r = await sendWhatsAppText(item.to, item.message);
        if (r.ok) sent++; else failed++;
        await logOutbound(item.to, item.message, r.ok, r.error, r.messageId);
      }
      return json({ sent, failed });
    }

    // ── Single message ──
    const { to, message, template } = body;
    if (!to) return json({ error: "to (phone) required" }, 400);

    if (template?.name) {
      const r = await sendWhatsAppTemplate(to, template.name, template.language || "en_US", template.components || []);
      await logOutbound(to, message || `[template: ${template.name}]`, r.ok, r.error, r.messageId);
      if (!r.ok) return json({ error: r.error }, 502);
      return json({ ok: true, messageId: r.messageId });
    }

    if (!message) return json({ error: "message required (or use template)" }, 400);
    const r = await sendWhatsAppText(to, message);
    await logOutbound(to, message, r.ok, r.error, r.messageId);
    if (!r.ok) return json({ error: r.error }, 502);
    return json({ ok: true, messageId: r.messageId });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
