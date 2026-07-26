// ════════════════════════════════════════════════════════════════
// AI Default — built-in Gemini key POOL so the app works out of the box
// even if the user hasn't configured their own AI provider.
//
// KEY POOL + ROTATION (fallback loop):
//   The app keeps a pool of Gemini keys (DEFAULT_GEMINI_API_KEY first,
//   then GEMINI_API_KEY, then GEMINI_STOCK_API_KEY). On a 429 (rate limit)
//   from one key, it rotates to the next available key in the pool and
//   cools the limited one for the per-minute window — so a single request
//   rarely fails, and the free per-key RPM quota is effectively multiplied
//   across keys. When a cooled key's window clears, it re-enters rotation.
//
// Secrets (NEVER in frontend / repo):
//   supabase secrets set DEFAULT_GEMINI_API_KEY=AIza...
//   supabase secrets set GEMINI_STOCK_API_KEY=AIza...     # fallback/stock key
// ════════════════════════════════════════════════════════════════

export const DEFAULT_MODEL = "gemini-flash-latest";

// Build the key pool (default first, then stock). Filtered to set values,
// then de-duplicated (e.g. if DEFAULT and GEMINI_API_KEY are the same).
const RAW_KEYS: string[] = [
  Deno.env.get("DEFAULT_GEMINI_API_KEY"),
  Deno.env.get("GEMINI_API_KEY"),
  Deno.env.get("GEMINI_STOCK_API_KEY"),
].filter((k): k is string => typeof k === "string" && k.length > 0);
export const GEMINI_KEYS: string[] = Array.from(new Set(RAW_KEYS));

// Backward-compat export for any code referencing the primary key directly.
export const DEFAULT_GEMINI_KEY = GEMINI_KEYS[0] || "";

// Per-key cooldown: a key that returns 429 isn't retried for this long.
// (~60s matches the per-MINUTE free-tier RPM window; for a daily cap the key
//  simply re-429s after cooling and gets cooled again — the pool stays usable.)
const COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<string, number>();

export function hasDefaultAI(): boolean {
  return GEMINI_KEYS.length > 0;
}

// One outbound Gemini call with a specific key.
async function callWithKey(
  key: string,
  keyIndex: number,
  systemPrompt: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; feature?: string }
): Promise<{ ok: boolean; status: number; value: string }> {
  // One log line per actual outbound Gemini call (diagnosis-only, no UI).
  console.log(`[gemini] outbound feature=${opts.feature || "unknown"} key=#${keyIndex + 1}/${GEMINI_KEYS.length}`);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": key },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxTokens ?? 1500 },
        }),
      }
    );

    if (!res.ok) {
      // 429 = rate limit on THIS key. Caller (the pool rotator) will try the next key.
      if (res.status === 429) {
        return { ok: false, status: 429, value: "Rate limit reached (429) on this key." };
      }
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
    return { ok: false, status: 0, value: `Network error: ${(err as Error)?.message || err}` };
  }
}

/**
 * Call Gemini using the built-in key POOL with automatic rotation.
 * Tries the default key first; on a 429 it rotates to the next key in the
 * pool (cooling the limited one for the per-minute window) and keeps going.
 * Used as the fallback when the user's selected provider has no key.
 */
export async function callDefaultGemini(
  systemPrompt: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; feature?: string } = {}
): Promise<{ ok: boolean; status: number; value: string }> {
  if (GEMINI_KEYS.length === 0) {
    return { ok: false, status: 503, value: "No AI key configured — set DEFAULT_GEMINI_API_KEY (and optionally GEMINI_STOCK_API_KEY)" };
  }

  const now = Date.now();
  // Prefer keys whose cooldown has expired (soonest-available first).
  const ordered = [...GEMINI_KEYS].sort(
    (a, b) => (cooldownUntil.get(a) || 0) - (cooldownUntil.get(b) || 0)
  );

  let lastResult: { ok: boolean; status: number; value: string } | null = null;
  for (const key of ordered) {
    if ((cooldownUntil.get(key) || 0) > now) continue; // still cooling — skip to next key

    const res = await callWithKey(key, GEMINI_KEYS.indexOf(key), systemPrompt, prompt, opts);
    if (res.ok) return res;

    if (res.status === 429) {
      // Limit hit on this key — cool it down and rotate to the next key in the pool.
      cooldownUntil.set(key, Date.now() + COOLDOWN_MS);
      lastResult = res;
      continue;
    }
    // Non-rate-limit error (auth/network/5xx) — don't burn other keys; surface it.
    return res;
  }

  // Every key is cooling down or just returned 429.
  return lastResult || { ok: false, status: 429, value: "All Gemini keys are rate-limited right now. Please try again in a minute." };
}
