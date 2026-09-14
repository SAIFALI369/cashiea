import { describe, it, expect } from 'vitest'
import {
  shiftMinutes, minutesByStaffForDay, computeStaffPerformance, commissionForSale,
  type StaffShift, type ServedSale,
} from './workforce'

const now = new Date('2026-09-14T18:00:00').getTime()

function shift(over: Partial<StaffShift>): StaffShift {
  return {
    id: over.id || 's1',
    staff_name: over.staff_name || 'Sita',
    clock_in: over.clock_in || '2026-09-14T09:00:00',
    clock_out: over.clock_out ?? null,
    break_minutes: over.break_minutes ?? 0,
    note: over.note ?? null,
  }
}

describe('shiftMinutes', () => {
  it('computes worked minutes minus breaks', () => {
    expect(shiftMinutes(shift({ clock_in: '2026-09-14T09:00:00', clock_out: '2026-09-14T17:00:00', break_minutes: 30 }))).toBe(450)
  })
  it('uses now for open shifts', () => {
    expect(shiftMinutes(shift({ clock_in: '2026-09-14T09:00:00' }), new Date('2026-09-14T11:00:00').getTime())).toBe(120)
  })
  it('handles clock-out before clock-in (data error) as zero', () => {
    expect(shiftMinutes(shift({ clock_in: '2026-09-14T17:00:00', clock_out: '2026-09-14T09:00:00' }))).toBe(0)
  })
  it('caps break minutes at 600', () => {
    // 09:00–23:00 = 840 gross; 900 break minutes clamp to 600 → 240 worked.
    expect(shiftMinutes(shift({ clock_in: '2026-09-14T09:00:00', clock_out: '2026-09-14T23:00:00', break_minutes: 900 }))).toBe(240)
  })
})

describe('minutesByStaffForDay', () => {
  it('aggregates per staff for one local day only', () => {
    const mins = minutesByStaffForDay([
      shift({ staff_name: 'Sita', clock_in: '2026-09-14T09:00:00', clock_out: '2026-09-14T13:00:00' }),
      shift({ staff_name: 'Sita', clock_in: '2026-09-14T14:00:00', clock_out: '2026-09-14T18:00:00' }),
      shift({ staff_name: 'Ramu', clock_in: '2026-09-13T09:00:00', clock_out: '2026-09-13T17:00:00' }), // other day
    ], '2026-09-14', now)
    expect(mins.get('Sita')).toBe(480)
    expect(mins.has('Ramu')).toBe(false)
  })
  it('returns empty for an invalid day', () => {
    expect(minutesByStaffForDay([], 'not-a-date').size).toBe(0)
  })
})

describe('computeStaffPerformance', () => {
  const sales: ServedSale[] = [
    { served_by: 'Sita', total: 1000, created_at: '2026-09-10T10:00:00' },
    { served_by: 'Sita', total: 500, created_at: '2026-09-12T12:00:00' },
    { served_by: 'Ramu', total: 300, created_at: '2026-09-11T11:00:00' },
    { served_by: 'Sita', total: 9999, created_at: '2026-09-01T10:00:00' }, // outside window
    { served_by: null, total: 700, created_at: '2026-09-12T10:00:00' },    // walk-in, no staff
    { served_by: 'Sita', total: 400, created_at: '2026-09-12T10:00:00', status: 'void' }, // voided
  ]
  const shifts = [
    shift({ staff_name: 'Sita', clock_in: '2026-09-10T09:00:00', clock_out: '2026-09-10T18:00:00', break_minutes: 60 }),
    shift({ staff_name: 'Sita', clock_in: '2026-09-12T09:00:00', clock_out: '2026-09-12T18:00:00', break_minutes: 60 }),
  ]
  const rules = [
    { id: 'r1', staff_name: 'Sita', percent: 2, active: true },
    { id: 'r2', staff_name: 'Ramu', percent: 5, active: true },
  ]

  it('matches sales by served_by inside the window, completed only', () => {
    const perf = computeStaffPerformance(sales, rules, shifts, { from: '2026-09-10', to: '2026-09-13', now })
    const sita = perf.find((p) => p.staffName === 'Sita')!
    expect(sita.orders).toBe(2)
    expect(sita.revenue).toBe(1500)
    expect(sita.avgOrder).toBe(750)
  })

  it('applies the commission percent to revenue', () => {
    const perf = computeStaffPerformance(sales, rules, shifts, { from: '2026-09-10', to: '2026-09-13', now })
    expect(perf.find((p) => p.staffName === 'Sita')!.commission).toBe(30)
    expect(perf.find((p) => p.staffName === 'Ramu')!.commission).toBe(15)
  })

  it('counts paid hours from shifts in the window', () => {
    const perf = computeStaffPerformance(sales, rules, shifts, { from: '2026-09-10', to: '2026-09-13', now })
    const sita = perf.find((p) => p.staffName === 'Sita')!
    expect(sita.hoursWorked).toBe(16)
    expect(sita.shifts).toBe(2)
    expect(sita.revenuePerHour).toBe(94) // 1500/16 rounded
  })

  it('staff with a rule but no sales still appear (for setup visibility)', () => {
    const perf = computeStaffPerformance([], [{ id: 'r1', staff_name: 'Ghost', percent: 1, active: true }], [], { from: '2026-09-10', to: '2026-09-13', now })
    expect(perf[0].staffName).toBe('Ghost')
    expect(perf[0].orders).toBe(0)
  })

  it('ignores inactive commission rules', () => {
    const perf = computeStaffPerformance(sales, [{ id: 'r1', staff_name: 'Sita', percent: 10, active: false }], shifts, { from: '2026-09-10', to: '2026-09-13', now })
    expect(perf.find((p) => p.staffName === 'Sita')!.commissionPercent).toBe(0)
  })

  it('sorts by revenue, biggest seller first', () => {
    const perf = computeStaffPerformance(sales, rules, shifts, { from: '2026-09-10', to: '2026-09-13', now })
    expect(perf[0].staffName).toBe('Sita')
  })

  it('invalid window returns empty', () => {
    expect(computeStaffPerformance(sales, rules, shifts, { from: 'zzz', to: '2026-09-13' })).toEqual([])
  })
})

describe('commissionForSale', () => {
  it('computes and clamps', () => {
    expect(commissionForSale(1500, 2)).toBe(30)
    expect(commissionForSale(1500, 0)).toBe(0)
    expect(commissionForSale(1500, 300)).toBe(1500)
    expect(commissionForSale(-100, 5)).toBe(0)
  })
})
