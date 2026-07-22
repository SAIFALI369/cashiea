// ════════════════════════════════════════════════════════════════
// PUBLIC API: Draft Email  —  /functions/v1/api-draft-email
// Auth via x-api-key header. For 3rd-party integrations.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import { withRetry, apiCorsHeaders, json } from "../_shared/retry.ts";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function callAI(provider: string, systemPrompt: string, prompt: string): Promise<string> {
  const callers: Record<string, () => Promise<{ ok: boolean; status: number; value: string }>> = {
    openai: async () => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }], temperature: 0.7, max_tokens: 2000 }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).choices[0].message.content };
    },
    gemini: async () => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2000 } }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).candidates[0].content.parts[0].text };
    },
    anthropic: async () => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: 2000, system: systemPrompt, messages: [{ role: "user", content: prompt }] }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).content[0].text };
    },
  };
  return withRetry(callers[provider] || callers.openai, 2, 600);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: apiCorsHeaders });
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ error: "Missing x-api-key header" }, 401, apiCorsHeaders);

    const service = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
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
    const result = await callAI(
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
