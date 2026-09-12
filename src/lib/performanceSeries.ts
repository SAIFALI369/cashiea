/**
 * performanceSeries — pure bucketing for the Dashboard Performance card.
 *
 * The dashboard RPC returns only seven daily buckets; relabelling those
 * "Month" is a lie the chart tells silently. This module derives honest
 * series for both ranges so the headline number and the bars can never
 * disagree.
 *
 *   week  → 7 daily buckets, Mon–Sun of the current week
 *   month → ~5 weekly buckets (1–7, 8–14, …) — 30 slivers on a phone
 *           are unreadable; the real question is "which week was strong?"
 *
 * Rules that bite if missed:
 *  · localDayKey uses LOCAL getters, never toISOString() — at +05:30
 *    that shifts the day.
 *  · peak() floors at 1 so an empty chart still lays out.
 *  · monthBuckets IGNORES rows outside the current month rather than
 *    folding them into an edge bucket.
 */

export type Range = 'week' | 'month'

export interface Bucket {
  label: string
  start: number
  end: number
  sales: number
  expenses: number
}

export interface DatedAmount {
  /** local day key, 'YYYY-MM-DD' */
  date: string
  amount: number
}

/** Local day key — LOCAL getters only (toISOString shifts the day at +05:30). */
export function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Monday = 0 … Sunday = 6 (JS getDay(): Sun=0). */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

/** First of the current month, local midnight. */
export function monthStart(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** 28 / 29 / 30 / 31 as the month dictates. */
export function daysInMonth(d = new Date()): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

const sum = (rows: DatedAmount[]) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)

/** Seven daily buckets for the Monday–Sunday week containing `today`. */
export function weekBuckets(sales: DatedAmount[], expenses: DatedAmount[], today = new Date()): Bucket[] {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - mondayIndex(today))
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const key = localDayKey(day)
    return {
      label: labels[i],
      start: i,
      end: i,
      sales: sum(sales.filter((r) => r.date === key)),
      expenses: sum(expenses.filter((r) => r.date === key)),
    }
  })
}

/** ~5 weekly buckets for the CURRENT month. Rows outside the month are
 *  IGNORED — a stray record can never inflate an edge bucket. */
export function monthBuckets(sales: DatedAmount[], expenses: DatedAmount[], today = new Date()): Bucket[] {
  const dim = daysInMonth(today)
  const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-`
  const edges: [number, number, string][] = [
    [1, 7, '1–7'],
    [8, 14, '8–14'],
    [15, 21, '15–21'],
    [22, 28, '22–28'],
    [29, dim, dim > 28 ? '29–end' : ''],
  ]
  return edges
    .filter(([from, to]) => to >= from)
    .map(([from, to, label]) => {
      const inRange = (r: DatedAmount) => {
        if (!r.date.startsWith(prefix)) return false
        const day = Number(r.date.slice(8, 10))
        return day >= from && day <= to
      }
      return {
        label: label || `${from}–${to}`,
        start: from,
        end: to,
        sales: sum(sales.filter(inRange)),
        expenses: sum(expenses.filter(inRange)),
      }
    })
}

/** Tallest bar; floors at 1 so an empty chart still lays out. */
export function peak(buckets: Bucket[]): number {
  return Math.max(1, ...buckets.map((b) => Math.max(b.sales, b.expenses)))
}

/** Headline totals derived from the SAME buckets the bars draw. */
export function rangeTotals(buckets: Bucket[]): { sales: number; expenses: number; profit: number } {
  const sales = sum(buckets.map((b) => ({ date: '', amount: b.sales })))
  const expenses = sum(buckets.map((b) => ({ date: '', amount: b.expenses })))
  return { sales, expenses, profit: sales - expenses }
}
