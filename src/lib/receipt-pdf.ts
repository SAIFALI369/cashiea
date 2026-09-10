// ════════════════════════════════════════════════════════════════
// Receipt PDF — Cashiea Signature for the 80 mm roll.
//
// A counter receipt with a designed moment: letter-spaced brand,
// chip label, hairline ledger, ink TOTAL band, serif-italic words,
// and a warm sign-off. Courier stays for line items (thermal-classic)
// but the brand block goes helvetica display.
//
//   downloadReceiptPdf() → saves <shop>-<receipt>.pdf
//   printReceiptPdf()    → same PDF, print dialog opened directly
// ════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import type { ReceiptModel } from './pos'
import { amountInIndianWords } from './india-compliance'
import type { Profile } from './types'

const WIDTH = 80 // mm — standard thermal roll
const MARGIN = 5
const LINE = 4.6

const INK = [28, 25, 23] as [number, number, number]
const MUTED = [110, 103, 97] as [number, number, number]
const FAINT = [150, 143, 137] as [number, number, number]
const ACCENT = [5, 150, 105] as [number, number, number]
const WHITE = [255, 255, 255] as [number, number, number]

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
  let height = 72 + r.lines.length * LINE * 2 + r.tenders.length * LINE + 36
  if (isTaxInvoice) height += 9
  if (r.discountTotal > 0) height += LINE
  if (r.taxTotal > 0) height += LINE
  if (r.change > 0) height += LINE
  if (r.customerName) height += LINE
  if (r.gstin) height += LINE
  if (r.upiId) height += 6

  const doc = new jsPDF({ unit: 'mm', format: [WIDTH, Math.max(92, height)] })
  let y = 6

  // ── Brand block: emerald tick + letter-spaced display name ──
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, WIDTH, 1.6, 'F')
  y = 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text(shopName.toUpperCase(), WIDTH / 2, y, { align: 'center', charSpace: 1.1 })
  y += 5.5

  const docLabel = isTaxInvoice ? 'TAX INVOICE' : 'RECEIPT'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  const chipW = doc.getTextWidth(docLabel) + 8
  doc.setFillColor(...INK)
  doc.roundedRect(WIDTH / 2 - chipW / 2, y, chipW, 5.4, 1.2, 1.2, 'F')
  doc.setTextColor(...WHITE)
  doc.text(docLabel, WIDTH / 2, y + 3.7, { align: 'center', charSpace: 0.7 })
  y += 8.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  const c7 = (t: string) => { doc.text(t, WIDTH / 2, y, { align: 'center' }); y += 3.6 }
  if (r.address) c7(r.address)
  if (r.phone) c7(`Phone ${r.phone}`)
  if (r.gstin) c7(`GSTIN ${r.gstin}`)
  y += 1

  const rule = (strong = false) => {
    doc.setLineDashPattern(strong ? [] : [0.5, 0.8], 0)
    doc.setDrawColor(...(strong ? INK : FAINT))
    doc.setLineWidth(strong ? 0.5 : 0.2)
    doc.line(MARGIN, y - 1.8, WIDTH - MARGIN, y - 1.8)
    doc.setLineDashPattern([], 0)
    y += 1.6
  }
  const row = (left: string, right: string, style: 'normal' | 'bold' = 'normal') => {
    doc.setFont('courier', style)
    doc.setFontSize(8.5)
    doc.text(left, MARGIN, y)
    doc.text(right, WIDTH - MARGIN, y, { align: 'right' })
    y += LINE
  }

  rule(true)
  doc.setFont('courier', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(r.receiptNumber, MARGIN, y)
  doc.text(date.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }), WIDTH - MARGIN, y, { align: 'right' })
  y += LINE
  if (r.customerName) { doc.setTextColor(...INK); row(r.customerName, '') }
  rule()

  // ── Items — thermal ledger ──
  doc.setFont('courier', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  for (const l of r.lines) {
    const name = l.name.length > 30 ? l.name.slice(0, 29) + '…' : l.name
    doc.text(name, MARGIN, y)
    y += LINE
    const qtyLabel = l.unit ? `${l.quantity} ${l.unit}` : `${l.quantity}`
    doc.setTextColor(...MUTED)
    doc.text(`  ${qtyLabel} x ${rs(l.unit_price)}`, MARGIN, y)
    doc.setTextColor(...INK)
    doc.text(rs(l.amount), WIDTH - MARGIN, y, { align: 'right' })
    y += LINE
  }
  rule()
  doc.setTextColor(...INK)
  row('Subtotal', rs(r.subtotal))
  if (r.discountTotal > 0) row('Discount', `-${rs(r.discountTotal)}`)
  if (r.taxTotal > 0) row('Tax (GST)', rs(r.taxTotal))
  rule(true)

  // ── TOTAL in an ink band — the moment of the receipt ──
  doc.setFillColor(...INK)
  doc.rect(MARGIN, y - 3, WIDTH - 2 * MARGIN, 7, 'F')
  doc.setFillColor(...ACCENT)
  doc.rect(MARGIN, y - 3, 1.1, 7, 'F')
  doc.setTextColor(...WHITE)
  doc.setFont('courier', 'bold')
  doc.setFontSize(10)
  doc.text('TOTAL', MARGIN + 3, y + 1.8, { charSpace: 0.8 })
  doc.text(rs(r.total), WIDTH - MARGIN - 2, y + 1.8, { align: 'right' })
  doc.setTextColor(...INK)
  y += 9

  if (isTaxInvoice) {
    const words = doc.splitTextToSize(`(${amountInIndianWords(r.total)})`, WIDTH - 2 * MARGIN) as string[]
    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    words.forEach((w) => { doc.text(w, MARGIN, y); y += 3.6 })
  }
  for (const t of r.tenders) row(t.method.toUpperCase(), rs(t.amount))
  if (r.change > 0) row('Change', rs(r.change))
  if (r.upiId) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(`Pay by UPI: ${r.upiId}`, WIDTH / 2, y, { align: 'center' })
    y += 5
  }
  rule()

  // ── Sign-off ──
  y += 1.5
  if (r.servedBy) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...FAINT)
    doc.text(`Served by ${r.servedBy}`, WIDTH / 2, y, { align: 'center' })
    y += 4.2
  }
  doc.setFont('times', 'italic')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text('Dhanyavaad — thank you for shopping with us', WIDTH / 2, y, { align: 'center' })
  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...ACCENT)
  doc.text('CASHIEA', WIDTH / 2, y, { align: 'center', charSpace: 1 })
  y += 3
  doc.setFillColor(...ACCENT)
  doc.rect(0, Math.min(y - 0.5, (doc as any).internal?.pageSize?.getHeight?.() - 1.6 || y), WIDTH, 1.6, 'F')

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
