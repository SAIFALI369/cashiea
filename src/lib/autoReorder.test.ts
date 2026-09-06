import { describe, it, expect } from 'vitest'
import {
  unitsSold, computeVelocity, suggestReorderQty, buildReorderSuggestions, draftPoItems,
} from './autoReorder'

const DAY = 86_400_000
const now = Date.parse('2026-09-06T12:00:00+05:30')

describe('unitsSold', () => {
  it('uses factor when present (500g on a kg SKU)', () => {
    expect(unitsSold({ quantity: 2, factor: 0.5 })).toBe(1)
  })
  it('defaults factor to 1 and treats junk as 0', () => {
    expect(unitsSold({ quantity: 3 })).toBe(3)
    expect(unitsSold({ quantity: Number.NaN })).toBe(0)
  })
})

describe('computeVelocity', () => {
  it('averages completed sales over the lookback window', () => {
    const txns = [
      { created_at: new Date(now - 2 * DAY).toISOString(), status: 'completed', items: [{ product_id: 'p1', quantity: 12 }] },
      { created_at: new Date(now - 10 * DAY).toISOString(), status: 'completed', items: [{ product_id: 'p1', quantity: 18 }] },
    ]
    expect(computeVelocity('p1', txns, 10, now)).toBe(3) // 30 units / 10 days
  })

  it('ignores voided sales and other products', () => {
    const txns = [
      { created_at: new Date(now - 1 * DAY).toISOString(), status: 'void', items: [{ product_id: 'p1', quantity: 100 }] },
      { created_at: new Date(now - 1 * DAY).toISOString(), status: 'completed', items: [{ product_id: 'p2', quantity: 50 }] },
    ]
    expect(computeVelocity('p1', txns, 7, now)).toBe(0)
  })

  it('ignores sales outside the window', () => {
    const txns = [
      { created_at: new Date(now - 40 * DAY).toISOString(), status: 'completed', items: [{ product_id: 'p1', quantity: 99 }] },
    ]
    expect(computeVelocity('p1', txns, 30, now)).toBe(0)
  })
})

describe('suggestReorderQty', () => {
  it('sizes to lead + cover minus current stock, ceiled', () => {
    // 12/day × (3 lead + 14 cover) = 204 target − 30 stock = 174
    expect(suggestReorderQty({ stock: 30, dailyVelocity: 12, leadTimeDays: 3, coverDays: 14 })).toBe(174)
  })
  it('never goes negative when already over-covered', () => {
    expect(suggestReorderQty({ stock: 500, dailyVelocity: 1, leadTimeDays: 3, coverDays: 14 })).toBe(0)
  })
  it('treats NaN stock/velocity as zero', () => {
    expect(suggestReorderQty({ stock: Number.NaN, dailyVelocity: Number.NaN })).toBe(0)
  })
})

describe('buildReorderSuggestions', () => {
  const cement = { id: 'c1', name: 'Cement', sku: 'CEM', stock_quantity: 30, low_stock_threshold: 50, cost: 350, active: true }
  const rice = { id: 'r1', name: 'Rice 25kg', sku: 'RICE', stock_quantity: 80, low_stock_threshold: 10, cost: 1200, active: true }

  it('flags a fast-moving item that will stock out inside lead time as critical', () => {
    const txns = [
      { created_at: new Date(now - 1 * DAY).toISOString(), status: 'completed', items: [{ product_id: 'c1', quantity: 20 }] },
    ]
    // 30 in stock, 20/day → 1.5 days of cover, lead time 3 → critical (not yet out)
    const s = buildReorderSuggestions([cement], txns, { now, lookbackDays: 1, leadTimeDays: 3, coverDays: 14 })
    expect(s).toHaveLength(1)
    expect(s[0].urgency).toBe('critical')
    expect(s[0].suggestedQty).toBeGreaterThan(0)
  })

  it('marks stock 0 as out', () => {
    const s = buildReorderSuggestions(
      [{ ...cement, stock_quantity: 0 }],
      [],
      { now },
    )
    expect(s[0].urgency).toBe('out')
    expect(s[0].suggestedQty).toBeGreaterThan(0)
  })

  it('skips healthy slow items and inactive products', () => {
    const s = buildReorderSuggestions(
      [rice, { ...cement, active: false, stock_quantity: 0 }],
      [],
      { now },
    )
    expect(s).toHaveLength(0)
  })

  it('falls back to the alert level when there are no recent sales', () => {
    const s = buildReorderSuggestions(
      [{ ...cement, stock_quantity: 10 }],
      [],
      { now },
    )
    expect(s).toHaveLength(1)
    expect(s[0].dailyVelocity).toBe(0)
    expect(s[0].reason.toLowerCase()).toMatch(/alert level/)
    expect(s[0].suggestedQty).toBeGreaterThanOrEqual(50)
  })

  it('draft PO items use cost as unit price and drop zero qty', () => {
    const items = draftPoItems([
      { productId: 'c1', name: 'Cement', sku: 'CEM', stock: 0, threshold: 5, dailyVelocity: 1, daysOfCover: 0, suggestedQty: 10, estimatedCost: 3500, urgency: 'out', reason: '' },
      { productId: 'x', name: 'Skip', sku: null, stock: 9, threshold: 5, dailyVelocity: 0, daysOfCover: null, suggestedQty: 0, estimatedCost: 0, urgency: 'watch', reason: '' },
    ])
    expect(items).toEqual([{ name: 'Cement', quantity: 10, unit_price: 350 }])
  })
})
