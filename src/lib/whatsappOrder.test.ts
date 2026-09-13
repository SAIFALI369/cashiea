// Tests for the WhatsApp order parser — the exact module the
// whatsapp-webhook edge function imports (`supabase/functions/_shared/`).
// It is pure TypeScript (no Deno APIs) so vitest runs it directly; this
// file is the single source of truth for billing-command behaviour.

import { describe, it, expect } from 'vitest'
import {
  parseWhatsAppOrder, matchCatalogItem, clearCatalogMatch,
  buildCustomerBillMessage, orderHelpMessage, ORDER_LIMITS,
} from '../../supabase/functions/_shared/order-parser'

const CATALOG = [
  { id: '1', name: 'Notebook 200 pages', price: 40, gst_rate: 12, hsn_code: '4820' },
  { id: '2', name: 'Classmate Notebook', price: 55, gst_rate: 12 },
  { id: '3', name: 'Ball Pen Blue', price: 10, gst_rate: 12 },
  { id: '4', name: 'Aashirvaad Atta 5kg', price: 245, gst_rate: 0 },
  { id: '5', name: 'Tata Salt 1kg', price: 28, gst_rate: 5 },
]

describe('parseWhatsAppOrder — the spec sentence', () => {
  it('"Add 50 notebooks at ₹25" parses to one item with qty and price', () => {
    const r = parseWhatsAppOrder('Add 50 notebooks at ₹25')
    expect(r.kind).toBe('order')
    if (r.kind !== 'order') return
    expect(r.items).toEqual([{ name: 'notebooks', quantity: 50, unitPrice: 25 }])
  })

  it('"bill for Ramesh: 3 pens @10, 2 notebooks @40" parses multi-item + customer', () => {
    const r = parseWhatsAppOrder('bill for Ramesh: 3 pens @10, 2 notebooks @40')
    expect(r.kind).toBe('order')
    if (r.kind !== 'order') return
    expect(r.customerName).toBe('Ramesh')
    expect(r.items).toHaveLength(2)
    expect(r.items[0]).toEqual({ name: 'pens', quantity: 3, unitPrice: 10 })
    expect(r.items[1]).toEqual({ name: 'notebooks', quantity: 2, unitPrice: 40 })
  })

  it('parses "aur"/"and" separated Hindi-style lists', () => {
    const r = parseWhatsAppOrder('add 5 kg aata aur 2 packet salt')
    expect(r.kind).toBe('order')
    if (r.kind !== 'order') return
    expect(r.items).toEqual([
      { name: 'kg aata', quantity: 5 },
      { name: 'packet salt', quantity: 2 },
    ])
  })

  it('accepts "Ramesh ke liye" customer phrasing', () => {
    const r = parseWhatsAppOrder('Ramesh ke liye bill karo 2 notebook at 55')
    expect(r.kind).toBe('order')
    if (r.kind !== 'order') return
    expect(r.customerName).toBe('Ramesh')
    expect(r.items[0].quantity).toBe(2)
    expect(r.items[0].unitPrice).toBe(55)
  })

  it('understands Hindi number words as quantities', () => {
    const r = parseWhatsAppOrder('bill: paanch notebook @ 40')
    expect(r.kind).toBe('order')
    if (r.kind !== 'order') return
    expect(r.items[0].quantity).toBe(5)
  })

  it('understands "do" as 2 at the start but filler mid-sentence', () => {
    const start = parseWhatsAppOrder('bill: do notebook @ 40')
    expect(start.kind === 'order' && start.items[0].quantity).toBe(2)
    // "notebook do" mid-sentence: 'do' follows a word → filler, qty stays 1
    const mid = parseWhatsAppOrder('bill: notebook do @ 40')
    expect(mid.kind === 'order' && mid.items[0].quantity).toBe(1)
  })

  it('defaults quantity to 1 when omitted', () => {
    const r = parseWhatsAppOrder('add notebook at 40')
    expect(r.kind).toBe('order')
    if (r.kind !== 'order') return
    expect(r.items[0]).toEqual({ name: 'notebook', quantity: 1, unitPrice: 40 })
  })

  it('keeps numbers that belong to the product name ("Atta 5kg")', () => {
    const r = parseWhatsAppOrder('add 2 Aashirvaad Atta 5kg')
    expect(r.kind).toBe('order')
    if (r.kind !== 'order') return
    expect(r.items[0].name).toContain('aashirvaad atta 5kg')
    expect(r.items[0].quantity).toBe(2)
  })
})

describe('parseWhatsAppOrder — rejection & safety', () => {
  it('ignores ordinary conversation', () => {
    for (const msg of ['ok', 'theek hai', 'kal aa jana', 'thanks boss', 'how was business today?']) {
      expect(parseWhatsAppOrder(msg).kind).toBe('not_order')
    }
  })

  it('ignores enquiries like "5 notebook chahiye kal" (chatter, not a command)', () => {
    expect(parseWhatsAppOrder('5 notebook chahiye kal').kind).toBe('not_order')
  })

  it('asks for help when a billing verb has nothing parseable', () => {
    const r = parseWhatsAppOrder('bill banao')
    expect(r.kind).toBe('unparseable')
  })

  it('rejects absurd quantities', () => {
    const r = parseWhatsAppOrder('add 999999 notebooks at 25')
    expect(r.kind).toBe('unparseable')
  })

  it('rejects absurd unit prices', () => {
    expect(parseWhatsAppOrder('add 2 notebook at 9999999').kind).toBe('unparseable')
  })

  it('rejects zero-priced explicit prices', () => {
    expect(parseWhatsAppOrder('add 2 notebook at 0').kind).toBe('unparseable')
  })

  it('caps the item count per command', () => {
    const msg = 'bill: ' + Array.from({ length: 30 }, (_, i) => `item${i} @10`).join(', ')
    expect(parseWhatsAppOrder(msg).kind).toBe('unparseable')
  })

  it('treats a >1000-char message as not an order', () => {
    expect(parseWhatsAppOrder('bill '.repeat(300)).kind).toBe('not_order')
  })

  it('never bills a bare list that is clearly a question', () => {
    expect(parseWhatsAppOrder('2 notebook kitne ka hai').kind).toBe('not_order')
  })
})

describe('matchCatalogItem / clearCatalogMatch', () => {
  it('exact name matches with score 100', () => {
    const ranked = matchCatalogItem('Tata Salt 1kg', CATALOG)
    expect(ranked[0].product.id).toBe('5')
    expect(ranked[0].score).toBe(100)
  })

  it('plural typed name still matches the singular catalogue entry', () => {
    const m = clearCatalogMatch('notebooks', CATALOG)
    expect(m?.id).toBe('1')
  })

  it('partial catalogue match wins for "notebook 200"', () => {
    const m = clearCatalogMatch('notebook 200', CATALOG)
    expect(m?.id).toBe('1')
  })

  it('full-token match prefers the exact brand item', () => {
    const m = clearCatalogMatch('classmate notebook', CATALOG)
    expect(m?.id).toBe('2')
  })

  it('atta matches Aashirvaad Atta 5kg', () => {
    const m = clearCatalogMatch('aata', CATALOG)
    expect(m?.id).toBe('4')
  })

  it('returns null for unknown items (never guesses)', () => {
    expect(clearCatalogMatch('iphone charger', CATALOG)).toBeNull()
  })

  it('returns null on an ambiguous tie ("notebook" alone)', () => {
    // 'Notebook 200 pages' and 'Classmate Notebook' both overlap 1 token
    // with different value → not a clear winner.
    const m = clearCatalogMatch('notebook', CATALOG)
    expect(m).toBeNull()
  })

  it('empty catalogue and empty query are safe', () => {
    expect(clearCatalogMatch('x', [])).toBeNull()
    expect(clearCatalogItem_empty()).toBeNull()
  })

  it('ranks are sorted descending', () => {
    const ranked = matchCatalogItem('notebook', CATALOG)
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score)
    }
  })
})

// helper: empty query case
function clearCatalogItem_empty(): unknown {
  return clearCatalogMatch('', CATALOG)
}

describe('reply copy', () => {
  const invoice = {
    invoice_number: 'INV-260913-0001',
    items: [
      { description: 'Notebook 200 pages', quantity: 50, unit_price: 25 },
      { description: 'Ball Pen Blue', quantity: 10, unit_price: 10 },
    ],
    subtotal: 1350,
    tax_rate: 10.8,
    tax_amount: 162,
    total: 1512,
  }

  it('formats a customer bill with items, tax, total', () => {
    const msg = buildCustomerBillMessage(invoice, 'Ramesh Stores')
    expect(msg).toContain('INV-260913-0001')
    expect(msg).toContain('Notebook 200 pages × 50')
    expect(msg).toContain('Ball Pen Blue × 10')
    expect(msg).toContain('Subtotal: ₹1,350')
    expect(msg).toContain('GST')
    expect(msg).toContain('Total: ₹1,512')
    expect(msg).toContain('Ramesh Stores')
  })

  it('adds a UPI deep link when the shop has a UPI id', () => {
    const msg = buildCustomerBillMessage(invoice, 'Ramesh Stores', 'ramesh@upi')
    expect(msg).toContain('upi://pay?pa=ramesh%40upi')
    expect(msg).toContain('am=1512.00')
  })

  it('omits the GST line on tax-free bills', () => {
    const msg = buildCustomerBillMessage(
      { ...invoice, tax_amount: 0, tax_rate: 0, total: 1350 }, 'Shop',
    )
    expect(msg).not.toContain('GST')
  })

  it('help message shows the two canonical examples', () => {
    const msg = orderHelpMessage('Ramesh Stores')
    expect(msg).toContain('Add 50 notebooks at ₹25')
    expect(msg).toContain('Bill for Ramesh')
    expect(msg).toContain('Ramesh Stores')
  })
})

describe('ORDER_LIMITS stay conservative', () => {
  it('never allows more than 25 items or ₹10L unit prices', () => {
    expect(ORDER_LIMITS.maxItems).toBeLessThanOrEqual(25)
    expect(ORDER_LIMITS.maxUnitPrice).toBeLessThanOrEqual(1000000)
  })
})
