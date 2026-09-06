import { describe, it, expect } from 'vitest'
import {
  median, purchaseCadenceDays, churnRiskOf, assignLtvTiers,
  suggestedCreditLimit, enrichCustomers, type EnrichSale, type EnrichCustomer,
} from './customer360'

const noon = (ymd: string) => `${ymd}T12:00:00+05:30`
const NOW = new Date('2026-09-06T12:00:00+05:30').getTime()

function sale(partial: Partial<EnrichSale> & { customer_id: string; created_at: string; total: number }): EnrichSale {
  return { status: 'completed', payment_method: 'upi', items: [], ...partial }
}

describe('median', () => {
  it('returns null on empty', () => expect(median([])).toBeNull())
  it('returns the middle of an odd list', () => expect(median([3, 1, 2])).toBe(2))
  it('averages the middle of an even list', () => expect(median([4, 1, 2, 3])).toBe(2.5))
})

describe('purchaseCadenceDays', () => {
  it('needs two distinct days', () => {
    expect(purchaseCadenceDays([])).toBeNull()
    expect(purchaseCadenceDays([noon('2026-09-01')])).toBeNull()
    expect(purchaseCadenceDays([noon('2026-09-01'), noon('2026-09-01')])).toBeNull()
  })
  it('uses the median gap, ignoring two visits on the same day', () => {
    expect(purchaseCadenceDays([
      noon('2026-09-01'), noon('2026-09-01'),
      noon('2026-09-04'),
      noon('2026-09-07'),
    ])).toBe(3)
  })
})

describe('churnRiskOf', () => {
  it('is none with no history', () => {
    expect(churnRiskOf(null, 7, 4)).toBe('none')
    expect(churnRiskOf(10, 7, 0)).toBe('none')
  })
  it('is low when they are still inside the usual window', () => {
    expect(churnRiskOf(8, 7, 4)).toBe('low') // 8 <= 8.75
  })
  it('is medium then high as the gap grows', () => {
    expect(churnRiskOf(14, 7, 4)).toBe('medium') // 14 <= 17.5
    expect(churnRiskOf(20, 7, 4)).toBe('high')
  })
  it('falls back to 30 days when there is no cadence yet', () => {
    expect(churnRiskOf(20, null, 2)).toBe('low')
    expect(churnRiskOf(40, null, 2)).toBe('medium')
    expect(churnRiskOf(80, null, 2)).toBe('high')
  })
})

describe('assignLtvTiers', () => {
  it('marks zero-order customers as new', () => {
    const m = assignLtvTiers([{ id: 'a', spent: 0, orders: 0 }])
    expect(m.get('a')).toBe('new')
  })
  it('uses absolute bands when fewer than 4 spenders', () => {
    const m = assignLtvTiers([
      { id: 'p', spent: 120000, orders: 10 },
      { id: 'g', spent: 60000, orders: 8 },
      { id: 's', spent: 12000, orders: 3 },
    ])
    expect(m.get('p')).toBe('platinum')
    expect(m.get('g')).toBe('gold')
    expect(m.get('s')).toBe('silver')
  })
  it('does not crown a single ₹500 customer platinum', () => {
    const m = assignLtvTiers([{ id: 'a', spent: 500, orders: 1 }])
    expect(m.get('a')).toBe('bronze')
  })
  it('ranks relatively once there are 4+ spenders', () => {
    const spenders = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100].map((spent, i) => ({
      id: `c${i}`, spent, orders: 2,
    }))
    const m = assignLtvTiers(spenders)
    expect(m.get('c0')).toBe('platinum') // top 10%
    expect(m.get('c1')).toBe('gold')
    expect(m.get('c2')).toBe('gold')
    expect(m.get('c4')).toBe('silver')
    expect(m.get('c9')).toBe('bronze')
  })
})

describe('suggestedCreditLimit', () => {
  it('stays silent with fewer than 3 orders or high churn', () => {
    expect(suggestedCreditLimit({ orders: 2, avgOrder: 1000, churn: 'low' })).toBeNull()
    expect(suggestedCreditLimit({ orders: 5, avgOrder: 1000, churn: 'high' })).toBeNull()
  })
  it('rounds 2× average order to the nearest ₹100', () => {
    expect(suggestedCreditLimit({ orders: 4, avgOrder: 1230, churn: 'low' })).toBe(2500)
  })
})

describe('enrichCustomers', () => {
  const customers: EnrichCustomer[] = [
    { id: 'ramesh', name: 'Ramesh', total_spent: 0, total_orders: 0 },
    { id: 'asha', name: 'Asha' },
    { id: 'new', name: 'New face', total_spent: 0, total_orders: 0 },
  ]

  const sales: EnrichSale[] = [
    sale({ customer_id: 'ramesh', created_at: noon('2026-08-10'), total: 500, payment_method: 'cash', items: [{ name: 'Rice 5kg', quantity: 1 }] }),
    sale({ customer_id: 'ramesh', created_at: noon('2026-08-17'), total: 700, payment_method: 'upi', items: [{ name: 'Rice 5kg', quantity: 2 }] }),
    sale({ customer_id: 'ramesh', created_at: noon('2026-08-24'), total: 600, payment_method: 'upi', items: [{ name: 'Atta', quantity: 1 }] }),
    sale({ customer_id: 'ramesh', created_at: noon('2026-08-31'), total: 800, payment_method: 'upi', items: [{ name: 'Rice 5kg', quantity: 1 }] }),
    // voided must not count
    sale({ customer_id: 'ramesh', created_at: noon('2026-09-05'), total: 9999, status: 'void', items: [{ name: 'Ghost', quantity: 9 }] }),
    // Asha last bought 50 days ago, 3 weekly-ish visits before that
    sale({ customer_id: 'asha', created_at: noon('2026-06-10'), total: 400, payment_method: 'cash' }),
    sale({ customer_id: 'asha', created_at: noon('2026-06-17'), total: 400, payment_method: 'cash' }),
    sale({ customer_id: 'asha', created_at: noon('2026-07-18'), total: 400, payment_method: 'cash' }),
  ]

  it('ignores voided sales, prefers UPI, and names the top item', () => {
    const map = enrichCustomers(customers, sales, NOW)
    const r = map.get('ramesh')!
    expect(r.orders).toBe(4)
    expect(r.lifetimeValue).toBe(2600)
    expect(r.preferredPay).toBe('upi')
    expect(r.topItems[0].name).toBe('Rice 5kg')
    expect(r.topItems[0].qty).toBe(4)
    expect(r.cadenceDays).toBe(7)
    expect(r.churnRisk).toBe('low') // last 31 Aug, 6 days ago
    expect(r.insight.toLowerCase()).toMatch(/rice 5kg|every 7/)
    expect(r.suggestedCredit).toBe(1300)
  })

  it('flags a quiet regular as high churn', () => {
    const a = enrichCustomers(customers, sales, NOW).get('asha')!
    expect(a.churnRisk).toBe('high')
    expect(a.insight).toMatch(/Quiet for/)
    expect(a.suggestedCredit).toBeNull()
  })

  it('does not invent a pattern for a brand-new card', () => {
    const n = enrichCustomers(customers, sales, NOW).get('new')!
    expect(n.tier).toBe('new')
    expect(n.orders).toBe(0)
    expect(n.insight).toMatch(/no purchase pattern/)
    expect(n.preferredPay).toBeNull()
    expect(n.topItems).toEqual([])
  })

  it('falls back to customer.total_spent when no sales rows are loaded', () => {
    const c: EnrichCustomer[] = [{ id: 'x', name: 'X', total_spent: 8000, total_orders: 4, last_purchase_at: noon('2026-09-01') }]
    const x = enrichCustomers(c, [], NOW).get('x')!
    expect(x.lifetimeValue).toBe(8000)
    expect(x.orders).toBe(4)
    expect(x.daysSinceLast).toBe(5)
  })
})
