// ════════════════════════════════════════════════════════════════
// Per-user burst rate limiting for the expensive AI edge functions.
//
// The daily AI quota (reserve_api_usage / profiles.api_usage_limit) bounds
// CUMULATIVE spend, but it does not stop a one-minute burst: a compromised
// session, a stuck client retry loop, or an abusive account could fire dozens
// of concurrent AI calls and burn provider credits before the daily cap kicks
// in visibly.
//
// This is a Postgres-backed sliding window (api_rate_limits + the
// check_rate_limit RPC, see supabase/schema-v34-rate-limits.sql):
//   - one atomic RPC per request (purge expired + count + insert),
//   - per (user, function-scope), e.g. scope "ai-assistant" @ 10/60s,
//   - fails OPEN on the limiter's own errors: a rate-limiter outage must
//     never take AI features down (availability beats throttle correctness).
//
// Deliberately simple (not a strict token bucket): under a tight concurrency
// race the count can overshoot by a few requests. For cost protection that
// is fine — the daily quota remains the hard ceiling.
//
// Usage at the top of a handler, after auth + business resolution:
//
//   const rate = await checkRateLimit(service, {
//     userId: ownerId, scope: "ai-assistant", limit: 10, windowSeconds: 60,
//   });
//   if (!rate.allowed) {
//     return json({ error: `...wait ${rate.retryAfterSeconds}s...` }, 429, {
//       ...corsHeaders, "Retry-After": String(rate.retryAfterSeconds),
//     });
//   }
// ════════════════════════════════════════════════════════════════

export interface RateLimitResult {
  allowed: boolean
  /** Seconds the caller should wait before retrying (meaningful when !allowed). */
  retryAfterSeconds: number
}

export interface RateLimitOptions {
  /** The authenticated user (or resolved business owner) being limited. */
  userId: string
  /** Function scope — use the edge function name so limits are per-feature. */
  scope: string
  /** Max requests per window. */
  limit: number
  /** Window length in seconds (default 60). */
  windowSeconds?: number
}

export async function checkRateLimit(
  service: any,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (!service || !opts.userId) return { allowed: true, retryAfterSeconds: 0 }
  try {
    const { data, error } = await service.rpc("check_rate_limit", {
      p_user_id: opts.userId,
      p_scope: opts.scope,
      p_limit: opts.limit,
      p_window_seconds: opts.windowSeconds ?? 60,
    })
    if (error) {
      console.error(`[rate-limit] check_rate_limit rpc error for ${opts.scope} (failing open):`, error.message)
      return { allowed: true, retryAfterSeconds: 0 }
    }
    const row = Array.isArray(data) ? data[0] : data
    return {
      allowed: row?.allowed !== false,
      retryAfterSeconds: Number(row?.retry_after) || 0,
    }
  } catch (e) {
    console.error(`[rate-limit] unexpected error for ${opts.scope} (failing open):`, e)
    return { allowed: true, retryAfterSeconds: 0 }
  }
}
