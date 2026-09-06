// ════════════════════════════════════════════════════════════════
// Invoice PDF — a drafted tax invoice, not a dump of fields.
// Client-side jsPDF. Standard fonts cannot render ₹, so amounts
// are written as "Rs." with Indian grouping.
// ════════════════════════════════════════════════════════════════

import { jsPDF } from 'jspdf'
import type { Invoice, InvoiceItem, Profile } from './types'
import { buildUpiLink } from './payments'
import { amountInIndianWords, gstinState } from './india-compliance'

const PAGE = { w: 210, h: 297, margin: 16 }
const COLOR = {
  ink: [28, 25, 23] as [number, number, number],
  muted: [87, 83, 78] as [number, number, number],
  faint: [120, 113, 108] as [number, number, number],
  line: [214, 211, 209] as [number, number, number],
  band: [28, 25, 23] as [number, number, number],
  paper: [250, 250, 249] as [number, number, number],
  accent: [5, 150, 105] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
}

const rs = (amount: number): string =>
  `Rs. ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const DEFAULT_COURTESY =
  'Thank you for your business. Kindly settle this invoice by the due date. Please write to us within seven days if anything on this bill needs a second look.'

function lineGst(item: InvoiceItem, fallback: number): number {
  const n = Number(item.gst_rate)
  return Number.isFinite(n) && n > 0 ? n : Number(fallback) || 0
}

export async function generateInvoicePdf(invoice: Invoice, profile: Profile | null): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const businessName = profile?.company_name || profile?.full_name || 'My Business'
  const gstin = profile?.gstin || ''
  const upiId = profile?.upi_id || ''
  const isTaxInvoice = !!gstin
  const interstate = !!(invoice as Invoice).is_interstate
  const place = (invoice as Invoice).place_of_supply
    || gstinState((invoice as Invoice).client_gstin || '')
    || gstinState(gstin)
    || profile?.business_state
    || ''

  // ── Masthead ──
  doc.setFillColor(...COLOR.band)
  doc.rect(0, 0, PAGE.w, 38, 'F')

  let headerTextX = PAGE.margin
  const logo = profile?.avatar_url ? await fetchImageAsDataUrl(profile.avatar_url) : null
  if (logo) {
    try {
      const fmt = logo.includes('image/png') ? 'PNG' : 'JPEG'
      doc.addImage(logo, fmt, PAGE.margin, 9, 18, 18)
      headerTextX = PAGE.margin + 22
    } catch { /* monogram */ }
  }
  if (!logo) {
    doc.setFillColor(...COLOR.white)
    doc.roundedRect(PAGE.margin, 9, 18, 18, 2, 2, 'F')
    doc.setTextColor(...COLOR.band)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    const initials = businessName.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || 'B'
    doc.text(initials, PAGE.margin + 9, 20.5, { align: 'center' })
    headerTextX = PAGE.margin + 22
  }

  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(businessName, headerTextX, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const ident: string[] = []
  if (profile?.business_address) ident.push(profile.business_address)
  if (profile?.business_state) ident.push(profile.business_state)
  if (profile?.phone || profile?.whatsapp_number) ident.push(String(profile.phone || profile.whatsapp_number))
  if (gstin) ident.push(`GSTIN ${gstin}`)
  const identLines = doc.splitTextToSize(ident.join('  ·  '), 110) as string[]
  doc.text(identLines.slice(0, 2), headerTextX, 22)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(isTaxInvoice ? 'TAX INVOICE' : 'INVOICE', PAGE.w - PAGE.margin, 16, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(invoice.invoice_number, PAGE.w - PAGE.margin, 22, { align: 'right' })
  doc.setFontSize(8)
  doc.text(new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), PAGE.w - PAGE.margin, 27, { align: 'right' })

  // ── Parties ──
  let y = 48
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLOR.faint)
  doc.text('PREPARED FOR', PAGE.margin, y)
  doc.text('PARTICULARS', PAGE.w / 2 + 8, y)

  y += 5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...COLOR.ink)
  doc.text(invoice.client_name, PAGE.margin, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR.muted)
  const clientBits: string[] = []
  const clientGstin = (invoice as Invoice).client_gstin || ''
  if (clientGstin) clientBits.push(`GSTIN ${clientGstin}${gstinState(clientGstin) ? ` · ${gstinState(clientGstin)}` : ''}`)
  if (invoice.client_address) clientBits.push(invoice.client_address)
  if (invoice.client_phone) clientBits.push(invoice.client_phone)
  if (invoice.client_email) clientBits.push(invoice.client_email)
  const clientLines = doc.splitTextToSize(clientBits.join('\n') || ' ', 85) as string[]
  doc.text(clientLines, PAGE.margin, y + 5)

  const particulars: [string, string][] = [
    ['Invoice', invoice.invoice_number],
    ['Dated', new Date(invoice.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
  ]
  if (invoice.due_date) {
    const due = new Date(invoice.due_date)
    particulars.push(['Due', Number.isNaN(due.getTime()) ? invoice.due_date : due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })])
  }
  if (place) particulars.push(['Place of supply', place])
  if (isTaxInvoice) particulars.push(['Reverse charge', 'No'])
  particulars.push(['Status', invoice.status === 'paid' ? 'Received' : invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)])

  particulars.forEach(([k, v], i) => {
    const py = y + i * 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR.faint)
    doc.text(k, PAGE.w / 2 + 8, py)
    doc.setTextColor(...COLOR.ink)
    doc.text(v, PAGE.w - PAGE.margin, py, { align: 'right' })
  })

  y += Math.max(8 + clientLines.length * 4.2, particulars.length * 5) + 8

  // ── Items ──
  const col = {
    no: PAGE.margin + 1,
    desc: PAGE.margin + 10,
    hsn: 108,
    qty: 128,
    rate: 148,
    gst: 168,
    amt: PAGE.w - PAGE.margin - 1,
  }
  doc.setFillColor(...COLOR.paper)
  doc.rect(PAGE.margin, y, PAGE.w - 2 * PAGE.margin, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLOR.faint)
  doc.text('#', col.no, y + 4.8)
  doc.text('DESCRIPTION', col.desc, y + 4.8)
  doc.text('HSN', col.hsn, y + 4.8)
  doc.text('QTY', col.qty, y + 4.8)
  doc.text('RATE', col.rate, y + 4.8)
  doc.text('GST', col.gst, y + 4.8)
  doc.text('AMOUNT', col.amt, y + 4.8, { align: 'right' })
  y += 8

  const items = invoice.items || []
  items.forEach((item, i) => {
    if (y > PAGE.h - 88) { doc.addPage(); y = PAGE.margin }
    const qty = item.quantity || 0
    const rate = item.unit_price || 0
    const amount = qty * rate
    const gst = lineGst(item, invoice.tax_rate)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.ink)
    const desc = doc.splitTextToSize(item.description || 'Item', 90) as string[]
    const rowH = Math.max(8, desc.length * 4)
    if (i % 2 === 1) {
      doc.setFillColor(...COLOR.paper)
      doc.rect(PAGE.margin, y - 3, PAGE.w - 2 * PAGE.margin, rowH, 'F')
    }
    doc.text(String(i + 1), col.no, y)
    doc.text(desc, col.desc, y)
    doc.setFontSize(8)
    doc.setTextColor(...COLOR.muted)
    doc.text(item.hsn_code || '—', col.hsn, y)
    doc.text(String(qty), col.qty, y)
    doc.text(rs(rate).replace('Rs. ', ''), col.rate, y)
    doc.text(gst ? `${gst}%` : '—', col.gst, y)
    doc.setTextColor(...COLOR.ink)
    doc.text(rs(amount).replace('Rs. ', ''), col.amt, y, { align: 'right' })
    y += rowH
  })

  doc.setDrawColor(...COLOR.line)
  doc.setLineWidth(0.25)
  doc.line(PAGE.margin, y, PAGE.w - PAGE.margin, y)
  y += 7

  // ── Totals ──
  const tx = 128
  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 10 : 8.5)
    doc.setTextColor(...(bold ? COLOR.ink : COLOR.muted))
    doc.text(label, tx, y)
    doc.setTextColor(...COLOR.ink)
    doc.text(value, PAGE.w - PAGE.margin, y, { align: 'right' })
    y += bold ? 7 : 5.5
  }
  row('Goods / services', rs(invoice.subtotal + (Number(invoice.discount) || 0)))
  const discount = Number((invoice as Invoice).discount) || 0
  if (discount > 0) row('Less discount', `− ${rs(discount)}`)
  if (invoice.tax_amount > 0) {
    if (interstate) {
      row(`IGST${invoice.tax_rate ? ` at ${invoice.tax_rate}%` : ''}`, rs(invoice.tax_amount))
    } else {
      row(`CGST${invoice.tax_rate ? ` at ${invoice.tax_rate / 2}%` : ''}`, rs(invoice.tax_amount / 2))
      row(`SGST${invoice.tax_rate ? ` at ${invoice.tax_rate / 2}%` : ''}`, rs(invoice.tax_amount / 2))
    }
  }
  doc.setFillColor(...COLOR.band)
  doc.rect(tx - 4, y - 4.5, PAGE.w - PAGE.margin - tx + 4, 9, 'F')
  doc.setTextColor(...COLOR.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Total payable', tx, y + 1.5)
  doc.text(rs(invoice.total), PAGE.w - PAGE.margin, y + 1.5, { align: 'right' })
  y += 12

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.muted)
  const words = doc.splitTextToSize(`${amountInIndianWords(Number(invoice.total))}.`, PAGE.w - 2 * PAGE.margin) as string[]
  doc.text(words, PAGE.margin, y)
  y += words.length * 4 + 4

  // ── Payment ──
  if (upiId && invoice.status !== 'paid') {
    if (y > PAGE.h - 50) { doc.addPage(); y = PAGE.margin }
    doc.setDrawColor(...COLOR.line)
    doc.setFillColor(...COLOR.paper)
    doc.roundedRect(PAGE.margin, y, PAGE.w - 2 * PAGE.margin, 28, 1.5, 1.5, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.ink)
    doc.text('A note on settlement', PAGE.margin + 4, y + 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR.muted)
    doc.text(`Scan the code with any UPI app, or pay ${upiId}.`, PAGE.margin + 4, y + 13)
    doc.text(`The amount due on this bill is ${rs(invoice.total)}.`, PAGE.margin + 4, y + 18)
    try {
      const QRCode = (await import('qrcode')).default
      const link = buildUpiLink({
        payeeVpa: upiId, payeeName: businessName,
        amount: Number(invoice.total), reference: invoice.invoice_number,
        note: `Invoice ${invoice.invoice_number}`,
      })
      const qrImg = await QRCode.toDataURL(link, {
        width: 240, margin: 1, errorCorrectionLevel: 'M',
        color: { dark: '#1c1917', light: '#FFFFFF' },
      })
      if (qrImg) doc.addImage(qrImg, 'PNG', PAGE.w - PAGE.margin - 26, y + 3, 22, 22)
    } catch { /* QR is a courtesy */ }
    y += 32
  } else if (invoice.status === 'paid') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR.accent)
    const paidOn = invoice.paid_at ? ` on ${new Date(invoice.paid_at).toLocaleDateString('en-IN')}` : ''
    doc.text(`This invoice has been received in full${paidOn}.`, PAGE.margin, y)
    y += 8
  }

  // ── Courtesy / terms ──
  if (y > PAGE.h - 42) { doc.addPage(); y = PAGE.margin }
  const courtesy = (invoice.notes || '').trim() || DEFAULT_COURTESY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...COLOR.faint)
  doc.text(invoice.notes ? 'A NOTE FROM US' : 'WITH THANKS', PAGE.margin, y)
  y += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLOR.muted)
  const noteLines = doc.splitTextToSize(courtesy, PAGE.w - 2 * PAGE.margin - 60) as string[]
  doc.text(noteLines, PAGE.margin, y)

  const sigY = y
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...COLOR.muted)
  doc.text(`For ${businessName}`, PAGE.w - PAGE.margin, sigY, { align: 'right' })
  doc.setDrawColor(...COLOR.ink)
  doc.setLineWidth(0.3)
  doc.line(PAGE.w - PAGE.margin - 48, sigY + 12, PAGE.w - PAGE.margin, sigY + 12)
  doc.setFontSize(7.5)
  doc.setTextColor(...COLOR.faint)
  doc.text('Authorised signatory', PAGE.w - PAGE.margin, sigY + 16, { align: 'right' })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setDrawColor(...COLOR.line)
    doc.setLineWidth(0.2)
    doc.line(PAGE.margin, PAGE.h - 14, PAGE.w - PAGE.margin, PAGE.h - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLOR.faint)
    doc.text(isTaxInvoice
      ? 'This is a computer-generated tax invoice, valid without a physical signature.'
      : 'This is a computer-generated invoice.', PAGE.margin, PAGE.h - 9)
    doc.text(`${p} of ${pages}`, PAGE.w - PAGE.margin, PAGE.h - 9, { align: 'right' })
  }

  doc.save(`Invoice-${invoice.invoice_number}.pdf`)
}

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
