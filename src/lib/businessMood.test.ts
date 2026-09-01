/**
 * businessMood — the shared signal-detection logic behind Meraj's
 * resting expression, and the face-priority resolution used by
 * <MerajDevice />.
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
  })

  it("is 'sad' when any invoice is overdue", () => {
    expect(computeBusinessMood({ ...base, overdueInvoiceCount: 1 })).toBe('sad')
  })

  it("is 'sad' when a low-stock alert exists", () => {
    expect(computeBusinessMood({ ...base, lowStockCount: 1 })).toBe('sad')
  })

  it("is 'neutral' on a mild shortfall that isn't a significant drop", () => {
    expect(computeBusinessMood({ ...base, todayRevenue: 800 })).toBe('neutral')
  })

  it("is 'neutral' when there is insufficient history (no average yet)", () => {
    expect(computeBusinessMood({ ...base, recentAvgDailyRevenue: null, todayRevenue: 0 })).toBe('neutral')
    expect(computeBusinessMood({ ...base, recentAvgDailyRevenue: null, todayRevenue: 500 })).toBe('neutral')
  })

  it('lets problem signals win even when sales look healthy', () => {
    expect(computeBusinessMood({ ...base, todayRevenue: 2000, lowStockCount: 2 })).toBe('sad')
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

  it('defers to businessMood only while idle', () => {
    expect(resolveMerajFace('idle', 'happy')).toBe('happy')
    expect(resolveMerajFace('idle', 'sad')).toBe('sad')
    expect(resolveMerajFace('idle', 'neutral')).toBe('neutral')
  })
})
