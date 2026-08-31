// ════════════════════════════════════════════════════════════════
// Invoice PDF generator (client-side, via jsPDF).
//
// Builds a professional, GST-ready invoice PDF in the browser — no
// server round-trip, no edge function deploy needed. Includes:
//  - Business header: logo (or initials monogram), name, address,
//    GSTIN, phone, UPI ID
//  - Invoice meta (number, date, due date, status, place of supply)
//  - Bill-to client block
//  - Items table (description, qty, unit price, amount)
//  - Subtotal, discount, GST split (CGST/SGST or IGST), total
//  - Payment details: status, UPI ID + scannable QR
//  - Signature line ("For <business> — Authorised Signatory")
//  - Cashiea branding footer with page numbers
//
// Used by the Invoices page's "PDF" actions.
// ════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import type { Invoice, Profile } from './types'
import { buildUpiLink } from './payments'
import { amountInIndianWords, gstinState } from './india-compliance'

// Page constants (A4 in mm)
const PAGE = { w: 210, h: 297, margin: 15 }
// The app's semantic palette (light theme), as RGB.
const COLOR = {
  accent: [16, 185, 129] as [number, number, number],      // --accent
  accentDark: [5, 150, 105] as [number, number, number],   // --accent-strong
  accentSoft: [209, 250, 229] as [number, number, number], // --accent-soft
  dark: [41, 37, 31] as [number, number, number],          // --fg
  muted: [92, 84, 73] as [number, number, number],         // --fg-muted
  subtle: [132, 123, 108] as [number, number, number],     // --fg-subtle
  surface: [245, 239, 228] as [number, number, number],    // --surface-2
  line: [214, 204, 185] as [number, number, number],       // --line-2
  white: [255, 255, 255] as [number, number, number],
  positive: [74, 118, 92] as [number, number, number],     // --positive
}

/**
 * Generate and download a professional invoice PDF.
 */
export async function generateInvoicePdf(invoice: Invoice, profile: Profile | null): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const businessName = profile?.company_name || profile?.full_name || 'My Business'
  const businessAddress = profile?.business_address || ''
  const businessState = profile?.business_state || ''
  const businessPhone = profile?.phone || profile?.whatsapp_number || ''
  const gstin = profile?.gstin || ''
  const upiId = profile?.upi_id || ''

  // ─── Header band: logo / monogram + business identity ──────────
  doc.setFillColor(...COLOR.accent)
  doc.rect(0, 0, PAGE.w, 34, 'F')

  // Logo (avatar) if the shop has one — otherwise a clean monogram.
  let headerTextX = PAGE.margin
  const logo = profile?.avatar_url ? await fetchImageAsDataUrl(profile.avatar_url) : null
  if (logo) {
    try {
      const fmt = logo.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(logo, fmt, PAGE.margin, 8, 18, 18)
      headerTextX = PAGE.margin + 23
    } catch { /* broken image → monogram instead */ }
  }
  if (!logo) {
    doc.setFillColor(...COLOR.white)
    doc.roundedRect(PAGE.margin, 8, 18, 18, 3, 3, 'F')
    doc.setTextColor(...COLOR.accentDark)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    const initials = businessName.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || 'B'
    doc.text(initials, PAGE.margin + 9, 19.5, { align: 'center' })
    headerTextX = PAGE.margin + 23
  }

  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.text(businessName, headerTextX, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const headerLines: string[] = []
  if (businessAddress) headerLines.push(businessAddress)
  if (businessState) headerLines.push(businessState)
  if (businessPhone) headerLines.push(`Phone: ${businessPhone}`)
  if (gstin) headerLines.push(`GSTIN: ${gstin}`)
  if (upiId) headerLines.push(`UPI: ${upiId}`)
  doc.text(headerLines.join('  •  '), headerTextX, 22)
  // Second identity line when the first gets long
  if (headerLines.length > 3) {
    doc.text(headerLines.slice(3).join('  •  '), headerTextX, 27)
  }

  // Document heading — "TAX INVOICE" when GST-registered (Rule 46(a));
  // a plain "INVOICE" for unregistered businesses, which must not
  // charge or show GST.
  const isTaxInvoice = !!gstin
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(isTaxInvoice ? 18 : 23)
  doc.setTextColor(...COLOR.white)
  doc.text(isTaxInvoice ? 'TAX INVOICE' : 'INVOICE', PAGE.w - PAGE.margin - 30, 18, { align: 'right' })
  doc.setFontSize(9.5)
  doc.text(invoice.invoice_number, PAGE.w - PAGE.margin - 30, 24, { align: 'right' })

  // ─── Bill To + Invoice details (two columns) ──────────────────
  let y = 44
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.subtle)
  doc.text('BILL TO', PAGE.margin, y)
  doc.text('INVOICE DETAILS', PAGE.w / 2 + 10, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLOR.dark)
  doc.text(invoice.client_name, PAGE.margin, y + 6.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.muted)
  const clientGstin = (invoice as any).client_gstin || ''
  const clientLines: string[] = []
  if (clientGstin) clientLines.push(`GSTIN: ${clientGstin}${gstinState(clientGstin) ? ` (${gstinState(clientGstin)})` : ''}`)
  if (invoice.client_email) clientLines.push(invoice.client_email)
  if (invoice.client_phone) clientLines.push(invoice.client_phone)
  if (invoice.client_address) clientLines.push(invoice.client_address)
  clientLines.forEach((line, i) => doc.text(line, PAGE.margin, y + 12 + i * 4.8))

  const detailsX = PAGE.w / 2 + 10
  const detailRows: [string, string][] = [
    ['Invoice no.', invoice.invoice_number],
    ['Date', new Date(invoice.created_at).toLocaleDateString('en-IN')],
  ]
  if (invoice.due_date) detailRows.push(['Due date', invoice.due_date])
  if ((invoice as any).place_of_supply) detailRows.push(['Place of supply', (invoice as any).place_of_supply])
  else if (isTaxInvoice && gstinState(gstin)) detailRows.push(['Place of supply', gstinState(gstin) || ''])
  if (isTaxInvoice) detailRows.push(['Reverse charge', 'No'])
  detailRows.push(['Status', invoice.status === 'paid' ? 'PAID' : invoice.status.toUpperCase()])
  if (invoice.paid_at) detailRows.push(['Paid on', new Date(invoice.paid_at).toLocaleDateString('en-IN')])
  detailRows.forEach(([k, v], i) => {
    doc.setTextColor(...COLOR.subtle)
    doc.text(k, detailsX, y + 6.5 + i * 4.8)
    doc.setTextColor(...COLOR.dark)
    doc.text(v, PAGE.w - PAGE.margin, y + 6.5 + i * 4.8, { align: 'right' })
  })

  // ─── Items table ───────────────────────────────────────────────
  y += Math.max(26, 14 + Math.max(clientLines.length, detailRows.length) * 4.8 + 8)

  // Table header
  doc.setFillColor(...COLOR.surface)
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
    if (y > PAGE.h - 70) {
      doc.addPage()
      y = PAGE.margin
    }
    // Zebra striping
    if (i % 2 === 1) {
      doc.setFillColor(...COLOR.surface)
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
  doc.setDrawColor(...COLOR.line)
  doc.setLineWidth(0.3)
  doc.line(PAGE.margin, y, PAGE.w - PAGE.margin, y)
  y += 6

  // ─── Totals (right-aligned box) ────────────────────────────────
  const totalsX = 130
  const totalsW = PAGE.w - PAGE.margin - totalsX
  const rowH = 6

  doc.setFontSize(9.5)
  doc.setTextColor(...COLOR.muted)
  doc.text('Subtotal', totalsX, y)
  doc.setTextColor(...COLOR.dark)
  doc.text(formatINR(invoice.subtotal), PAGE.w - PAGE.margin, y, { align: 'right' })
  y += rowH

  const discount = Number((invoice as any).discount) || 0
  if (discount > 0) {
    doc.setTextColor(...COLOR.muted)
    doc.text('Discount', totalsX, y)
    doc.setTextColor(...COLOR.positive)
    doc.text(`- ${formatINR(discount)}`, PAGE.w - PAGE.margin, y, { align: 'right' })
    y += rowH
  }

  // GST breakdown — CGST/SGST for intra-state, IGST for inter-state
  if (invoice.tax_amount > 0) {
    doc.setTextColor(...COLOR.muted)
    if ((invoice as any).is_interstate) {
      doc.text(`IGST (${invoice.tax_rate}%)`, totalsX, y)
      doc.setTextColor(...COLOR.dark)
      doc.text(formatINR(invoice.tax_amount), PAGE.w - PAGE.margin, y, { align: 'right' })
    } else {
      const cgst = invoice.tax_amount / 2
      doc.text(`CGST (${invoice.tax_rate / 2}%)`, totalsX, y)
      doc.setTextColor(...COLOR.dark)
      doc.text(formatINR(cgst), PAGE.w - PAGE.margin, y, { align: 'right' })
      y += 5
      doc.setTextColor(...COLOR.muted)
      doc.text(`SGST (${invoice.tax_rate / 2}%)`, totalsX, y)
      doc.setTextColor(...COLOR.dark)
      doc.text(formatINR(cgst), PAGE.w - PAGE.margin, y, { align: 'right' })
    }
    y += rowH
  }

  // Total bar
  doc.setFillColor(...COLOR.accent)
  doc.rect(totalsX - 4, y - 2, totalsW + 4, 9, 'F')
  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('TOTAL', totalsX, y + 3.5)
  doc.text(formatINR(invoice.total), PAGE.w - PAGE.margin, y + 3.5, { align: 'right' })
  y += 15

  // Total in words — mandatory on tax invoices (Rule 46).
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR.muted)
  const wordsLine = doc.splitTextToSize(`(${amountInIndianWords(Number(invoice.total))})`, PAGE.w - 2 * PAGE.margin) as string[]
  doc.text(wordsLine, PAGE.margin, y)
  y += wordsLine.length * 4 + 3

  // ─── Payment details + UPI QR ─────────────────────────────────
  const paymentStartY = y
  if (upiId) {
    doc.setDrawColor(...COLOR.line)
    doc.setFillColor(...COLOR.surface)
    doc.roundedRect(PAGE.margin, y, PAGE.w - 2 * PAGE.margin, 34, 2, 2, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...COLOR.accentDark)
    doc.text(invoice.status === 'paid' ? 'Payment received' : 'Pay via UPI', PAGE.margin + 5, y + 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.muted)
    doc.text('Scan with any UPI app (PhonePe, GPay, Paytm, BHIM)', PAGE.margin + 5, y + 14)
    doc.text(`UPI ID: ${upiId}`, PAGE.margin + 5, y + 19)
    doc.text(`Amount: ${formatINR(invoice.total)}`, PAGE.margin + 5, y + 24)

    // Client-side QR generation — no external service, no network fetch
    try {
      const QRCode = (await import('qrcode')).default
      const link = buildUpiLink({
        payeeVpa: upiId, payeeName: businessName,
        amount: Number(invoice.total), reference: invoice.invoice_number,
        note: `Invoice ${invoice.invoice_number}`,
      })
      const qrImg = await QRCode.toDataURL(link, {
        width: 240, margin: 1, errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' },
      })
      if (qrImg) {
        doc.addImage(qrImg, 'PNG', PAGE.w - PAGE.margin - 26, y + 4, 22, 22)
      }
    } catch {
      doc.setFontSize(8)
      doc.setTextColor(...COLOR.subtle)
      doc.text('QR unavailable', PAGE.w - PAGE.margin - 24, y + 16)
    }
    y += 40
  } else {
    // No UPI ID — still show the payment status clearly.
    doc.setDrawColor(...COLOR.line)
    doc.setFillColor(...COLOR.surface)
    doc.roundedRect(PAGE.margin, y, PAGE.w - 2 * PAGE.margin, 14, 2, 2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...COLOR.dark)
    doc.text(`Payment status: ${invoice.status === 'paid' ? 'PAID' : invoice.status.toUpperCase()}`, PAGE.margin + 5, y + 8.5)
    y += 20
  }

  // ─── Notes ─────────────────────────────────────────────────────
  if (invoice.notes) {
    if (y > PAGE.h - 45) { doc.addPage(); y = PAGE.margin }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.subtle)
    doc.text('NOTES', PAGE.margin, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.dark)
    const noteLines = doc.splitTextToSize(invoice.notes, PAGE.w - 2 * PAGE.margin)
    doc.text(noteLines, PAGE.margin, y + 5)
    y += 5 + noteLines.length * 5
  }

  // ─── Signature line ────────────────────────────────────────────
  const sigY = Math.max(y + 10, paymentStartY + 46)
  if (sigY > PAGE.h - 30) { doc.addPage(); /* footer is per-page */ }
  const sigYFinal = sigY > PAGE.h - 30 ? PAGE.margin + 20 : sigY
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLOR.muted)
  doc.text(`For ${businessName}`, PAGE.w - PAGE.margin - 55, sigYFinal)
  doc.setDrawColor(...COLOR.dark)
  doc.setLineWidth(0.3)
  doc.line(PAGE.w - PAGE.margin - 55, sigYFinal + 12, PAGE.w - PAGE.margin, sigYFinal + 12)
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.subtle)
  doc.text('Authorised Signatory', PAGE.w - PAGE.margin - 27.5, sigYFinal + 16, { align: 'center' })

  // ─── Footer (every page): Cashiea branding ─────────────────────
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...COLOR.line)
    doc.setLineWidth(0.3)
    doc.line(PAGE.margin, PAGE.h - 18, PAGE.w - PAGE.margin, PAGE.h - 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR.subtle)
    doc.text('This is a computer-generated invoice.', PAGE.margin, PAGE.h - 12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLOR.accentDark)
    doc.text('Created with Cashiea', PAGE.w / 2, PAGE.h - 12, { align: 'center' })
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLOR.subtle)
    doc.text(`${p} / ${pages}`, PAGE.w - PAGE.margin, PAGE.h - 12, { align: 'right' })
  }

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
    if (!blob.type.startsWith('image/')) return null
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
