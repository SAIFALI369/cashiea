import { describe, it, expect } from 'vitest'
import { periodWindow, computeSnapshot } from './businessSnapshot'

const now = new Date(2026, 8, 6, 18, 0, 0)

describe('periodWindow', () => {
  it('today starts at local midnight', () => {
    const w = periodWindow('today', now)
    expect(w.from.getHours()).toBe(0)
    expect(w.from.getDate()).toBe(6)
  })
  it('week looks back 6 days (7 calendar days inclusive)', () => {
    const w = periodWindow('week', now)
    expect(w.from.getDate()).toBe(31) // 31 Aug
    expect(w.from.getMonth()).toBe(7)
  })
  it('month starts on the 1st', () => {
    expect(periodWindow('month', now).from.getDate()).toBe(1)
  })
})

describe('computeSnapshot', () => {
  const sale = (hoursAgo: number, total: number, items: { name: string; product_id: string; quantity: number }[], status = 'completed') => ({
    created_at: new Date(now.getTime() - hoursAgo * 3600000).toISOString(),
    total, status, items,
  })

  it('sums today\'s completed sales and names the top item', () => {
    const s = computeSnapshot({
      period: 'today',
      shopName: 'Kumar Store',
      now,
      sales: [
        sale(2, 500, [{ name: 'Cement', product_id: 'c', quantity: 5 }]),
        sale(3, 200, [{ name: 'Cement', product_id: 'c', quantity: 2 }, { name: 'Sand', product_id: 's', quantity: 1 }]),
        sale(30, 9999, [{ name: 'Old', product_id: 'o', quantity: 1 }]), // yesterday
      ],
      costs: [{ id: 'c', cost: 40 }, { id: 's', cost: 10 }],
    })
    expect(s.sales).toBe(700)
    expect(s.bills).toBe(2)
    expect(s.topItem).toEqual({ name: 'Cement', qty: 7 })
    expect(s.profit).toBe(410) // 700 − (7*40 + 1*10)
  })

  it('voided sales do not count', () => {
    const s = computeSnapshot({
      period: 'today', shopName: 'X', now,
      sales: [sale(1, 500, [{ name: 'A', product_id: 'a', quantity: 1 }], 'void')],
    })
    expect(s.sales).toBe(0)
    expect(s.bills).toBe(0)
    expect(s.profit).toBe(0)
  })

  it('withholds profit when fewer than half the lines have cost data', () => {
    const s = computeSnapshot({
      period: 'today', shopName: 'X', now,
      sales: [
        sale(1, 100, [{ name: 'A', product_id: 'a', quantity: 1 }]),
        sale(1, 100, [{ name: 'B', product_id: 'b', quantity: 1 }]),
        sale(1, 100, [{ name: 'C', product_id: 'c', quantity: 1 }]),
      ],
      costs: [{ id: 'a', cost: 40 }],
    })
    expect(s.profit).toBeNull()
    expect(s.profitCoverage).toBe(33)
  })

  it('reports profit when at least half the lines have cost data', () => {
    const s = computeSnapshot({
      period: 'today', shopName: 'X', now,
      sales: [
        sale(1, 100, [{ name: 'A', product_id: 'a', quantity: 1 }]),
        sale(1, 100, [{ name: 'B', product_id: 'b', quantity: 1 }]),
      ],
      costs: [{ id: 'a', cost: 40 }, { id: 'b', cost: 40 }],
    })
    expect(s.profit).toBe(120)
    expect(s.profitCoverage).toBe(100)
  })

  it('zero sales is a quiet day, profit 0 — not a loss', () => {
    const s = computeSnapshot({ period: 'today', shopName: 'X', now, sales: [] })
    expect(s.sales).toBe(0)
    expect(s.profit).toBe(0)
    expect(s.topItem).toBeNull()
  })
})
