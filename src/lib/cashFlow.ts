// ════════════════════════════════════════════════════════════════
// Predictive cash flow — forward-looking in vs out.
//
// Honest rules (same bar as the profit dashboard):
//   • We never invent a bank balance. Opening cash is optional; when
//     omitted the chart is a *net change* projection, labelled as such.
//   • Unpaid invoices land on their due date (overdue → today).
//   • Khata (udhaar) is collectable, not certain — shown separately,
//     never mixed into "expected in".
//   • Supplier outstanding is money we already owe — counted as out
//     on day +7 unless a date is supplied.
//   • Forward expenses use the last-30-day daily average of operating
//     expenses (Inventory category excluded, matching Profit).
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'

const DAY = 86_400_000

export type CashKind = 'invoice' | 'supplier' | 'expense'

export interface CashInvoice {
  id: string
  invoice_number?: string | null
  client_name?: string | null
  total: number
  due_date?: string | null
  status: string
}

export interface CashKhata {
  amount: number
  status: string
}

export interface CashSupplier {
  name?: string | null
  outstanding: number
}

export interface CashExpense {
  amount: number
  type?: string | null
  category?: string | null
  date: string
}

export interface DailyCashPoint {
  date: string
  inflow: number
  outflow: number
  net: number
  cumulative: number
}

export interface CashProjection {
  days: number
  expectedIn: number
  expectedOut: number
  net: number
  opening: number
  /** True when opening was supplied; false → cumulative is a net-change. */
  hasOpening: boolean
  daily: DailyCashPoint[]
  /** First date the running total goes negative, if any. */
  firstNegativeDay: string | null
  khataCollectable: number
  warning: string | null
}

export function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + n)
  return ymd(dt)
}

function startOfDay(isoOrDate: string | Date): Date {
  if (isoOrDate instanceof Date) {
    return new Date(isoOrDate.getFullYear(), isoOrDate.getMonth(), isoOrDate.getDate())
  }
  const [y, m, d] = isoOrDate.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((startOfDay(toIso).getTime() - startOfDay(fromIso).getTime()) / DAY)
}

const UNPAID = new Set(['sent', 'viewed', 'partial', 'overdue', 'draft'])

function isInventory(category: string | null | undefined): boolean {
  return String(category || '').trim().toLowerCase() === 'inventory'
}

/** Average daily operating expense over the last `lookbackDays`. */
export function averageDailyExpense(expenses: CashExpense[], lookbackDays = 30, todayIso?: string): number {
  const today = todayIso || ymd(new Date())
  const from = addDays(today, -(lookbackDays - 1))
  let sum = 0
  for (const e of expenses) {
    if (e.type && e.type !== 'expense') continue
    if (isInventory(e.category)) continue
    const date = (e.date || '').slice(0, 10)
    if (!date || date < from || date > today) continue
    const amt = Number(e.amount)
    if (Number.isFinite(amt) && amt > 0) sum += amt
  }
  return lookbackDays > 0 ? sum / lookbackDays : 0
}

export function projectCashFlow(input: {
  invoices?: CashInvoice[]
  khata?: CashKhata[]
  suppliers?: CashSupplier[]
  expenses?: CashExpense[]
  days?: 30 | 60 | 90
  opening?: number
  today?: string
  supplierDueInDays?: number
}): CashProjection {
  const days = input.days ?? 30
  const today = input.today ?? ymd(new Date())
  const end = addDays(today, days - 1)
  const opening = Number.isFinite(Number(input.opening)) ? Number(input.opening) : 0
  const hasOpening = input.opening != null && Number.isFinite(Number(input.opening))
  const supplierLag = input.supplierDueInDays ?? 7

  const buckets = new Map<string, { inflow: number; outflow: number }>()
  for (let i = 0; i < days; i++) buckets.set(addDays(today, i), { inflow: 0, outflow: 0 })

  let expectedIn = 0
  for (const inv of input.invoices || []) {
    if (!UNPAID.has(inv.status)) continue
    const amt = Number(inv.total)
    if (!Number.isFinite(amt) || amt <= 0) continue
    let due = (inv.due_date || '').slice(0, 10)
    if (!due) due = addDays(today, 14)
    if (due < today) due = today
    if (due > end) continue
    const b = buckets.get(due)
    if (!b) continue
    b.inflow += amt
    expectedIn += amt
  }

  let expectedOut = 0
  for (const s of input.suppliers || []) {
    const amt = Number(s.outstanding)
    if (!Number.isFinite(amt) || amt <= 0) continue
    const due = addDays(today, Math.min(supplierLag, days - 1))
    const b = buckets.get(due)
    if (!b) continue
    b.outflow += amt
    expectedOut += amt
  }

  const dailyExp = averageDailyExpense(input.expenses || [], 30, today)
  if (dailyExp > 0) {
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i)
      const b = buckets.get(date)!
      b.outflow += dailyExp
      expectedOut += dailyExp
    }
  }

  expectedIn = round2(expectedIn)
  expectedOut = round2(expectedOut)

  let cumulative = opening
  let firstNegativeDay: string | null = null
  const daily: DailyCashPoint[] = []
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i)
    const b = buckets.get(date)!
    const inflow = round2(b.inflow)
    const outflow = round2(b.outflow)
    const net = round2(inflow - outflow)
    cumulative = round2(cumulative + net)
    if (hasOpening && firstNegativeDay === null && cumulative < 0) firstNegativeDay = date
    daily.push({ date, inflow, outflow, net, cumulative })
  }

  const khataCollectable = round2(
    (input.khata || [])
      .filter((k) => k.status === 'pending')
      .reduce((s, k) => s + (Number(k.amount) || 0), 0),
  )

  const net = round2(expectedIn - expectedOut)
  let warning: string | null = null
  if (hasOpening && firstNegativeDay) {
    const n = daysBetween(today, firstNegativeDay)
    warning = n <= 0
      ? 'Projected cash is already negative if invoices pay on their due dates.'
      : `Warning: cash may go negative in ${n} day${n === 1 ? '' : 's'} (${firstNegativeDay}).`
  } else if (!hasOpening && net < 0) {
    warning = `This window is ₹${Math.abs(net).toLocaleString('en-IN', { maximumFractionDigits: 0 })} net-out if invoices pay on time and expenses stay at the recent average.`
  }

  return {
    days,
    expectedIn,
    expectedOut,
    net,
    opening,
    hasOpening,
    daily,
    firstNegativeDay,
    khataCollectable,
    warning,
  }
}
