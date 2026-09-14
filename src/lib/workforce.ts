// ════════════════════════════════════════════════════════════════
// workforce.ts — staff shifts + commission estimates.
//
// The "Square Workforce / Lightspeed commissions" answer, sized for a
// small Indian shop: clock in/out with break minutes, plus a commission
// estimate computed from REAL sales (transactions.served_by matches the
// staff display name). Deliberately NOT payroll — no statutory maths;
// the owner settles amounts with their CA.
// ════════════════════════════════════════════════════════════════

export interface StaffShift {
  id: string
  staff_name: string
  clock_in: string
  clock_out: string | null
  break_minutes: number
  note: string | null
}

export interface CommissionRule {
  id: string
  staff_name: string
  percent: number
  active: boolean
}

export interface ServedSale {
  served_by: string | null
  total: number
  created_at: string
  status?: string | null
}

export interface StaffPerformance {
  staffName: string
  orders: number
  revenue: number
  avgOrder: number
  /** Commission % from the rule (0 when none configured). */
  commissionPercent: number
  /** Estimated commission in rupees. */
  commission: number
  /** Total paid (worked) hours in the period — null when no shifts. */
  hoursWorked: number | null
  shifts: number
  /** Rupees of revenue per paid hour — null when hours unknown. */
  revenuePerHour: number | null
}

/** Worked minutes for one shift (clock out may still be open). */
export function shiftMinutes(shift: StaffShift, now = Date.now()): number {
  const inMs = new Date(shift.clock_in).getTime()
  const outMs = shift.clock_out ? new Date(shift.clock_out).getTime() : now
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) return 0
  const gross = (outMs - inMs) / 60000
  const breaks = Math.max(0, Math.min(600, Math.floor(Number(shift.break_minutes) || 0)))
  return Math.max(0, Math.floor(gross - breaks))
}

/** True when a shift started on the same calendar day as `dayIso`. */
function sameDay(iso: string, dayStart: number, dayEnd: number): boolean {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= dayStart && t < dayEnd
}

/** Minutes worked per staff name for one local day (open shifts included). */
export function minutesByStaffForDay(
  shifts: StaffShift[],
  dayIso: string,
  now = Date.now(),
): Map<string, number> {
  const day = new Date(`${dayIso}T00:00:00`)
  if (Number.isNaN(day.getTime())) return new Map()
  const start = day.getTime()
  const end = start + 86400000
  const out = new Map<string, number>()
  for (const s of shifts) {
    if (!sameDay(s.clock_in, start, end)) continue
    const name = s.staff_name.trim()
    if (!name) continue
    out.set(name, (out.get(name) || 0) + shiftMinutes(s, now))
  }
  return out
}

function inWindow(iso: string, fromMs: number, toMs: number): boolean {
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && t >= fromMs && t <= toMs
}

/**
 * Commission + performance per staff member over a period. Sales are
 * matched by served_by (display name) exactly as recorded at checkout.
 */
export function computeStaffPerformance(
  sales: ServedSale[],
  rules: CommissionRule[],
  shifts: StaffShift[],
  opts: { from: string; to: string; now?: number },
): StaffPerformance[] {
  const now = opts.now ?? Date.now()
  const fromMs = new Date(`${opts.from}T00:00:00`).getTime()
  const toMs = new Date(`${opts.to}T23:59:59.999`).getTime()
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return []

  const ruleByName = new Map<string, CommissionRule>()
  for (const r of rules) {
    if (!r.active) continue
    ruleByName.set(r.staff_name.trim().toLowerCase(), r)
  }

  const agg = new Map<string, { orders: number; revenue: number }>()
  for (const s of sales) {
    const name = String(s.served_by || '').trim()
    if (!name) continue
    if (s.status && s.status !== 'completed') continue
    if (!inWindow(s.created_at, fromMs, toMs)) continue
    const cur = agg.get(name) || { orders: 0, revenue: 0 }
    cur.orders += 1
    cur.revenue += Math.max(0, Number(s.total) || 0)
    agg.set(name, cur)
  }

  // Shift minutes in the window (for hours worked).
  const minutes = new Map<string, { minutes: number; shifts: number }>()
  for (const sh of shifts) {
    const name = sh.staff_name.trim()
    if (!name) continue
    if (!inWindow(sh.clock_in, fromMs, toMs)) continue
    const cur = minutes.get(name) || { minutes: 0, shifts: 0 }
    cur.minutes += shiftMinutes(sh, now)
    cur.shifts += 1
    minutes.set(name, cur)
  }

  const out: StaffPerformance[] = []
  const names = new Set([...agg.keys(), ...[...ruleByName.values()].map((r) => r.staff_name.trim())])
  for (const name of names) {
    const a = agg.get(name) || { orders: 0, revenue: 0 }
    const m = minutes.get(name) || null
    const rule = ruleByName.get(name.toLowerCase())
    const percent = rule ? Math.max(0, Math.min(100, Number(rule.percent) || 0)) : 0
    const hours = m ? Math.round((m.minutes / 60) * 100) / 100 : null
    out.push({
      staffName: name,
      orders: a.orders,
      revenue: Math.round(a.revenue * 100) / 100,
      avgOrder: a.orders > 0 ? Math.round((a.revenue / a.orders) * 100) / 100 : 0,
      commissionPercent: percent,
      commission: Math.round(a.revenue * (percent / 100) * 100) / 100,
      hoursWorked: hours,
      shifts: m?.shifts || 0,
      revenuePerHour: hours && hours > 0 ? Math.round(a.revenue / hours) : null,
    })
  }
  return out.sort((x, y) => y.revenue - x.revenue || x.staffName.localeCompare(y.staffName))
}

/** Commission for a single sale (used for the receipt line estimate). */
export function commissionForSale(total: number, percent: number): number {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  return Math.round(Math.max(0, Number(total) || 0) * (p / 100) * 100) / 100
}
