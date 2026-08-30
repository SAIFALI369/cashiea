import { describe, it, expect } from 'vitest'
import {
  computeSale, tenderStatus, topSoldProducts, expectedCashForDay,
  ageLabel, buildReceiptText, holdRepeatDelay, holdStep, round2,
} from './pos'

const line = (over: Partial<Parameters<typeof computeSale>[0][number]> = {}) => ({
  key: 'a', name: 'Item', quantity: 1, unit_price: 100, gst_rate: 0,
  price_includes_tax: false, ...over,
})

describe('computeSale — base math', () => {
  it('simple exclusive sale: subtotal − discount + tax = total', () => {
    const t = computeSale([line({ quantity: 2, unit_price: 100 })], 0)
    expect(t.subtotal).toBe(200)
    expect(t.taxTotal).toBe(0)
    expect(t.total).toBe(200)
  })

  it('cart discount reduces the taxable base (existing behaviour preserved)', () => {
    const t = computeSale([line({ quantity: 2, unit_price: 100 })], 50)
    expect(t.discountTotal).toBe(50)
    expect(t.taxableBase).toBe(150)
    expect(t.total).toBe(150)
  })

  it('per-line GST at different rates', () => {
    const t = computeSale([
      line({ key: 'a', quantity: 1, unit_price: 100, gst_rate: 5 }),
      line({ key: 'b', quantity: 1, unit_price: 100, gst_rate: 18 }),
    ], 0)
    expect(t.taxTotal).toBe(23) // 5 + 18
    expect(t.total).toBe(223)
    expect(t.effectiveTaxRate).toBe(11.5)
  })

  it('inclusive pricing back-computes the pre-tax base', () => {
    // ₹118 including 18% GST → base 100, tax 18, total still 118
    const t = computeSale([line({ quantity: 1, unit_price: 118, gst_rate: 18, price_includes_tax: true })], 0)
    expect(t.lines[0].base).toBe(100)
    expect(t.lines[0].tax).toBe(18)
    expect(t.total).toBe(118)
    expect(t.subtotal).toBe(100) // stored subtotal is pre-tax
    expect(t.rawTotal).toBe(118) // price-tag sum, display only
  })

  it('line discount applies before tax', () => {
    const t = computeSale([line({ quantity: 1, unit_price: 100, gst_rate: 18, line_discount: 20 })], 0)
    expect(t.lines[0].taxable).toBe(80)
    expect(t.lines[0].tax).toBe(14.4)
    expect(t.total).toBe(94.4)
    expect(t.discountTotal).toBe(20)
  })

  it('line discount cannot exceed the line base', () => {
    const t = computeSale([line({ unit_price: 100, line_discount: 500 })], 0)
    expect(t.lines[0].lineDiscount).toBe(100)
    expect(t.total).toBe(0)
  })

  it('cart discount allocates proportionally across mixed rates', () => {
    // Line A base 300 @5%, line B base 100 @18%; cart discount 40 → 30 / 10
    const t = computeSale([
      line({ key: 'a', quantity: 3, unit_price: 100, gst_rate: 5 }),
      line({ key: 'b', quantity: 1, unit_price: 100, gst_rate: 18 }),
    ], 40)
    expect(t.lines[0].cartDiscountShare).toBe(30)
    expect(t.lines[1].cartDiscountShare).toBe(10)
    expect(t.taxTotal).toBe(round2(270 * 0.05 + 90 * 0.18)) // 13.5 + 16.2
    expect(t.total).toBe(389.7) // taxable 360 + tax 29.7
  })

  it('cart discount is clamped to the taxable pool', () => {
    const t = computeSale([line({ unit_price: 100 })], 999)
    expect(t.cartDiscount).toBe(100)
    expect(t.total).toBe(0)
  })

  it('stored equation always holds: subtotal − discount + tax = total', () => {
    const t = computeSale([
      line({ key: 'a', quantity: 2, unit_price: 83.5, gst_rate: 12, line_discount: 10 }),
      line({ key: 'b', quantity: 1, unit_price: 118, gst_rate: 18, price_includes_tax: true }),
    ], 25)
    expect(round2(t.subtotal - t.discountTotal + t.taxTotal)).toBe(t.total)
  })
})

describe('tenderStatus — split payment guard', () => {
  it('exact single tender balances', () => {
    const s = tenderStatus(500, [{ id: '1', method: 'cash', amount: 500 }])
    expect(s.covered).toBe(true)
    expect(s.remaining).toBe(0)
    expect(s.change).toBe(0)
    expect(s.netTenders).toEqual([{ method: 'cash', amount: 500 }])
  })

  it('split across cash + UPI', () => {
    const s = tenderStatus(500, [
      { id: '1', method: 'cash', amount: 300 },
      { id: '2', method: 'upi', amount: 200 },
    ])
    expect(s.covered).toBe(true)
    expect(s.remaining).toBe(0)
    expect(s.netTenders.length).toBe(2)
    expect(s.netTenders.reduce((a, b) => a + b.amount, 0)).toBe(500)
  })

  it('under-tender is not covered — checkout must block', () => {
    const s = tenderStatus(500, [{ id: '1', method: 'cash', amount: 300 }])
    expect(s.covered).toBe(false)
    expect(s.remaining).toBe(200)
  })

  it('over-tender shows change and records net tenders summing to total', () => {
    // ₹450 sale, ₹500 cash tendered → change 50, net cash recorded 450
    const s = tenderStatus(450, [{ id: '1', method: 'cash', amount: 500 }])
    expect(s.change).toBe(50)
    expect(s.covered).toBe(true)
    expect(s.netTenders).toEqual([{ method: 'cash', amount: 450 }])
  })

  it('change nets out of cash first, leaving UPI intact', () => {
    const s = tenderStatus(600, [
      { id: '1', method: 'upi', amount: 500 },
      { id: '2', method: 'cash', amount: 200 },
    ])
    expect(s.change).toBe(100)
    expect(s.netTenders).toEqual([
      { method: 'upi', amount: 500 },
      { method: 'cash', amount: 100 },
    ])
  })

  it('empty tender never covers', () => {
    expect(tenderStatus(500, []).covered).toBe(false)
  })

  it('zero/negative amounts are ignored', () => {
    const s = tenderStatus(100, [{ id: '1', method: 'cash', amount: 0 }, { id: '2', method: 'upi', amount: -5 }])
    expect(s.entered).toBe(0)
    expect(s.covered).toBe(false)
  })

  it('a fully-discounted ₹0 sale is covered without tenders', () => {
    const s = tenderStatus(0, [])
    expect(s.covered).toBe(true)
    expect(s.netTenders).toEqual([])
  })
})

describe('hold-repeat acceleration', () => {
  it('delay decreases as the hold continues', () => {
    expect(holdRepeatDelay(0)).toBeGreaterThan(holdRepeatDelay(2000))
    expect(holdRepeatDelay(2000)).toBeGreaterThan(holdRepeatDelay(5000))
  })
  it('step size grows with sustained holding', () => {
    expect(holdStep(500)).toBe(1)
    expect(holdStep(2000)).toBe(2)
    expect(holdStep(3500)).toBe(5)
  })
})

describe('topSoldProducts', () => {
  it('counts sale-line frequency and orders by count', () => {
    const txns = [
      { items: [{ product_id: 'a', name: 'Rice', quantity: 2 }, { product_id: 'b', name: 'Soap', quantity: 1 }] },
      { items: [{ product_id: 'a', name: 'Rice', quantity: 1 }] },
      { items: null },
      { items: [{ product_id: 'c', name: 'Oil', quantity: 3 }] },
    ]
    const top = topSoldProducts(txns, 2)
    expect(top[0]).toMatchObject({ productId: 'a', count: 2, unitsSold: 3 })
    // 'Oil' beats 'Soap' on the alphabetical tie-break
    expect(top.map((t) => t.productId)).toEqual(['a', 'c'])
  })
})

describe('expectedCashForDay', () => {
  it('sums cash tender lines', () => {
    expect(expectedCashForDay([], [
      { transaction_id: 't1', amount: 300 },
      { transaction_id: 't2', amount: 150.5 },
    ])).toBe(450.5)
  })

  it('adds legacy cash sales that have no tender rows', () => {
    const txns = [
      { id: 't1', total: 200, payment_method: 'cash' as const, status: 'completed' as const },
      { id: 't2', total: 400, payment_method: 'upi' as const, status: 'completed' as const },
    ]
    expect(expectedCashForDay(txns, [{ transaction_id: 't3', amount: 100 }])).toBe(300)
  })

  it('excludes voided legacy sales', () => {
    const txns = [
      { id: 't1', total: 200, payment_method: 'cash' as const, status: 'void' as const },
    ]
    expect(expectedCashForDay(txns, [])).toBe(0)
  })
})

describe('ageLabel', () => {
  const now = Date.now()
  it('labels age bands', () => {
    expect(ageLabel(new Date(now - 20_000).toISOString(), now)).toBe('just now')
    expect(ageLabel(new Date(now - 12 * 60_000).toISOString(), now)).toBe('12m ago')
    expect(ageLabel(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe('3h ago')
    expect(ageLabel(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe('2d ago')
  })
})

describe('buildReceiptText', () => {
  const model = {
    shopName: 'Bokaro Stores', receiptNumber: 'RCP-123', date: '2026-08-30T10:00:00',
    lines: [{ name: 'Rice', quantity: 2, unit_price: 60, amount: 120 }],
    subtotal: 120, discountTotal: 0, taxTotal: 0, total: 120,
    tenders: [{ method: 'cash', amount: 120 }], change: 0,
  }
  it('includes shop, receipt number, lines and total', () => {
    const text = buildReceiptText(model)
    expect(text).toContain('Bokaro Stores')
    expect(text).toContain('RCP-123')
    expect(text).toContain('Rice')
    expect(text).toContain('120.00')
    expect(text).not.toContain('!')
  })
  it('lists split tenders and change', () => {
    const text = buildReceiptText({
      ...model, total: 150,
      tenders: [{ method: 'upi', amount: 100 }, { method: 'cash', amount: 100 }], change: 50,
    })
    expect(text).toContain('UPI')
    expect(text).toContain('Cash')
    expect(text).toContain('Change')
  })
})
