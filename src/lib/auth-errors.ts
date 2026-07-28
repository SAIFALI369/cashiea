// ════════════════════════════════════════════════════════════════
// Friendly auth error handling.
//
// Auth errors come back in many shapes (AuthError, plain Error, fetch
// failures, or an object with no message). This ALWAYS logs the full
// object to the console (so the real cause is visible in DevTools) and
// returns a clear, human-readable string — never "{}" or "[object Object]".
// ════════════════════════════════════════════════════════════════

export function friendlyAuthError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  // Always surface the full object for debugging in the browser console.
  // eslint-disable-next-line no-console
  console.error("[cashiea:auth] full error →", err)

  const anyErr = err as Record<string, unknown> | null | undefined
  const raw =
    (anyErr && (anyErr.message as string)) ||
    (anyErr && (anyErr.error_description as string)) ||
    (anyErr && (anyErr.msg as string)) ||
    ""
  const msg = typeof raw === "string" ? raw.trim() : ""

  // Unhelpful / empty-body cases (e.g. a blocked or empty fetch response → "{}").
  if (!msg || msg === "{}" || msg === "[object Object]" || /^object\sObject/i.test(msg)) {
    return "We couldn't reach the sign-in service. Check your internet connection, disable any ad blockers on this site, and try again."
  }

  const lower = msg.toLowerCase()
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) return "Wrong email or password. Try again, or create an account."
  if (lower.includes("email not confirmed")) return "Please confirm your email first — check your inbox (and spam) for the activation link."
  if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already")) return "An account with this email already exists. Try signing in instead."
  if (lower.includes("rate limit") || lower.includes("too many") || lower.includes("too many requests")) return "Too many attempts — wait a minute and try again."
  if (lower.includes("password should be") || lower.includes("password is too weak") || lower.includes("weak password")) return "Please choose a stronger password (at least 6 characters)."
  if (lower.includes("failed to fetch") || lower.includes("networkrequestfailed") || lower.includes("network error") || lower.includes("load failed")) return "Network problem — check your connection and try again."
  if (lower.includes("captcha")) return "Verification failed. Please complete the captcha and try again."

  return msg || fallback
}
