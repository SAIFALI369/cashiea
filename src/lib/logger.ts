/**
 * Structured client logger with correlation (request) ids.
 *
 * Every log line is prefixed with a stable request id for the current page
 * view: `[cashiea][error][req:a1b2c3] message`. The id is:
 *  - regenerated on every navigation (so "the invoice page was slow" maps to
 *    one id across its DB calls, AI calls and error reports),
 *  - attached to outgoing AI edge-function calls as `X-Request-Id`, and
 *  - included in client error reports (errorTracking.ts), so a production
 *    error and its surrounding logs can be correlated end-to-end.
 *
 * Levels: `debug` only logs in dev builds; `info/warn/error` always log.
 * This is deliberately dependency-free — swap the sink for Sentry later
 * without touching call sites.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

const PREFIX = '[cashiea]'

function newId(): string {
  try {
    return (crypto.randomUUID() || Math.random().toString(36).slice(2)).slice(0, 8)
  } catch {
    return Math.random().toString(36).slice(2, 10)
  }
}

let currentRequestId = newId()

/**
 * Return the request id for the current page view.
 * Call `rotateRequestId()` on route change to start a new correlation scope.
 */
export function requestId(): string {
  return currentRequestId
}

/** Start a new correlation scope (call on navigation / app boot). */
export function rotateRequestId(): void {
  currentRequestId = newId()
}

function format(level: Level, message: string, meta?: Record<string, unknown>): string {
  const base = `${PREFIX}[${level}][req:${currentRequestId}] ${message}`
  if (!meta || Object.keys(meta).length === 0) return base
  try {
    return `${base} ${JSON.stringify(meta)}`
  } catch {
    return base
  }
}

function isDev(): boolean {
  return typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true
}

export const log = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!isDev()) return
     
    console.debug(format('debug', message, meta))
  },
  info(message: string, meta?: Record<string, unknown>): void {
     
    console.info(format('info', message, meta))
  },
  warn(message: string, meta?: Record<string, unknown>): void {
     
    console.warn(format('warn', message, meta))
  },
  error(message: string, meta?: Record<string, unknown>): void {
     
    console.error(format('error', message, meta))
  },
}
