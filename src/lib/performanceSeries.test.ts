import { describe, expect, it } from 'vitest'
import {
  daysInMonth, localDayKey, mondayIndex, monthBuckets, monthStart, peak, rangeTotals, weekBuckets,
  type DatedAmount,
} from './performanceSeries'

const rows = (pairs: [string, number][]): DatedAmount[] => pairs.map(([date, amount]) => ({ date, amount }))

describe('localDayKey + mondayIndex', () => {
  it('uses LOCAL date parts, never toISOString (no +05:30 day shift)', () => {
    // 1 Feb 2026, 01:00 LOCAL — toISOString would push this to 31 Jan UTC
    const d = new Date(2026, 1, 1, 1, 0, 0)
    expect(localDayKey(d)).toBe('2026-02-01')
  })
  it('mondayIndex: Monday=0 … Sunday=6 regardless of JS getDay', () => {
    expect(mondayIndex(new Date(2026, 8, 7))).toBe(0)  // Mon 7 Sep 2026
    expect(mondayIndex(new Date(2026, 8, 13))).toBe(6) // Sun 13 Sep 2026
  })
})

describe('weekBuckets', () => {
  const monday = new Date(2026, 8, 7) // Mon 7 Sep 2026
  it('seven Mon–Sun buckets with the right labels and sums', () => {
    const sales = rows([['2026-09-07', 100], ['2026-09-09', 50], ['2026-09-13', 25]])
    const expenses = rows([['2026-09-09', 30]])
    const b = weekBuckets(sales, expenses, monday)
    expect(b.map((x) => x.label)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
    expect(b[0].sales).toBe(100)
    expect(b[2].sales).toBe(50)
    expect(b[6].sales).toBe(25)
    expect(b[2].expenses).toBe(30)
  })
  it('ignores rows outside the week', () => {
    const b = weekBuckets(rows([['2026-08-31', 999]]), [], monday)
    expect(b.reduce((s, x) => s + x.sales, 0)).toBe(0)
  })
})

describe('monthBuckets — edges, 28/30/31-day months, strays', () => {
  it('buckets 1–7 / 8–14 / 15–21 / 22–28 / 29–end and sums correctly', () => {
    const sales = rows([['2026-09-01', 10], ['2026-09-07', 10], ['2026-09-08', 40], ['2026-09-30', 5]])
    const b = monthBuckets(sales, [], new Date(2026, 8, 15))
    expect(b).toHaveLength(5)
    expect(b[0]).toMatchObject({ label: '1–7', sales: 20 })
    expect(b[1]).toMatchObject({ label: '8–14', sales: 40 })
    expect(b[4]).toMatchObject({ label: '29–end', sales: 5 })
  })
  it('28-day February yields only four buckets', () => {
    const b = monthBuckets([], [], new Date(2023, 1, 10)) // Feb 2023 = 28 days
    expect(b).toHaveLength(4)
    expect(b[3].end).toBe(28)
  })
  it('30-day months keep the fifth bucket ending at 30', () => {
    const b = monthBuckets([], [], new Date(2026, 3, 10)) // Apr 2026
    expect(b[4]).toMatchObject({ start: 29, end: 30 })
    expect(daysInMonth(new Date(2026, 3, 10))).toBe(30)
  })
  it('31-day months end at 31', () => {
    const b = monthBuckets([], [], new Date(2026, 0, 10)) // Jan 2026
    expect(b[4].end).toBe(31)
    expect(b[4].label).toBe('29–end')
  })
  it('IGNORES stray rows outside the month — never folds into an edge bucket', () => {
    const sales = rows([['2026-08-31', 500], ['2026-10-01', 500], ['2026-09-15', 20]])
    const b = monthBuckets(sales, [], new Date(2026, 8, 15))
    expect(b.reduce((s, x) => s + x.sales, 0)).toBe(20)
  })
})

describe('peak + rangeTotals', () => {
  it('peak floors at 1 so an empty chart still lays out', () => {
    expect(peak(monthBuckets([], []))).toBe(1)
  })
  it('peak is the tallest of sales or expenses', () => {
    const b = weekBuckets(rows([['2026-09-07', 90]]), rows([['2026-09-08', 120]]), new Date(2026, 8, 7))
    expect(peak(b)).toBe(120)
  })
  it('totals derive from the same buckets the bars draw — they cannot disagree', () => {
    const sales = rows([['2026-09-07', 100], ['2026-09-08', 200]])
    const expenses = rows([['2026-09-07', 50]])
    const b = weekBuckets(sales, expenses, new Date(2026, 8, 7))
    const t = rangeTotals(b)
    expect(t.sales).toBe(300)
    expect(t.expenses).toBe(50)
    expect(t.profit).toBe(250)
  })
  it('monthStart returns local midnight of the 1st', () => {
    const m = monthStart(new Date(2026, 8, 15, 18, 30))
    expect(m.getDate()).toBe(1)
    expect(m.getHours()).toBe(0)
    expect(m.getMonth()).toBe(8)
  })
})
