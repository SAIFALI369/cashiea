import { describe, it, expect } from 'vitest'
import { ymd, addDays, averageDailyExpense, projectCashFlow } from './cashFlow'

describe('date helpers', () => {
  it('formats and adds days without UTC surprises', () => {
    expect(ymd(new Date(2026, 8, 6))).toBe('2026-09-06')
    expect(addDays('2026-09-06', 1)).toBe('2026-09-07')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('averageDailyExpense', () => {
  it('ignores inventory purchases and income rows', () => {
    const avg = averageDailyExpense([
      { amount: 300, type: 'expense', category: 'Rent', date: '2026-09-01' },
      { amount: 300, type: 'expense', category: 'Rent', date: '2026-09-02' },
      { amount: 5000, type: 'expense', category: 'Inventory', date: '2026-09-03' },
      { amount: 900, type: 'income', category: 'Other', date: '2026-09-03' },
    ], 2, '2026-09-02')
    expect(avg).toBe(300) // 600 over 2 days
  })
})

describe('projectCashFlow — honest money', () => {
  const today = '2026-09-06'

  it('puts overdue invoices on today and future dues on their date', () => {
    const p = projectCashFlow({
      today,
      days: 30,
      invoices: [
        { id: '1', total: 5400, due_date: '2026-09-01', status: 'overdue', client_name: 'Rajesh' },
        { id: '2', total: 2000, due_date: '2026-09-20', status: 'sent', client_name: 'Asha' },
        { id: '3', total: 9999, due_date: '2026-09-20', status: 'paid', client_name: 'Skip' },
      ],
    })
    expect(p.expectedIn).toBe(7400)
    expect(p.daily[0].inflow).toBe(5400)
    expect(p.daily.find((d) => d.date === '2026-09-20')?.inflow).toBe(2000)
  })

  it('does not mix khata into expected in', () => {
    const p = projectCashFlow({
      today,
      days: 30,
      khata: [{ amount: 8000, status: 'pending' }, { amount: 100, status: 'settled' }],
    })
    expect(p.expectedIn).toBe(0)
    expect(p.khataCollectable).toBe(8000)
  })

  it('counts supplier outstanding as outflow (default day +7)', () => {
    const p = projectCashFlow({
      today,
      days: 30,
      suppliers: [{ name: 'XYZ', outstanding: 12000 }],
    })
    expect(p.expectedOut).toBe(12000)
    expect(p.daily.find((d) => d.date === '2026-09-13')?.outflow).toBe(12000)
  })

  it('projects operating-expense average forward, excluding inventory', () => {
    const expenses = Array.from({ length: 30 }, (_, i) => ({
      amount: 100,
      type: 'expense' as const,
      category: 'Rent',
      date: addDays(today, -(29 - i)),
    }))
    const p = projectCashFlow({ today, days: 30, expenses })
    expect(p.expectedOut).toBe(3000)
  })

  it('warns when an opening balance goes negative, and not otherwise', () => {
    const p = projectCashFlow({
      today,
      days: 30,
      opening: 1000,
      suppliers: [{ outstanding: 5000 }],
    })
    expect(p.hasOpening).toBe(true)
    expect(p.firstNegativeDay).toBe('2026-09-13')
    expect(p.warning).toMatch(/negative/)
  })

  it('zero activity is a quiet window, not a loss', () => {
    const p = projectCashFlow({ today, days: 30 })
    expect(p.net).toBe(0)
    expect(p.expectedIn).toBe(0)
    expect(p.expectedOut).toBe(0)
    expect(p.warning).toBeNull()
  })
})
