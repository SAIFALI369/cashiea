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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";

const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "supportcashiea@gmail.com";
const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 10_000;

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] || character));
}

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
        <tr><td style="padding: 6px 0; font-weight: 600; width: 100px;">Name:</td><td>${escapeHtml(name)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Email:</td><td>${escapeHtml(from)}</td></tr>
        <tr><td style="padding: 6px 0; font-weight: 600;">Subject:</td><td>${escapeHtml(subject)}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
      <p style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
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
    // SECURITY: support email is only for signed-in Cashiea users. Without this
    // check anyone could use the endpoint as a free spam relay.
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "You must be signed in to contact support." }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Support service is not configured" }, 503);

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ error: "You must be signed in to contact support." }, 401);

    let body: { name?: unknown; email?: unknown; subject?: unknown; message?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const subject = typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : "General enquiry";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || !email || !message) return json({ error: "Name, email, and message are required" }, 400);
    if (name.length > MAX_NAME || email.length > MAX_EMAIL || subject.length > MAX_SUBJECT || message.length > MAX_MESSAGE) {
      return json({ error: "One or more fields exceed the allowed length" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !user.email || email !== user.email.toLowerCase()) {
      return json({ error: "Use the email address on your Cashiea account" }, 400);
    }
    if ([name, email, subject, message].some((value) => /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))) {
      return json({ error: "Control characters are not allowed" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from("support_requests")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if (countError) return json({ error: "Support service is not ready; please try again later" }, 503);
    if ((count || 0) >= 5) return json({ error: "Please wait before sending another support request" }, 429);

    // Record the attempt before delivery. This rate-limits both Resend and the
    // mailto fallback, so a user cannot bypass the quota by repeatedly retrying.
    const { error: ledgerError } = await admin.from("support_requests").insert({
      user_id: user.id, email, subject,
    });
    if (ledgerError) return json({ error: "Support service is not ready; please try again later" }, 503);

    // Try real delivery; if not configured, fall back to a mailto link.
    const sent = await sendViaResend(name, email, subject, message).catch(() => false);

    if (sent) return json({ ok: true, delivered: true });

    return json({
      ok: true,
      delivered: false,
      mailto: buildMailto(name, email, subject, message),
      message: "Your email app will open with the message pre-filled. Just press send.",
    });
  } catch (e) {
    console.error("[support-email] request failed", e);
    return json({ error: "Support request failed" }, 500);
  }
});
