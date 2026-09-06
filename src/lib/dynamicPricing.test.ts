import { describe, it, expect } from 'vitest'
import { suggestPrices } from './dynamicPricing'

const noon = (ymd: string) => `${ymd}T12:00:00+05:30`
const NOW = new Date('2026-09-06T12:00:00+05:30').getTime()

function salesFor(productId: string, days: string[], qty = 2) {
  return days.map((d) => ({
    created_at: noon(d),
    status: 'completed',
    items: [{ product_id: productId, quantity: qty, factor: 1 }],
  }))
}

describe('suggestPrices', () => {
  it('raises a fast mover with thin cover, never below cost', () => {
    const out = suggestPrices(
      [{ id: 'rice', name: 'Rice 5kg', price: 520, cost: 400, stock_quantity: 2, low_stock_threshold: 5 }],
      salesFor('rice', ['2026-08-10', '2026-08-18', '2026-08-26', '2026-09-02', '2026-09-05']),
      NOW,
    )
    expect(out).toHaveLength(1)
    expect(out[0].action).toBe('raise')
    expect(out[0].suggested).toBeGreaterThan(520)
    expect(out[0].suggested).toBeGreaterThan(out[0].cost)
  })

  it('does not raise without a cost (we cannot protect margin)', () => {
    const out = suggestPrices(
      [{ id: 'rice', name: 'Rice', price: 520, cost: 0, stock_quantity: 2 }],
      salesFor('rice', ['2026-08-10', '2026-08-18', '2026-08-26', '2026-09-02', '2026-09-05']),
      NOW,
    )
    expect(out.filter((s) => s.action === 'raise')).toEqual([])
  })

  it('ignores voided sales when judging velocity', () => {
    const out = suggestPrices(
      [{ id: 'x', name: 'X', price: 100, cost: 50, stock_quantity: 1 }],
      [{ created_at: noon('2026-09-01'), status: 'void', items: [{ product_id: 'x', quantity: 50, factor: 1 }] }],
      NOW,
    )
    expect(out.filter((s) => s.action === 'raise')).toEqual([])
  })

  it('cuts an overstocked dead SKU down toward cost, not through it', () => {
    const out = suggestPrices(
      [{ id: 'old', name: 'Old stock', price: 200, cost: 100, stock_quantity: 80, low_stock_threshold: 5 }],
      [],
      NOW,
    )
    expect(out).toHaveLength(1)
    expect(out[0].action).toBe('cut')
    expect(out[0].suggested).toBeGreaterThanOrEqual(100)
    expect(out[0].suggested).toBeLessThan(200)
  })

  it('skips inactive products', () => {
    const out = suggestPrices(
      [{ id: 'z', name: 'Z', price: 200, cost: 100, stock_quantity: 80, active: false }],
      [],
      NOW,
    )
    expect(out).toEqual([])
  })
})
