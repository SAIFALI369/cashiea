// ════════════════════════════════════════════════════════════════
// Logging helper — persists failed AI tasks to the failed_jobs table
// so we have visibility into outages, rate limits, and errors.
//
// This is a fire-and-forget call: it can NEVER throw into the calling
// code. All errors are swallowed silently (the UI must not break just
// because logging failed).
// ════════════════════════════════════════════════════════════════

import { supabase } from './supabase'

/**
 * Log a failed AI task to the failed_jobs table. Fire-and-forget —
 * the returned promise is designed to be `.catch(() => {})` chained
 * and will never reject.
 */
export async function logFailedTask(
  jobType: string,
  errorMessage: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return // can't log without a session

    await supabase.from('failed_jobs').insert({
      job_type: jobType,
      user_id: user.id,
      payload: { input_text: payload, timestamp: new Date().toISOString() },
      error: errorMessage,
      status: 'pending',
    })
  } catch {
    // Swallow — logging must never break the UI
  }
}
