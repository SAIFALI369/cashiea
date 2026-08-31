// ════════════════════════════════════════════════════════════════
// Receipt PDF generator (client-side, jsPDF) — 80 mm roll format.
//
// A counter receipt, not an invoice: shop header, receipt number,
// line items, discounts, GST, tender lines and change, thank-you.
// Uses "Rs." because the jsPDF standard fonts (helvetica / courier)
// cannot render the ₹ glyph — the WhatsApp text receipt keeps ₹.
//
//   downloadReceiptPdf() → saves <shop>-<receipt>.pdf
//   printReceiptPdf()    → same PDF, print dialog opened directly
//                          (the UI slot for thermal printers later)
// ════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import type { ReceiptModel } from './pos'
import { amountInIndianWords } from './india-compliance'
import type { Profile } from './types'

const WIDTH = 80 // mm — standard thermal roll
const MARGIN = 5
const LINE = 4.6

function rs(n: number): string {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function buildReceiptPdf(r: ReceiptModel, profile: Profile | null): jsPDF {
  const shopName = r.shopName || profile?.company_name || profile?.full_name || 'My Business'
  const date = new Date(r.date)

  // A GST-registered shop's receipt with tax shown is a tax invoice
  // (Rule 46): it carries the heading and the total in words.
  const isTaxInvoice = !!r.gstin && r.taxTotal > 0

  // Pre-measure so the page is exactly as tall as the receipt.
  let height = 58 + r.lines.length * LINE * 2 + r.tenders.length * LINE + 30
  if (isTaxInvoice) height += 8
  if (r.discountTotal > 0) height += LINE
  if (r.taxTotal > 0) height += LINE
  if (r.change > 0) height += LINE
  if (r.customerName) height += LINE
  if (r.gstin) height += LINE

  const doc = new jsPDF({ unit: 'mm', format: [WIDTH, Math.max(90, height)] })
  let y = 12

  const center = (text: string, size: number, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('courier', style)
    doc.setFontSize(size)
    doc.text(text, WIDTH / 2, y, { align: 'center' })
    y += size * 0.42 + 1.2
  }
  const row = (left: string, right: string, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('courier', style)
    doc.setFontSize(8.5)
    doc.text(left, MARGIN, y)
    doc.text(right, WIDTH - MARGIN, y, { align: 'right' })
    y += LINE
  }
  const rule = () => {
    doc.setLineDashPattern([0.6, 0.6], 0)
    doc.setDrawColor(120)
    doc.line(MARGIN, y - 2, WIDTH - MARGIN, y - 2)
    doc.setLineDashPattern([], 0)
    y += 1.5
  }

  // ── Header ──
  center(shopName.toUpperCase(), 11, 'bold')
  if (isTaxInvoice) center('TAX INVOICE', 9, 'bold')
  if (r.address) center(r.address, 7.5)
  if (r.phone) center(`Phone: ${r.phone}`, 7.5)
  if (r.gstin) center(`GSTIN: ${r.gstin}`, 7.5)
  y += 1
  rule()
  row(`Receipt: ${r.receiptNumber}`, date.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }))
  if (r.customerName) row(`Customer: ${r.customerName}`, '')
  rule()

  // ── Items ──
  doc.setFont('courier', 'normal')
  doc.setFontSize(8.5)
  for (const l of r.lines) {
    const name = l.name.length > 30 ? l.name.slice(0, 29) + '…' : l.name
    doc.text(name, MARGIN, y)
    y += LINE
    const qtyLabel = l.unit ? `${l.quantity} ${l.unit}` : `${l.quantity}`
    doc.text(`  ${qtyLabel} x ${rs(l.unit_price)}`, MARGIN, y)
    doc.text(rs(l.amount), WIDTH - MARGIN, y, { align: 'right' })
    y += LINE
  }
  rule()
  row('Subtotal', rs(r.subtotal))
  if (r.discountTotal > 0) row('Discount', `-${rs(r.discountTotal)}`)
  if (r.taxTotal > 0) row('Tax (GST)', rs(r.taxTotal))
  rule()
  row('TOTAL', rs(r.total), 'bold')
  if (isTaxInvoice) {
    const words = doc.splitTextToSize(`(${amountInIndianWords(r.total)})`, WIDTH - 2 * MARGIN) as string[]
    doc.setFont('courier', 'italic')
    doc.setFontSize(7.5)
    words.forEach((w) => { doc.text(w, MARGIN, y); y += 3.4 })
  }
  for (const t of r.tenders) row(t.method.toUpperCase(), rs(t.amount))
  if (r.change > 0) row('Change', rs(r.change))
  rule()

  // ── Footer ──
  y += 1
  if (r.servedBy) center(`Served by ${r.servedBy}`, 7.5)
  center('Thank you for shopping with us.', 8)
  center('Powered by Cashiea', 7)

  return doc
}

export function receiptFileName(r: ReceiptModel): string {
  const shop = (r.shopName || 'receipt').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return `${shop}-${r.receiptNumber}.pdf`
}

export function downloadReceiptPdf(r: ReceiptModel, profile: Profile | null): void {
  buildReceiptPdf(r, profile).save(receiptFileName(r))
}

/**
 * Print path — generates the same digital receipt and opens the print
 * dialog. When dedicated ESC/POS printer support lands, this action
 * swaps to the hardware path without changing the UI.
 */
export function printReceiptPdf(r: ReceiptModel, profile: Profile | null): void {
  const doc = buildReceiptPdf(r, profile)
  doc.autoPrint()
  const blob = doc.output('blob')
  const url = URL.createObjectURL(blob)
  const w = window.open(url, '_blank')
  if (!w) {
    // Popup blocked — fall back to a download so the action still completes.
    doc.save(receiptFileName(r))
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
