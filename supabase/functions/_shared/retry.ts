// ════════════════════════════════════════════════════════════════
// Shared helpers for Supabase Edge Functions
// ════════════════════════════════════════════════════════════════

/**
 * Retry an async operation with exponential backoff.
 * Retries on thrown errors and on 429 / 5xx HTTP responses.
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
      // Only retry on transient failures
      if ((status === 429 || status >= 500) && attempt < retries) {
        await sleep(baseDelayMs * Math.pow(2, attempt))
        continue
      }
      // Non-retryable failure — surface the last known error
      throw new Error(`Upstream returned status ${status}`)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
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
