// ════════════════════════════════════════════════════════════════
// WHATSAPP WEBHOOK — Meta Cloud API receiver.
//
// Configure in the Meta App → WhatsApp → Configuration:
//   Callback URL:  https://<project>.supabase.co/functions/v1/whatsapp-webhook
//   Verify token:  WHATSAPP_VERIFY_TOKEN
//   App secret:    WHATSAPP_APP_SECRET
//   Field:         messages + message_status updates
//
// GET  → Meta verification (returns hub.challenge).
// POST → inbound messages + status updates. Every POST is authenticated with
//        Meta's X-Hub-Signature-256 HMAC before it can touch the database.
//
// verify_jwt = false (Meta calls this without our JWT).
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/whatsapp.ts";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
const APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET") || "";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validMetaSignature(rawBody: string, header: string | null): Promise<boolean> {
  if (!APP_SECRET || !header || !header.startsWith("sha256=")) return false;
  const supplied = header.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(supplied)) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(APP_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))));
    if (digest.length !== supplied.length) return false;
    let difference = 0;
    for (let i = 0; i < digest.length; i += 1) difference |= digest.charCodeAt(i) ^ supplied.charCodeAt(i);
    return difference === 0;
  } catch {
    return false;
  }
}

function phoneForms(raw: string): string[] {
  const normalized = normalizePhone(raw);
  if (!/^\d{10,15}$/.test(normalized)) return [];
  const forms = new Set([normalized, `+${normalized}`]);
  // Indian customer rows commonly use either a local ten-digit value or a
  // formatted +91 value; query those exact representations instead of loading
  // every customer/profile into memory for every webhook delivery.
  if (normalized.startsWith("91") && normalized.length === 12) {
    const local = normalized.slice(2);
    forms.add(local);
    forms.add(`+91 ${local}`);
    forms.add(`91 ${local}`);
    forms.add(`+91-${local}`);
  }
  return [...forms];
}

// Resolve only an unambiguous active owner. A customer phone can exist in two
// tenants; guessing the first row would leak that customer's message into the
// wrong business history.
async function resolveOwner(fromPhone: string): Promise<string | null> {
  const forms = phoneForms(fromPhone);
  if (!forms.length) return null;
  try {
    const [profiles, customers] = await Promise.all([
      supabase.from("profiles").select("id,role,business_owner_id,whatsapp_number").in("whatsapp_number", forms).limit(100),
      supabase.from("customers").select("user_id,phone").in("phone", forms).limit(500),
    ]);
    if (profiles.error || customers.error) return null;

    const candidateUserIds = new Set<string>();
    for (const profile of profiles.data || []) {
      if (profile.role === "owner" && profile.business_owner_id === null) candidateUserIds.add(profile.id);
    }
    for (const customer of customers.data || []) if (customer.user_id) candidateUserIds.add(customer.user_id);
    if (!candidateUserIds.size) return null;

    // A customer row can belong to a team member in older data. Resolve those
    // IDs to the owning profile before applying the ambiguity check.
    const { data: members, error: memberError } = await supabase.from("profiles")
      .select("id,role,business_owner_id").in("id", [...candidateUserIds]).limit(500);
    if (memberError) return null;
    const ownerIds = new Set<string>();
    for (const member of members || []) {
      if (member.role === "owner" && member.business_owner_id === null) ownerIds.add(member.id);
      else if (member.business_owner_id) ownerIds.add(member.business_owner_id);
    }
    if (ownerIds.size !== 1) return null;
    const ownerId = [...ownerIds][0];
    const { data: owner, error: ownerError } = await supabase.from("profiles")
      .select("id").eq("id", ownerId).eq("role", "owner").is("business_owner_id", null).maybeSingle();
    return ownerError ? null : owner?.id || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── Verification handshake ──
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (VERIFY_TOKEN && mode === "subscribe" && token === VERIFY_TOKEN && challenge && challenge.length <= 500) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── Inbound + status ──
  if (req.method === "POST") {
    const rawBody = await req.text().catch(() => "");
    if (rawBody.length > 2_000_000 || !(await validMetaSignature(rawBody, req.headers.get("x-hub-signature-256")))) {
      return new Response("Unauthorized", { status: 401 });
    }
    try {
      const payload = JSON.parse(rawBody);
      const value = payload?.entry?.[0]?.changes?.[0]?.value;

      const msg = value?.messages?.[0];
      if (msg && typeof msg.from === "string") {
        const from = normalizePhone(msg.from);
        const rawText = msg.text?.body || msg.image?.caption || msg.video?.caption || "";
        const text = typeof rawText === "string" ? rawText.slice(0, 10_000) : "";
        const userId = await resolveOwner(from);
        // Unmatched/ambiguous messages are ACKed but never written into a
        // tenant's ledger. This is safer than inserting a null or guessed id.
        if (userId) {
          const { error: insertError } = await supabase.from("whatsapp_messages").insert({
            user_id: userId,
            from_phone: from,
            to_phone: typeof value?.metadata?.display_phone_number === "string"
              ? value.metadata.display_phone_number.slice(0, 100)
              : null,
            body: text,
            direction: "inbound",
            status: "received",
            wa_message_id: typeof msg.id === "string" ? msg.id.slice(0, 250) : null,
            meta: { type: typeof msg.type === "string" ? msg.type.slice(0, 50) : "text" },
          });
          // Meta retries the same notification; schema-v27's unique provider
          // message id makes this a harmless duplicate acknowledgement.
          if (insertError && insertError.code !== "23505") console.error("[whatsapp-webhook] message insert failed");
        }
      }

      const st = value?.statuses?.[0];
      const allowedStatuses = new Set(["sent", "delivered", "read", "failed"]);
      if (st?.id && allowedStatuses.has(st.status)) {
        await supabase.from("whatsapp_messages").update({ status: st.status })
          .eq("wa_message_id", String(st.id).slice(0, 250));
      }
    } catch {
      // Authenticated but malformed/unsupported callbacks are ACKed so Meta
      // does not retry a payload that cannot be acted on.
    }
    return new Response("ok", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});
