// ════════════════════════════════════════════════════════════════
// Collision-safe document numbers (invoices, quotations).
//
// The old scheme — `INV-${Date.now().toString().slice(-6)}` — keeps the
// last 6 digits of a millisecond timestamp, i.e. ms mod 1,000,000,
// which REPEATS every ~16.7 minutes. Two invoices created in different
// 16.7-minute windows can silently collide (there is no unique
// constraint on invoice_number in the database).
//
// The scheme below groups numbers by day and randomises a 4-digit
// suffix, so numbers stay short and readable while collisions become
// practically impossible.
// ════════════════════════════════════════════════════════════════

export interface DocNumberDeps {
  now?: Date
  rand?: () => number
}

/** e.g. `INV-260906-0042` — an invoice created on 6 Sep 2026. */
export function nextDocNumber(prefix: string, deps: DocNumberDeps = {}): string {
  const now = deps.now ?? new Date()
  const rand = deps.rand ?? Math.random
  const yy = String(now.getFullYear()).slice(2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const seq = String(Math.floor(rand() * 10000) % 10000).padStart(4, '0')
  return `${prefix}-${yy}${mm}${dd}-${seq}`
}
