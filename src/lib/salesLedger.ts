// ════════════════════════════════════════════════════════════════
// salesLedger — grouping and labelling for the transaction timeline.
//
// A flat list of 200 sales is a wall. Grouped under "Today",
// "Yesterday", "8 September", it becomes a journal you can skim.
// ════════════════════════════════════════════════════════════════

export type LedgerFilter = 'all' | 'today' | 'week' | 'pending'

/**
 * The minimum a row must carry to be filtered. Deliberately structural
 * (no index signature) so concrete types like `Transaction` satisfy it
 * without being widened into `Record<string, unknown>`.
 */
export interface LedgerRow {
  created_at: string
  status?: string | null
  payment_method?: string | null
}

export interface LedgerGroup<T> {
  /** Stable key (YYYY-MM-DD in local time). */
  key: string
  label: string
  items: T[]
}

/** Local midnight for a date — grouping must follow the shopkeeper's day. */
function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function dayKey(iso: string | Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'unknown'
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** "Today" / "Yesterday" / "8 September" / "8 September 2024". */
export function dayLabel(iso: string | Date, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Unknown date'
  const diffDays = Math.round((dayStart(now).getTime() - dayStart(d).getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** Group chronologically-sorted rows into day buckets, order preserved. */
export function groupByDay<T extends { created_at: string }>(rows: T[], now: Date = new Date()): LedgerGroup<T>[] {
  const out: LedgerGroup<T>[] = []
  const index = new Map<string, LedgerGroup<T>>()
  for (const row of rows) {
    const key = dayKey(row.created_at)
    let g = index.get(key)
    if (!g) {
      g = { key, label: dayLabel(row.created_at, now), items: [] }
      index.set(key, g)
      out.push(g)
    }
    g.items.push(row)
  }
  return out
}

/**
 * Apply a tab filter.
 *
 * "Pending" means a sale that still needs attention — one that was
 * voided or refunded, or that carries no payment method. A completed,
 * fully-paid sale is never pending.
 */
export function filterLedger<T extends LedgerRow>(rows: T[], filter: LedgerFilter, now: Date = new Date()): T[] {
  if (filter === 'all') return rows
  if (filter === 'pending') {
    return rows.filter((r) => r.status === 'void' || r.status === 'refunded' || !r.payment_method)
  }
  const start = filter === 'today'
    ? dayStart(now).getTime()
    : dayStart(now).getTime() - 6 * 86_400_000 // today + the previous 6 days
  return rows.filter((r) => {
    const t = new Date(r.created_at).getTime()
    return Number.isFinite(t) && t >= start
  })
}

/** Payment-method dot colour: green cash, blue UPI, purple card. */
export function methodColor(method?: string | null): string {
  switch ((method || '').toLowerCase()) {
    case 'cash': return 'bg-emerald-500'
    case 'upi': return 'bg-blue-500'
    case 'card': return 'bg-purple-500'
    case 'wallet': return 'bg-amber-500'
    case 'split': return 'bg-teal-500'
    default: return 'bg-gray-400'
  }
}

/** Short time for a row, e.g. "2:45 pm". */
export function rowTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
}
