// ════════════════════════════════════════════════════════════════
// Shared helpers for Supabase Edge Functions
// ════════════════════════════════════════════════════════════════

/**
 * Retry an async operation with exponential backoff.
 * Retries ONLY on transient 5xx / network errors. A 429 (rate limit) is NEVER
 * retried — it surfaces immediately so we don't amplify a per-minute cap.
 */
export async function withRetry<T>(
  fn: () => Promise<{ ok: boolean; status?: number; value: T }>,
  retries = 2,
  baseDelayMs = 600
): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fn()
      if (res.ok) return res.value
      const status = res.status ?? 0
      // 429 = rate limit. NEVER auto-retry — retrying into a per-MINUTE cap
      // amplifies the burst (3 calls in ~2s instead of 1). Surface immediately.
      if (status === 429) {
        throw new Error('Rate limit reached (429). Please wait a minute and try again.')
      }
      // 5xx = transient upstream error — worth a backoff-and-retry.
      if (status >= 500 && attempt < retries) {
        await sleep(baseDelayMs * Math.pow(2, attempt))
        continue
      }
      throw new Error(`Upstream returned status ${status}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const msg = lastError.message
      // Do NOT retry configuration or rate-limit errors — only genuine transient
      // (network) failures. This stops "not configured" from being retried 3x.
      if (/not configured|Rate limit|\b429\b/.test(msg)) throw lastError
      if (attempt < retries) {
        await sleep(baseDelayMs * Math.pow(2, attempt))
        continue
      }
    }
  }
  throw lastError ?? new Error('Operation failed after retries')
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** CORS headers shared by all functions. */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** CORS headers for the public API (api-key auth instead of JWT). */
export const apiCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200, headers: Record<string, string> = corsHeaders): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
