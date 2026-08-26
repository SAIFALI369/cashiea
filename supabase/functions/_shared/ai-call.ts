// ════════════════════════════════════════════════════════════════
// ai-call.ts — THE single AI call helper for every Cashiea edge function.
//
// TASK-CLASSIFICATION ROUTING (owner's spec):
//
//     AI TASK
//       ↓ classify
//     Need huge context?  (≥20k chars)
//       ├── YES → Ox Alpha   (OpenRouter stealth/ox-alpha, 1M-token ctx)
//       └── NO
//            ↓
//          Need extreme speed?  (chat / quick-tasks, small input)
//            ├── YES → Groq   (groq/compound, sub-second)
//            └── NO → Gemini  (gemini-3.6-flash key pool)
//       ↓
//     Provider unavailable? → automatic Gemini fallback (2-key pool),
//     then the remaining providers as an absolute last resort — a single
//     busy provider can never fail the owner's request.
//
// The 4 API keys: OpenRouter (Ox Alpha) · Groq (speed) · 2× Gemini
// (default route + universal fallback, with key rotation).
// ════════════════════════════════════════════════════════════════

import { callDefaultGemini, hasDefaultAI } from "./ai-default.ts";
import { callOpenRouter } from "./openrouter.ts";
import { callGateway } from "./ai-gateway.ts";
import { withRetry } from "./retry.ts";

// ── Classification ────────────────────────────────────────────────
/** ≈5k tokens of input → big enough to want the 1M-context Ox Alpha model. */
const HUGE_CONTEXT_CHARS = 20_000;
/**
 * Above this size a "speed" feature still routes to Gemini: Groq's free-tier
 * per-minute token budget (~30k TPM) makes LARGE requests fragile (one big
 * request eats half the minute), and a big request is not latency-critical
 * anyway. Keeps Groq's quota for the many small snappy chat turns.
 */
const SPEED_MAX_CHARS = 10_000;
/**
 * Interactive features where the owner is watching a spinner and sub-second
 * latency matters. Background/batch jobs (daily-brain, campaign, api-*, …)
 * deliberately route to Gemini instead — balanced quality, no rush.
 */
const SPEED_FEATURES = new Set(["assistant", "assistant-memory", "quick-tasks", "onboarding-questions", "onboarding-persona", "dashboard-suggestions"]);

type Route = "oxalpha" | "groq" | "gemini";

function classifyRoute(systemPrompt: string, prompt: string, feature: string): Route {
  const size = (systemPrompt || "").length + (prompt || "").length;
  if (size >= HUGE_CONTEXT_CHARS) return "oxalpha";        // 1. huge context
  if (SPEED_FEATURES.has(feature) && size < SPEED_MAX_CHARS) return "groq"; // 2. extreme speed
  return "gemini";                                          // 3. balanced default
}

// ── Direct providers ──────────────────────────────────────────────
async function callAI(provider: string, systemPrompt: string, prompt: string, maxTokens = 1200): Promise<string> {
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

// ── The routes ────────────────────────────────────────────────────
/**
 * Huge-context route via OpenRouter. Circuit breaker: when the ACCOUNT can't
 * serve OpenRouter at all (402 = no credits, 403/404 = policy blocks), skip it
 * for 5 minutes so huge requests go straight to the Gemini pool instead of
 * burning round-trips. Self-resets, so it starts working the moment the
 * account settings allow it.
 */
const OR_SKIP_MS = 5 * 60_000;
let orSkipUntil = 0;

async function callOxAlpha(systemPrompt: string, prompt: string, maxTokens: number): Promise<string> {
  if (Date.now() < orSkipUntil) throw new Error("OpenRouter skipped — account cannot serve it right now");
  const r = await callOpenRouter(systemPrompt, prompt, { maxTokens });
  if (!r.ok) {
    if (r.status === 402 || r.status === 403 || r.status === 404) orSkipUntil = Date.now() + OR_SKIP_MS;
    throw new Error(r.value);
  }
  return r.value;
}

/** Gemini key pool (the 2 Gemini keys, auto-rotation on 429) — default route + universal fallback. */
async function callGeminiPool(systemPrompt: string, prompt: string, maxTokens: number, feature: string): Promise<string> {
  const fb = await callDefaultGemini(systemPrompt, prompt, { maxTokens, feature });
  if (!fb.ok) throw new Error(fb.value);
  return fb.value;
}

/**
 * Same signature every edge function already uses:
 *   callAIWithFallback(provider, systemPrompt, prompt, maxTokens?, feature?)
 *
 * Routing is automatic (see the spec at the top). The `provider` argument is
 * only honored as an explicit override for rare exotic choices
 * ('openrouter' → Ox Alpha chain, 'anthropic', 'vercel_gateway').
 */
export async function callAIWithFallback(
  provider: string,
  systemPrompt: string,
  prompt: string,
  maxTokens = 1200,
  feature = "unknown"
): Promise<string> {
  const run = (p: string): Promise<string> => {
    if (p === "oxalpha") return callOxAlpha(systemPrompt, prompt, maxTokens);
    if (p === "gemini") return callGeminiPool(systemPrompt, prompt, maxTokens, feature);
    return callAI(p, systemPrompt, prompt, maxTokens); // groq, anthropic, vercel_gateway
  };

  // Fallback order: the classified route first, then Gemini (the designated
  // fallback), then the remaining providers as an absolute last resort.
  let order: string[];
  if (provider === "openrouter") {
    order = ["oxalpha", "gemini", "groq"];
  } else if (provider === "anthropic" || provider === "vercel_gateway") {
    order = [provider, "gemini", "groq"];
  } else {
    const route = classifyRoute(systemPrompt, prompt, feature);
    order =
      route === "oxalpha" ? ["oxalpha", "gemini", "groq"] :
      route === "groq" ? ["groq", "gemini", "oxalpha"] :
                          ["gemini", "groq", "oxalpha"];
  }

  let lastErr: unknown = null;
  for (const p of order) {
    try {
      return await run(p);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
