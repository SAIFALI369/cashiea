import { describe, it, expect } from 'vitest'
import { buildSupplierScorecards } from './supplierScorecard'

const today = '2026-09-06'

describe('buildSupplierScorecards', () => {
  it('grades — when there are no POs', () => {
    const cards = buildSupplierScorecards([{ id: 's1', name: 'Ramesh' }], [], today)
    expect(cards[0].grade).toBe('—')
    expect(cards[0].poCount).toBe(0)
  })

  it('flags open POs past expected_date as late, not a fake on-time %', () => {
    const cards = buildSupplierScorecards(
      [{ id: 's1', name: 'Ramesh', outstanding: 5000 }],
      [{
        id: 'p1', supplier_id: 's1', total: 5000, status: 'ordered',
        expected_date: '2026-09-01', created_at: '2026-08-20T00:00:00+05:30',
        items: [{ name: 'Cement', quantity: 10, unit_price: 500 }],
      }],
      today,
    )
    expect(cards[0].lateOpenCount).toBe(1)
    expect(cards[0].grade).toBe('C')
    expect(cards[0].outstanding).toBe(5000)
  })

  it('does not call a received PO late (we have no received_at)', () => {
    const cards = buildSupplierScorecards(
      [{ id: 's1', name: 'Ramesh' }],
      [{
        id: 'p1', supplier_id: 's1', total: 1000, status: 'received',
        expected_date: '2026-08-01', created_at: '2026-07-20T00:00:00+05:30',
      }],
      today,
    )
    expect(cards[0].lateOpenCount).toBe(0)
    expect(cards[0].grade).toBe('A')
    expect(cards[0].volume).toBe(1000)
  })

  it('compares last unit price of the same item across suppliers', () => {
    const cards = buildSupplierScorecards(
      [{ id: 'cheap', name: 'Cheap Co' }, { id: 'dear', name: 'Dear Co' }],
      [
        { id: 'a', supplier_id: 'cheap', total: 400, status: 'received', created_at: '2026-08-01T00:00:00+05:30', items: [{ name: 'Cement 50kg', quantity: 1, unit_price: 400 }] },
        { id: 'b', supplier_id: 'dear', total: 480, status: 'received', created_at: '2026-08-02T00:00:00+05:30', items: [{ name: 'Cement 50kg', quantity: 1, unit_price: 480 }] },
      ],
      today,
    )
    const cheap = cards.find((c) => c.supplierId === 'cheap')!
    const dear = cards.find((c) => c.supplierId === 'dear')!
    expect(cheap.cheaperWins[0].rivalName).toBe('Dear Co')
    expect(dear.dearerLosses[0].rivalName).toBe('Cheap Co')
  })

  it('ignores cancelled POs in volume and price', () => {
    const cards = buildSupplierScorecards(
      [{ id: 's1', name: 'X' }],
      [{ id: 'c', supplier_id: 's1', total: 9999, status: 'cancelled', created_at: '2026-08-01T00:00:00+05:30', items: [{ name: 'Gold', unit_price: 1 }] }],
      today,
    )
    expect(cards[0].volume).toBe(0)
    expect(cards[0].cancelledCount).toBe(1)
  })
})
