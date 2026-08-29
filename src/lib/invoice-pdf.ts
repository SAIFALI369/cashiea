// ════════════════════════════════════════════════════════════════
// Invoice PDF generator (client-side, via jsPDF).
//
// Builds a professional, GST-ready invoice PDF in the browser — no
// server round-trip, no edge function deploy needed. Includes:
//  - Business header (name, GSTIN, address, UPI ID)
//  - Invoice meta (number, date, due date, status)
//  - Bill-to client block
//  - Items table (description, qty, unit price, amount)
//  - Subtotal, discount, tax (GST %), total
//  - UPI payment link + scannable QR code
//  - Notes / terms
//
// Used by the Invoices page's "Download PDF" button.
// ════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import type { Invoice, Profile } from './types'
import { buildUpiLink } from './payments'

// Page constants (A4 in mm)
const PAGE = { w: 210, h: 297, margin: 15 }
const COLOR = {
  brand: [79, 70, 229] as [number, number, number],    // indigo-600
  brandLight: [224, 231, 255] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],      // slate-900
  slate: [100, 116, 139] as [number, number, number],  // slate-500
  slateLight: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
}

/**
 * Generate and download a professional invoice PDF.
 */
export async function generateInvoicePdf(invoice: Invoice, profile: Profile | null): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const businessName = profile?.company_name || profile?.full_name || 'My Business'
  const businessAddress = profile?.business_address || ''
  const businessState = profile?.business_state || ''
  const gstin = profile?.gstin || ''
  const upiId = profile?.upi_id || ''

  // ─── Header band ───────────────────────────────────────────────
  doc.setFillColor(...COLOR.brand)
  doc.rect(0, 0, PAGE.w, 32, 'F')

  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(businessName, PAGE.margin, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const headerLines: string[] = []
  if (businessAddress) headerLines.push(businessAddress)
  if (businessState) headerLines.push(businessState)
  if (gstin) headerLines.push(`GSTIN: ${gstin}`)
  if (upiId) headerLines.push(`UPI: ${upiId}`)
  doc.text(headerLines.join('  •  '), PAGE.margin, 23)

  // "INVOICE" label, top-right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('INVOICE', PAGE.w - PAGE.margin - 30, 18, { align: 'right' })

  // ─── Invoice meta (number, date, status) ───────────────────────
  let y = 44
  doc.setTextColor(...COLOR.dark)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(`Invoice ${invoice.invoice_number}`, PAGE.margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.slate)
  const metaParts: string[] = [`Date: ${new Date(invoice.created_at).toLocaleDateString()}`]
  if (invoice.due_date) metaParts.push(`Due: ${invoice.due_date}`)
  metaParts.push(`Status: ${invoice.status.toUpperCase()}`)
  doc.text(metaParts.join('    '), PAGE.margin, y + 6)

  // ─── Bill To ───────────────────────────────────────────────────
  y += 18
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...COLOR.slate)
  doc.text('BILL TO', PAGE.margin, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLOR.dark)
  doc.text(invoice.client_name, PAGE.margin, y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.slate)
  const clientLines: string[] = []
  if (invoice.client_email) clientLines.push(invoice.client_email)
  if (invoice.client_phone) clientLines.push(invoice.client_phone)
  if (invoice.client_address) clientLines.push(invoice.client_address)
  clientLines.forEach((line, i) => {
    doc.text(line, PAGE.margin, y + 12 + i * 5)
  })

  // ─── Items table ───────────────────────────────────────────────
  y += Math.max(22, 12 + clientLines.length * 5 + 6)

  // Table header
  doc.setFillColor(...COLOR.slateLight)
  doc.rect(PAGE.margin, y, PAGE.w - 2 * PAGE.margin, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.dark)
  const colX = { desc: PAGE.margin + 3, qty: 125, price: 145, amt: PAGE.w - PAGE.margin - 3 }
  doc.text('DESCRIPTION', colX.desc, y + 5.5)
  doc.text('QTY', colX.qty, y + 5.5)
  doc.text('PRICE', colX.price, y + 5.5)
  doc.text('AMOUNT', colX.amt, y + 5.5, { align: 'right' })
  y += 8

  // Item rows
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR.dark)
  ;(invoice.items || []).forEach((item, i) => {
    if (y > PAGE.h - 60) {
      doc.addPage()
      y = PAGE.margin
    }
    // Zebra striping
    if (i % 2 === 1) {
      doc.setFillColor(...COLOR.slateLight)
      doc.rect(PAGE.margin, y, PAGE.w - 2 * PAGE.margin, 9, 'F')
    }
    const amount = (item.quantity || 0) * (item.unit_price || 0)
    // Truncate long descriptions
    const desc = item.description && item.description.length > 55
      ? item.description.slice(0, 55) + '…'
      : (item.description || '')
    doc.text(desc, colX.desc, y + 5.5)
    doc.text(String(item.quantity || 0), colX.qty, y + 5.5)
    doc.text(`${formatINR(item.unit_price || 0)}`, colX.price, y + 5.5)
    doc.text(formatINR(amount), colX.amt, y + 5.5, { align: 'right' })
    y += 9
  })

  // Border under table
  doc.setDrawColor(...COLOR.border)
  doc.line(PAGE.margin, y, PAGE.w - PAGE.margin, y)
  y += 6

  // ─── Totals (right-aligned box) ────────────────────────────────
  const totalsX = 130
  const totalsW = PAGE.w - PAGE.margin - totalsX
  const rowH = 6

  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR.slate)
  doc.text('Subtotal', totalsX, y)
  doc.setTextColor(...COLOR.dark)
  doc.text(formatINR(invoice.subtotal), PAGE.w - PAGE.margin, y, { align: 'right' })
  y += rowH

  const discount = Number((invoice as any).discount) || 0
  if (discount > 0) {
    doc.setTextColor(...COLOR.slate)
    doc.text('Discount', totalsX, y)
    doc.setTextColor(...COLOR.green)
    doc.text(`- ${formatINR(discount)}`, PAGE.w - PAGE.margin, y, { align: 'right' })
    y += rowH
  }

  doc.setTextColor(...COLOR.slate)
  doc.text(`Tax (GST ${invoice.tax_rate}%)`, totalsX, y)
  doc.setTextColor(...COLOR.dark)
  doc.text(formatINR(invoice.tax_amount), PAGE.w - PAGE.margin, y, { align: 'right' })
  y += rowH + 1

  // Total bar
  doc.setFillColor(...COLOR.brand)
  doc.rect(totalsX - 4, y - 2, totalsW + 4, 9, 'F')
  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL', totalsX, y + 3.5)
  doc.text(formatINR(invoice.total), PAGE.w - PAGE.margin, y + 3.5, { align: 'right' })
  y += 16

  // ─── UPI payment link + QR ─────────────────────────────────────
  if (upiId) {
    const upiLink = buildUpiLink({
      payeeVpa: upiId,
      payeeName: businessName,
      amount: Number(invoice.total),
      reference: invoice.invoice_number,
      note: `Invoice ${invoice.invoice_number}`,
    })

    doc.setDrawColor(...COLOR.border)
    doc.setFillColor(...COLOR.slateLight)
    doc.roundedRect(PAGE.margin, y, PAGE.w - 2 * PAGE.margin, 34, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COLOR.brand)
    doc.text('Pay Instantly via UPI', PAGE.margin + 5, y + 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.slate)
    doc.text(`Scan with any UPI app (PhonePe, GPay, Paytm, BHIM)`, PAGE.margin + 5, y + 14)
    doc.text(`Or pay to: ${upiId}`, PAGE.margin + 5, y + 19)
    doc.text(`Amount: ${formatINR(invoice.total)}`, PAGE.margin + 5, y + 24)

    // Client-side QR generation — no external service, no network fetch
    try {
      const QRCode = (await import('qrcode')).default
      const upiLink = buildUpiLink({
        payeeVpa: upiId, payeeName: businessName,
        amount: Number(invoice.total), reference: invoice.invoice_number,
      })
      const qrImg = await QRCode.toDataURL(upiLink, {
        width: 240, margin: 1, errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      })
      if (qrImg) {
        doc.addImage(qrImg, 'PNG', PAGE.w - PAGE.margin - 26, y + 4, 22, 22)
      }
    } catch {
      doc.setFontSize(8)
      doc.text('QR unavailable', PAGE.w - PAGE.margin - 22, y + 16)
    }
    y += 40
  }

  // ─── Notes ─────────────────────────────────────────────────────
  if (invoice.notes) {
    if (y > PAGE.h - 30) { doc.addPage(); y = PAGE.margin }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.slate)
    doc.text('NOTES', PAGE.margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.dark)
    const noteLines = doc.splitTextToSize(invoice.notes, PAGE.w - 2 * PAGE.margin)
    doc.text(noteLines, PAGE.margin, y + 5)
    y += 5 + noteLines.length * 5
  }

  // ─── Footer ────────────────────────────────────────────────────
  doc.setDrawColor(...COLOR.border)
  doc.line(PAGE.margin, PAGE.h - 18, PAGE.w - PAGE.margin, PAGE.h - 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.slate)
  doc.text(
    `Generated by ${businessName} on ${new Date().toLocaleString()}  •  This is a computer-generated invoice.`,
    PAGE.w / 2, PAGE.h - 12, { align: 'center' }
  )

  // ─── Save ──────────────────────────────────────────────────────
  doc.save(`Invoice-${invoice.invoice_number}.pdf`)
}

// ─── Helpers ────────────────────────────────────────────────────

/** Format a number as Indian Rupees, e.g. 1250 → ₹1,250.00 */
function formatINR(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** Fetch an image URL and return it as a data URL (for jsPDF embedding). */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
