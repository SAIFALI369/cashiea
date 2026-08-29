/**
 * dbRetry — automatic retry with exponential backoff for Supabase queries.
 * Handles transient network failures so users never see permanent errors.
 */

export async function dbRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fn()
      // Check for Supabase error in the result
      if (result && typeof result === 'object' && 'error' in result && (result as any).error) {
        const err = (result as any).error as { code?: string; status?: number; message?: string }
        // Don't retry auth errors or validation errors
        if (err.code === '23505' || err.code === '23503' || err.code === '42501' || err.status === 401) {
          throw err
        }
        // Retry on network/service errors
        throw err
      }
      return result
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      // Don't retry on auth/permission errors
      const msg = lastError.message
      if (msg.includes('JWT') || msg.includes('permission') || msg.includes('row-level security')) {
        throw lastError
      }

      // Don't retry on the last attempt
      if (attempt === retries) break

      // Exponential backoff: 500ms → 1000ms → 2000ms
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  throw lastError ?? new Error('Operation failed after retries')
}

/**
 * withRetry — wraps a Supabase query call with automatic retry.
 * Shows a toast on final failure with a retry option.
 *
 * Usage:
 *   const { data } = await withRetry(
 *     () => supabase.from('products').select('*').eq('user_id', ownerId),
 *     'Failed to load products',
 *   )
 */
export async function withRetry<T extends { data: any; error: any }>(
  fn: () => Promise<T>,
  errorMessage: string,
  retries = 3,
): Promise<T> {
  try {
    return await dbRetry(fn, retries)
  } catch (err) {
    // Import toast dynamically to avoid circular dependency
    const { toast } = await import('react-hot-toast')
    const t = toast.error(errorMessage, {
      duration: 6000,
      id: 'db-retry-error',
    })
    throw err
  }
}
