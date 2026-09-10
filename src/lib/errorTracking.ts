/**
 * Client error tracking — zero-dependency structured error sink.
 *
 * Captures:
 *  - uncaught exceptions (window 'error')
 *  - unhandled promise rejections (window 'unhandledrejection')
 *  - React ErrorBoundary crashes + explicit `captureError()` calls
 *
 * Reports are structured (request id, page path, user id when signed in),
 * deduplicated per session, rate-limited, truncated, and flushed in small
 * batches (timer + pagehide keepalive) to the `client_errors` table.
 *
 * Privacy: the session id is a random per-browser value (not tied to the
 * logged-in account; when signed in, `user_id` is the Supabase uid so
 * support can correlate). No input values, tokens, or request bodies are
 * ever captured — only thrown error messages/stacks.
 *
 * Swap-in point for Sentry: `captureError` + the global hooks are the only
 * integration surface; the rest of the app already calls `captureError`.
 */

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase'
import { requestId, log } from './logger'

export type ErrorKind = 'uncaught' | 'rejection' | 'boundary' | 'console' | 'auth' | 'app'

export interface ErrorReport {
  session_id: string
  request_id: string
  user_id: string | null
  page_path: string
  error_type: ErrorKind
  message: string
  stack: string | null
  meta: Record<string, unknown>
}

// ── Session identity (random, per browser session — not PII) ──────────
const SESSION_KEY = 'cashiea_error_session'

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 24)
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

// ── Dedupe: same error signature reported at most once per session ─────
// (A stuck component re-throwing 50× a second must not create 50 rows.)
const DEDUPE_KEY = 'cashiea_error_dedupe'
const DEDUPE_MAX = 60

function dedupeSeen(signature: string): boolean {
  try {
    const raw = JSON.parse(sessionStorage.getItem(DEDUPE_KEY) || '[]') as string[]
    if (raw.includes(signature)) return true
    raw.push(signature)
    if (raw.length > DEDUPE_MAX) raw.splice(0, raw.length - DEDUPE_MAX)
    sessionStorage.setItem(DEDUPE_KEY, JSON.stringify(raw))
  } catch {
    /* storage unavailable — allow the report */
  }
  return false
}

// ── Rate limiting: cap total reports per session + per minute ──────────
const RATE_KEY = 'cashiea_error_rate'
const MAX_PER_SESSION = 40
const MAX_PER_MINUTE = 6

function rateLimited(): boolean {
  try {
    const now = Date.now()
    const raw = JSON.parse(sessionStorage.getItem(RATE_KEY) || '{"total":0,"minute":0,"at":0}') as {
      total: number; minute: number; at: number
    }
    if (now - raw.at > 60_000) { raw.total = 0; raw.minute = 0 }
    if (raw.total >= MAX_PER_SESSION || raw.minute >= MAX_PER_MINUTE) return true
    raw.total += 1
    raw.minute += 1
    raw.at = now
    sessionStorage.setItem(RATE_KEY, JSON.stringify(raw))
  } catch {
    return false
  }
  return false
}

// ── Truncation: never ship unbounded text ──────────────────────────────
function trunc(s: unknown, n: number): string {
  const t = typeof s === 'string' ? s : s == null ? '' : String(s)
  return t.length > n ? t.slice(0, n) + '…[truncated]' : t
}

function toError(err: unknown): { message: string; stack: string | null } {
  if (err instanceof Error) {
    return { message: trunc(err.message || err.name, 500), stack: trunc(err.stack, 4000) }
  }
  return { message: trunc(err, 500), stack: null }
}

function firstFrame(stack: string | null): string {
  if (!stack) return ''
  const line = stack.split('\n').slice(1, 3).join('|')
  return trunc(line, 200)
}

// ── Queue + flush ───────────────────────────────────────────────────────
const queue: ErrorReport[] = []
let flushing = false
let timer: ReturnType<typeof setTimeout> | null = null
const FLUSH_INTERVAL_MS = 5_000
const FLUSH_BATCH = 5

/**
 * Local session read (storage-backed, no network round-trip) — safe to kick
 * off on pagehide. Uses supabase-js' own storage adapter rather than parsing
 * storage keys, so it keeps working across library upgrades.
 */
async function localSession(): Promise<{ token: string | null; userId: string | null }> {
  try {
    const { data } = await supabase.auth.getSession()
    return {
      token: data.session?.access_token ?? null,
      userId: data.session?.user?.id ?? null,
    }
  } catch {
    return { token: null, userId: null }
  }
}

/**
 * Best-effort flush at tab close/hide: one keepalive REST insert (Supabase
 * accepts a JSON array for multi-row insert). keepalive lets the request
 * outlive the pagehide in supporting browsers; failures are silent.
 *
 * RLS note: with a live session the rows must carry the uid (policy:
 * authenticated inserts require user_id = auth.uid()); anonymous visitors
 * insert with user_id NULL. Both shapes are handled here.
 */
function flushKeepalive(): void {
  if (queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  const url = `${SUPABASE_URL}/rest/v1/client_errors`
  void localSession().then(({ token, userId }) =>
    fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(batch.map((report) => ({ ...report, user_id: userId }))),
    }).catch(() => {}),
  )
}

async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return
  flushing = true
  const batch = queue.splice(0, FLUSH_BATCH)
  try {
    // Local session read — consistent with the RLS policies (uid when
    // signed in, NULL when not) without a network round-trip.
    const { userId } = await localSession()
    const rows = batch.map((report) => ({ ...report, user_id: userId }))
    const { error } = await supabase.from('client_errors').insert(rows)
    if (error) log.warn('error-report insert failed', { message: error.message })
  } catch (err) {
    log.warn('error-report flush failed', { message: err instanceof Error ? err.message : String(err) })
  } finally {
    flushing = false
    if (queue.length > 0 && timer === null) timer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS)
  }
}

function enqueue(report: ErrorReport): void {
  queue.push(report)
  if (queue.length >= FLUSH_BATCH) {
    void flush()
  } else if (timer === null) {
    timer = setTimeout(() => {
      timer = null
      void flush()
    }, FLUSH_INTERVAL_MS)
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Capture an error explicitly (boundaries, auth failures, known-risky code
 * paths). Safe to call anywhere, including before init.
 */
export function captureError(err: unknown, kind: ErrorKind = 'app', meta: Record<string, unknown> = {}): void {
  try {
    const { message, stack } = toError(err)
    const signature = `${kind}:${message}|${firstFrame(stack)}`
    if (dedupeSeen(signature) || rateLimited()) return
    enqueue({
      session_id: getSessionId(),
      request_id: requestId(),
      user_id: null, // resolved at flush time (session may have changed)
      page_path: trunc(typeof location !== 'undefined' ? location.pathname : '', 200),
      error_type: kind,
      message,
      stack,
      meta: { ...meta },
    })
  } catch {
    /* tracking must never break the app */
  }
}

let initialized = false

/** Install the global error hooks. Call once, before app render. */
export function initErrorTracking(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('error', (event) => {
    // Resource-load errors (img/link/script) arrive with `target` set and
    // no meaningful stack — capture them too (a broken icon should be
    // visible), with a lighter signature.
    const target = event.target as (HTMLElement & { src?: string; href?: string }) | null
    const resourceUrl = target && (target.src || target.href)
    if (resourceUrl && !resourceUrl.startsWith('data:')) {
      captureError(new Error(`Resource failed to load: ${trunc(resourceUrl, 300)}`), 'uncaught', {
        resource: true,
        tag: target.tagName,
      })
    } else if (event.error || event.message) {
      captureError(event.error ?? new Error(event.message), 'uncaught')
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, 'rejection')
  })

  // Flush whatever is queued when the tab hides/closes (best effort).
  window.addEventListener('pagehide', () => {
    flushKeepalive()
  })
}
