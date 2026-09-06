// ════════════════════════════════════════════════════════════════
// One-tap business snapshot — the numbers that go on a shareable
// card. Pure functions; the page draws the PNG.
//
// Honest profit: only reported when enough sold lines have a cost
// price. Zero sales is a quiet day, not a loss.
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'

const DAY = 86_400_000

export type SnapshotPeriod = 'today' | 'week' | 'month'

export interface SnapshotSale {
  created_at: string
  total: number
  status?: string | null
  items?: { name?: string; product_id?: string; quantity?: number; factor?: number }[] | null
}

export interface SnapshotProductCost {
  id: string
  cost: number
}

export interface SnapshotStats {
  period: SnapshotPeriod
  shopName: string
  dateLabel: string
  sales: number
  bills: number
  /** Null when we don't have enough cost data to be honest. */
  profit: number | null
  profitCoverage: number
  topItem: { name: string; qty: number } | null
  lowStock: number
  pendingDues: number
}

export function periodWindow(period: SnapshotPeriod, now = new Date()): { from: Date; label: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'today') {
    return {
      from: start,
      label: now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
    }
  }
  if (period === 'week') {
    const from = new Date(start.getTime() - 6 * DAY)
    return { from, label: `Last 7 days · ${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` }
  }
  const from = new Date(start.getFullYear(), start.getMonth(), 1)
  return { from, label: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
}

export function computeSnapshot(input: {
  period: SnapshotPeriod
  shopName: string
  sales?: SnapshotSale[]
  costs?: SnapshotProductCost[]
  lowStock?: number
  pendingDues?: number
  now?: Date
}): SnapshotStats {
  const now = input.now ?? new Date()
  const { from, label } = periodWindow(input.period, now)
  const fromMs = from.getTime()
  const until = now.getTime()

  const txns = (input.sales || []).filter((t) => {
    if (t.status && t.status !== 'completed') return false
    const at = new Date(t.created_at).getTime()
    return Number.isFinite(at) && at >= fromMs && at <= until
  })

  const sales = round2(txns.reduce((s, t) => s + (Number(t.total) || 0), 0))
  const bills = txns.length

  const costById = new Map((input.costs || []).map((p) => [p.id, Number(p.cost) || 0]))
  let cogs = 0
  let lines = 0
  let withCost = 0
  const sold = new Map<string, { name: string; qty: number }>()

  for (const t of txns) {
    for (const it of t.items || []) {
      const qty = (Number(it.quantity) || 0) * (Number(it.factor) || 1)
      if (qty <= 0) continue
      lines++
      const name = (it.name || 'Item').trim() || 'Item'
      const key = it.product_id || name.toLowerCase()
      const cur = sold.get(key) || { name, qty: 0 }
      cur.qty += qty
      sold.set(key, cur)
      if (it.product_id && costById.has(it.product_id) && (costById.get(it.product_id) || 0) > 0) {
        cogs += qty * (costById.get(it.product_id) || 0)
        withCost++
      }
    }
  }

  const coverage = lines ? Math.round((withCost / lines) * 100) : 0
  const profit = lines === 0 ? 0 : coverage >= 50 ? round2(sales - cogs) : null

  let topItem: { name: string; qty: number } | null = null
  for (const v of sold.values()) {
    if (!topItem || v.qty > topItem.qty) topItem = { name: v.name, qty: round2(v.qty) }
  }

  return {
    period: input.period,
    shopName: input.shopName || 'My shop',
    dateLabel: label,
    sales,
    bills,
    profit,
    profitCoverage: coverage,
    topItem,
    lowStock: Math.max(0, Number(input.lowStock) || 0),
    pendingDues: round2(Math.max(0, Number(input.pendingDues) || 0)),
  }
}
