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

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
  const authHeader = req.headers.get("authorization") || "";
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expectedKey || !authHeader.endsWith(expectedKey)) {
    return new Response(JSON.stringify({ error: "Unauthorized — service-role only" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const now = new Date();
    // Unpaid = sent, viewed, partial, or overdue (not draft/paid)
    const { data: invoices } = await supabase.from("invoices")
      .select("*")
      .in("status", ["sent", "viewed", "partial", "overdue"])
      .order("created_at", { ascending: false });

    if (!invoices || invoices.length === 0) {
      return new Response(JSON.stringify({ reminders_sent: 0 }), { headers: { "Content-Type": "application/json" } });
    }

    let sent = 0;
    let skipped = 0;

    for (const inv of invoices) {
      // Mark overdue if due_date passed
      let newStatus = inv.status;
      if (inv.due_date && new Date(inv.due_date) < now && inv.status !== "overdue") {
        newStatus = "overdue";
      }

      // Throttle: max 1 reminder per 3 days, max 5 reminders
      const tooSoon = inv.last_reminder_at && (now.getTime() - new Date(inv.last_reminder_at).getTime()) < 3 * 86400000;
      const tooMany = (inv.reminder_count || 0) >= 5;
      if (tooSoon || tooMany) { skipped++; continue; }

      // Send email reminder if we have an address
      let emailed = false;
      if (inv.client_email) {
        const subject = inv.status === "overdue"
          ? `Overdue: Invoice ${inv.invoice_number} — ₹${inv.total}`
          : `Reminder: Invoice ${inv.invoice_number}`;
        const html = `
          <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b;">
            <h2 style="color:#4f46e5;">Invoice ${inv.invoice_number}</h2>
            <p>Hi ${inv.client_name},</p>
            <p>This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> for <strong>₹${inv.total}</strong> ${inv.status === "overdue" ? "is <span style=\"color:#dc2626\">overdue</span>" : "is due"}.</p>
            ${inv.payment_link ? `<p style="margin:24px 0;"><a href="${inv.payment_link}" style="background:#4f46e5;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Pay ₹${inv.total} via UPI</a></p>` : ""}
            <p>Thank you for your business!</p>
          </div>`;
        emailed = await sendEmail(inv.client_email, subject, html).catch(() => false);
      }

      // Log the reminder + update the invoice
      await supabase.from("invoice_reminders").insert({
        invoice_id: inv.id, user_id: inv.user_id,
        channel: emailed ? "email" : "upi",
        notes: inv.client_email ? `Reminder #${(inv.reminder_count || 0) + 1}` : "No email — manual reminder needed",
      });
      await supabase.from("invoices").update({
        reminder_count: (inv.reminder_count || 0) + 1,
        last_reminder_at: now.toISOString(),
        status: newStatus,
      }).eq("id", inv.id);
      if (emailed) sent++;
    }

    return new Response(JSON.stringify({
      scanned: invoices.length, reminders_sent: sent, skipped, date: now.toISOString(),
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
