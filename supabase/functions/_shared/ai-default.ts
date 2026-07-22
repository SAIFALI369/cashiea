// ════════════════════════════════════════════════════════════════
// AI Default — built-in Gemini key so the app works out of the box
// even if the user hasn't configured their own AI provider.
//
// Set as a Supabase secret (NEVER in frontend):
//   supabase secrets set DEFAULT_GEMINI_API_KEY=AQ.Ab8RN6Lnk...
//
// This is the LAST RESORT fallback. The priority is:
//   1. User's selected provider (OpenRouter/OpenAI/Gemini/Anthropic)
//   2. This default Gemini key (always works)
// ════════════════════════════════════════════════════════════════

export const DEFAULT_GEMINI_KEY = Deno.env.get("DEFAULT_GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY");
export const DEFAULT_MODEL = "gemini-flash-latest";

/**
 * Check if the default Gemini key is available.
 */
export function hasDefaultAI(): boolean {
  return !!DEFAULT_GEMINI_KEY;
}

/**
 * Call Gemini using the built-in default key. Used as a fallback when
 * the user's selected provider has no key configured.
 *
 * Returns { ok, status, value } for compatibility with withRetry.
 */
export async function callDefaultGemini(
  systemPrompt: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<{ ok: boolean; status: number; value: string }> {
  if (!DEFAULT_GEMINI_KEY) {
    return { ok: false, status: 503, value: "No AI key configured — set DEFAULT_GEMINI_API_KEY secret" };
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": DEFAULT_GEMINI_KEY,
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.7,
            maxOutputTokens: opts.maxTokens ?? 1500,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      let detail = errText.slice(0, 300);
      try {
        const parsed = JSON.parse(errText);
        if (parsed?.error?.message) detail = parsed.error.message.slice(0, 300);
      } catch { /* keep raw */ }
      return { ok: false, status: res.status, value: detail };
    }

    const data = await res.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return { ok: false, status: 502, value: "Gemini returned no content" };
    return { ok: true, status: 200, value: content as string };
  } catch (err) {
    return { ok: false, status: 0, value: `Network error: ${err.message}` };
  }
}
