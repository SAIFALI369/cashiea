// ════════════════════════════════════════════════════════════════
// CAMPAIGN SEND — generate personalized drafts and optionally deliver them.
//
// This worker is deliberately single-flight per campaign. The database claims
// the campaign and each recipient, so a double-click, two tabs, or a retried
// edge invocation cannot process the same pending row at the same time. Stale
// runs are reclaimed by claim_campaign_send after the heartbeat expires.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";
import { createTrackingToken } from "../_shared/tracking.ts";
import { resolveBusiness } from "../_shared/business.ts";
import { releaseApiUsage } from "../_shared/usage.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const TRACK_BASE = (Deno.env.get("TRACK_BASE_URL") || `${SUPABASE_URL}/functions/v1/track`).replace(/\/+$/, "");
const MAX_RECIPIENT_ATTEMPTS = 8;
const SEND_STALE_SECONDS = 900;
const AI_TIMEOUT_MS = 45_000;

const PERSONALIZER_SYS = `You are an expert at writing hyper-personalized cold emails at scale. Given a base email template and a recipient's details, produce a personalized version. Keep the core message and offer, but naturally weave in the recipient's name, company, and any context. First line MUST be "Subject: ..." then a blank line then the body. Return ONLY the email.`;

type DeliveryResult = { ok: true } | { ok: false; status: number; retryable: boolean; message: string };

type CampaignRecipient = {
  id: string;
  email: string;
  name?: string | null;
  personalization?: Record<string, unknown> | null;
  status: string;
  variant?: string | null;
  generated_subject?: string | null;
  generated_body?: string | null;
  attempt_count?: number | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character] || character));
}

function safeError(error: unknown, fallback = "Operation failed"): string {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500) || fallback;
}

function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AI provider timed out")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

async function trackedBody(text: string, recipientId: string): Promise<string> {
  const urlPattern = /https?:\/\/[^\s<>\"']+/gi;
  let html = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(text)) !== null) {
    html += escapeHtml(text.slice(cursor, match.index)).replace(/\n/g, "<br>");
    const raw = match[0];
    const trailing = (raw.match(/[.,!?;:]+$/) || [""])[0];
    const destination = trailing ? raw.slice(0, -trailing.length) : raw;
    const token = await createTrackingToken(recipientId, "click", destination);
    html += `<a href="${TRACK_BASE}?k=${token}&amp;t=click">${escapeHtml(destination)}</a>${escapeHtml(trailing)}`;
    cursor = match.index + raw.length;
  }
  html += escapeHtml(text.slice(cursor)).replace(/\n/g, "<br>");
  return html;
}

async function deliverViaResend(to: string, subject: string, bodyText: string, recipientId: string): Promise<DeliveryResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from || !TRACK_BASE) {
    return { ok: false, status: 0, retryable: false, message: "Email delivery is not configured" };
  }

  const openToken = await createTrackingToken(recipientId, "open");
  const openPixel = `<img src="${TRACK_BASE}?k=${openToken}&amp;t=open" width="1" height="1" alt="" />`;
  const html = `${await trackedBody(bodyText, recipientId)}${openPixel}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        // Resend supports idempotency keys. Reusing the recipient id closes the
        // crash window between provider acceptance and our database update.
        "Idempotency-Key": `cashiea-recipient-${recipientId}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (res.ok) return { ok: true };
    const responseText = (await res.text().catch(() => "")).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 240);
    return {
      ok: false,
      status: res.status,
      retryable: res.status === 408 || res.status === 409 || res.status === 425 || res.status === 429 || res.status >= 500,
      message: `Email provider returned ${res.status}${responseText ? `: ${responseText}` : ""}`,
    };
  } catch (error) {
    return { ok: false, status: 0, retryable: true, message: safeError(error, "Email provider network error") };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let admin: any = null;
  let ownerId = "";
  let campaignId = "";
  let runId = "";
  let claimed = false;

  try {
    const authorization = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !anonKey || !serviceKey) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const business = await resolveBusiness(admin, user.id);
    if (!business) return json({ error: "Your account is not linked to exactly one active business" }, 403);
    if (!["owner", "manager"].includes(business.role)) return json({ error: "Your role cannot launch campaigns" }, 403);
    ownerId = business.ownerId;

    let body: { campaign_id?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    campaignId = typeof body.campaign_id === "string" ? body.campaign_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return json({ error: "campaign_id is invalid" }, 400);

    const { data: campaign, error: campaignError } = await admin
      .from("email_campaigns").select("*").eq("id", campaignId).eq("user_id", ownerId).maybeSingle();
    if (campaignError) return json({ error: "Could not read campaign" }, 503);
    if (!campaign) return json({ error: "Campaign not found" }, 404);

    const deliveryEnabled = !!(Deno.env.get("RESEND_API_KEY") && Deno.env.get("MAIL_FROM") && TRACK_BASE);
    runId = crypto.randomUUID();
    const { data: didClaim, error: claimError } = await admin.rpc("claim_campaign_send", {
      p_campaign_id: campaignId,
      p_run_id: runId,
      p_stale_after_seconds: SEND_STALE_SECONDS,
      p_include_generated: deliveryEnabled,
    });
    if (claimError) return json({ error: "Campaign worker is not available; deploy schema v27 first" }, 503);
    if (!didClaim) return json({ error: "This campaign is already being sent, is paused, or has no retryable work." }, 409);
    claimed = true;

    const retryFilter = deliveryEnabled
      ? `status.in.(pending,generated),and(status.eq.failed,attempt_count.lt.${MAX_RECIPIENT_ATTEMPTS}),and(status.eq.failed,attempt_count.is.null)`
      : `status.in.(pending),and(status.eq.failed,attempt_count.lt.${MAX_RECIPIENT_ATTEMPTS}),and(status.eq.failed,attempt_count.is.null)`;
    const { data: recipients, error: recipientError } = await admin
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("user_id", ownerId)
      .or(retryFilter)
      .order("created_at", { ascending: true })
      .limit(501);
    if (recipientError) throw new Error("Could not read recipients");
    if (!recipients || recipients.length === 0) throw new Error("No retryable recipients remain");
    if (recipients.length > 500) throw new Error("Send at most 500 recipients per campaign batch");

    const provider = campaign.provider || "openai";
    const baseTemplate = `Base subject: ${campaign.variant_a_subject || campaign.template_subject || ""}\nBase body:\n${campaign.template_body || ""}\nTone: ${campaign.tone || "professional"}`;
    let processed = 0;
    let delivered = 0;
    let generated = 0;
    let quotaExhausted = false;
    let providerBlocked = false;
    const errors: string[] = [];

    const touch = async () => {
      await admin.from("email_campaigns")
        .update({ send_heartbeat_at: new Date().toISOString() })
        .eq("id", campaignId).eq("user_id", ownerId).eq("send_run_id", runId);
    };

    const markFailed = async (recipientId: string, message: string) => {
      await admin.from("campaign_recipients").update({
        status: "failed",
        last_error: message.slice(0, 500),
        processing_run_id: null,
        processing_at: null,
      }).eq("id", recipientId).eq("campaign_id", campaignId).eq("user_id", ownerId).eq("processing_run_id", runId);
    };

    for (const candidate of recipients as CampaignRecipient[]) {
      await touch();

      // Atomically claim this row. A second worker sees processing instead and
      // moves on; it never generates or delivers the same recipient.
      const { data: recipient, error: claimRecipientError } = await admin
        .from("campaign_recipients")
        .update({
          status: "processing",
          processing_run_id: runId,
          processing_at: new Date().toISOString(),
          attempt_count: Math.min(MAX_RECIPIENT_ATTEMPTS, Number(candidate.attempt_count || 0) + 1),
          last_error: null,
        })
        .eq("id", candidate.id)
        .eq("campaign_id", campaignId)
        .eq("user_id", ownerId)
        .in("status", ["pending", "generated", "failed"])
        .select("*")
        .maybeSingle();
      if (claimRecipientError) throw new Error("Could not claim a campaign recipient");
      if (!recipient) continue;
      processed++;

      const r = recipient as CampaignRecipient;
      let recipientUsageReserved = false;
      let recipientUsageConsumed = false;
      try {
        if (!validEmail(r.email)) throw new Error("Recipient email is invalid");

        let variant = r.variant || null;
        let subjectLine = campaign.variant_a_subject || campaign.template_subject || "";
        let finalSubject = subjectLine;
        let finalBody = "";
        const reusableDraft = r.status === "processing" && !!r.generated_body;

        // A generated draft can be delivered later without consuming another AI
        // token. New/failed rows need one atomic quota reservation before AI.
        if (reusableDraft) {
          finalSubject = r.generated_subject || subjectLine;
          finalBody = r.generated_body || "";
          variant = r.variant || null;
        } else {
          const { data: reserved, error: reservationError } = await admin.rpc("reserve_api_usage", {
            p_user_id: ownerId,
            p_amount: 1,
          });
          if (reservationError) throw new Error("Could not reserve AI usage");
          if (!reserved) {
            quotaExhausted = true;
            // No AI call happened, so do not burn an attempt or turn a clean
            // pending row into a failure. Put the claimed row back in its
            // prior retryable state and leave every untouched row unchanged.
            await admin.from("campaign_recipients").update({
              status: candidate.status,
              attempt_count: Math.max(0, Number(r.attempt_count || 1) - 1),
              processing_run_id: null,
              processing_at: null,
              last_error: "AI usage limit reached; retry after the quota resets",
            }).eq("id", r.id).eq("campaign_id", campaignId).eq("user_id", ownerId).eq("processing_run_id", runId);
            break;
          }
          recipientUsageReserved = true;

          if (campaign.ab_enabled && campaign.variant_b_subject) {
            variant = Math.random() < 0.5 ? "a" : "b";
            subjectLine = variant === "b" ? campaign.variant_b_subject : campaign.variant_a_subject;
          }
          const recipientCtx = `Recipient: ${r.name || r.email}${r.personalization && Object.keys(r.personalization).length ? `\nContext: ${JSON.stringify(r.personalization)}` : ""}`;
          const prompt = `${baseTemplate}\n\nUse this subject line: ${subjectLine}\n\n${recipientCtx}\n\nWrite the personalized email now.`;
          const generatedEmail = await withTimeout(callAIWithFallback(provider, PERSONALIZER_SYS, prompt, 1500, "campaign"), AI_TIMEOUT_MS);
          if (!generatedEmail || !generatedEmail.trim()) throw new Error("AI returned an empty email");
          recipientUsageConsumed = true;

          finalSubject = subjectLine;
          finalBody = generatedEmail.trim();
          const subjectMatch = finalBody.match(/^Subject:\s*(.+)$/im);
          if (subjectMatch) {
            finalSubject = subjectMatch[1].trim();
            finalBody = finalBody.replace(/^Subject:\s*.+\n?/im, "").trim();
          }
          finalBody = finalBody
            .replace(/\{name\}/gi, r.name || "there")
            .replace(/\{company\}/gi, String(r.personalization?.company || "your company"));
        }

        finalSubject = finalSubject.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200) || "Cashiea update";
        finalBody = finalBody.slice(0, 50_000).trim();
        if (!finalBody) throw new Error("Email body is empty");

        if (!deliveryEnabled) {
          const { error: saveDraftError } = await admin.from("campaign_recipients").update({
            variant,
            generated_subject: finalSubject.slice(0, 500),
            generated_body: finalBody,
            status: "generated",
            sent_at: null,
            processing_run_id: null,
            processing_at: null,
            last_error: null,
          }).eq("id", r.id).eq("campaign_id", campaignId).eq("user_id", ownerId).eq("processing_run_id", runId);
          if (saveDraftError) throw new Error("Could not save generated recipient");
          generated++;
          continue;
        }

        const delivery = await deliverViaResend(r.email.trim(), finalSubject, finalBody, r.id);
        if (!delivery.ok) {
          await markFailed(r.id, delivery.message);
          errors.push(`${r.email}: ${delivery.message}`);
          if (delivery.retryable) {
            providerBlocked = true;
            break;
          }
          continue;
        }

        const { error: saveError } = await admin.from("campaign_recipients").update({
          variant,
          generated_subject: finalSubject.slice(0, 500),
          generated_body: finalBody,
          status: "sent",
          sent_at: new Date().toISOString(),
          processing_run_id: null,
          processing_at: null,
          last_error: null,
        }).eq("id", r.id).eq("campaign_id", campaignId).eq("user_id", ownerId).eq("processing_run_id", runId);
        if (saveError) throw new Error("Could not save delivered recipient");
        delivered++;
      } catch (error) {
        const message = safeError(error);
        await markFailed(r.id, message);
        errors.push(`${r.email || r.id}: ${message}`);
        // A failed AI/configuration call is usually global, not recipient
        // specific. Stop the run so 500 recipients do not all consume quota
        // during an upstream outage; untouched rows remain pending.
        providerBlocked = true;
        break;
      } finally {
        if (recipientUsageReserved && !recipientUsageConsumed) await releaseApiUsage(admin, ownerId);
      }
    }

    await touch();
    const { error: statsError } = await admin.rpc("sync_campaign_stats", { campaign_uuid: campaignId });
    if (statsError) errors.push("Could not refresh campaign statistics");

    const { data: allRows, error: allRowsError } = await admin
      .from("campaign_recipients")
      .select("status,attempt_count")
      .eq("campaign_id", campaignId).eq("user_id", ownerId);
    if (allRowsError) throw new Error("Could not calculate campaign result");
    const counts = (allRows || []).reduce((acc: Record<string, number>, row: { status: string }) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    const sent = (counts.sent || 0) + (counts.opened || 0) + (counts.clicked || 0) + (counts.replied || 0);
    const retryable = (allRows || []).reduce((count: number, row: { status: string; attempt_count?: number | null }) => {
      if (row.status === "pending" || row.status === "processing") return count + 1;
      if (deliveryEnabled && row.status === "generated") return count + 1;
      if (row.status === "failed" && Number(row.attempt_count || 0) < MAX_RECIPIENT_ATTEMPTS) return count + 1;
      return count;
    }, 0);
    const completed = sent + (!deliveryEnabled ? (counts.generated || 0) : 0);
    const finalStatus = !deliveryEnabled && completed > 0 && retryable === 0
      ? "draft"
      : retryable > 0
        ? (completed > 0 ? "partial" : "failed")
        : sent > 0
          ? "sent"
          : "failed";
    const resultMessage = quotaExhausted
      ? "AI usage limit reached; remaining recipients were left for a later retry."
      : providerBlocked
        ? "The provider stopped this batch; failed recipients are retryable."
        : !deliveryEnabled
          ? `Generated ${generated} personalized drafts. Set RESEND_API_KEY and MAIL_FROM to deliver them.`
          : `Generated and delivered ${delivered} emails.`;
    if (errors.length) {
      // Keep an operator-visible summary on the campaign, never provider keys
      // or a full upstream response.
      errors.unshift(resultMessage);
    }

    const { data: finalized, error: finalizeError } = await admin.from("email_campaigns").update({
      status: finalStatus,
      last_error: errors.length ? errors.slice(0, 5).join(" | ").slice(0, 2_000) : null,
      send_run_id: null,
      send_heartbeat_at: null,
    }).eq("id", campaignId).eq("user_id", ownerId).eq("send_run_id", runId).select("id").maybeSingle();
    if (finalizeError) throw new Error("Could not finalize campaign");
    if (!finalized) return json({ error: "Campaign was taken over by a newer worker; refresh and retry." }, 409);
    claimed = false;

    await admin.from("activity_logs").insert({
      user_id: ownerId,
      action_type: "campaign",
      description: `Campaign "${campaign.name}" — ${processed} processed, ${delivered} delivered${quotaExhausted ? " (quota reached)" : ""}`,
      time_saved_minutes: processed * 10,
      money_saved: processed * 5.0,
      provider,
      metadata: {
        processed, delivered, generated, deliveryEnabled, finalStatus,
        quotaExhausted, providerBlocked, errors: errors.slice(0, 5),
      },
    });

    return json({
      success: true,
      status: finalStatus,
      processed,
      delivered,
      generated,
      deliveryEnabled,
      quotaExhausted,
      message: resultMessage,
      errors: errors.slice(0, 5),
    });
  } catch (error) {
    const message = safeError(error, "Campaign send failed");
    if (claimed && admin && campaignId && runId) {
      // Leave retryable recipient rows alone, but release the campaign lock. If
      // this update races a stale-run takeover, the run-id predicate protects
      // the newer worker from being reset.
      await admin.from("email_campaigns").update({
        status: "failed",
        last_error: message,
        send_run_id: null,
        send_heartbeat_at: null,
      }).eq("id", campaignId).eq("user_id", ownerId).eq("send_run_id", runId);
    }
    return json({ error: message }, message.includes("already") ? 409 : 500);
  }
});
