// ════════════════════════════════════════════════════════════════
// OBSERVABILITY — isolated, privacy-conscious analytics + error layer.
//
// Deliberately additive: no business logic depends on this module.
// It activates ONLY when VITE_PLAUSIBLE_DOMAIN is configured (Plausible
// cloud or a self-hosted instance). When unset it is a complete no-op —
// no script is loaded, nothing is collected, zero performance impact.
//
// Why Plausible: cookieless, no personal data, no consent banner needed
// for aggregate, privacy-respecting measurement. Events are anonymous
// counts; authenticated business data never leaves the app, and /app
// paths are never reported (see PageMetaSync).
//
// Enable in Vercel → Project → Settings → Environment Variables:
//   VITE_PLAUSIBLE_DOMAIN=cashiea.vercel.app
//   VITE_PLAUSIBLE_SRC=https://plausible.io/js/script.manual.js   (optional; self-host URL works too)
// ════════════════════════════════════════════════════════════════

type EventProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: EventProps; u?: string }) => void
  }
}

const env = ((import.meta as unknown as { env?: Record<string, string> }).env) || {}
const DOMAIN = env.VITE_PLAUSIBLE_DOMAIN || ''
const SRC = env.VITE_PLAUSIBLE_SRC || 'https://plausible.io/js/script.manual.js'

export const observabilityEnabled = Boolean(DOMAIN)

let scriptInjected = false
const seenErrors = new Set<string>()

function ensureScript() {
  if (!observabilityEnabled || scriptInjected) return
  scriptInjected = true
  const s = document.createElement('script')
  s.defer = true
  s.setAttribute('data-domain', DOMAIN)
  s.src = SRC
  document.head.appendChild(s)
}

/** Record a pageview for an SPA route. Safe to call when disabled. */
export function trackPageview(path: string) {
  if (!observabilityEnabled) return
  ensureScript()
  // Manual mode: we own pageview timing so SPA navigations are counted.
  window.plausible?.('pageview', { u: `${location.origin}${path}` })
}

/** Record a named product event (signup_completed, cta_clicked, …). */
export function track(event: string, props?: EventProps) {
  if (!observabilityEnabled) return
  ensureScript()
  window.plausible?.(event, props ? { props } : undefined)
}

/**
 * Attach global runtime-error monitoring once (deduplicated, message-only —
 * no stack, no DOM, no business data ever leaves the device).
 */
export function initErrorMonitoring() {
  if (!observabilityEnabled) return
  const report = (message: string) => {
    const key = message.slice(0, 160)
    if (seenErrors.has(key) || seenErrors.size > 50) return
    seenErrors.add(key)
    track('js_error', { message: key })
  }
  window.addEventListener('error', (e) => report(e.message || 'unhandled error'))
  window.addEventListener('unhandledrejection', (e) =>
    report(e.reason instanceof Error ? e.reason.message : 'unhandled rejection'),
  )
}
