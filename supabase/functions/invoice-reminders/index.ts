// ════════════════════════════════════════════════════════════════
// INVOICE REMINDERS (cron) — auto-reminds customers about unpaid
// invoices via email (Resend) and/or WhatsApp/SMS deep links.
//
// Schedule: Supabase Dashboard → Database → Scheduled Functions,
// POST to /invoice-reminders with the service role key, e.g. daily.
//
// Deploy:  supabase functions deploy invoice-reminders
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { resolveBusiness } from "../_shared/business.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character] || character));
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isServiceRole = !!expectedKey && bearer === expectedKey;
  let ownerId: string | null = null;
  if (!isServiceRole) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!anonKey || !authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const caller = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const business = await resolveBusiness(supabase, user.id);
    if (!business || !business.isOwner) {
      return json({ error: "Only the business owner can retry invoice reminders" }, 403);
    }
    ownerId = business.ownerId;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedInvoiceId = body.invoice_id == null ? null : String(body.invoice_id);
    if (requestedInvoiceId && !/^[0-9a-f-]{36}$/i.test(requestedInvoiceId)) return json({ error: "invoice_id is invalid" }, 400);
    // A browser retry must target the exact failed invoice. Without this guard,
    // one click in Failed Jobs could legitimately scan and send every due invoice
    // in the business.
    if (ownerId && !requestedInvoiceId) return json({ error: "invoice_id is required for a manual reminder retry" }, 400);

    const now = new Date();
    // Unpaid = sent, viewed, partial, or overdue (not draft/paid)
    let invoiceQuery = supabase.from("invoices")
      .select("*")
      .in("status", ["sent", "viewed", "partial", "overdue"])
      .order("created_at", { ascending: false })
      .limit(500);
    if (ownerId) invoiceQuery = invoiceQuery.eq("user_id", ownerId);
    if (requestedInvoiceId) invoiceQuery = invoiceQuery.eq("id", requestedInvoiceId);
    const { data: invoices } = await invoiceQuery;

    if (!invoices || invoices.length === 0) {
      return json({ reminders_sent: 0 });
    }

    let sent = 0;
    let skipped = 0;

    for (const inv of invoices) {
      // Claim with a row lock before contacting the customer. The claim
      // operation owns throttling/counting and is idempotent across cron
      // retries, so two workers cannot send the same reminder.
      const claimId = crypto.randomUUID();
      const { data: claim, error: claimError } = await supabase.rpc("claim_invoice_reminder", {
        p_invoice_id: inv.id,
        p_owner_id: inv.user_id,
        p_claim_id: claimId,
      });
      if (claimError) throw new Error("Reminder worker is not available; deploy schema v27 first");
      if (!claim?.claimed) { skipped++; continue; }
      const newStatus = String(claim.status || inv.status);
      const reminderNumber = Number(claim.reminder_count || inv.reminder_count || 0) + 1;

      // Send email reminder if we have an address. All invoice-derived values
      // are escaped before entering HTML; invoice fields are user input.
      let emailed = false;
      if (inv.client_email) {
        const subject = newStatus === "overdue"
          ? `Overdue: Invoice ${inv.invoice_number} — ₹${inv.total}`
          : `Reminder: Invoice ${inv.invoice_number}`;
        const invoiceNumber = escapeHtml(String(inv.invoice_number || ""));
        const clientName = escapeHtml(String(inv.client_name || "Customer"));
        const total = escapeHtml(String(inv.total ?? "0"));
        const paymentLink = typeof inv.payment_link === "string" && /^(https?):\/\//i.test(inv.payment_link)
          ? escapeHtml(inv.payment_link)
          : "";
        const html = `
          <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b;">
            <h2 style="color:#4f46e5;">Invoice ${invoiceNumber}</h2>
            <p>Hi ${clientName},</p>
            <p>This is a friendly reminder that invoice <strong>${invoiceNumber}</strong> for <strong>₹${total}</strong> ${newStatus === "overdue" ? "is <span style=\"color:#dc2626\">overdue</span>" : "is due"}.</p>
            ${paymentLink ? `<p style="margin:24px 0;"><a href="${paymentLink}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Pay ₹${total} via UPI</a></p>` : ""}
            <p>Thank you for your business!</p>
          </div>`;
        emailed = await sendEmail(inv.client_email, subject, html).catch(() => false);
      }

      // A missing customer email is an intentional manual/UPI reminder path.
      // Failed provider delivery releases the claim without consuming a slot,
      // so the next run can retry instead of suppressing the invoice for days.
      const delivered = emailed || !inv.client_email;
      const { data: finished, error: finishError } = await supabase.rpc("finish_invoice_reminder", {
        p_invoice_id: inv.id,
        p_owner_id: inv.user_id,
        p_claim_id: claimId,
        p_delivered: delivered,
      });
      if (finishError) throw new Error("Could not finalize invoice reminder");
      if (!finished) { skipped++; continue; }

      if (delivered) {
        try {
          await supabase.from("invoice_reminders").insert({
            invoice_id: inv.id, user_id: inv.user_id,
            channel: emailed ? "email" : "upi",
            notes: inv.client_email ? `Reminder #${reminderNumber}` : "No email — manual reminder needed",
          });
        } catch { /* the invoice throttle is authoritative; ledger is best-effort */ }
      }
      if (emailed) sent++;
      else if (!delivered) skipped++;
    }

    return json({ scanned: invoices.length, reminders_sent: sent, skipped, date: now.toISOString() });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
