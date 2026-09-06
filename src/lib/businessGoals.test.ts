import { describe, it, expect } from 'vitest'
import {
  ymdLocal, addDays, startOfWeekMon, startOfMonth, billingStreak,
  weekGrade, progressOf, collectFacts, loadGoals, saveGoals, newGoal,
  type Goal,
} from './businessGoals'

describe('calendar helpers', () => {
  it('ymdLocal is local YYYY-MM-DD', () => {
    expect(ymdLocal(new Date(2026, 8, 6, 9, 30))).toBe('2026-09-06')
  })
  it('startOfWeekMon lands on Monday', () => {
    expect(startOfWeekMon('2026-09-06')).toBe('2026-08-31') // Sun → previous Mon
    expect(startOfWeekMon('2026-08-31')).toBe('2026-08-31')
  })
  it('startOfMonth', () => expect(startOfMonth('2026-09-06')).toBe('2026-09-01'))
  it('addDays crosses months', () => expect(addDays('2026-08-31', 1)).toBe('2026-09-01'))
})

describe('billingStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(billingStreak(['2026-09-04', '2026-09-05', '2026-09-06'], '2026-09-06')).toBe(3)
  })
  it('does not break the streak just because today has no sale yet', () => {
    expect(billingStreak(['2026-09-04', '2026-09-05'], '2026-09-06')).toBe(2)
  })
  it('breaks on a missed day', () => {
    expect(billingStreak(['2026-09-03', '2026-09-05'], '2026-09-06')).toBe(1)
  })
  it('is 0 when there are no sales', () => {
    expect(billingStreak([], '2026-09-06')).toBe(0)
  })
})

describe('weekGrade', () => {
  it('does not fail a quiet shop', () => {
    expect(weekGrade(0, 0).grade).toBe('—')
  })
  it('grades first sales of the week as A, not A+', () => {
    expect(weekGrade(500, 0).grade).toBe('A')
  })
  it('A+ when up 20%+', () => expect(weekGrade(1200, 1000).grade).toBe('A+'))
  it('A when matching last week', () => expect(weekGrade(1000, 1000).grade).toBe('A'))
  it('B when down but within 20%', () => expect(weekGrade(850, 1000).grade).toBe('B'))
  it('C when this week is empty after a busy last week', () => expect(weekGrade(0, 1000).grade).toBe('C'))
})

describe('progressOf', () => {
  const base: Goal = { id: 'g', kind: 'revenue', period: 'month', target: 100000, createdAt: '2026-09-01' }
  it('computes remaining and hit', () => {
    const p = progressOf(base, { revenue: 80000, bills: 0, newCustomers: 0, streak: 0 })
    expect(p.pct).toBe(80)
    expect(p.remaining).toBe(20000)
    expect(p.hit).toBe(false)
  })
  it('marks a goal hit at 100%', () => {
    const p = progressOf(base, { revenue: 100000, bills: 0, newCustomers: 0, streak: 0 })
    expect(p.hit).toBe(true)
    expect(p.remaining).toBe(0)
  })
  it('uses streak / bills / new customers for those kinds', () => {
    expect(progressOf({ ...base, kind: 'streak', target: 7 }, { revenue: 0, bills: 0, newCustomers: 0, streak: 7 }).hit).toBe(true)
    expect(progressOf({ ...base, kind: 'bills', target: 20 }, { revenue: 0, bills: 12, newCustomers: 0, streak: 0 }).actual).toBe(12)
    expect(progressOf({ ...base, kind: 'new_customers', target: 10 }, { revenue: 0, bills: 0, newCustomers: 3, streak: 0 }).pct).toBe(30)
  })
})

describe('collectFacts', () => {
  const sales = [
    { created_at: '2026-08-31T10:00:00+05:30', total: 1000, status: 'completed' }, // last week
    { created_at: '2026-09-01T10:00:00+05:30', total: 2000, status: 'completed' },
    { created_at: '2026-09-01T18:00:00+05:30', total: 500, status: 'completed' },  // same day — one billing day
    { created_at: '2026-09-05T10:00:00+05:30', total: 3000, status: 'void' },      // ignored
    { created_at: '2026-09-06T10:00:00+05:30', total: 4000, status: 'completed' },
  ]
  it('month facts skip voids and count unique billing days', () => {
    const f = collectFacts({
      sales,
      newCustomerDates: ['2026-09-02T00:00:00+05:30', '2026-08-01T00:00:00+05:30'],
      todayYmd: '2026-09-06',
      period: 'month',
    })
    expect(f.revenue).toBe(6500) // 2000+500+4000 (Aug 31 is previous month)
    expect(f.bills).toBe(2) // 1st and 6th
    expect(f.newCustomers).toBe(1)
    expect(f.streak).toBe(1) // today has a sale; yesterday (5th) was void-only
  })
  it('week facts include Monday 31 Aug', () => {
    const f = collectFacts({ sales, newCustomerDates: [], todayYmd: '2026-09-06', period: 'week' })
    expect(f.revenue).toBe(7500)
  })
})

describe('localStorage round-trip', () => {
  function memory(): Storage {
    const bag = new Map<string, string>()
    return {
      getItem: (k) => bag.get(k) ?? null,
      setItem: (k, v) => { bag.set(k, v) },
      removeItem: (k) => { bag.delete(k) },
      clear: () => bag.clear(),
      key: () => null,
      length: 0,
    } as Storage
  }
  it('saves and reloads goals for one owner', () => {
    const store = memory()
    const g = newGoal({ id: 'g1', kind: 'revenue', period: 'month', target: 50000, createdAt: '2026-09-01' })
    saveGoals('owner-a', [g], store)
    expect(loadGoals('owner-a', store)).toEqual([g])
    expect(loadGoals('owner-b', store)).toEqual([])
  })
  it('returns [] on corrupt JSON and drops zero-target rows', () => {
    const store = memory()
    store.setItem('cashiea_goals_v1_o', '{not json')
    expect(loadGoals('o', store)).toEqual([])
    store.setItem('cashiea_goals_v1_o', JSON.stringify({ goals: [{ id: 'x', kind: 'revenue', period: 'month', target: 0 }] }))
    expect(loadGoals('o', store)).toEqual([])
  })
})
