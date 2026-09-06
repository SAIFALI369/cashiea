// ════════════════════════════════════════════════════════════════
// Supplier scorecard — derived from purchase orders we already have.
//
// Honest limits:
//   • POs have no received_at. We do NOT invent an on-time %.
//   • "Late" only means still open (ordered/draft) past expected_date.
//   • Price comparison is same item name across suppliers, last price
//     on a non-cancelled PO. Ties are not a "win".
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'
import { normalizeName } from './duplicates'

export interface ScorePoItem {
  name?: string | null
  quantity?: number | null
  unit_price?: number | null
}

export interface ScorePo {
  id: string
  supplier_id: string | null
  total: number
  status: string
  expected_date?: string | null
  created_at: string
  items?: ScorePoItem[] | null
}

export interface ScoreSupplier {
  id: string
  name: string
  outstanding?: number | null
}

export type SupplierGrade = 'A' | 'B' | 'C' | '—'

export interface PriceWin {
  item: string
  ourPrice: number
  rivalPrice: number
  rivalName: string
}

export interface SupplierCard {
  supplierId: string
  name: string
  poCount: number
  receivedCount: number
  openCount: number
  lateOpenCount: number
  cancelledCount: number
  volume: number
  outstanding: number
  cheaperWins: PriceWin[]
  dearerLosses: PriceWin[]
  grade: SupplierGrade
  gradeWhy: string
}

function lastPriceByItem(pos: ScorePo[]): Map<string, { price: number; at: number }> {
  const out = new Map<string, { price: number; at: number }>()
  for (const po of pos) {
    if (po.status === 'cancelled' || po.status === 'draft') continue
    const at = new Date(po.created_at).getTime() || 0
    for (const it of po.items || []) {
      const key = normalizeName(it.name || '')
      if (key.length < 2) continue
      const price = Number(it.unit_price)
      if (!Number.isFinite(price) || price <= 0) continue
      const cur = out.get(key)
      if (!cur || at >= cur.at) out.set(key, { price, at })
    }
  }
  return out
}

function gradeOf(c: Omit<SupplierCard, 'grade' | 'gradeWhy'>): { grade: SupplierGrade; gradeWhy: string } {
  if (c.poCount === 0) return { grade: '—', gradeWhy: 'No purchase orders yet — nothing to grade.' }
  if (c.lateOpenCount > 0 && c.lateOpenCount >= Math.max(1, Math.ceil(c.openCount * 0.5))) {
    return { grade: 'C', gradeWhy: `${c.lateOpenCount} open PO${c.lateOpenCount === 1 ? '' : 's'} past the expected date.` }
  }
  if (c.receivedCount > 0 && c.lateOpenCount === 0) {
    return { grade: 'A', gradeWhy: `${c.receivedCount} received, none currently late.` }
  }
  return { grade: 'B', gradeWhy: c.openCount ? `${c.openCount} still open.` : 'Mixed history — no late open POs.' }
}

export function buildSupplierScorecards(
  suppliers: ScoreSupplier[],
  pos: ScorePo[],
  todayYmd: string,
): SupplierCard[] {
  const bySupplier = new Map<string, ScorePo[]>()
  for (const po of pos) {
    if (!po.supplier_id) continue
    const list = bySupplier.get(po.supplier_id) || []
    list.push(po)
    bySupplier.set(po.supplier_id, list)
  }

  const prices = new Map<string, Map<string, { price: number; at: number }>>()
  for (const s of suppliers) prices.set(s.id, lastPriceByItem(bySupplier.get(s.id) || []))

  const cards: SupplierCard[] = suppliers.map((s) => {
    const list = bySupplier.get(s.id) || []
    const received = list.filter((p) => p.status === 'received')
    const open = list.filter((p) => p.status === 'ordered' || p.status === 'draft')
    const late = open.filter((p) => p.expected_date && p.expected_date.slice(0, 10) < todayYmd)
    const cancelled = list.filter((p) => p.status === 'cancelled')
    const volume = round2(received.reduce((n, p) => n + (Number(p.total) || 0), 0))

    const cheaperWins: PriceWin[] = []
    const dearerLosses: PriceWin[] = []
    const mine = prices.get(s.id) || new Map()
    for (const [item, ours] of mine) {
      let best: { price: number; name: string } | null = null
      for (const other of suppliers) {
        if (other.id === s.id) continue
        const theirs = prices.get(other.id)?.get(item)
        if (!theirs) continue
        if (!best || theirs.price < best.price) best = { price: theirs.price, name: other.name }
      }
      if (!best) continue
      if (ours.price + 0.005 < best.price) {
        cheaperWins.push({ item, ourPrice: ours.price, rivalPrice: best.price, rivalName: best.name })
      } else if (ours.price > best.price + 0.005) {
        dearerLosses.push({ item, ourPrice: ours.price, rivalPrice: best.price, rivalName: best.name })
      }
    }

    const partial = {
      supplierId: s.id,
      name: s.name,
      poCount: list.length,
      receivedCount: received.length,
      openCount: open.length,
      lateOpenCount: late.length,
      cancelledCount: cancelled.length,
      volume,
      outstanding: Number(s.outstanding) || 0,
      cheaperWins: cheaperWins.sort((a, b) => (b.rivalPrice - b.ourPrice) - (a.rivalPrice - a.ourPrice)).slice(0, 5),
      dearerLosses: dearerLosses.sort((a, b) => (b.ourPrice - b.rivalPrice) - (a.ourPrice - a.rivalPrice)).slice(0, 5),
    }
    const g = gradeOf(partial)
    return { ...partial, ...g }
  })

  const rank: Record<SupplierGrade, number> = { A: 0, B: 1, C: 2, '—': 3 }
  return cards.sort((a, b) => rank[a.grade] - rank[b.grade] || b.volume - a.volume || a.name.localeCompare(b.name))
}
