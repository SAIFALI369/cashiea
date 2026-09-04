// ════════════════════════════════════════════════════════════════
// PUBLIC API: Draft Email  —  /functions/v1/api-draft-email
// Auth via x-api-key header. For 3rd-party integrations.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apiCorsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";
import { releaseApiUsage } from "../_shared/usage.ts";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// AI calls go through _shared/ai-call.ts (Groq primary + Gemini fallback — same as Meraj chat).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: apiCorsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, apiCorsHeaders);
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 50_000) return json({ error: "Request is too large" }, 413, apiCorsHeaders);
  let service: any = null;
  let usageReserved = false;
  let usageConsumed = false;
  let usageOwner = "";
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey.length > 300) return json({ error: "Missing or invalid x-api-key header" }, 401, apiCorsHeaders);

    service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const keyHash = await sha256(apiKey);
    const { data: keyRow } = await service.from("api_keys").select("user_id, active").eq("key_hash", keyHash).maybeSingle();
    if (!keyRow || !keyRow.active) return json({ error: "Invalid API key" }, 401, apiCorsHeaders);

    await service.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", keyHash);

    const { data: profile, error: profileError } = await service.from("profiles")
      .select("ai_provider, role, business_owner_id")
      .eq("id", keyRow.user_id).maybeSingle();
    if (profileError || !profile || profile.role !== "owner" || profile.business_owner_id !== null) {
      return json({ error: "API keys are available only to an active business owner" }, 403, apiCorsHeaders);
    }
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid JSON body" }, 400, apiCorsHeaders);
    const type = typeof body.type === "string" ? body.type.slice(0, 80) : "custom";
    const tone = typeof body.tone === "string" ? body.tone.slice(0, 80) : "professional";
    const recipient = typeof body.recipient === "string" ? body.recipient.slice(0, 320) : "";
    const subject = typeof body.subject === "string" ? body.subject.slice(0, 300) : "";
    const points = typeof body.points === "string" ? body.points.trim().slice(0, 20_000) : "";
    if (!points) return json({ error: "points is required" }, 400, apiCorsHeaders);
    usageOwner = keyRow.user_id;
    const { data: reserved, error: reserveError } = await service.rpc("reserve_api_usage", { p_user_id: keyRow.user_id, p_amount: 1 });
    if (reserveError) return json({ error: "AI usage service is unavailable; deploy schema v27 first" }, 503, apiCorsHeaders);
    if (!reserved) return json({ error: "Usage limit reached" }, 429, apiCorsHeaders);
    usageReserved = true;

    const prompt = `Email type: ${type}\nTone: ${tone}\n${recipient ? `Recipient: ${recipient}` : ""}\n${subject ? `Suggested subject: ${subject}` : ""}\nKey points:\n${points}`;
    const result = await callAIWithFallback(
      profile?.ai_provider || "openai",
      "You are an expert business copywriter. Write a polished, ready-to-send email. Match the requested tone and type. Return format: first line 'Subject: ...', blank line, then the body.",
      prompt,
      2000,
      "api-draft-email"
    );
    usageConsumed = true;

    await service.from("activity_logs").insert({ user_id: keyRow.user_id, action_type: "email", description: "API: draft-email", time_saved_minutes: 10, money_saved: 5.0, provider: profile?.ai_provider });

    return json({ email_raw: result }, 200, apiCorsHeaders);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500, apiCorsHeaders);
  } finally {
    if (usageReserved && !usageConsumed && service) await releaseApiUsage(service, usageOwner);
  }
});
