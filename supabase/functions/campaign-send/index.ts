// ════════════════════════════════════════════════════════════════
// CAMPAIGN SEND — generates personalized emails + DELIVERS them.
//
// Delivery: set RESEND_API_KEY (recommended) to actually send to inboxes.
//   supabase secrets set RESEND_API_KEY=re_...
//   supabase secrets set MAIL_FROM=you@yourdomain.com
// If no key is set, emails are generated & saved as "drafts" so you can
// review/export them — the response tells you which mode ran.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";

const TRACK_BASE = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".functions.supabase.co") + "/track" || "";

// AI calls go through _shared/ai-call.ts (Groq primary + Gemini fallback — same as Meraj chat).

const PERSONALIZER_SYS = `You are an expert at writing hyper-personalized cold emails at scale. Given a base email template and a recipient's details, produce a personalized version. Keep the core message and offer, but naturally weave in the recipient's name, company, and any context. First line MUST be "Subject: ..." then a blank line then the body. Return ONLY the email.`;

// Real delivery via Resend (https://resend.com). Returns true on success.
async function deliverViaResend(to: string, subject: string, htmlBody: string, recipientId: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return false;

  // Inject open-tracking pixel + wrap link clicks (best-effort)
  const openPixel = TRACK_BASE ? `<img src="${TRACK_BASE}?e=${recipientId}&t=open" width="1" height="1" alt="" />` : "";
  const html = htmlBody.replace(/\n/g, "<br>") + openPixel;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const { campaign_id } = await req.json();
    if (!campaign_id) return json({ error: "campaign_id required" }, 400);

    const { data: campaign } = await supabase.from("email_campaigns").select("*").eq("id", campaign_id).eq("user_id", user.id).single();
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const { data: recipients } = await supabase.from("campaign_recipients").select("*").eq("campaign_id", campaign_id).eq("status", "pending");
    if (!recipients || recipients.length === 0) return json({ error: "No pending recipients" }, 400);

    const { data: profile } = await supabase.from("profiles").select("ai_provider, api_usage_count, api_usage_limit, trial_ends_at").eq("id", user.id).single();
    const onTrial = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date();
    const effectiveLimit = onTrial ? Math.max(profile.api_usage_limit, 500) : (profile?.api_usage_limit || 50);
    if ((profile?.api_usage_count || 0) + recipients.length > effectiveLimit) {
      return json({ error: `This campaign needs ${recipients.length} AI actions but you have ${effectiveLimit - (profile?.api_usage_count || 0)} left. Upgrade your plan.` }, 429);
    }

    await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaign_id);

    const provider = profile?.ai_provider || "openai";
    const baseTemplate = `Base subject: ${campaign.variant_a_subject || campaign.template_subject || ""}\nBase body:\n${campaign.template_body || ""}\nTone: ${campaign.tone}`;
    const deliveryEnabled = !!(Deno.env.get("RESEND_API_KEY") && Deno.env.get("MAIL_FROM"));

    let processed = 0;
    let delivered = 0;
    const errors: string[] = [];

    for (const r of recipients) {
      try {
        let variant: string | null = null;
        let subjectLine = campaign.variant_a_subject || campaign.template_subject || "";
        if (campaign.ab_enabled && campaign.variant_b_subject) {
          variant = Math.random() < 0.5 ? "a" : "b";
          subjectLine = variant === "b" ? campaign.variant_b_subject : campaign.variant_a_subject;
        }

        const recipientCtx = `Recipient: ${r.name || r.email}${r.personalization && Object.keys(r.personalization).length ? `\nContext: ${JSON.stringify(r.personalization)}` : ""}`;
        const prompt = `${baseTemplate}\n\nUse this subject line: ${subjectLine}\n\n${recipientCtx}\n\nWrite the personalized email now.`;

        const generated = await callAIWithFallback(provider, PERSONALIZER_SYS, prompt, 800, "campaign");

        let finalSubject = subjectLine;
        let finalBody = generated;
        const m = generated.match(/^Subject:\s*(.+)$/im);
        if (m) { finalSubject = m[1].trim(); finalBody = generated.replace(/^Subject:\s*.+\n?/im, "").trim(); }

        // Replace {name}/{company} merge tags in body as a safety net
        finalBody = finalBody
          .replace(/\{name\}/gi, r.name || "there")
          .replace(/\{company\}/gi, String((r.personalization as Record<string, unknown>)?.company || "your company"));

        // Deliver if configured; otherwise keep as draft for review
        const sentOk = deliveryEnabled ? await deliverViaResend(r.email, finalSubject, finalBody, r.id) : false;

        await supabase.from("campaign_recipients").update({
          variant,
          generated_subject: finalSubject,
          generated_body: finalBody,
          status: sentOk ? "sent" : "pending",
          sent_at: sentOk ? new Date().toISOString() : null,
        }).eq("id", r.id);

        if (sentOk) delivered++;
        processed++;
      } catch (err) {
        errors.push(`${r.email}: ${err.message}`);
      }
    }

    await supabase.rpc("sync_campaign_stats", { campaign_uuid: campaign_id });
    await supabase.from("email_campaigns").update({
      status: deliveryEnabled ? "sent" : "draft",
      sent_count: delivered,
    }).eq("id", campaign_id);

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action_type: "campaign",
      description: `Campaign "${campaign.name}" — ${processed} personalized${deliveryEnabled ? `, ${delivered} delivered` : " (drafts — add RESEND_API_KEY to deliver)"}`,
      time_saved_minutes: processed * 10,
      money_saved: processed * 5.0,
      provider,
      metadata: { processed, delivered, deliveryEnabled, errors: errors.slice(0, 5) },
    });

    return json({
      success: true,
      processed,
      delivered,
      deliveryEnabled,
      message: deliveryEnabled
        ? `Generated and delivered ${delivered} emails`
        : `Generated ${processed} personalized drafts. Set RESEND_API_KEY + MAIL_FROM secrets to deliver to inboxes.`,
      errors: errors.slice(0, 5),
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
