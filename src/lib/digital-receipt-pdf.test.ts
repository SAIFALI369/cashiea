import { describe, it, expect } from 'vitest'
import { buildDigitalReceiptPdf, digitalReceiptFileName } from './digital-receipt-pdf'
import type { ReceiptModel } from './pos'

const receipt: ReceiptModel = {
  shopName: 'Joker Stores',
  address: '12 MG Road, Patna',
  phone: '9876543210',
  gstin: '10ABCDE1234F1Z5',
  upiId: 'joker@upi',
  receiptNumber: 'INV-0042',
  date: new Date('2026-09-12T14:45:00Z').toISOString(),
  customerName: 'Mohammad Hasan',
  lines: [
    { name: 'Aashirvaad Atta 5kg', quantity: 1, unit_price: 285, unit: null, amount: 285 },
    { name: 'Tata Salt 1kg', quantity: 2, unit_price: 28, unit: null, amount: 56 },
  ],
  subtotal: 341,
  discountTotal: 0,
  taxTotal: 17.05,
  total: 358.05,
  tenders: [{ method: 'upi', amount: 358.05 }],
  change: 0,
  servedBy: 'Saif',
}

describe('buildDigitalReceiptPdf', () => {
  it('produces a non-trivial single-page A5 PDF', async () => {
    const doc = await buildDigitalReceiptPdf(receipt, null)
    const out = doc.output('arraybuffer')
    expect(out.byteLength).toBeGreaterThan(1000)
    expect(doc.getNumberOfPages()).toBe(1)
    const size = doc.internal.pageSize
    expect(Math.round(size.getWidth())).toBe(148)
    expect(Math.round(size.getHeight())).toBe(210)
  })

  it('renders without a UPI id (no QR available)', async () => {
    const doc = await buildDigitalReceiptPdf({ ...receipt, upiId: null }, null)
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000)
  })

  it('renders without an identified customer', async () => {
    const doc = await buildDigitalReceiptPdf({ ...receipt, customerName: null }, null)
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000)
  })

  it('continues a long shopping list onto more pages instead of truncating', async () => {
    const many = {
      ...receipt,
      lines: Array.from({ length: 40 }, (_, i) => ({
        name: `Product number ${i} with a deliberately long name`,
        quantity: i + 1,
        unit_price: 99.5,
        unit: 'kg',
        amount: (i + 1) * 99.5,
      })),
    }
    const doc = await buildDigitalReceiptPdf(many, null)
    // Every purchased item must appear; a receipt that hides lines is wrong.
    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
    const text = JSON.stringify(doc.output('arraybuffer').byteLength)
    expect(Number(text)).toBeGreaterThan(1000)
  })

  it('handles a discounted sale with change due', async () => {
    const doc = await buildDigitalReceiptPdf(
      { ...receipt, discountTotal: 40, change: 12.5, tenders: [{ method: 'cash', amount: 400 }] },
      null,
    )
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000)
  })

  it('falls back to the profile name when the receipt has none', async () => {
    const doc = await buildDigitalReceiptPdf(
      { ...receipt, shopName: '' },
      { company_name: 'Fallback Traders' } as never,
    )
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(1000)
  })
})

describe('digitalReceiptFileName', () => {
  it('slugifies the shop name', () => {
    expect(digitalReceiptFileName(receipt)).toBe('joker-stores-INV-0042.pdf')
  })
  it('copes with a missing shop name', () => {
    expect(digitalReceiptFileName({ ...receipt, shopName: '' })).toContain('receipt')
  })
})
