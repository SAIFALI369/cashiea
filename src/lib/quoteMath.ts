// ════════════════════════════════════════════════════════════════
// Quotation / invoice line math — one source of truth for the
// Quotations page, InvoiceComposer, and Meraj drafts.
//
// Fixes three long-standing bugs:
//   1. Totals were summed over ALL form rows but only "valid" rows
//      were saved, so the stored subtotal/tax/total could disagree
//      with the stored items (and carried into converted invoices).
//   2. Amounts were stored as raw floats (0.1 × 3 ≠ 0.3).
//   3. No validation — negative prices, NaN quantities and absurd
//      tax rates were all accepted.
// Plus GST: per-line rates, a document discount before tax, and
// CGST/SGST vs IGST (interstate).
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'

export interface LineInput {
  description: string
  quantity: number | string
  unit_price: number | string
  gst_rate?: number | string | null
  hsn_code?: string | null
}

export interface DocLine {
  description: string
  quantity: number
  unit_price: number
  gst_rate?: number
  hsn_code?: string | null
}

export interface HsnSummaryRow {
  hsn: string
  rate: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
}

export interface DocTotalOpts {
  discountPct?: number | string | null
  isInterstate?: boolean
}

/** Tax / discount clamp — anything outside 0–100 is nonsense for a doc. */
export function clampTaxRate(rate: number | string | null | undefined): number {
  const r = Number(rate)
  if (!Number.isFinite(r) || r <= 0) return 0
  return round2(Math.min(r, 100))
}

function toCount(v: number | string | null | undefined): number | null {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : null
}

/**
 * Keep only complete, sane lines: a description, quantity > 0 and
 * unit_price >= 0 (a 0 price is allowed — free samples / service lines).
 * Quantities and prices are rounded to the paisa. GST / HSN travel with
 * the line when present so a mixed-rate bill stays honest.
 */
export function parseDocLines(items: LineInput[] | null | undefined): DocLine[] {
  const out: DocLine[] = []
  for (const it of items || []) {
    const description = String(it?.description ?? '').trim()
    if (!description) continue
    const quantity = toCount(it?.quantity)
    const unitPrice = toCount(it?.unit_price)
    if (quantity === null || !(quantity > 0)) continue
    if (unitPrice === null || unitPrice < 0) continue
    const line: DocLine = { description, quantity: round2(quantity), unit_price: round2(unitPrice) }
    if (it?.gst_rate != null && String(it.gst_rate).trim() !== '') {
      line.gst_rate = clampTaxRate(it.gst_rate)
    }
    const hsn = it?.hsn_code != null ? String(it.hsn_code).trim() : ''
    if (hsn) line.hsn_code = hsn
    out.push(line)
  }
  return out
}

export interface DocTotals {
  lines: DocLine[]
  /** Goods / services before discount. */
  line: number
  discountPct: number
  discountAmount: number
  /** After discount, before tax. */
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  isInterstate: boolean
  hsnSummary: HsnSummaryRow[]
}

/**
 * Totals that always satisfy the stored equation
 *   subtotal + taxAmount = total
 * with subtotal = Σ (quantity × unit_price) − discount, everything
 * rounded to the paisa. Per-line GST wins over the document rate when
 * any line carries a rate.
 */
export function computeDocTotals(
  lines: DocLine[],
  taxRate: number | string | null | undefined,
  opts: DocTotalOpts = {},
): DocTotals {
  const fallback = clampTaxRate(taxRate)
  const discountPct = clampTaxRate(opts.discountPct)
  const isInterstate = opts.isInterstate === true
  const line = round2(lines.reduce((s, l) => s + l.quantity * l.unit_price, 0))
  const discountAmount = round2((line * discountPct) / 100)
  const subtotal = round2(line - discountAmount)
  const perLine = lines.some((l) => l.gst_rate != null)

  const hsnMap = new Map<string, { hsn: string; rate: number; taxable: number; tax: number }>()
  let taxAmount = 0

  if (perLine) {
    for (const l of lines) {
      const rate = l.gst_rate != null ? clampTaxRate(l.gst_rate) : fallback
      const gross = l.quantity * l.unit_price
      const taxable = round2(gross * (1 - discountPct / 100))
      const tax = round2((taxable * rate) / 100)
      taxAmount = round2(taxAmount + tax)
      const key = `${l.hsn_code || ''}|${rate}`
      const entry = hsnMap.get(key) || { hsn: l.hsn_code || '', rate, taxable: 0, tax: 0 }
      entry.taxable = round2(entry.taxable + taxable)
      entry.tax = round2(entry.tax + tax)
      hsnMap.set(key, entry)
    }
  } else {
    taxAmount = round2((subtotal * fallback) / 100)
    if (lines.length) {
      hsnMap.set(`|${fallback}`, { hsn: '', rate: fallback, taxable: subtotal, tax: taxAmount })
    }
  }

  const hsnSummary: HsnSummaryRow[] = Array.from(hsnMap.values()).map((entry) => ({
    hsn: entry.hsn,
    rate: entry.rate,
    taxable: entry.taxable,
    cgst: isInterstate ? 0 : round2(entry.tax / 2),
    sgst: isInterstate ? 0 : round2(entry.tax / 2),
    igst: isInterstate ? entry.tax : 0,
  }))

  return {
    lines,
    line,
    discountPct,
    discountAmount,
    subtotal,
    taxRate: perLine ? (subtotal > 0 ? round2((taxAmount / subtotal) * 100) : 0) : fallback,
    taxAmount,
    total: round2(subtotal + taxAmount),
    isInterstate,
    hsnSummary,
  }
}

/** Parse + total in one step — the form-facing helper. */
export function quoteTotals(
  items: LineInput[] | null | undefined,
  taxRate: number | string | null | undefined,
  opts: DocTotalOpts = {},
): DocTotals {
  return computeDocTotals(parseDocLines(items), taxRate, opts)
}
