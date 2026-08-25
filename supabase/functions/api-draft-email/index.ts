// ════════════════════════════════════════════════════════════════
// PUBLIC API: Draft Email  —  /functions/v1/api-draft-email
// Auth via x-api-key header. For 3rd-party integrations.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apiCorsHeaders, json } from "../_shared/retry.ts";
import { callAIWithFallback } from "../_shared/ai-call.ts";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// AI calls go through _shared/ai-call.ts (Groq primary + Gemini fallback — same as Meraj chat).

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: apiCorsHeaders });
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ error: "Missing x-api-key header" }, 401, apiCorsHeaders);

    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const keyHash = await sha256(apiKey);
    const { data: keyRow } = await service.from("api_keys").select("user_id, active").eq("key_hash", keyHash).maybeSingle();
    if (!keyRow || !keyRow.active) return json({ error: "Invalid API key" }, 401, apiCorsHeaders);

    await service.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", keyHash);

    const { data: profile } = await service.from("profiles").select("ai_provider, api_usage_count, api_usage_limit").eq("id", keyRow.user_id).single();
    if (profile && profile.api_usage_count >= profile.api_usage_limit) {
      return json({ error: "Usage limit reached" }, 429, apiCorsHeaders);
    }

    const { type = "custom", tone = "professional", recipient, subject, points } = await req.json();
    if (!points) return json({ error: "points is required" }, 400, apiCorsHeaders);

    const prompt = `Email type: ${type}\nTone: ${tone}\n${recipient ? `Recipient: ${recipient}` : ""}\n${subject ? `Suggested subject: ${subject}` : ""}\nKey points:\n${points}`;
    const result = await callAIWithFallback(
      profile?.ai_provider || "openai",
      "You are an expert business copywriter. Write a polished, ready-to-send email. Match the requested tone and type. Return format: first line 'Subject: ...', blank line, then the body.",
      prompt
    );

    await service.rpc("increment_api_usage", { user_uuid: keyRow.user_id });
    await service.from("activity_logs").insert({ user_id: keyRow.user_id, action_type: "email", description: "API: draft-email", time_saved_minutes: 10, money_saved: 5.0, provider: profile?.ai_provider });

    return json({ email_raw: result }, 200, apiCorsHeaders);
  } catch (e) {
    return json({ error: e.message }, 500, apiCorsHeaders);
  }
});
