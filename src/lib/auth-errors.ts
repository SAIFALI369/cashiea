// ════════════════════════════════════════════════════════════════
// Friendly auth error handling.
//
// Auth errors come back in many shapes (AuthError, plain Error, fetch
// failures, or an object with no message). Supabase can also return an
// error with an EMPTY payload (e.g. `{}`) even though the user's browser
// and internet are fine. This ALWAYS logs the full object to the console
// and returns a human-readable string that never blames the user for what
// is actually a service/config problem.
// ════════════════════════════════════════════════════════════════

type ErrorRecord = Record<string, unknown>

function asRecord(value: unknown): ErrorRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as ErrorRecord)
    : null
}

function findText(value: unknown, seen = new Set<unknown>()): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const record = asRecord(value)
  if (!record || seen.has(value)) return ''
  seen.add(value)

  const textKeys = ['message', 'msg', 'error', 'error_description', 'description', 'reason', 'hint', 'detail', 'details']
  for (const key of textKeys) {
    const text = findText(record[key], seen)
    if (text) return text
  }

  // Wrap fields that often carry the real API payload.
  const nestedKeys = ['body', 'cause', 'originalError', 'data']
  for (const key of nestedKeys) {
    const text = findText(record[key], seen)
    if (text) return text
  }
  return ''
}

function findStatus(value: unknown, seen = new Set<unknown>()): number | undefined {
  const record = asRecord(value)
  if (!record || seen.has(value)) return undefined
  seen.add(value)

  for (const key of ['status', 'statusCode', 'httpStatus', 'status_code']) {
    const current = Number(record[key])
    if (Number.isFinite(current) && current >= 0) return current
  }
  for (const key of ['response', 'body', 'cause', 'originalError']) {
    const current = findStatus(record[key], seen)
    if (current !== undefined) return current
  }
  return undefined
}

function findCode(value: unknown, seen = new Set<unknown>()): string {
  const record = asRecord(value)
  if (!record || seen.has(value)) return ''
  seen.add(value)

  for (const key of ['code', 'errorCode', 'error_code', 'status']) {
    const current = typeof record[key] === 'string' ? record[key] : ''
    if (current) return current
  }
  for (const key of ['response', 'body', 'cause', 'originalError']) {
    const current = findCode(record[key], seen)
    if (current) return current
  }
  return ''
}

function errorName(value: unknown): string {
  const record = asRecord(value)
  if (record && typeof record.name === 'string') return record.name
  const constructor = record && asRecord(record.constructor)
  if (constructor && typeof constructor.name === 'string') return constructor.name
  return ''
}

const isOpaqueMessage = (message: string): boolean =>
  !message || message === '{}' || message === '[object Object]' || /^object\sObject/i.test(message)

function messageForOpaqueError(err: unknown, fallback: string): string {
  const status = findStatus(err)
  const code = findCode(err)
  const name = errorName(err)
  const codeLower = code.toLowerCase()
  const statusText = status ? ` (status ${status})` : ''

  const configNotFound =
    status === 404 ||
    /not_found|no_such|project_not_found|supabase_url|not reachable/i.test(codeLower)
  if (configNotFound) {
    return `The sign-in service isn't reachable from this deployment${statusText}. Check that VITE_SUPABASE_URL points to the correct, live Supabase project, then try again.`
  }

  const credentials =
    status === 401 ||
    status === 403 ||
    /invalid_credentials|invalid_login|unauthorized|forbidden/i.test(codeLower)
  if (credentials) {
    return 'Wrong email or password. Try again, or create an account.'
  }

  if (status === 422 || /validation|invalid_request/i.test(codeLower)) {
    return `The sign-in request was rejected${statusText}. Check your email and password and try again.`
  }

  if (status === 429 || /rate|too_many/i.test(codeLower)) {
    return 'Too many attempts — wait a minute and try again.'
  }

  const retryable =
    status === 0 ||
    (status !== undefined && status >= 500 && status < 600) ||
    /AuthRetryableFetchError|FetchError|UnknownError|temporarily unavailable|connect/i.test(name)
  if (retryable) {
    return `We couldn't reach the sign-in service${statusText}. The service is temporarily busy or unreachable from the browser — please try again in a moment.`
  }

  if (status === 400 || /invalid|bad_request/i.test(codeLower)) {
    return `The sign-in service rejected that request${statusText}. Double-check your email and password, or try again.`
  }

  const genericServiceMessage = `The sign-in service returned an unexpected response${statusText}. Please try again, or contact support if this keeps happening.`
  const defaultFallback = 'Something went wrong. Please try again.'
  return fallback && fallback !== defaultFallback ? fallback : genericServiceMessage
}

export function friendlyAuthError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  // Always surface the full object for debugging in the browser console.
  // eslint-disable-next-line no-console
  console.error('[cashiea:auth] full error →', err)

  const msg = findText(err)

  // Unhelpful / empty-body cases (e.g. a non-2xx API response of `{}`) are
  // NOT an internet/ad-blocker problem. Use the status/code to be specific.
  if (isOpaqueMessage(msg)) {
    return messageForOpaqueError(err, fallback)
  }

  const lower = msg.toLowerCase()
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) return 'Wrong email or password. Try again, or create an account.'
  if (lower.includes('email not confirmed')) return 'Please confirm your email first — check your inbox (and spam) for the activation link.'
  if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('user already')) return 'An account with this email already exists. Try signing in instead.'
  if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('too many requests')) return 'Too many attempts — wait a minute and try again.'
  if (lower.includes('password should be') || lower.includes('password is too weak') || lower.includes('weak password')) return 'Please choose a stronger password (at least 6 characters).'
  if (lower.includes('failed to fetch') || lower.includes('networkrequestfailed') || lower.includes('network error') || lower.includes('load failed') || lower.includes('fetch failed')) return 'Network problem — check your connection and try again.'
  if (lower.includes('captcha')) return 'Verification failed. Please complete the captcha and try again.'
  if (lower.includes('project is paused') || lower.includes('project paused')) return "This Supabase project is paused. Reactivate it in the Supabase dashboard, then try again."
  if (lower.includes('api key') || lower.includes('invalid apikey') || lower.includes('apikey')) return 'This deployment has an incorrect Supabase API key. Update VITE_SUPABASE_ANON_KEY in the hosting dashboard, then redeploy.'

  // If we have status/code metadata but the server message was unhelpful,
  // prefer a mapped message over showing cryptic server text.
  const status = findStatus(err)
  const code = findCode(err)
  const name = errorName(err)
  if (status === 404 || /not_found|project_not_found/i.test(code)) {
    return `The sign-in service isn't reachable from this deployment (status ${status}). Check that VITE_SUPABASE_URL points to the correct, live Supabase project, then try again.`
  }
  if (status === 429 || /rate|too_many/i.test(code)) return 'Too many attempts — wait a minute and try again.'
  if (status === 401 || status === 403 || /invalid_credentials|invalid_login|unauthorized|forbidden/i.test(code)) return 'Wrong email or password. Try again, or create an account.'
  if (status === 0 || (status !== undefined && status >= 500 && status < 600) || /AuthRetryableFetchError|FetchError|UnknownError/i.test(name)) {
    return "We couldn't reach the sign-in service. The service is temporarily busy or unreachable from the browser — please try again in a moment."
  }

  return msg || fallback
}

export function isTransientAuthError(err: unknown): boolean {
  const status = findStatus(err)
  const name = errorName(err)
  if (status === 0 || (status !== undefined && status >= 500 && status < 600)) return true
  if (/AuthRetryableFetchError|FetchError|UnknownError/i.test(name)) return true
  const msg = findText(err).toLowerCase()
  return /failed to fetch|network error|networkrequestfailed|load failed|fetch failed|temporarily unavailable|service.*unavailable/i.test(msg)
}
