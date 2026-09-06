// ════════════════════════════════════════════════════════════════
// Dynamic pricing suggestions — never auto-applied.
//
// Raise: selling fast with thin cover, and we know cost so the new
// price cannot go underwater.
// Cut: slow / overstocked, floor is cost (never below).
// Quiet SKUs with no cost and no sales are left alone — we do not
// invent a "market price".
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'
import { computeVelocity, unitsSold, type ReorderSale } from './autoReorder'

export type PriceAction = 'raise' | 'cut'

export interface PricingProduct {
  id: string
  name: string
  sku?: string | null
  price: number
  cost: number
  stock_quantity: number
  low_stock_threshold?: number | null
  active?: boolean | null
}

export interface PriceSuggestion {
  productId: string
  name: string
  sku: string | null
  action: PriceAction
  current: number
  suggested: number
  deltaPct: number
  cost: number
  dailyVelocity: number
  daysOfCover: number | null
  reason: string
}

const LOOKBACK = 30
const MIN_UNITS_FOR_RAISE = 3
const RAISE_COVER_DAYS = 7
const CUT_COVER_DAYS = 45

function rupee(n: number): number {
  return Math.max(0, Math.round(n))
}

export function suggestPrices(
  products: PricingProduct[],
  sales: ReorderSale[],
  now = Date.now(),
): PriceSuggestion[] {
  const out: PriceSuggestion[] = []
  const since = now - LOOKBACK * 86_400_000

  for (const p of products) {
    if (p.active === false) continue
    const price = Number(p.price) || 0
    const cost = Math.max(0, Number(p.cost) || 0)
    const stock = Math.max(0, Number(p.stock_quantity) || 0)
    const threshold = Math.max(0, Number(p.low_stock_threshold) || 0)
    if (price <= 0) continue

    const velocity = computeVelocity(p.id, sales, LOOKBACK, now)
    const daysOfCover = velocity > 0 ? round2(stock / velocity) : null

    let units = 0
    for (const t of sales) {
      if (t.status && t.status !== 'completed') continue
      const at = new Date(t.created_at).getTime()
      if (!Number.isFinite(at) || at < since || at > now) continue
      for (const it of t.items || []) {
        if (it.product_id === p.id) units += unitsSold(it)
      }
    }

    // ── Raise: demand + thin cover + known cost ──
    if (units >= MIN_UNITS_FOR_RAISE && velocity > 0 && daysOfCover != null && daysOfCover <= RAISE_COVER_DAYS && cost > 0 && price > cost) {
      const raw = price * 1.05
      const floor = cost * 1.05
      const suggested = rupee(Math.max(raw, floor))
      if (suggested > price) {
        out.push({
          productId: p.id,
          name: p.name,
          sku: p.sku || null,
          action: 'raise',
          current: price,
          suggested,
          deltaPct: round2(((suggested - price) / price) * 100),
          cost,
          dailyVelocity: round2(velocity),
          daysOfCover,
          reason: `${Math.floor(daysOfCover) || '<1'} day${daysOfCover < 2 ? '' : 's'} of cover at ${round2(velocity)}/day. 5% lift still above cost.`,
        })
        continue
      }
    }

    // ── Cut: overstocked and moving slowly. Floor = cost. ──
    const overstocked = stock > Math.max(threshold * 3, 10)
    const slow = daysOfCover != null && daysOfCover >= CUT_COVER_DAYS
    const dead = velocity === 0 && overstocked
    if (cost > 0 && price > cost && (slow || dead)) {
      const suggested = rupee(Math.max(cost, price * 0.9))
      if (suggested < price && suggested >= cost) {
        out.push({
          productId: p.id,
          name: p.name,
          sku: p.sku || null,
          action: 'cut',
          current: price,
          suggested,
          deltaPct: round2(((suggested - price) / price) * 100),
          cost,
          dailyVelocity: round2(velocity),
          daysOfCover,
          reason: dead
            ? `No sales in ${LOOKBACK} days and ${stock} in stock. 10% markdown, not below cost ₹${cost}.`
            : `${Math.floor(daysOfCover || 0)} days of cover. 10% markdown, floor is cost.`,
        })
      }
    }
  }

  const rank: Record<PriceAction, number> = { raise: 0, cut: 1 }
  return out.sort((a, b) => rank[a.action] - rank[b.action] || Math.abs(b.deltaPct) - Math.abs(a.deltaPct) || a.name.localeCompare(b.name))
}
