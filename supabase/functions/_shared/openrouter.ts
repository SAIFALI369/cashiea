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
// ROLE IN CASHIEA (owner's routing spec): OpenRouter = the huge-context
// route. Primary is stealth/ox-alpha (1M-token ctx). NOTE: it needs the
// OpenRouter account's DATA POLICY to permit it (the provider is already
// allowlisted). While the account can't serve it (data policy / no credits /
// free variants blocked), the caller (ai-call.ts) circuit-breaks past
// OpenRouter and serves huge contexts from the Gemini key pool instead —
// nothing fails, it just self-heals the moment the account allows it.
// ════════════════════════════════════════════════════════════════

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// The fallback chain — order matters. Each is tried in sequence.
// Kept SHORT on purpose: while the account can't serve OpenRouter models,
// every entry is a wasted round-trip before the caller falls back to the
// Gemini pool — 2 attempts fail fast (<1s).
export const OPENROUTER_MODELS = [
  "stealth/ox-alpha",             // 1. Ox Alpha — 1M ctx (activates when the account data policy allows)
  "google/gemini-3.6-flash",      // 2. 1M-ctx backup (activates when the account has credits)
];

// Errors that should trigger a fallback to the next model.
// 404 included: "model/provider not available for this account" (e.g. the
// provider is not in the account's allowed-providers list yet) — advance.
const FALLBACK_CODES = new Set([402, 403, 404, 408, 409, 413, 429, 500, 502, 503, 504, 529]);

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
    return { ok: false, status: 0, value: `Network error: ${(err as Error)?.message || err}` };
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
