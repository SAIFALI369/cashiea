import { describe, it, expect } from 'vitest'
import { dayKey, dayLabel, groupByDay, filterLedger, methodColor, rowTime } from './salesLedger'

// A fixed "now" so the relative labels are deterministic.
const NOW = new Date(2026, 8, 12, 14, 30) // 12 Sept 2026, 2:30 pm local
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString()

describe('dayLabel', () => {
  it('names today and yesterday', () => {
    expect(dayLabel(at(2026, 8, 12), NOW)).toBe('Today')
    expect(dayLabel(at(2026, 8, 11), NOW)).toBe('Yesterday')
  })

  it('uses a plain date within the same year', () => {
    expect(dayLabel(at(2026, 8, 8), NOW)).toBe('8 September')
  })

  it('adds the year for older dates', () => {
    expect(dayLabel(at(2025, 8, 8), NOW)).toContain('2025')
  })

  it('is not fooled by a late-evening timestamp', () => {
    // 11:59 pm yesterday is still "Yesterday", not "Today".
    expect(dayLabel(at(2026, 8, 11, 23), NOW)).toBe('Yesterday')
  })

  it('survives a malformed date', () => {
    expect(dayLabel('not-a-date', NOW)).toBe('Unknown date')
  })
})

describe('dayKey', () => {
  it('is stable per calendar day', () => {
    expect(dayKey(at(2026, 8, 12, 1))).toBe(dayKey(at(2026, 8, 12, 23)))
  })
  it('differs across days', () => {
    expect(dayKey(at(2026, 8, 12))).not.toBe(dayKey(at(2026, 8, 11)))
  })
  it('zero-pads', () => {
    expect(dayKey(at(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('groupByDay', () => {
  it('buckets rows and preserves their order', () => {
    const rows = [
      { created_at: at(2026, 8, 12, 15) },
      { created_at: at(2026, 8, 12, 9) },
      { created_at: at(2026, 8, 11, 18) },
    ]
    const groups = groupByDay(rows, NOW)
    expect(groups).toHaveLength(2)
    expect(groups[0].label).toBe('Today')
    expect(groups[0].items).toHaveLength(2)
    expect(groups[1].label).toBe('Yesterday')
  })

  it('returns nothing for no rows', () => {
    expect(groupByDay([], NOW)).toEqual([])
  })
})

describe('filterLedger', () => {
  const rows = [
    { created_at: at(2026, 8, 12), status: 'completed', payment_method: 'cash' },
    { created_at: at(2026, 8, 10), status: 'completed', payment_method: 'upi' },
    { created_at: at(2026, 8, 1), status: 'completed', payment_method: 'card' },
    { created_at: at(2026, 8, 11), status: 'void', payment_method: 'cash' },
  ]

  it('passes everything through on "all"', () => {
    expect(filterLedger(rows, 'all', NOW)).toHaveLength(4)
  })

  it('keeps only today', () => {
    const r = filterLedger(rows, 'today', NOW)
    expect(r).toHaveLength(1)
    expect(r[0].payment_method).toBe('cash')
  })

  it('keeps the trailing week', () => {
    // 12th, 11th and 10th fall inside; the 1st does not.
    expect(filterLedger(rows, 'week', NOW)).toHaveLength(3)
  })

  it('treats voided and refunded sales as pending attention', () => {
    const r = filterLedger(rows, 'pending', NOW)
    expect(r).toHaveLength(1)
    expect(r[0].status).toBe('void')
  })

  it('flags a sale with no payment method as pending', () => {
    const r = filterLedger([{ created_at: at(2026, 8, 12), status: 'completed', payment_method: null }], 'pending', NOW)
    expect(r).toHaveLength(1)
  })

  it('does not crash on an unparseable date', () => {
    expect(() => filterLedger([{ created_at: 'nope' }], 'today', NOW)).not.toThrow()
    expect(filterLedger([{ created_at: 'nope' }], 'today', NOW)).toHaveLength(0)
  })
})

describe('methodColor', () => {
  it('maps the payment types the brief calls out', () => {
    expect(methodColor('cash')).toContain('emerald')
    expect(methodColor('upi')).toContain('blue')
    expect(methodColor('card')).toContain('purple')
  })
  it('is case-insensitive and has a fallback', () => {
    expect(methodColor('CASH')).toBe(methodColor('cash'))
    expect(methodColor(null)).toContain('gray')
    expect(methodColor('bitcoin')).toContain('gray')
  })
})

describe('rowTime', () => {
  it('formats a 12-hour time', () => {
    expect(rowTime(at(2026, 8, 12, 14))).toMatch(/2:00\s*pm/)
  })
  it('is empty for a bad date', () => {
    expect(rowTime('nope')).toBe('')
  })
})
