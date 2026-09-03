// ════════════════════════════════════════════════════════════════
// WhatsApp Cloud API sender — shared by daily-reports, whatsapp-send,
// and Meraj. Extracted from daily-reports so there's ONE sender.
//
// Platform-level credentials (one Cashiea WhatsApp Business number):
//   WHATSAPP_TOKEN            — permanent system access token (EAAG…)
//   WHATSAPP_PHONE_NUMBER_ID  — the phone number ID to send from
//
// Business-initiated messages OUTSIDE the 24-hour customer service window
// must use an approved template — free-text is rejected by Meta. Within the
// window (customer messaged in last 24h), free-text replies are allowed.
// ════════════════════════════════════════════════════════════════

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

const messagesUrl = (id: string) => `https://graph.facebook.com/v20.0/${id}/messages`;

export function isWhatsAppConfigured(): boolean {
  return !!(WHATSAPP_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}

/** Normalize to international digits; default-prefix 91 for 10-digit Indian numbers. */
export function normalizePhone(raw: string): string {
  let num = String(raw || "").replace(/[^\d]/g, "");
  if (num.length === 10) num = "91" + num;
  return num;
}

function validRecipient(raw: string): boolean {
  return /^\d{10,15}$/.test(normalizePhone(raw));
}

export interface SendResult { ok: boolean; error?: string; messageId?: string }

/** Free-text message (allowed within the 24h customer service window). */
export async function sendWhatsAppText(toPhone: string, message: string): Promise<SendResult> {
  if (!validRecipient(toPhone)) return { ok: false, error: "Invalid WhatsApp recipient" };
  if (typeof message !== "string" || message.trim().length === 0 || message.length > 4096) return { ok: false, error: "Invalid WhatsApp message" };
  if (!isWhatsAppConfigured()) return { ok: false, error: "WhatsApp not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing)" };
  try {
    const res = await fetch(messagesUrl(WHATSAPP_PHONE_NUMBER_ID!), {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: normalizePhone(toPhone), type: "text", text: { body: message } }),
    });
    if (!res.ok) return { ok: false, error: `WA API ${res.status}: ${(await res.text()).slice(0, 220)}` };
    const data = await res.json();
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: `Network: ${(e as Error)?.message || "request failed"}` };
  }
}

/** Approved template message (required for business-initiated msgs outside the 24h window). */
export async function sendWhatsAppTemplate(
  toPhone: string,
  templateName: string,
  languageCode = "en_US",
  components: any[] = []
): Promise<SendResult> {
  if (!validRecipient(toPhone)) return { ok: false, error: "Invalid WhatsApp recipient" };
  if (typeof templateName !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/.test(templateName)) return { ok: false, error: "Invalid WhatsApp template" };
  if (!isWhatsAppConfigured()) return { ok: false, error: "WhatsApp not configured" };
  try {
    const template: any = { name: templateName, language: { code: languageCode } };
    if (components.length) template.components = components;
    const res = await fetch(messagesUrl(WHATSAPP_PHONE_NUMBER_ID!), {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: normalizePhone(toPhone), type: "template", template }),
    });
    if (!res.ok) return { ok: false, error: `WA API ${res.status}: ${(await res.text()).slice(0, 220)}` };
    const data = await res.json();
    return { ok: true, messageId: data?.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: `Network: ${(e as Error)?.message || "request failed"}` };
  }
}
