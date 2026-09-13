// ════════════════════════════════════════════════════════════════
// WHATSAPP WEBHOOK — Meta Cloud API receiver + billing commands.
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
// Billing commands (opt-in per business, profiles.whatsapp_billing_enabled):
//   When the SENDER is the owner or a staff member of the resolved
//   business, the message is additionally parsed by the deterministic
//   order parser (_shared/order-parser.ts — the same module the vitest
//   suite runs). "Add 50 notebooks at ₹25" becomes a GST invoice with
//   catalogue prices, a bill is sent back, and a realtime card lands on
//   the dashboard. No AI tokens are spent and nothing is auto-collected.
//
// verify_jwt = false (Meta calls this without our JWT).
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone, sendWhatsAppText } from "../_shared/whatsapp.ts";
import {
  parseWhatsAppOrder, clearCatalogMatch, matchCatalogItem,
  buildCustomerBillMessage, orderHelpMessage, inr,
  type CatalogProduct,
} from "../_shared/order-parser.ts";

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

interface BusinessContext {
  ownerId: string;
  /** True when the sender's own WhatsApp number belongs to the business. */
  senderIsStaff: boolean;
}

// Resolve only an unambiguous active owner. A customer phone can exist in two
// tenants; guessing the first row would leak that customer's message into the
// wrong business history.
async function resolveBusiness(fromPhone: string): Promise<BusinessContext | null> {
  const forms = phoneForms(fromPhone);
  if (!forms.length) return null;
  try {
    const [profiles, customers] = await Promise.all([
      supabase.from("profiles").select("id,role,business_owner_id,whatsapp_number").in("whatsapp_number", forms).limit(100),
      supabase.from("customers").select("user_id,phone").in("phone", forms).limit(500),
    ]);
    if (profiles.error || customers.error) return null;

    const candidateUserIds = new Set<string>();
    // Businesses whose STAFF member's number matched (staff messages belong
    // to the owner's business too, and staff may send billing commands).
    const memberOwners = new Set<string>();
    for (const profile of profiles.data || []) {
      if (profile.role === "owner" && profile.business_owner_id === null) candidateUserIds.add(profile.id);
      else if (profile.business_owner_id) memberOwners.add(profile.business_owner_id);
    }
    for (const customer of customers.data || []) if (customer.user_id) candidateUserIds.add(customer.user_id);
    if (!candidateUserIds.size && !memberOwners.size) return null;

    // A customer row can belong to a team member in older data. Resolve those
    // IDs to the owning profile before applying the ambiguity check.
    const lookupIds = new Set([...candidateUserIds, ...memberOwners]);
    const { data: members, error: memberError } = await supabase.from("profiles")
      .select("id,role,business_owner_id").in("id", [...lookupIds]).limit(500);
    if (memberError) return null;
    const ownerIds = new Set<string>();
    for (const member of members || []) {
      if (member.role === "owner" && member.business_owner_id === null) ownerIds.add(member.id);
      else if (member.business_owner_id) ownerIds.add(member.business_owner_id);
    }
    // Staff matches count only when the pointed-to business really is an
    // active owner (the member query above resolved them).
    if (ownerIds.size !== 1) return null;
    const ownerId = [...ownerIds][0];
    const { data: owner, error: ownerError } = await supabase.from("profiles")
      .select("id").eq("id", ownerId).eq("role", "owner").is("business_owner_id", null).maybeSingle();
    if (ownerError || !owner) return null;

    // Staff/owner sender? Any profile inside this business whose WhatsApp
    // number matches the sender — the owner's own number or a team member's.
    let senderIsStaff = false;
    for (const profile of profiles.data || []) {
      const memberOfThisBusiness = profile.id === ownerId || profile.business_owner_id === ownerId;
      if (memberOfThisBusiness) senderIsStaff = true;
    }
    return { ownerId, senderIsStaff };
  } catch {
    return null;
  }
}

// ── Billing command execution ────────────────────────────────────

function nextDocNumber(prefix: string): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 10000) % 10000).padStart(4, "0");
  return `${prefix}-${yy}${mm}${dd}-${seq}`;
}

async function reply(to: string, message: string): Promise<void> {
  try { await sendWhatsAppText(to, message); } catch { /* best effort */ }
}

/**
 * Handle one inbound text as a potential billing command. Deterministic —
 * no AI calls, no tokens. Returns true when a command was executed or
 * answered (so callers can log it).
 */
async function handleOrderCommand(
  ownerId: string,
  fromPhone: string,
  text: string,
): Promise<boolean> {
  const { data: profile } = await supabase.from("profiles")
    .select("company_name,full_name,upi_id,whatsapp_billing_enabled,business_state")
    .eq("id", ownerId).maybeSingle();
  if (!profile || profile.whatsapp_billing_enabled !== true) return false;

  const shopName = profile.company_name || profile.full_name || "our shop";
  const parsed = parseWhatsAppOrder(text);
  if (parsed.kind === "not_order") return false;
  if (parsed.kind === "unparseable") {
    await reply(fromPhone, orderHelpMessage(shopName));
    return true;
  }

  // Load the catalogue once and match every item. Unknown or ambiguous
  // items are NEVER guessed — the sender gets the closest matches back.
  const { data: products } = await supabase.from("products")
    .select("id,name,price,gst_rate,hsn_code")
    .eq("user_id", ownerId)
    .eq("active", true)
    .limit(1000);
  const catalog: CatalogProduct[] = (products || []).map((p: any) => ({
    id: p.id, name: p.name, price: Number(p.price) || 0,
    gst_rate: p.gst_rate === null ? 0 : Number(p.gst_rate) || 0,
    hsn_code: p.hsn_code || null,
  }));
  if (!catalog.length) {
    await reply(fromPhone, `You don't have any products in your catalogue yet — add items on the Stock page first, then bill them here.`);
    return true;
  }

  const lines: any[] = [];
  const problems: string[] = [];
  for (const item of parsed.items) {
    const match = clearCatalogMatch(item.name, catalog);
    if (!match) {
      const near = matchCatalogItem(item.name, catalog).slice(0, 3)
        .map((m) => m.product.name).join(", ");
      problems.push(`"${item.name}" — ${near ? `did you mean: ${near}?` : "not in your catalogue"}`);
      continue;
    }
    const unitPrice = item.unitPrice !== undefined ? item.unitPrice : Number(match.price) || 0;
    lines.push({
      description: match.name,
      quantity: item.quantity,
      unit_price: unitPrice,
      gst_rate: Number(match.gst_rate) || 0,
      hsn_code: match.hsn_code || null,
    });
  }
  if (problems.length) {
    await reply(
      fromPhone,
      `I couldn't bill that — ${problems.length} item${problems.length === 1 ? "" : "s"} didn't match your catalogue:\n\n` +
        problems.map((p) => `• ${p}`).join("\n") +
        `\n\nNothing was created. Send the item exactly as it appears in your catalogue, or add it on the Stock page first.`,
    );
    return true;
  }

  // Customer: an explicit name beats a fuzzy match; fall back to a
  // walk-in label so the invoice is still addressable.
  let clientName = "Counter (WhatsApp)";
  let clientPhone: string | null = null;
  let clientGstin: string | null = null;
  let customerRow: any = null;
  if (parsed.customerName) {
    const { data: candidates } = await supabase.from("customers")
      .select("id,name,phone,gstin,user_id")
      .eq("user_id", ownerId)
      .ilike("name", `%${parsed.customerName}%`)
      .limit(10);
    const wanted = parsed.customerName.toLowerCase();
    const exact = (candidates || []).find((c: any) => String(c.name).toLowerCase() === wanted);
    customerRow = exact || (candidates || [])[0] || null;
    if (customerRow) {
      clientName = customerRow.name;
      clientPhone = customerRow.phone || null;
      clientGstin = customerRow.gstin || null;
    } else {
      clientName = parsed.customerName;
    }
  }

  // Invoice maths — identical to the in-app Meraj create_invoice draft.
  const gross = lines.reduce((s: number, it: any) => s + it.quantity * it.unit_price, 0);
  const subtotal = +gross.toFixed(2);
  const hsnMap = new Map<string, any>();
  let taxAmount = 0;
  for (const item of lines) {
    const taxable = item.quantity * item.unit_price;
    const tax = taxable * (item.gst_rate || 0) / 100;
    taxAmount += tax;
    const key = `${item.hsn_code || ""}|${item.gst_rate}`;
    const entry = hsnMap.get(key) || { hsn: item.hsn_code || "", rate: item.gst_rate, taxable: 0, tax: 0 };
    entry.taxable += taxable;
    entry.tax += tax;
    hsnMap.set(key, entry);
  }
  taxAmount = +taxAmount.toFixed(2);
  const taxRate = subtotal > 0 ? +(taxAmount / subtotal * 100).toFixed(2) : 0;
  const total = +(subtotal + taxAmount).toFixed(2);
  const hsnSummary = Array.from(hsnMap.values()).map((e: any) => ({
    hsn: e.hsn, rate: e.rate, taxable: +e.taxable.toFixed(2),
    cgst: +(e.tax / 2).toFixed(2), sgst: +(e.tax / 2).toFixed(2), igst: 0,
  }));
  const invoiceNumber = nextDocNumber("INV");

  const payee = profile.upi_id ? String(profile.upi_id).trim() : "";
  const paymentLink = payee
    ? `upi://pay?pa=${encodeURIComponent(payee)}&pn=${encodeURIComponent(shopName)}&am=${total.toFixed(2)}&cu=INR&tr=${encodeURIComponent(invoiceNumber)}&tn=${encodeURIComponent("Invoice " + invoiceNumber)}`
    : null;

  const { data: invoice, error: insertError } = await supabase.from("invoices").insert({
    user_id: ownerId,
    invoice_number: invoiceNumber,
    client_name: clientName,
    client_phone: clientPhone,
    client_gstin: clientGstin,
    items: lines,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total,
    hsn_summary: hsnSummary,
    is_interstate: false,
    status: "sent",
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    notes: "Created from WhatsApp command",
    payment_link: paymentLink,
  }).select().single();
  if (insertError || !invoice) {
    await reply(fromPhone, `I couldn't create that bill — ${insertError?.message || "unknown error"}. Nothing was charged.`);
    return true;
  }

  await supabase.from("activity_logs").insert({
    user_id: ownerId, action_type: "invoice",
    description: `WhatsApp bill ${invoiceNumber} for ${clientName} — ₹${total}`,
    time_saved_minutes: 6, money_saved: 3, provider: "whatsapp-command",
    metadata: { invoice_number: invoiceNumber, source: "whatsapp" },
  });
  // Realtime card on every logged-in device (automation_events is in the
  // supabase_realtime publication).
  await supabase.from("automation_events").insert({
    user_id: ownerId, type: "wa_order",
    title: `Bill raised from WhatsApp — ${inr(total)}`,
    body: `${invoiceNumber} for ${clientName} · ${lines.length} item${lines.length === 1 ? "" : "s"}`,
    severity: "success", money_impact: total,
    receipt: { invoice_number: invoiceNumber, client: clientName, items: lines, total, tax_amount: taxAmount },
  });

  // Owner confirmation.
  const summary = lines.map((it: any) => `• ${it.description} × ${it.quantity} @ ${inr(it.unit_price)}`).join("\n");
  let ownerMsg = `✅ Bill ${invoiceNumber} created for ${clientName}:\n\n${summary}\n\n` +
    `Subtotal: ${inr(subtotal)}\n` +
    (taxAmount > 0 ? `GST (${taxRate}%): ${inr(taxAmount)}\n` : "") +
    `Total: ${inr(total)}\n`;
  if (paymentLink) ownerMsg += `\nUPI: ${paymentLink}`;

  // Customer copy — only when the bill names someone other than the
  // sender, and only inside Meta's free-text window (best effort).
  let customerNotified = false;
  if (clientPhone && normalizePhone(clientPhone) !== normalizePhone(fromPhone)) {
    try {
      const sent = await sendWhatsAppText(
        normalizePhone(clientPhone),
        buildCustomerBillMessage({ invoice_number: invoiceNumber, items: lines, subtotal, tax_amount: taxAmount, tax_rate: taxRate, total }, shopName, payee || null),
      );
      customerNotified = sent.ok;
    } catch { /* outside 24h window — owner copy already has the UPI link */ }
  }
  if (parsed.customerName && !customerNotified) {
    ownerMsg += `\n\n(Customer message couldn't be sent — outside WhatsApp's 24-hour window. The bill is saved in your Bills page.)`;
  }
  await reply(fromPhone, ownerMsg);
  return true;
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
        const ctx = await resolveBusiness(from);
        // Unmatched/ambiguous messages are ACKed but never written into a
        // tenant's ledger. This is safer than inserting a null or guessed id.
        if (ctx) {
          const { error: insertError } = await supabase.from("whatsapp_messages").insert({
            user_id: ctx.ownerId,
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
          const isDuplicate = insertError && insertError.code === "23505";
          if (insertError && !isDuplicate) console.error("[whatsapp-webhook] message insert failed");
          // Billing commands run ONCE per message id, only for the
          // business's own people, only when the owner opted in.
          if (!insertError && ctx.senderIsStaff && text) {
            try {
              await handleOrderCommand(ctx.ownerId, from, text);
            } catch (err) {
              console.error("[whatsapp-webhook] order command failed", err);
            }
          }
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
