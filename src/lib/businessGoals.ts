// ════════════════════════════════════════════════════════════════
// Goals & billing streaks — all local, no new tables.
//
// Streak rule (same as GitHub): consecutive local calendar days with
// at least one completed sale. If today has no sale yet, yesterday
// still counts — we don't break a 14-day streak at 10am.
//
// Goals live in localStorage keyed by owner so two shops on the same
// browser don't share targets. Nothing is written to the database.
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'

export type GoalKind = 'revenue' | 'bills' | 'new_customers' | 'streak'
export type GoalPeriod = 'week' | 'month'

export interface Goal {
  id: string
  kind: GoalKind
  period: GoalPeriod
  target: number
  createdAt: string
}

export interface GoalProgress extends Goal {
  actual: number
  pct: number
  remaining: number
  hit: boolean
}

export interface GoalFacts {
  revenue: number
  bills: number
  newCustomers: number
  streak: number
}

const PREFIX = 'cashiea_goals_v1_'

export function ymdLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return ymdLocal(d)
}

export function startOfWeekMon(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00')
  const dow = d.getDay() // 0 Sun
  const back = dow === 0 ? 6 : dow - 1
  d.setDate(d.getDate() - back)
  return ymdLocal(d)
}

export function startOfMonth(ymd: string): string {
  return ymd.slice(0, 7) + '-01'
}

export function daysInMonth(ymd: string): number {
  const [y, m] = ymd.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/**
 * Consecutive billing days ending at `today`. If today is empty, the
 * streak may still end on yesterday (shop just hasn't billed yet).
 */
export function billingStreak(daysWithSales: Iterable<string>, todayYmd: string): number {
  const set = daysWithSales instanceof Set ? daysWithSales : new Set(daysWithSales)
  let cursor = todayYmd
  if (!set.has(cursor)) cursor = addDays(cursor, -1)
  let n = 0
  while (set.has(cursor)) {
    n += 1
    cursor = addDays(cursor, -1)
  }
  return n
}

export function periodBounds(period: GoalPeriod, todayYmd: string): { from: string; to: string } {
  if (period === 'week') return { from: startOfWeekMon(todayYmd), to: todayYmd }
  return { from: startOfMonth(todayYmd), to: todayYmd }
}

export function progressOf(goal: Goal, facts: GoalFacts): GoalProgress {
  const actual =
    goal.kind === 'revenue' ? facts.revenue
    : goal.kind === 'bills' ? facts.bills
    : goal.kind === 'new_customers' ? facts.newCustomers
    : facts.streak
  const target = Math.max(0, Number(goal.target) || 0)
  const pct = target > 0 ? Math.min(999, round2((actual / target) * 100)) : actual > 0 ? 100 : 0
  return {
    ...goal,
    actual,
    pct,
    remaining: Math.max(0, round2(target - actual)),
    hit: target > 0 && actual + 1e-9 >= target,
  }
}

export type WeekGrade = 'A+' | 'A' | 'B' | 'C' | '—'

/** Compare this week's revenue to last week's. Quiet shop ≠ failing shop. */
export function weekGrade(thisWeek: number, lastWeek: number): { grade: WeekGrade; label: string } {
  if (thisWeek <= 0 && lastWeek <= 0) return { grade: '—', label: 'Quiet week — no sales yet to grade.' }
  if (lastWeek <= 0 && thisWeek > 0) return { grade: 'A', label: 'First sales this week. Keep the streak going.' }
  const ratio = thisWeek / lastWeek
  if (ratio >= 1.2) return { grade: 'A+', label: `Up ${Math.round((ratio - 1) * 100)}% vs last week.` }
  if (ratio >= 1) return { grade: 'A', label: 'Matching last week.' }
  if (ratio >= 0.8) return { grade: 'B', label: `Down ${Math.round((1 - ratio) * 100)}% vs last week.` }
  if (thisWeek <= 0) return { grade: 'C', label: 'No sales this week yet.' }
  return { grade: 'C', label: `Down ${Math.round((1 - ratio) * 100)}% vs last week.` }
}

export function loadGoals(ownerId: string, storage: Storage = localStorage): Goal[] {
  try {
    const raw = storage.getItem(PREFIX + ownerId)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { goals?: Goal[] }
    if (!Array.isArray(parsed.goals)) return []
    return parsed.goals.filter((g) => g && typeof g.id === 'string' && g.target > 0)
  } catch {
    return []
  }
}

export function saveGoals(ownerId: string, goals: Goal[], storage: Storage = localStorage): void {
  storage.setItem(PREFIX + ownerId, JSON.stringify({ goals }))
}

export function newGoal(partial: Omit<Goal, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Goal {
  return {
    id: partial.id || crypto.randomUUID(),
    kind: partial.kind,
    period: partial.period,
    target: partial.target,
    createdAt: partial.createdAt || new Date().toISOString(),
  }
}

export const GOAL_TEMPLATES: { label: string; kind: GoalKind; period: GoalPeriod; target: number }[] = [
  { label: '₹1 lakh this month', kind: 'revenue', period: 'month', target: 100000 },
  { label: '₹25k this week', kind: 'revenue', period: 'week', target: 25000 },
  { label: '20 billing days this month', kind: 'bills', period: 'month', target: 20 },
  { label: '7-day billing streak', kind: 'streak', period: 'month', target: 7 },
  { label: '10 new customers this month', kind: 'new_customers', period: 'month', target: 10 },
]

export interface SaleRow {
  created_at: string
  total: number
  status?: string | null
}

function inRange(iso: string, from: string, to: string): boolean {
  const d = ymdLocal(new Date(iso))
  return d >= from && d <= to
}

/** Current streak + this-period revenue / billing-days / new customers. */
export function collectFacts(opts: {
  sales: SaleRow[]
  newCustomerDates: string[]
  todayYmd: string
  period: GoalPeriod
}): GoalFacts {
  const completed = opts.sales.filter((s) => !s.status || s.status === 'completed')
  const days = new Set(completed.map((s) => ymdLocal(new Date(s.created_at))).filter(Boolean))
  const { from, to } = periodBounds(opts.period, opts.todayYmd)
  const inPeriod = completed.filter((s) => inRange(s.created_at, from, to))
  const billDays = new Set(inPeriod.map((s) => ymdLocal(new Date(s.created_at))))
  return {
    revenue: round2(inPeriod.reduce((s, t) => s + (Number(t.total) || 0), 0)),
    bills: billDays.size,
    newCustomers: opts.newCustomerDates.filter((d) => inRange(d, from, to)).length,
    streak: billingStreak(days, opts.todayYmd),
  }
}
