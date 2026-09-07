import { describe, it, expect } from 'vitest'
import { computeBusinessMood, isLowStock, averageDailyRevenue } from './businessMood'

const base = { todayRevenue: 1000, recentAvgDailyRevenue: 1000, overdueInvoiceCount: 0, lowStockCount: 0 }

describe('computeBusinessMood — happy always, sad only on a real loss day', () => {
  it("is 'happy' on a normal day", () => {
    expect(computeBusinessMood(base)).toBe('happy')
  })

  it("is 'happy' even when sales drop hard — a slow day is not a loss", () => {
    expect(computeBusinessMood({ ...base, todayRevenue: 100 })).toBe('happy')
    expect(computeBusinessMood({ ...base, todayRevenue: 0 })).toBe('happy')
  })

  it("is 'happy' with overdue invoices and low stock — problems get advice, not a sad face", () => {
    expect(computeBusinessMood({ ...base, overdueInvoiceCount: 7, lowStockCount: 4 })).toBe('happy')
  })

  it("is 'sad' only when today's expenses exceed revenue (real loss)", () => {
    expect(computeBusinessMood({ ...base, todayRevenue: 1000, todayExpenses: 1500 })).toBe('sad')
    expect(computeBusinessMood({ ...base, todayRevenue: 0, todayExpenses: 500 })).toBe('sad')
  })

  it("is 'happy' when expenses equal or trail revenue (break-even or profit)", () => {
    expect(computeBusinessMood({ ...base, todayRevenue: 1500, todayExpenses: 1500 })).toBe('happy')
    expect(computeBusinessMood({ ...base, todayRevenue: 2000, todayExpenses: 1500 })).toBe('happy')
  })
})

describe('isLowStock', () => {
  it('matches products at or below their threshold', () => {
    expect(isLowStock({ stock_quantity: 2, low_stock_threshold: 5 })).toBe(true)
    expect(isLowStock({ stock_quantity: 5, low_stock_threshold: 5 })).toBe(true)
    expect(isLowStock({ stock_quantity: 6, low_stock_threshold: 5 })).toBe(false)
  })
})

describe('averageDailyRevenue', () => {
  it('needs 3+ active days', () => {
    expect(averageDailyRevenue([])).toBeNull()
    expect(averageDailyRevenue([
      { created_at: new Date(Date.now() - 86400000).toISOString(), total: 300 },
      { created_at: new Date(Date.now() - 2 * 86400000).toISOString(), total: 300 },
    ])).toBeNull()
  })
})
