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
import { resolveBusiness } from "../_shared/business.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 600_000) return json({ error: "Request is too large" }, 413);
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid JSON body" }, 400);
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const business = await resolveBusiness(svc, user.id);
    if (!business?.isOwner) return json({ error: "Only the business owner can send WhatsApp messages from the business account" }, 403);
    const ownerId = business.ownerId;

    const logOutbound = async (to: string, text: string, ok: boolean, errMsg?: string, waId?: string) => {
      try {
        await svc.from("whatsapp_messages").insert({
          user_id: ownerId,
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

    const validPhone = (value: unknown): value is string => {
      const normalized = normalizePhone(typeof value === "string" ? value : "");
      return /^\d{10,15}$/.test(normalized);
    };
    const validMessage = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 4096;

    // ── Broadcast ──
    if (body.broadcast !== undefined && !Array.isArray(body.broadcast)) return json({ error: "broadcast must be an array" }, 400);
    if (Array.isArray(body.broadcast)) {
      if (body.broadcast.length > 100) return json({ error: "Broadcast is limited to 100 recipients" }, 413);
      let sent = 0, failed = 0;
      for (const item of body.broadcast) {
        if (!item || typeof item !== "object" || Array.isArray(item) || !validPhone(item.to) || !validMessage(item.message)) { failed++; continue; }
        const r = await sendWhatsAppText(item.to, item.message.trim());
        if (r.ok) sent++; else failed++;
        await logOutbound(item.to, item.message.trim(), r.ok, r.error, r.messageId);
      }
      return json({ sent, failed });
    }

    // ── Single message ──
    const { to, message, template } = body;
    if (!validPhone(to)) return json({ error: "A valid international phone number is required" }, 400);
    if (template !== undefined && template !== null && (typeof template !== "object" || Array.isArray(template))) return json({ error: "template is invalid" }, 400);

    if (template?.name) {
      if (typeof template.name !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/.test(template.name)) return json({ error: "Invalid template name" }, 400);
      const language = typeof template.language === "string" && /^[A-Za-z]{2,3}_[A-Za-z]{2,4}$/.test(template.language) ? template.language : "en_US";
      if (template.components !== undefined && !Array.isArray(template.components)) return json({ error: "template components are invalid" }, 400);
      const components = Array.isArray(template.components) ? template.components.slice(0, 20) : [];
      if (JSON.stringify(components).length > 20_000) return json({ error: "template components are too large" }, 413);
      const r = await sendWhatsAppTemplate(to, template.name, language, components);
      await logOutbound(to, message || `[template: ${template.name}]`, r.ok, r.error, r.messageId);
      if (!r.ok) return json({ error: r.error }, 502);
      return json({ ok: true, messageId: r.messageId });
    }

    if (!validMessage(message)) return json({ error: "message required (or use template)" }, 400);
    const r = await sendWhatsAppText(to, message.trim());
    await logOutbound(to, message, r.ok, r.error, r.messageId);
    if (!r.ok) return json({ error: r.error }, 502);
    return json({ ok: true, messageId: r.messageId });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
