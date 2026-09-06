// ════════════════════════════════════════════════════════════════
// Customer 360° enrichment — derived from completed sales, never
// invented. Used on the Customers drawer and at the POS when a
// regular is selected.
//
// Honest rules:
//   • voided sales do not count
//   • cadence needs at least two distinct purchase days
//   • LTV tier is relative to THIS shop (a kirana's platinum is not
//     a wholesaler's). Tiny shops (< 4 spenders) fall back to
//     absolute rupee bands so one customer isn't "platinum" by default.
//   • suggested credit is a hint, never written back automatically
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'
import type { PaymentMethod } from './types'

const DAY = 86_400_000

export type LtvTier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'new'
export type ChurnRisk = 'none' | 'low' | 'medium' | 'high'

export interface EnrichSale {
  customer_id?: string | null
  created_at: string
  total: number
  status?: string | null
  payment_method?: string | null
  items?: { name?: string | null; quantity?: number | null; factor?: number | null }[] | null
}

export interface EnrichCustomer {
  id: string
  name: string
  total_spent?: number | null
  total_orders?: number | null
  last_purchase_at?: string | null
  credit_limit?: number | null
}

export interface Customer360 {
  customerId: string
  tier: LtvTier
  lifetimeValue: number
  orders: number
  avgOrder: number
  /** Median days between purchase-days. Null with fewer than 2 days. */
  cadenceDays: number | null
  daysSinceLast: number | null
  churnRisk: ChurnRisk
  preferredPay: PaymentMethod | null
  topItems: { name: string; qty: number }[]
  /** Rounded hint; null when we don't have enough history to be honest. */
  suggestedCredit: number | null
  insight: string
}

export function localDay(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function median(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).slice().sort((x, y) => x - y)
  if (!a.length) return null
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

/** Median gap (days) between unique local purchase days, oldest → newest. */
export function purchaseCadenceDays(isoDates: string[]): number | null {
  const days = Array.from(new Set(isoDates.map(localDay).filter(Boolean))).sort()
  if (days.length < 2) return null
  const gaps: number[] = []
  for (let i = 1; i < days.length; i++) {
    const a = new Date(days[i - 1] + 'T00:00:00').getTime()
    const b = new Date(days[i] + 'T00:00:00').getTime()
    gaps.push(Math.round((b - a) / DAY))
  }
  const m = median(gaps)
  return m == null ? null : Math.max(1, Math.round(m))
}

export function churnRiskOf(daysSinceLast: number | null, cadenceDays: number | null, orders: number): ChurnRisk {
  if (orders <= 0 || daysSinceLast == null) return 'none'
  const expected = cadenceDays && cadenceDays > 0 ? cadenceDays : 30
  if (daysSinceLast <= expected * 1.25) return 'low'
  if (daysSinceLast <= expected * 2.5) return 'medium'
  return 'high'
}

const ABSOLUTE: { min: number; tier: LtvTier }[] = [
  { min: 100000, tier: 'platinum' },
  { min: 50000, tier: 'gold' },
  { min: 10000, tier: 'silver' },
]

/**
 * Relative LTV tiers among customers with spend > 0.
 * Top 10% platinum, next 15% gold, next 25% silver, rest bronze.
 * Fewer than 4 spenders → absolute rupee bands (so a single customer
 * is not crowned platinum just for existing).
 */
export function assignLtvTiers(customers: { id: string; spent: number; orders: number }[]): Map<string, LtvTier> {
  const out = new Map<string, LtvTier>()
  const spenders = customers.filter((c) => c.spent > 0 && c.orders > 0)
  for (const c of customers) {
    if (c.orders <= 0 || c.spent <= 0) out.set(c.id, 'new')
  }
  if (spenders.length < 4) {
    for (const c of spenders) {
      const band = ABSOLUTE.find((b) => c.spent >= b.min)
      out.set(c.id, band ? band.tier : 'bronze')
    }
    return out
  }
  const ranked = spenders.slice().sort((a, b) => b.spent - a.spent || a.id.localeCompare(b.id))
  const n = ranked.length
  ranked.forEach((c, i) => {
    const pct = i / n // 0 = top
    const tier: LtvTier = pct < 0.1 ? 'platinum' : pct < 0.25 ? 'gold' : pct < 0.5 ? 'silver' : 'bronze'
    out.set(c.id, tier)
  })
  return out
}

function preferredPay(sales: EnrichSale[]): PaymentMethod | null {
  const counts = new Map<string, { n: number; last: number }>()
  for (const s of sales) {
    const m = s.payment_method
    if (!m || m === 'split') continue
    const at = new Date(s.created_at).getTime() || 0
    const cur = counts.get(m) || { n: 0, last: 0 }
    cur.n += 1
    if (at > cur.last) cur.last = at
    counts.set(m, cur)
  }
  let best: { m: string; n: number; last: number } | null = null
  for (const [m, v] of counts) {
    if (!best || v.n > best.n || (v.n === best.n && v.last > best.last)) best = { m, ...v }
  }
  return (best?.m as PaymentMethod) || null
}

function topItems(sales: EnrichSale[], limit = 3): { name: string; qty: number }[] {
  const map = new Map<string, { name: string; qty: number }>()
  for (const s of sales) {
    for (const it of s.items || []) {
      const name = (it.name || '').trim()
      if (!name) continue
      const qty = (Number(it.quantity) || 0) * (Number(it.factor) > 0 ? Number(it.factor) : 1)
      if (qty <= 0) continue
      const key = name.toLowerCase()
      const cur = map.get(key) || { name, qty: 0 }
      cur.qty += qty
      map.set(key, cur)
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((x) => ({ name: x.name, qty: round2(x.qty) }))
}

export function suggestedCreditLimit(opts: { orders: number; avgOrder: number; churn: ChurnRisk }): number | null {
  if (opts.orders < 3) return null
  if (opts.churn === 'high') return null
  const raw = opts.avgOrder * 2
  if (!Number.isFinite(raw) || raw <= 0) return null
  const rounded = Math.max(500, Math.min(100000, Math.round(raw / 100) * 100))
  return rounded
}

function insightFor(p: Omit<Customer360, 'insight'>): string {
  if (p.orders === 0) return 'New customer — no purchase pattern yet.'
  if (p.churnRisk === 'high' && p.daysSinceLast != null) {
    return `Quiet for ${p.daysSinceLast} days — a win-back now is cheaper than finding a new regular.`
  }
  if (p.cadenceDays != null && p.daysSinceLast != null) {
    const dueIn = p.cadenceDays - p.daysSinceLast
    const next = p.topItems[0]?.name
    if (dueIn <= 2) {
      return next
        ? `Usually every ${p.cadenceDays} days and due now. Likely next: ${next}.`
        : `Usually buys every ${p.cadenceDays} days and is due now.`
    }
    return next
      ? `Usually every ${p.cadenceDays} days. Likely next: ${next}.`
      : `Usually buys every ${p.cadenceDays} days.`
  }
  if (p.tier === 'platinum' || p.tier === 'gold') {
    return p.topItems[0]
      ? `${p.tier === 'platinum' ? 'Top-tier' : 'Gold'} regular. Often takes ${p.topItems[0].name}.`
      : `${p.tier === 'platinum' ? 'Top-tier' : 'Gold'} regular.`
  }
  if (p.daysSinceLast != null) return `Last visit ${p.daysSinceLast} day${p.daysSinceLast === 1 ? '' : 's'} ago.`
  return `${p.orders} order${p.orders === 1 ? '' : 's'} on file.`
}

function completedFor(customerId: string, sales: EnrichSale[]): EnrichSale[] {
  return sales.filter((s) => s.customer_id === customerId && (!s.status || s.status === 'completed'))
}

export function enrichOne(
  customer: EnrichCustomer,
  sales: EnrichSale[],
  tiers: Map<string, LtvTier>,
  now = Date.now(),
): Customer360 {
  const mine = completedFor(customer.id, sales)
  const lifetimeValue = round2(mine.reduce((s, t) => s + (Number(t.total) || 0), 0) || Number(customer.total_spent) || 0)
  const orders = mine.length || Number(customer.total_orders) || 0
  const avgOrder = orders > 0 ? round2(lifetimeValue / orders) : 0
  const cadence = purchaseCadenceDays(mine.map((s) => s.created_at))
  const lastIso = mine.length
    ? mine.map((s) => s.created_at).sort().slice(-1)[0]
    : customer.last_purchase_at || null
  let daysSinceLast: number | null = null
  if (lastIso) {
    const last = new Date(lastIso).getTime()
    if (Number.isFinite(last)) daysSinceLast = Math.max(0, Math.floor((now - last) / DAY))
  }
  const churn = churnRiskOf(daysSinceLast, cadence, orders)
  const items = topItems(mine)
  const partial = {
    customerId: customer.id,
    tier: tiers.get(customer.id) || (orders > 0 ? 'bronze' : 'new'),
    lifetimeValue,
    orders,
    avgOrder,
    cadenceDays: cadence,
    daysSinceLast,
    churnRisk: churn,
    preferredPay: preferredPay(mine),
    topItems: items,
    suggestedCredit: suggestedCreditLimit({ orders, avgOrder, churn }),
  }
  return { ...partial, insight: insightFor(partial) }
}

export function winbackText(name: string, shop: string, topItem?: string | null): string {
  const usual = topItem ? ` Your usual ${topItem} is in stock.` : ''
  return `Hi ${name}, it's been a while — we miss you at ${shop}.${usual}`
}

export function enrichCustomers(
  customers: EnrichCustomer[],
  sales: EnrichSale[],
  now = Date.now(),
): Map<string, Customer360> {
  const spent = new Map<string, number>()
  const orderN = new Map<string, number>()
  for (const s of sales) {
    if (s.status && s.status !== 'completed') continue
    if (!s.customer_id) continue
    spent.set(s.customer_id, (spent.get(s.customer_id) || 0) + (Number(s.total) || 0))
    orderN.set(s.customer_id, (orderN.get(s.customer_id) || 0) + 1)
  }
  const tiers = assignLtvTiers(customers.map((c) => ({
    id: c.id,
    spent: spent.get(c.id) || Number(c.total_spent) || 0,
    orders: orderN.get(c.id) || Number(c.total_orders) || 0,
  })))
  const out = new Map<string, Customer360>()
  for (const c of customers) out.set(c.id, enrichOne(c, sales, tiers, now))
  return out
}
