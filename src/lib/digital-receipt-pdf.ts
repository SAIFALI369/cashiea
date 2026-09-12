// ════════════════════════════════════════════════════════════════
// Digital receipt PDF — the artifact a customer keeps.
//
// This is NOT the 80 mm thermal slip (see receipt-pdf.ts, still used
// for the counter printer). This is the version that gets sent on
// WhatsApp and screenshotted: A5 portrait, generous margins, a clean
// minimal table with no grid lines, right-aligned totals, and a large
// scannable QR.
//
// Standard jsPDF fonts cannot render ₹, so amounts are written as
// "Rs." with Indian digit grouping.
// ════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import type { ReceiptModel } from './pos'
import type { Profile } from './types'
import { buildUpiLink } from './payments'

const PAGE = { w: 148, h: 210 } // A5 portrait, mm
const M = 14 // ~40px of breathing room at 72dpi

const INK: [number, number, number] = [17, 24, 39] // #111827
const BODY: [number, number, number] = [55, 65, 81] // #374151
const MUTED: [number, number, number] = [107, 114, 128] // #6B7280
const HAIR: [number, number, number] = [229, 231, 235]
const ACCENT: [number, number, number] = [16, 185, 129] // #10B981
const PAPER: [number, number, number] = [250, 250, 250] // #FAFAFA

/**
 * Vertical space the totals block plus the bottom-anchored footer card
 * need. The item list stops before this so nothing can ever collide with
 * the footer, however long the shopping list is.
 */
const FOOTER_CARD_MAX_H = 62
const TOTALS_MAX_H = 46
const RESERVED_BELOW_ITEMS = FOOTER_CARD_MAX_H + TOTALS_MAX_H + 8

function rs(n: number): string {
  return `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Render the UPI QR as a PNG data URL, or null if it cannot be made. */
async function upiQrDataUrl(upiId: string, payeeName: string, amount: number, ref: string): Promise<string | null> {
  try {
    const QRCode = (await import('qrcode')).default
    const link = buildUpiLink({ payeeVpa: upiId, payeeName, amount, reference: ref })
    // Generous pixel size so it stays sharp when the PDF is zoomed.
    return await QRCode.toDataURL(link, { width: 420, margin: 1, errorCorrectionLevel: 'M' })
  } catch {
    return null
  }
}

export async function buildDigitalReceiptPdf(r: ReceiptModel, profile: Profile | null): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE.w, PAGE.h] })
  const shopName = r.shopName || profile?.company_name || profile?.full_name || 'My Business'
  const date = new Date(r.date)

  // Very faint off-white page, so the white content blocks read as cards.
  doc.setFillColor(...PAPER)
  doc.rect(0, 0, PAGE.w, PAGE.h, 'F')

  // ── Header: brand left, monogram right ──
  let y = M + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...INK)
  doc.text(shopName, M, y)

  // Circular monogram, the "logo" slot
  const initials = shopName.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || 'B'
  doc.setFillColor(...ACCENT)
  doc.circle(PAGE.w - M - 6, y - 3.5, 6, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.text(initials, PAGE.w - M - 6, y - 2, { align: 'center' })

  // Address / phone / GSTIN in small, light gray
  y += 5.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  const ident = [r.address, r.phone ? `Phone ${r.phone}` : '', r.gstin ? `GSTIN ${r.gstin}` : '']
    .filter(Boolean).join('  ·  ')
  if (ident) {
    const lines = doc.splitTextToSize(ident, PAGE.w - 2 * M - 16) as string[]
    doc.text(lines.slice(0, 2), M, y)
    y += lines.slice(0, 2).length * 3.4
  }

  // ── Meta block ──
  y += 5
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(M, y, PAGE.w - 2 * M, 17, 2.5, 2.5, 'F')

  const metaTop = y + 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...MUTED)
  doc.text('RECEIPT', M + 5, metaTop, { charSpace: 0.5 })
  doc.text('DATE', M + 46, metaTop, { charSpace: 0.5 })
  if (r.customerName) doc.text('CUSTOMER', M + 88, metaTop, { charSpace: 0.5 })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  doc.text(r.receiptNumber, M + 5, metaTop + 5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BODY)
  doc.text(
    date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    M + 46, metaTop + 5,
  )
  if (r.customerName) {
    const name = r.customerName.length > 18 ? `${r.customerName.slice(0, 17)}…` : r.customerName
    doc.text(name, M + 88, metaTop + 5)
  }
  y += 17 + 8

  // ── Items: minimal table, one hairline under the header only ──
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(...MUTED)
  doc.text('ITEM', M, y, { charSpace: 0.5 })
  doc.text('QTY', PAGE.w - M - 32, y, { align: 'right', charSpace: 0.5 })
  doc.text('AMOUNT', PAGE.w - M, y, { align: 'right', charSpace: 0.5 })
  y += 2.5
  doc.setDrawColor(...HAIR)
  doc.setLineWidth(0.2)
  doc.line(M, y, PAGE.w - M, y)
  y += 5.5

  // A receipt must show what was actually bought, so a long shopping list
  // continues onto another page rather than being cut off with an ellipsis.
  // Only the LAST page carries the totals and the footer card, so the
  // reserve applies there; earlier pages can run to the bottom margin.
  const startItemsPage = () => {
    doc.addPage([PAGE.w, PAGE.h])
    doc.setFillColor(...PAPER)
    doc.rect(0, 0, PAGE.w, PAGE.h, 'F')
    y = M + 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...MUTED)
    doc.text('ITEM (CONTINUED)', M, y, { charSpace: 0.5 })
    doc.text('QTY', PAGE.w - M - 32, y, { align: 'right', charSpace: 0.5 })
    doc.text('AMOUNT', PAGE.w - M, y, { align: 'right', charSpace: 0.5 })
    y += 2.5
    doc.setDrawColor(...HAIR)
    doc.setLineWidth(0.2)
    doc.line(M, y, PAGE.w - M, y)
    y += 5.5
  }

  for (let i = 0; i < r.lines.length; i++) {
    const l = r.lines[i]
    const remaining = r.lines.length - i
    // Reserve the totals+footer space only if this is the final page of items.
    const limit = PAGE.h - (remaining * 8.4 <= PAGE.h - y - RESERVED_BELOW_ITEMS
      ? RESERVED_BELOW_ITEMS
      : M + 4)
    if (y > limit) startItemsPage()
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    const name = l.name.length > 34 ? `${l.name.slice(0, 33)}…` : l.name
    doc.text(name, M, y)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BODY)
    doc.text(l.unit ? `${l.quantity} ${l.unit}` : String(l.quantity), PAGE.w - M - 32, y, { align: 'right' })
    doc.text(rs(l.amount), PAGE.w - M, y, { align: 'right' })

    // The unit price only earns a line when it isn't just the amount again.
    if (l.quantity !== 1) {
      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      doc.text(`${rs(l.unit_price)} each`, M, y + 3.4)
      y += 8.4
    } else {
      y += 5.6
    }
  }

  // ── Totals, right-aligned ──
  // If the items ran too close to the bottom, the totals + footer move to a
  // fresh page rather than overlapping the footer card.
  if (y > PAGE.h - RESERVED_BELOW_ITEMS) {
    doc.addPage([PAGE.w, PAGE.h])
    doc.setFillColor(...PAPER)
    doc.rect(0, 0, PAGE.w, PAGE.h, 'F')
    y = M + 8
  }
  y += 2
  doc.setDrawColor(...HAIR)
  doc.line(PAGE.w / 2, y, PAGE.w - M, y)
  y += 6

  const totalRow = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(opts.size || 8.5)
    doc.setTextColor(...(opts.bold ? INK : MUTED))
    doc.text(label, PAGE.w - M - 34, y, { align: 'right' })
    doc.setTextColor(...(opts.bold ? INK : BODY))
    doc.text(value, PAGE.w - M, y, { align: 'right' })
    y += opts.bold ? 7 : 5
  }

  totalRow('Subtotal', rs(r.subtotal))
  if (r.discountTotal > 0) totalRow('Discount', `-${rs(r.discountTotal)}`)
  if (r.taxTotal > 0) totalRow('Tax (GST)', rs(r.taxTotal))
  y += 1
  totalRow('Total', rs(r.total), { bold: true, size: 13 })

  if (r.tenders.length) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    const paid = r.tenders.map((t) => `${t.method.toUpperCase()} ${rs(t.amount)}`).join('  ·  ')
    doc.text(paid, PAGE.w - M, y, { align: 'right' })
    y += 4
    if (r.change > 0) {
      doc.text(`Change ${rs(r.change)}`, PAGE.w - M, y, { align: 'right' })
      y += 4
    }
  }

  // ── Footer: QR + a warm note ──
  //
  // The card is measured BEFORE it is drawn. Laying out the contents
  // first and sizing the panel to fit is what keeps the note inside its
  // card and clear of the "Powered by" line at every content length.
  const qrSize = 34 // mm ≈ 190 px at 144 dpi — comfortably scannable
  const padX = 6
  const padY = 8
  const upiId = r.upiId || profile?.upi_id || ''
  const qr = upiId ? await upiQrDataUrl(upiId, shopName, r.total, r.receiptNumber) : null

  // A note from Meraj — warm, and strictly truthful. It promises nothing
  // the app cannot honour: no discount code exists to redeem, so none is
  // offered. It simply thanks the customer by name where we know it.
  const note = r.customerName
    ? `Thank you for shopping with ${shopName}, ${r.customerName.split(/\s+/)[0]}. Keep this receipt for any exchange or warranty claim.`
    : `Thank you for shopping with ${shopName}. Keep this receipt for any exchange or warranty claim.`
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  const noteLines = (doc.splitTextToSize(note, PAGE.w - 2 * M - 2 * padX) as string[]).slice(0, 3)

  const qrBlockH = qr ? qrSize + 7 : 0
  const noteBlockH = 5 + noteLines.length * 3.6
  const cardH = padY + qrBlockH + noteBlockH + padY - 3


  // Bottom of the card must clear the "Powered by" line and the accent bar.
  // The card sits directly ABOVE the "Powered by" line, always. Anchoring
  // to the page bottom (rather than flowing after the totals) keeps the
  // footer identical on every receipt regardless of how many items sold.
  const cardBottomLimit = PAGE.h - M - 7
  const footerTop = cardBottomLimit - cardH

  doc.setFillColor(255, 255, 255)
  doc.roundedRect(M, footerTop, PAGE.w - 2 * M, cardH, 2.5, 2.5, 'F')

  let fy = footerTop + padY
  if (qr) {
    try {
      doc.addImage(qr, 'PNG', M + padX, fy, qrSize, qrSize)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8.5)
      doc.setTextColor(...INK)
      doc.text('Scan to pay next time', M + padX + qrSize + 6, fy + 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      const upiLines = doc.splitTextToSize(
        `Any UPI app · ${upiId}`,
        PAGE.w - 2 * M - qrSize - 2 * padX - 6,
      ) as string[]
      doc.text(upiLines.slice(0, 2), M + padX + qrSize + 6, fy + 13)
      fy += qrBlockH
    } catch {
      /* QR failed to embed — the note simply moves up */
    }
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...ACCENT)
  doc.text('A note from Meraj', M + padX, fy)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...BODY)
  doc.text(noteLines, M + padX, fy + 4.5)

  // ── Powered by ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...MUTED)
  doc.text('POWERED BY CASHIEA', PAGE.w / 2, PAGE.h - M + 1, { align: 'center', charSpace: 0.9 })
  doc.setFillColor(...ACCENT)
  doc.rect(0, PAGE.h - 1.4, PAGE.w, 1.4, 'F')

  // Page numbers only matter when the bill actually spans pages.
  const pages = doc.getNumberOfPages()
  if (pages > 1) {
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...MUTED)
      doc.text(`${r.receiptNumber} · Page ${i} of ${pages}`, PAGE.w - M, M - 4, { align: 'right' })
    }
    doc.setPage(pages)
  }

  return doc
}

export function digitalReceiptFileName(r: ReceiptModel): string {
  const shop = (r.shopName || 'receipt').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return `${shop}-${r.receiptNumber}.pdf`
}

export async function downloadDigitalReceiptPdf(r: ReceiptModel, profile: Profile | null): Promise<void> {
  const doc = await buildDigitalReceiptPdf(r, profile)
  doc.save(digitalReceiptFileName(r))
}
