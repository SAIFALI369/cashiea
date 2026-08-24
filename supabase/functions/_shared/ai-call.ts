// ════════════════════════════════════════════════════════════════
// ai-call.ts — THE single AI call helper for every Cashiea edge function.
//
// Identical to Meraj chat: Groq (groq/compound) is the PRIMARY provider,
// and ANY failure falls back to the built-in Gemini key pool
// (callDefaultGemini) so the owner always gets an answer.
//
// Every function imports `callAIWithFallback` from here instead of keeping
// its own copy — so a model/provider change in ONE place fixes them all.
//
// Signature matches the per-function helpers that existed before, so call
// sites need no change:
//   callAIWithFallback(provider, systemPrompt, prompt, maxTokens?, feature?)
// 'openai' / unset → 'groq' (the chat default).
// ════════════════════════════════════════════════════════════════

import { callDefaultGemini, hasDefaultAI } from "./ai-default.ts";
import { callOpenRouter } from "./openrouter.ts";
import { callGateway } from "./ai-gateway.ts";
import { withRetry } from "./retry.ts";

async function callAI(provider: string, systemPrompt: string, prompt: string, maxTokens = 1200): Promise<string> {
  // OpenRouter — auto-fallback chain: Gemini -> Kimi K3 -> Llama -> any free model
  if (provider === "openrouter") {
    const r = await callOpenRouter(systemPrompt, prompt, { maxTokens: 1500 });
    if (!r.ok) throw new Error(r.value);
    return r.value;
  }
  const callers: Record<string, (s: string, p: string) => Promise<{ ok: boolean; status: number; value: string }>> = {
    groq: async (s, p) => {
      const key = Deno.env.get("GROQ_API_KEY");
      if (!key) throw new Error("GROQ_API_KEY not configured");
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "groq/compound", messages: [{ role: "system", content: s }, { role: "user", content: p }], temperature: 0.5, max_tokens: maxTokens }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).choices[0].message.content };
    },
    openai: async (s, p) => {
      const key = Deno.env.get("OPENAI_API_KEY");
      if (!key) throw new Error("OPENAI_API_KEY not configured");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: s }, { role: "user", content: p }], temperature: 0.5, max_tokens: maxTokens }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).choices[0].message.content };
    },
    gemini: async (s, p) => {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) throw new Error("GEMINI_API_KEY not configured");
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_instruction: { parts: [{ text: s }] }, contents: [{ parts: [{ text: p }] }], generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens } }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).candidates[0].content.parts[0].text };
    },
    anthropic: async (s, p) => {
      const key = Deno.env.get("ANTHROPIC_API_KEY");
      if (!key) throw new Error("ANTHROPIC_API_KEY not configured");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: "claude-3-5-sonnet-20241022", max_tokens: maxTokens, system: s, messages: [{ role: "user", content: p }] }),
      });
      if (!res.ok) return { ok: false, status: res.status, value: await res.text() };
      return { ok: true, status: 200, value: (await res.json()).content[0].text };
    },
  };
  // Vercel AI Gateway is OpenAI-compatible and routes to any provider/model
  if (provider === "vercel_gateway") {
    return withRetry(() => callGateway(systemPrompt, prompt), 2, 600);
  }
  return withRetry(() => callers[provider || "openai"](systemPrompt, prompt), 2, 600);
}

/**
 * Same as Meraj chat: try the selected provider, then fall back to the built-in
 * Gemini key pool on ANY error (deprecated model, 404, 429, network, not configured).
 * 'openai' or unset → 'groq' (the chat default).
 */
export async function callAIWithFallback(
  provider: string,
  systemPrompt: string,
  prompt: string,
  maxTokens = 1200,
  feature = "unknown"
): Promise<string> {
  const p = provider && provider !== "openai" ? provider : "groq";
  try {
    return await callAI(p, systemPrompt, prompt, maxTokens);
  } catch (_err) {
    if (hasDefaultAI()) {
      const fb = await callDefaultGemini(systemPrompt, prompt, { maxTokens, feature });
      if (fb.ok) return fb.value;
      throw new Error(fb.value);
    }
    throw _err;
  }
}
