import { describe, it, expect } from 'vitest'
import { buildManifest, manifestSummary, KIND_META } from './manifest'

const input = {
  approvals: [{ id: 'a1', summary: 'Delete product "Old Soap"', requester_name: 'Ramesh (Cashier)' }],
  overdue: [
    { id: 'i2', invoice_number: 'INV-2', client_name: 'Big Client', total: 90000 },
    { id: 'i1', invoice_number: 'INV-1', client_name: 'Small Client', total: 5000 },
  ],
  lowStock: [
    { id: 'p1', name: 'Rice 5kg', stock_quantity: 0, low_stock_threshold: 5 },
    { id: 'p2', name: 'Soap', stock_quantity: 3, low_stock_threshold: 10 },
  ],
}

describe('buildManifest', () => {
  it('ranks approvals first (a person is blocked), then money, then stock', () => {
    const m = buildManifest(input)
    expect(m.map((x) => x.kind)).toEqual(['approval', 'overdue', 'overdue', 'lowstock', 'lowstock'])
  })

  it('orders overdue money biggest-first', () => {
    const m = buildManifest(input)
    expect(m[1].title).toContain('Big Client')
    expect(m[2].title).toContain('Small Client')
  })

  it('orders low stock emptiest-first', () => {
    const m = buildManifest(input)
    expect(m[3].title).toContain('Rice')
  })

  it('every item has a one-tap CTA', () => {
    for (const item of buildManifest(input)) {
      expect(item.cta.label.length).toBeGreaterThan(0)
      expect(['approve', 'deny', 'link', 'ask']).toContain(item.cta.kind)
    }
  })

  it('ids are unique', () => {
    const ids = buildManifest(input).map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('handles an empty day', () => {
    expect(buildManifest({ approvals: [], overdue: [], lowStock: [] })).toEqual([])
  })
})

describe('manifestSummary', () => {
  it('counts items and sums only money items', () => {
    const s = manifestSummary(buildManifest(input))
    expect(s.count).toBe(5)
    expect(s.money).toBe(95000)
  })
})

describe('KIND_META', () => {
  it('covers every kind', () => {
    expect(Object.keys(KIND_META).sort()).toEqual(['approval', 'lowstock', 'overdue'])
  })
})
