// ════════════════════════════════════════════════════════════════
// Quotation / invoice line math — one source of truth for the
// Quotations page, the AI invoice generator and the quick invoice.
//
// Fixes three long-standing bugs:
//   1. Totals were summed over ALL form rows but only "valid" rows
//      were saved, so the stored subtotal/tax/total could disagree
//      with the stored items (and carried into converted invoices).
//   2. Amounts were stored as raw floats (0.1 × 3 ≠ 0.3).
//   3. No validation — negative prices, NaN quantities and absurd
//      tax rates were all accepted.
// ════════════════════════════════════════════════════════════════

import { round2 } from './pos'

export interface LineInput {
  description: string
  quantity: number | string
  unit_price: number | string
}

export interface DocLine {
  description: string
  quantity: number
  unit_price: number
}

/** Tax rate clamp — anything outside 0–100 is nonsense for a doc. */
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
 * Quantities and prices are rounded to the paisa.
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
    out.push({ description, quantity: round2(quantity), unit_price: round2(unitPrice) })
  }
  return out
}

export interface DocTotals {
  lines: DocLine[]
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
}

/**
 * Totals that always satisfy the stored equation
 *   subtotal + taxAmount = total
 * with subtotal = Σ (quantity × unit_price), everything rounded to
 * the paisa.
 */
export function computeDocTotals(lines: DocLine[], taxRate: number | string | null | undefined): DocTotals {
  const rate = clampTaxRate(taxRate)
  const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unit_price, 0))
  const taxAmount = round2((subtotal * rate) / 100)
  return { lines, subtotal, taxRate: rate, taxAmount, total: round2(subtotal + taxAmount) }
}

/** Parse + total in one step — the form-facing helper. */
export function quoteTotals(items: LineInput[] | null | undefined, taxRate: number | string | null | undefined): DocTotals {
  return computeDocTotals(parseDocLines(items), taxRate)
}
