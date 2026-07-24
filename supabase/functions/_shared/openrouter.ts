// ════════════════════════════════════════════════════════════════
// OpenRouter helper — shared by all AI edge functions.
//
// OpenRouter is OpenAI-compatible at https://openrouter.ai/api/v1 and
// routes to 300+ models. The API key is read from a Supabase secret
// and NEVER touches frontend code.
//
// Setup (Supabase secret — never commit):
//   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
//
// FALLBACK CHAIN (per owner request):
//   1. Gemini first  (google/gemini-2.5-flash-lite — fast + cheap)
//   2. Kimi K3       (moonshotai/kimi-k3)
//   3. Llama         (meta-llama/llama-4-maverick)
//   4. Any reachable model (auto-fallback to a free model as last resort)
//
// The chain auto-advances on: 402 (insufficient credits), 429 (rate
// limit), 5xx (provider down). This means the feature works even
// before credits are purchased — it falls through to a free model.
// ════════════════════════════════════════════════════════════════

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// The fallback chain — order matters. Each is tried in sequence.
export const OPENROUTER_MODELS = [
  "google/gemini-2.5-flash-lite",   // 1. Gemini first (fast + cheap)
  "moonshotai/kimi-k3",              // 2. Kimi K3
  "meta-llama/llama-4-maverick",     // 3. Llama
  "google/gemini-2.5-flash",         // 4. alternate Gemini
  "tencent/hy3:free",                // 5. guaranteed free fallback
  "google/gemma-4-26b-a4b-it:free",  // 6. another free fallback
];

// Errors that should trigger a fallback to the next model.
const FALLBACK_CODES = new Set([402, 429, 403, 408, 409, 413, 429, 500, 502, 503, 504, 529]);

async function tryModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number }
): Promise<{ ok: boolean; status: number; value: string }> {
  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        // OpenRouter recommends these for ranking/identification
        "HTTP-Referer": "https://cashiea.ai",
        "X-Title": "Cashiea",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1500,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      // Extract the error code/message from OpenRouter's structured errors
      let detail = text.slice(0, 300);
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error?.message) detail = parsed.error.message.slice(0, 300);
      } catch { /* keep raw */ }
      return { ok: false, status: res.status, value: detail };
    }

    const data = JSON.parse(text);
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, status: 502, value: "OpenRouter returned no content" };
    return { ok: true, status: 200, value: content as string };
  } catch (err) {
    return { ok: false, status: 0, value: `Network error: ${err.message}` };
  }
}

/**
 * Call OpenRouter with automatic model fallback.
 * Tries each model in OPENROUTER_MODELS until one succeeds. Returns the
 * first success, or the last failure if all models fail.
 *
 * Returns { ok, status, value, model } so callers can know which model
 * was used (and wrap in withRetry if desired).
 */
export async function callOpenRouter(
  systemPrompt: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<{ ok: boolean; status: number; value: string; model: string }> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY not configured. Set it with: supabase secrets set OPENROUTER_API_KEY=sk-or-v1-..."
    );
  }

  let lastResult: { ok: boolean; status: number; value: string } = {
    ok: false, status: 0, value: "No models tried",
  };

  for (const model of OPENROUTER_MODELS) {
    const result = await tryModel(apiKey, model, systemPrompt, prompt, opts);

    if (result.ok) {
      return { ok: true, status: 200, value: result.value, model };
    }

    lastResult = result;

    // If the error is fallback-eligible, try the next model
    if (!FALLBACK_CODES.has(result.status)) {
      // Non-fallback error (e.g. 400 bad request) — return immediately
      return { ok: false, status: result.status, value: result.value, model };
    }
    // Else: advance to the next model in the chain
  }

  return {
    ok: false,
    status: lastResult.status,
    value: `All ${OPENROUTER_MODELS.length} models in the fallback chain failed. Last error: ${lastResult.value}`,
    model: OPENROUTER_MODELS[OPENROUTER_MODELS.length - 1],
  };
}
