// ════════════════════════════════════════════════════════════════
// GST filing health — flags on the invoices that will go into
// GSTR-1. Informational only; we never claim the return is filed.
//
// We do NOT flag B2C invoices for missing GSTIN — that is correct.
// We DO flag interstate invoices without a place of supply, tax
// that doesn't match rate × taxable, duplicate invoice numbers,
// and a GSTIN that isn't 15 characters.
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'

export type GstFlagKind = 'place_of_supply' | 'tax_mismatch' | 'gstin' | 'duplicate_number' | 'hsn'

export interface GstHealthInvoice {
  id: string
  invoice_number: string
  client_name?: string | null
  client_gstin?: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  is_interstate?: boolean | null
  place_of_supply?: string | null
  hsn_summary?: unknown
  items?: { hsn?: string | null; hsn_code?: string | null }[] | null
  status?: string | null
}

export interface GstFlag {
  kind: GstFlagKind
  invoiceId: string
  invoiceNumber: string
  detail: string
}

export interface GstHealth {
  invoiceCount: number
  b2b: number
  b2c: number
  flags: GstFlag[]
}

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i

export function looksLikeGstin(raw: string | null | undefined): boolean {
  const s = (raw || '').trim()
  if (s.length !== 15) return false
  return GSTIN_RE.test(s)
}

function hasHsn(inv: GstHealthInvoice): boolean {
  const summary = inv.hsn_summary
  if (Array.isArray(summary) && summary.length > 0) return true
  if (summary && typeof summary === 'object' && Object.keys(summary as object).length > 0) return true
  return (inv.items || []).some((it) => String(it.hsn || it.hsn_code || '').trim().length >= 2)
}

export function auditGstInvoices(invoices: GstHealthInvoice[]): GstHealth {
  const live = invoices.filter((i) => i.status !== 'draft')
  const flags: GstFlag[] = []
  const byNumber = new Map<string, GstHealthInvoice[]>()

  for (const inv of live) {
    const num = (inv.invoice_number || '').trim().toLowerCase()
    if (num) {
      const list = byNumber.get(num) || []
      list.push(inv)
      byNumber.set(num, list)
    }

    if (inv.is_interstate && !String(inv.place_of_supply || '').trim()) {
      flags.push({
        kind: 'place_of_supply',
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        detail: 'Inter-state but place of supply is blank (Rule 46).',
      })
    }

    const gstin = (inv.client_gstin || '').trim()
    if (gstin && !looksLikeGstin(gstin)) {
      flags.push({
        kind: 'gstin',
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        detail: `Buyer GSTIN “${gstin}” is not 15 characters in the GSTIN shape.`,
      })
    }

    const rate = Number(inv.tax_rate) || 0
    const taxable = Number(inv.subtotal) || 0
    const tax = Number(inv.tax_amount) || 0
    if (rate > 0 && taxable > 0) {
      const expected = round2(taxable * rate / 100)
      if (Math.abs(expected - tax) > 1) {
        flags.push({
          kind: 'tax_mismatch',
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          detail: `Tax ₹${tax} vs ${rate}% of taxable ₹${taxable} (≈ ₹${expected}).`,
        })
      }
    }

    if (rate > 0 && !hasHsn(inv)) {
      flags.push({
        kind: 'hsn',
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        detail: 'Tax charged but no HSN/SAC on the invoice.',
      })
    }
  }

  for (const [, list] of byNumber) {
    if (list.length < 2) continue
    for (const inv of list) {
      flags.push({
        kind: 'duplicate_number',
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        detail: `Invoice number used ${list.length} times in this period.`,
      })
    }
  }

  return {
    invoiceCount: live.length,
    b2b: live.filter((i) => !!String(i.client_gstin || '').trim()).length,
    b2c: live.filter((i) => !String(i.client_gstin || '').trim()).length,
    flags,
  }
}

/** Working-sheet JSON for a CA — not a GSTN upload file. */
export function gstr1WorkingJson(
  invoices: GstHealthInvoice[],
  period: { from: string; to: string },
) {
  const health = auditGstInvoices(invoices)
  const live = invoices.filter((i) => i.status !== 'draft')
  const row = (inv: GstHealthInvoice) => {
    const tax = Number(inv.tax_amount) || 0
    const interstate = !!inv.is_interstate
    return {
      invoice_number: inv.invoice_number,
      customer: inv.client_name || '',
      gstin: (inv.client_gstin || '').trim(),
      place_of_supply: inv.place_of_supply || '',
      interstate,
      taxable: Number(inv.subtotal) || 0,
      rate: Number(inv.tax_rate) || 0,
      cgst: interstate ? 0 : round2(tax / 2),
      sgst: interstate ? 0 : round2(tax / 2),
      igst: interstate ? tax : 0,
      total: Number(inv.total) || 0,
    }
  }
  return {
    version: 'cashiea-gstr1-working-1',
    disclaimer: 'Working sheet only — not a GSTN filing. File GSTR-1 on the GST portal (due the 11th).',
    period,
    counts: { invoices: health.invoiceCount, b2b: health.b2b, b2c: health.b2c, flags: health.flags.length },
    b2b: live.filter((i) => !!String(i.client_gstin || '').trim()).map(row),
    b2c: live.filter((i) => !String(i.client_gstin || '').trim()).map(row),
    flags: health.flags,
  }
}
