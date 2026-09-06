// ════════════════════════════════════════════════════════════════
// Smart auto-reorder — velocity-based purchase suggestions.
//
// Pure functions. The Products page already has a static low-stock
// threshold; this layer asks "at the current rate of sale, when will
// we run out?" and sizes a draft PO so the shop doesn't go dark.
//
// Honest rules:
//   • voided sales do not count
//   • inactive products are skipped
//   • zero recent sales is not treated as a forecast — we fall back
//     to the owner's own low-stock threshold instead of inventing
//     demand
//   • suggested qty is never negative
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'

const DAY = 86_400_000

export const DEFAULT_LEAD_DAYS = 3
export const DEFAULT_COVER_DAYS = 14
export const DEFAULT_LOOKBACK_DAYS = 30

export interface ReorderProduct {
  id: string
  name: string
  sku: string | null
  stock_quantity: number
  low_stock_threshold: number
  cost: number
  price?: number
  active?: boolean | null
}

export interface ReorderSaleLine {
  product_id?: string | null
  quantity?: number | null
  factor?: number | null
}

export interface ReorderSale {
  items?: ReorderSaleLine[] | null
  created_at: string
  status?: string | null
}

export type ReorderUrgency = 'out' | 'critical' | 'low' | 'watch'

export interface ReorderSuggestion {
  productId: string
  name: string
  sku: string | null
  stock: number
  threshold: number
  /** Units sold per day over the lookback window. */
  dailyVelocity: number
  /** Days until stock hits 0 at current velocity. Null when velocity is 0. */
  daysOfCover: number | null
  suggestedQty: number
  estimatedCost: number
  urgency: ReorderUrgency
  reason: string
}

export function unitsSold(line: ReorderSaleLine): number {
  const qty = Number(line.quantity)
  const factor = Number(line.factor)
  const q = Number.isFinite(qty) ? qty : 0
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1
  return q * f
}

/** Average daily units sold for one SKU over `lookbackDays`. */
export function computeVelocity(
  productId: string,
  txns: ReorderSale[],
  lookbackDays = DEFAULT_LOOKBACK_DAYS,
  now = Date.now(),
): number {
  if (!productId || lookbackDays <= 0) return 0
  const since = now - lookbackDays * DAY
  let sold = 0
  for (const t of txns) {
    if (t.status && t.status !== 'completed') continue
    const at = new Date(t.created_at).getTime()
    if (!Number.isFinite(at) || at < since || at > now) continue
    for (const it of t.items || []) {
      if (it.product_id === productId) sold += unitsSold(it)
    }
  }
  return sold / lookbackDays
}

/**
 * How many units to order so stock covers lead time + a buffer of
 * `coverDays` at the current velocity. Ceil'd so we never under-order
 * a fraction of a bag.
 */
export function suggestReorderQty(opts: {
  stock: number
  dailyVelocity: number
  leadTimeDays?: number
  coverDays?: number
}): number {
  const stock = Math.max(0, Number(opts.stock) || 0)
  const velocity = Math.max(0, Number(opts.dailyVelocity) || 0)
  const lead = Math.max(0, opts.leadTimeDays ?? DEFAULT_LEAD_DAYS)
  const cover = Math.max(0, opts.coverDays ?? DEFAULT_COVER_DAYS)
  const target = (lead + cover) * velocity
  return Math.max(0, Math.ceil(target - stock))
}

function urgencyFor(stock: number, daysOfCover: number | null, lead: number, threshold: number): ReorderUrgency {
  if (stock <= 0) return 'out'
  if (daysOfCover !== null && daysOfCover <= lead) return 'critical'
  if (stock <= threshold) return 'low'
  return 'watch'
}

/**
 * Build reorder suggestions. Healthy items (above threshold AND enough
 * days of cover) are omitted — the owner only sees what needs action.
 */
export function buildReorderSuggestions(
  products: ReorderProduct[],
  txns: ReorderSale[],
  opts: { leadTimeDays?: number; coverDays?: number; lookbackDays?: number; now?: number } = {},
): ReorderSuggestion[] {
  const lead = opts.leadTimeDays ?? DEFAULT_LEAD_DAYS
  const cover = opts.coverDays ?? DEFAULT_COVER_DAYS
  const lookback = opts.lookbackDays ?? DEFAULT_LOOKBACK_DAYS
  const now = opts.now ?? Date.now()

  const out: ReorderSuggestion[] = []
  for (const p of products) {
    if (p.active === false) continue
    const stock = Math.max(0, Number(p.stock_quantity) || 0)
    const threshold = Math.max(0, Number(p.low_stock_threshold) || 0)
    const cost = Math.max(0, Number(p.cost) || 0)
    const velocity = computeVelocity(p.id, txns, lookback, now)
    const daysOfCover = velocity > 0 ? round2(stock / velocity) : null

    let suggestedQty: number
    let reason: string

    if (velocity > 0) {
      suggestedQty = suggestReorderQty({ stock, dailyVelocity: velocity, leadTimeDays: lead, coverDays: cover })
      if (daysOfCover !== null && daysOfCover > cover && stock > threshold) continue
      if (suggestedQty <= 0 && stock > threshold) continue
      if (suggestedQty <= 0) suggestedQty = Math.max(1, Math.ceil(threshold - stock) || threshold)
      reason = daysOfCover === null
        ? 'Selling, but cover could not be computed'
        : daysOfCover <= 0
          ? 'Sold through — restock now'
          : `${daysOfCover < 1 ? '<1' : Math.floor(daysOfCover)} day${daysOfCover < 2 ? '' : 's'} of cover at ${round2(velocity)}/day`
    } else {
      if (stock > threshold) continue
      suggestedQty = Math.max(threshold * 2 - stock, threshold, 1)
      suggestedQty = Math.ceil(suggestedQty)
      reason = stock <= 0
        ? 'Out of stock — no recent sales to size the order, using your alert level'
        : 'Below alert level (no recent sales to size the order)'
    }

    const urgency = urgencyFor(stock, daysOfCover, lead, threshold)
    out.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      stock,
      threshold,
      dailyVelocity: round2(velocity),
      daysOfCover,
      suggestedQty,
      estimatedCost: round2(suggestedQty * cost),
      urgency,
      reason,
    })
  }

  const rank: Record<ReorderUrgency, number> = { out: 0, critical: 1, low: 2, watch: 3 }
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.name.localeCompare(b.name))
}

export function draftPoItems(suggestions: ReorderSuggestion[]): { name: string; quantity: number; unit_price: number }[] {
  return suggestions
    .filter((s) => s.suggestedQty > 0)
    .map((s) => ({
      name: s.name,
      quantity: s.suggestedQty,
      unit_price: s.suggestedQty > 0 ? round2(s.estimatedCost / s.suggestedQty) : 0,
    }))
}
