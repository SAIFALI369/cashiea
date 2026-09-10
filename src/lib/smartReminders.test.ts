import { describe, it, expect } from 'vitest'
import { daysUntil, gstDueDates, buildSmartReminders } from './smartReminders'

describe('daysUntil', () => {
  const today = new Date(2026, 8, 6) // 6 Sep 2026
  it('is 0 on the same local day', () => {
    expect(daysUntil('2026-09-06', today)).toBe(0)
  })
  it('is negative when overdue', () => {
    expect(daysUntil('2026-09-01', today)).toBe(-5)
  })
})

describe('gstDueDates', () => {
  it('on 6 Sep, GSTR-1 is due the 11th for August', () => {
    const rows = gstDueDates(new Date(2026, 8, 6))
    const g1 = rows.find((r) => r.form === 'GSTR-1')!
    expect(g1.due).toBe('2026-09-11')
    expect(g1.period.toLowerCase()).toMatch(/august/)
  })

  it('after the 11th + grace, GSTR-1 jumps to next month', () => {
    const rows = gstDueDates(new Date(2026, 8, 25))
    expect(rows.find((r) => r.form === 'GSTR-1')!.due).toBe('2026-10-11')
  })
})

describe('buildSmartReminders', () => {
  const today = new Date(2026, 8, 6)

  it('surfaces overdue invoices and upcoming GST', () => {
    const r = buildSmartReminders({
      today,
      invoices: [
        { id: 'i1', invoice_number: 'INV-1', client_name: 'Rajesh', total: 5400, due_date: '2026-09-01', status: 'overdue' },
        { id: 'i2', invoice_number: 'INV-2', client_name: 'Paid', total: 100, due_date: '2026-09-01', status: 'paid' },
      ],
    })
    expect(r.some((x) => x.kind === 'gst' && x.title.includes('GSTR-1'))).toBe(true)
    const inv = r.find((x) => x.id === 'inv-i1')!
    expect(inv.urgency).toBe('overdue')
    expect(inv.amount).toBe(5400)
    expect(r.find((x) => x.id === 'inv-i2')).toBeUndefined()
  })

  it('flags Holi when it is within 14 days', () => {
    const r = buildSmartReminders({ today: new Date(2026, 2, 1) }) // 1 Mar 2026, Holi on 3 Mar
    expect(r.some((x) => x.kind === 'festival' && x.title.includes('Holi'))).toBe(true)
  })

  it('does not nag about last week\'s festival', () => {
    const r = buildSmartReminders({ today: new Date(2026, 2, 20) })
    expect(r.some((x) => x.title.includes('Holi'))).toBe(false)
  })

  it('win-back kicks in after 30 quiet days, not before', () => {
    const r = buildSmartReminders({
      today,
      customers: [
        { id: 'c1', name: 'Asha', last_purchase_at: '2026-08-01T10:00:00+05:30', total_orders: 4 },
        { id: 'c2', name: 'Fresh', last_purchase_at: '2026-09-05T10:00:00+05:30', total_orders: 2 },
        { id: 'c3', name: 'Never', last_purchase_at: null, total_orders: 0 },
      ],
    })
    expect(r.some((x) => x.id === 'dormant-c1')).toBe(true)
    expect(r.some((x) => x.id === 'dormant-c2')).toBe(false)
    expect(r.some((x) => x.id === 'dormant-c3')).toBe(false)
  })

  it('khata only after 14 days pending', () => {
    const r = buildSmartReminders({
      today,
      khata: [
        { id: 'k1', customer_name: 'Ramesh', amount: 2000, status: 'pending', created_at: '2026-08-01T00:00:00+05:30' },
        { id: 'k2', customer_name: 'New', amount: 500, status: 'pending', created_at: '2026-09-05T00:00:00+05:30' },
        { id: 'k3', customer_name: 'Settled', amount: 500, status: 'settled', created_at: '2026-07-01T00:00:00+05:30' },
      ],
    })
    expect(r.some((x) => x.id === 'khata-k1')).toBe(true)
    expect(r.some((x) => x.id === 'khata-k2')).toBe(false)
    expect(r.some((x) => x.id === 'khata-k3')).toBe(false)
  })

  it('low stock points at auto-reorder', () => {
    const r = buildSmartReminders({ today, lowStockCount: 3 })
    const stock = r.find((x) => x.kind === 'stock')!
    expect(stock.href).toBe('/app/auto-reorder')
    expect(stock.title).toMatch(/3 items/)
  })

  it('sorts overdue before upcoming', () => {
    const r = buildSmartReminders({
      today,
      invoices: [
        { id: 'soon', invoice_number: 'A', client_name: 'A', total: 1, due_date: '2026-09-08', status: 'sent' },
        { id: 'late', invoice_number: 'B', client_name: 'B', total: 1, due_date: '2026-09-01', status: 'overdue' },
      ],
    })
    const invoices = r.filter((x) => x.kind === 'invoice')
    expect(invoices[0].id).toBe('inv-late')
  })
})
