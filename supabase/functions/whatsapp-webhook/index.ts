// ════════════════════════════════════════════════════════════════
// WHATSAPP WEBHOOK — Meta Cloud API receiver.
//
// Configure in the Meta App → WhatsApp → Configuration:
//   Callback URL:  https://<project>.functions.supabase.co/whatsapp-webhook
//   Verify token:  the value of WHATSAPP_VERIFY_TOKEN (default cashiea_verify)
//   Field:         messages + message_status updates
//
// GET  → Meta verification (returns hub.challenge).
// POST → inbound messages + status updates. Resolves the shop owner from the
//        sender's phone (profiles.whatsapp_number or customers.phone) and stores
//        the message so Meraj can read new inbound going forward.
// verify_jwt = false (Meta calls this without our JWT).
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "cashiea_verify";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Best-effort: which shop owner does this sender phone belong to?
async function resolveOwner(fromPhone: string): Promise<string | null> {
  try {
    const { data: prof } = await supabase.from("profiles").select("id").eq("whatsapp_number", fromPhone).maybeSingle();
    if (prof?.id) return prof.id;
    const { data: cust } = await supabase.from("customers").select("user_id").eq("phone", fromPhone).limit(1).maybeSingle();
    return cust?.user_id || null;
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
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge || "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // ── Inbound + status ──
  if (req.method === "POST") {
    // Always 200 fast (Meta retries if slow/non-200); process best-effort.
    try {
      const payload = await req.json();
      const value = payload?.entry?.[0]?.changes?.[0]?.value;

      // Inbound message
      const msg = value?.messages?.[0];
      if (msg) {
        const from = msg.from;
        const text = msg.text?.body || msg.image?.caption || msg.video?.caption || "";
        const userId = await resolveOwner(from);
        await supabase.from("whatsapp_messages").insert({
          user_id: userId,
          from_phone: from,
          to_phone: value?.metadata?.phone_number_id || null,
          body: text,
          direction: "inbound",
          status: "received",
          wa_message_id: msg.id || null,
          meta: { type: msg.type || "text" },
        });
      }

      // Status update for an outbound message we sent
      const st = value?.statuses?.[0];
      if (st?.id) {
        await supabase.from("whatsapp_messages").update({ status: st.status }).eq("wa_message_id", st.id);
      }
    } catch {
      /* best-effort — still ACK Meta */
    }
    return new Response("ok", { status: 200 });
  }

  return new Response("Method not allowed", { status: 405 });
});
