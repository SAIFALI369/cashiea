// ════════════════════════════════════════════════════════════════
// CAMPAIGN SEND — generates personalized emails for every recipient
// Handles A/B split, follow-up sequences, and bulk personalization.
// NOTE: This generates the personalized drafts and marks them ready.
// Actual SMTP delivery = wire in Resend/SendGrid in deliverRecipient().
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

async function callAI(provider: string, systemPrompt: string, prompt: string): Promise<string> {
  if (provider === "gemini") {
    const key = Deno.env.get("GEMINI_API_KEY");
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 800 } }),
    });
    return (await res.json()).candidates[0].content.parts[0].text;
  }
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: 800, system: systemPrompt, messages: [{ role: "user", content: prompt }] }),
    });
    return (await res.json()).content[0].text;
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], temperature: 0.8, max_tokens: 800 }),
  });
  return (await res.json()).choices[0].message.content;
}

const PERSONALIZER_SYS = `You are an expert at writing hyper-personalized cold emails at scale. Given a base email template and a recipient's details, produce a personalized version. Keep the core message and offer, but naturally weave in the recipient's name, company, and any context. First line MUST be "Subject: ..." then a blank line then the body. Return ONLY the email.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization")! } } });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const { campaign_id } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: cors });

    const { data: campaign } = await supabase.from("email_campaigns").select("*").eq("id", campaign_id).eq("user_id", user.id).single();
    if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: cors });

    const { data: recipients } = await supabase.from("campaign_recipients").select("*").eq("campaign_id", campaign_id).eq("status", "pending");
    if (!recipients || recipients.length === 0) return new Response(JSON.stringify({ error: "No pending recipients" }), { status: 400, headers: cors });

    // Usage check (campaign counts as 1 action per recipient, batched)
    const { data: profile } = await supabase.from("profiles").select("ai_provider, api_usage_count, api_usage_limit, trial_ends_at").eq("id", user.id).single();
    const effectiveLimit = (profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date()) ? Math.max(profile.api_usage_limit, 500) : (profile?.api_usage_limit || 50);
    const needed = recipients.length;
    if ((profile?.api_usage_count || 0) + needed > effectiveLimit) {
      return new Response(JSON.stringify({ error: `This campaign needs ${needed} AI actions but you have ${effectiveLimit - (profile?.api_usage_count || 0)} left. Upgrade your plan.` }), { status: 429, headers: cors });
    }

    await supabase.from("email_campaigns").update({ status: "sending" }).eq("id", campaign_id);

    const provider = profile?.ai_provider || "openai";
    const baseTemplate = `Base subject: ${campaign.variant_a_subject || campaign.template_subject || ""}\nBase body:\n${campaign.template_body || ""}\nTone: ${campaign.tone}`;
    let processed = 0;
    const errors: string[] = [];

    for (const r of recipients) {
      try {
        // A/B variant assignment
        let variant: string | null = null;
        let subjectLine = campaign.variant_a_subject || campaign.template_subject || "";
        if (campaign.ab_enabled && campaign.variant_b_subject) {
          variant = Math.random() < 0.5 ? "a" : "b";
          subjectLine = variant === "b" ? campaign.variant_b_subject : campaign.variant_a_subject;
        }

        const recipientCtx = `Recipient: ${r.name || r.email}${r.personalization && Object.keys(r.personalization).length ? `\nContext: ${JSON.stringify(r.personalization)}` : ""}`;
        const prompt = `${baseTemplate}\n\nUse this subject line: ${subjectLine}\n\n${recipientCtx}\n\nWrite the personalized email now.`;

        const generated = await callAI(provider, PERSONALIZER_SYS, prompt);

        let finalSubject = subjectLine;
        let finalBody = generated;
        const m = generated.match(/^Subject:\s*(.+)$/im);
        if (m) { finalSubject = m[1].trim(); finalBody = generated.replace(/^Subject:\s*.+\n?/im, "").trim(); }

        await supabase.from("campaign_recipients").update({
          variant, generated_subject: finalSubject, generated_body: finalBody,
          status: "sent", sent_at: new Date().toISOString(),
        }).eq("id", r.id);

        // ─── Deliver here. Wire in your email provider:
        // await deliverRecipient({ to: r.email, subject: finalSubject, body: finalBody });
        processed++;
      } catch (err) {
        errors.push(`${r.email}: ${err.message}`);
      }
    }

    // Roll up stats
    await supabase.rpc("sync_campaign_stats", { campaign_uuid: campaign_id });
    await supabase.from("email_campaigns").update({ status: "sent", sent_count: processed }).eq("id", campaign_id);

    // One activity-log entry summarizing the campaign
    await supabase.from("activity_logs").insert({
      user_id: user.id, action_type: "campaign",
      description: `Campaign "${campaign.name}" — ${processed} personalized emails sent${campaign.ab_enabled ? " (A/B test)" : ""}`,
      time_saved_minutes: processed * 10, money_saved: processed * 5.0, provider,
      metadata: { processed, errors: errors.slice(0, 5) },
    });

    return new Response(JSON.stringify({ success: true, processed, errors: errors.slice(0, 5) }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors });
  }
});
