import { describe, it, expect } from 'vitest'
import { auditGstInvoices, looksLikeGstin, gstr1WorkingJson } from './gstHealth'

describe('looksLikeGstin', () => {
  it('accepts a well-shaped 15-char GSTIN', () => {
    expect(looksLikeGstin('22AAAAA0000A1Z5')).toBe(true)
  })
  it('rejects short or junk values', () => {
    expect(looksLikeGstin('ABC')).toBe(false)
    expect(looksLikeGstin('')).toBe(false)
  })
})

describe('auditGstInvoices', () => {
  it('does not nag B2C invoices for a missing GSTIN', () => {
    const h = auditGstInvoices([{
      id: '1', invoice_number: 'INV-1', client_gstin: null,
      subtotal: 100, tax_rate: 0, tax_amount: 0, total: 100,
    }])
    expect(h.b2c).toBe(1)
    expect(h.flags.filter((f) => f.kind === 'gstin')).toEqual([])
  })

  it('flags interstate with no place of supply', () => {
    const h = auditGstInvoices([{
      id: '1', invoice_number: 'INV-1', subtotal: 100, tax_rate: 18, tax_amount: 18, total: 118,
      is_interstate: true, place_of_supply: '',
    }])
    expect(h.flags.some((f) => f.kind === 'place_of_supply')).toBe(true)
  })

  it('flags tax that does not match rate × taxable', () => {
    const h = auditGstInvoices([{
      id: '1', invoice_number: 'INV-1', subtotal: 1000, tax_rate: 18, tax_amount: 50, total: 1050,
    }])
    expect(h.flags.some((f) => f.kind === 'tax_mismatch')).toBe(true)
  })

  it('flags duplicate invoice numbers', () => {
    const h = auditGstInvoices([
      { id: 'a', invoice_number: 'INV-1', subtotal: 10, tax_rate: 0, tax_amount: 0, total: 10 },
      { id: 'b', invoice_number: 'INV-1', subtotal: 20, tax_rate: 0, tax_amount: 0, total: 20 },
    ])
    expect(h.flags.filter((f) => f.kind === 'duplicate_number')).toHaveLength(2)
  })

  it('skips drafts', () => {
    const h = auditGstInvoices([{
      id: 'd', invoice_number: 'DRAFT-1', status: 'draft',
      subtotal: 1000, tax_rate: 18, tax_amount: 1, total: 1001, is_interstate: true,
    }])
    expect(h.invoiceCount).toBe(0)
    expect(h.flags).toEqual([])
  })

  it('flags a malformed buyer GSTIN', () => {
    const h = auditGstInvoices([{
      id: '1', invoice_number: 'INV-1', client_gstin: 'NOT-A-GSTIN',
      subtotal: 10, tax_rate: 0, tax_amount: 0, total: 10,
    }])
    expect(h.flags.some((f) => f.kind === 'gstin')).toBe(true)
  })
})

describe('gstr1WorkingJson', () => {
  it('splits B2B/B2C and never claims to be a GSTN file', () => {
    const json = gstr1WorkingJson([
      { id: 'a', invoice_number: 'INV-1', client_gstin: '22AAAAA0000A1Z5', client_name: 'Co', subtotal: 100, tax_rate: 18, tax_amount: 18, total: 118 },
      { id: 'b', invoice_number: 'INV-2', client_gstin: null, client_name: 'Walk-in', subtotal: 50, tax_rate: 0, tax_amount: 0, total: 50 },
    ], { from: '2026-09-01', to: '2026-09-30' })
    expect(json.disclaimer).toMatch(/not a GSTN filing/i)
    expect(json.b2b).toHaveLength(1)
    expect(json.b2c).toHaveLength(1)
    expect(json.counts.invoices).toBe(2)
  })
})
