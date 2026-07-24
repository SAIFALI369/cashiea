// ════════════════════════════════════════════════════════════════
// SUPPORT EMAIL — sends the support/contact form to supportcashiea@gmail.com
//
// Uses Resend when RESEND_API_KEY + MAIL_FROM are set (real email delivery).
// Otherwise returns a { mailto } URL so the client can open the user's
// email app with the form pre-filled as a reliable fallback.
//
// Setup (optional, to send automatically):
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set MAIL_FROM=you@yourdomain.com
//   supabase secrets set SUPPORT_EMAIL=supportcashiea@gmail.com
//
// Deploy:  supabase functions deploy support-email
// ════════════════════════════════════════════════════════════════

import { corsHeaders, json } from "../_shared/retry.ts";

const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "supportcashiea@gmail.com";

function buildMailto(name: string, from: string, subject: string, message: string): string {
  const body = [
    `Name: ${name}`,
    `Email: ${from}`,
    ``,
    `Message:`,
    message,
    ``,
    `— Sent from the Cashiea support form`,
  ].join("\n");
  const params = new URLSearchParams({
    subject: `[Cashiea Support] ${subject}`,
    body,
  });
  // cc the sender so they have a copy of their own message
  if (from) params.set("cc", from);
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

async function sendViaResend(name: string, from: string, subject: string, message: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const mailFrom = Deno.env.get("MAIL_FROM");
  if (!key || !mailFrom) return false;

  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: auto; color: #1e293b;">
      <h2 style="color: #4f46e5;">New Support Request — Cashiea</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; font-weight: 600; width: 100px;">Name:</td><td>${name}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Email:</td><td>${from}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Subject:</td><td>${subject}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
      <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">Sent from the Cashiea support form.</p>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: mailFrom,
      to: [SUPPORT_EMAIL],
      reply_to: from || undefined,
      subject: `[Cashiea Support] ${subject}`,
      html,
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return json({ error: "Name, email, and message are required" }, 400);
    }
    if (message.length > 10000) {
      return json({ error: "Message is too long (max 10,000 characters)" }, 400);
    }

    // Try real delivery; if not configured, fall back to a mailto link
    const sent = await sendViaResend(name, email, subject || "General enquiry", message).catch(() => false);

    if (sent) {
      return json({ ok: true, delivered: true });
    }

    return json({
      ok: true,
      delivered: false,
      mailto: buildMailto(name, email, subject || "General enquiry", message),
      message: "Your email app will open with the message pre-filled. Just press send.",
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
