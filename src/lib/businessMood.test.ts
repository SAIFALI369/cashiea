/**
 * businessMood — the shared signal-detection logic behind Meraj's
 * resting expression, and the face-priority resolution used by
 * <MerajDevice />.
 *
 * Mood policy (positive by default): Meraj is a reassuring companion.
 * Only a demonstrable revenue problem (today's revenue falling below
 * 50% of the recent daily average) makes him sad. Overdue invoices and
 * low stock surface as advice cards instead — they are to-dos, not a
 * reason to look devastated.
 */
import { describe, it, expect } from 'vitest'
import {
  computeBusinessMood,
  isLowStock,
  averageDailyRevenue,
  type BusinessSignals,
} from './businessMood'
import { resolveMerajFace } from '../components/MerajDevice'

const base: BusinessSignals = {
  todayRevenue: 1000,
  recentAvgDailyRevenue: 1000,
  overdueInvoiceCount: 0,
  lowStockCount: 0,
}

describe('computeBusinessMood', () => {
  it("is 'happy' when sales meet the recent average with no problems", () => {
    expect(computeBusinessMood(base)).toBe('happy')
    expect(computeBusinessMood({ ...base, todayRevenue: 1200 })).toBe('happy')
  })

  it("is 'sad' on a significant sales drop vs. the recent average", () => {
    expect(computeBusinessMood({ ...base, todayRevenue: 400 })).toBe('sad') // < 50% of avg
    expect(computeBusinessMood({ ...base, todayRevenue: 100, overdueInvoiceCount: 0, lowStockCount: 0 })).toBe('sad')
  })

  it("stays 'happy' when an invoice is overdue — that becomes an advice card, not a sad face", () => {
    expect(computeBusinessMood({ ...base, overdueInvoiceCount: 1 })).toBe('happy')
    expect(computeBusinessMood({ ...base, overdueInvoiceCount: 5 })).toBe('happy')
  })

  it("stays 'happy' on a low-stock alert — restock advice, not a sad face", () => {
    expect(computeBusinessMood({ ...base, lowStockCount: 1 })).toBe('happy')
    expect(computeBusinessMood({ ...base, lowStockCount: 3 })).toBe('happy')
  })

  it("stays 'happy' on a mild shortfall that isn't a significant drop", () => {
    expect(computeBusinessMood({ ...base, todayRevenue: 800 })).toBe('happy')
    expect(computeBusinessMood({ ...base, todayRevenue: 600 })).toBe('happy')
  })

  it("stays 'happy' when there is insufficient history (no average yet)", () => {
    expect(computeBusinessMood({ ...base, recentAvgDailyRevenue: null, todayRevenue: 0 })).toBe('happy')
    expect(computeBusinessMood({ ...base, recentAvgDailyRevenue: null, todayRevenue: 500 })).toBe('happy')
  })

  it("stays positive when problem signals exist but sales are healthy", () => {
    expect(computeBusinessMood({ ...base, todayRevenue: 2000, lowStockCount: 2 })).toBe('happy')
    expect(computeBusinessMood({ ...base, todayRevenue: 2000, overdueInvoiceCount: 1, lowStockCount: 2 })).toBe('happy')
  })
})

describe('isLowStock (existing Dashboard signal)', () => {
  it('matches products at or below their own threshold', () => {
    expect(isLowStock({ stock_quantity: 2, low_stock_threshold: 5 })).toBe(true)
    expect(isLowStock({ stock_quantity: 5, low_stock_threshold: 5 })).toBe(true)
    expect(isLowStock({ stock_quantity: 0, low_stock_threshold: 5 })).toBe(true)
    expect(isLowStock({ stock_quantity: 6, low_stock_threshold: 5 })).toBe(false)
    expect(isLowStock({})).toBe(true) // 0 <= 0 → flagged
  })
})

describe('averageDailyRevenue', () => {
  const day = (offset: number, total: number) => ({
    created_at: new Date(Date.now() - offset * 86400000).toISOString(),
    total,
  })

  it('returns null when there is no history', () => {
    expect(averageDailyRevenue([])).toBeNull()
  })

  it('returns null with fewer than 3 active days (insufficient data)', () => {
    expect(averageDailyRevenue([day(1, 300), day(2, 500)])).toBeNull()
  })

  it('averages over distinct active days', () => {
    expect(averageDailyRevenue([day(1, 300), day(2, 300), day(3, 300)])).toBe(300)
    expect(averageDailyRevenue([day(1, 100), day(1, 200), day(2, 300), day(3, 300)])).toBe(300)
  })
})

describe('resolveMerajFace (interaction states beat mood)', () => {
  it('always uses the matching interaction-state face when active', () => {
    expect(resolveMerajFace('listening', 'happy')).toBe('listening')
    expect(resolveMerajFace('thinking', 'sad')).toBe('thinking')
    expect(resolveMerajFace('speaking', 'neutral')).toBe('speaking')
    // even a happy mood defers to an urgent state
    expect(resolveMerajFace('thinking', 'happy')).toBe('thinking')
  })

  it('defers to businessMood only while idle (positive by default)', () => {
    expect(resolveMerajFace('idle', 'happy')).toBe('happy')
    expect(resolveMerajFace('idle', 'sad')).toBe('sad')
    // a 'neutral' input renders as the positive resting face
    expect(resolveMerajFace('idle', 'neutral')).toBe('happy')
  })
})
