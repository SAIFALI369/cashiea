// ════════════════════════════════════════════════════════════════
// POS sale math — pure functions, shared by the New Sale screen,
// receipts and tests. No React, no network.
//
// Covers:
//   • per-line GST (product rate or sale default), inclusive or
//     exclusive pricing, line + cart discounts (flat), proportional
//     cart-discount allocation across mixed GST rates
//   • split-tender status: remaining / change / net recording so the
//     stored tender lines always sum to the sale total
//   • press-and-hold stepper acceleration schedule
//   • frequent (top-selling) product aggregation
//   • end-of-day expected-cash calculation
//   • receipt text for WhatsApp
// ════════════════════════════════════════════════════════════════

import type { PaymentMethod, SalePayment, Transaction } from './types'

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ─── Cart line (New Sale screen) ─────────────────────────────────

/** Where a line's GST rate came from — product tag, sale default, or manual. */
export type GstSource = 'product' | 'sale' | 'manual'

export interface CartLine {
  /** product_id + unit — same product in different units is separate lines. */
  key: string
  product_id: string
  name: string
  quantity: number
  unit_price: number
  /** Base stock units still available (for clamp checks). */
  stock: number
  gst_rate: number
  gst_source: GstSource
  price_includes_tax: boolean
  unit?: string
  /** Base units consumed per unit sold (default 1). */
  factor: number
  line_discount?: number
  line_discount_note?: string
}

export const lineKey = (productId: string, unit?: string): string => `${productId}|${unit || ''}`

/** Effective GST rate for a line given the sale-level default. */
export function effectiveRate(line: Pick<CartLine, 'gst_rate' | 'gst_source'>, defaultRate: number): number {
  if (line.gst_source === 'sale') return Math.max(0, defaultRate || 0)
  return Math.max(0, line.gst_rate || 0)
}

// ─── Sale computation ────────────────────────────────────────────

export interface SaleLineInput {
  key: string
  name: string
  quantity: number
  /** Price of one unit as entered at the counter. */
  unit_price: number
  /** GST % for this line (product rate, or the sale default). */
  gst_rate: number
  /** True → unit_price already includes GST (MRP-style pricing). */
  price_includes_tax: boolean
  /** Flat ₹ amount off this line. */
  line_discount?: number
}

export interface SaleLineResult {
  key: string
  /** qty × unit_price exactly as entered (price-tag sum). */
  raw: number
  /** Pre-tax value of the line (back-computed when inclusive). */
  base: number
  lineDiscount: number
  /** Taxable value after line discount + cart-discount share. */
  taxable: number
  tax: number
  /** What the customer pays for this line. */
  total: number
  /** Share of the cart-level discount allocated to this line. */
  cartDiscountShare: number
}

export interface SaleTotals {
  lines: SaleLineResult[]
  /** Σ pre-tax line values (back-computed when inclusive) — what gets stored. */
  subtotal: number
  /** Σ qty × unit_price exactly as entered (price-tag sum, display only). */
  rawTotal: number
  lineDiscountTotal: number
  cartDiscount: number
  /** line + cart discounts combined (stored in transactions.discount). */
  discountTotal: number
  /** Σ taxable values. */
  taxableBase: number
  taxTotal: number
  total: number
  /** Blended rate — taxTotal as % of taxableBase (0 when base is 0). */
  effectiveTaxRate: number
}

/**
 * Compute a full sale. The stored equation always holds:
 *   subtotal − discountTotal + taxTotal = total
 * `subtotal` is the pre-tax sum (inclusive lines are back-computed),
 * matching GST accounting for MRP-style pricing. Cart discount is
 * allocated across lines in proportion to each line's post-line-
 * discount base, so mixed GST rates stay correct.
 */
export function computeSale(lines: SaleLineInput[], cartDiscount: number): SaleTotals {
  const prepped = lines.map((l) => {
    const raw = l.quantity * l.unit_price
    const base = l.price_includes_tax && l.gst_rate > 0
      ? raw / (1 + l.gst_rate / 100)
      : raw
    const lineDiscount = clamp(round2(Math.min(Math.max(l.line_discount || 0, 0), base)), 0, base)
    return { l, raw, base, lineDiscount, effBase: round2(base - lineDiscount) }
  })

  const pool = prepped.reduce((s, p) => s + p.effBase, 0)
  // A cart discount can never eat into tax or go below a zero base.
  const cartDisc = clamp(round2(cartDiscount || 0), 0, round2(pool))

  const results: SaleLineResult[] = prepped.map((p) => {
    const share = pool > 0 ? round2((cartDisc * p.effBase) / pool) : 0
    const taxable = round2(Math.max(0, p.effBase - share))
    const tax = round2((taxable * p.l.gst_rate) / 100)
    return {
      key: p.l.key,
      raw: round2(p.raw),
      base: round2(p.base),
      lineDiscount: p.lineDiscount,
      taxable,
      tax,
      total: round2(taxable + tax),
      cartDiscountShare: share,
    }
  })

  const subtotal = round2(prepped.reduce((s, p) => s + p.base, 0))
  const rawTotal = round2(prepped.reduce((s, p) => s + p.raw, 0))
  const lineDiscountTotal = round2(prepped.reduce((s, p) => s + p.lineDiscount, 0))
  const taxableBase = round2(results.reduce((s, r) => s + r.taxable, 0))
  const taxTotal = round2(results.reduce((s, r) => s + r.tax, 0))
  const total = round2(taxableBase + taxTotal)
  return {
    lines: results,
    subtotal,
    rawTotal,
    lineDiscountTotal,
    cartDiscount: cartDisc,
    discountTotal: round2(lineDiscountTotal + cartDisc),
    taxableBase,
    taxTotal,
    total,
    effectiveTaxRate: taxableBase > 0 ? round2((taxTotal / taxableBase) * 100) : 0,
  }
}

// ─── Split tender ────────────────────────────────────────────────

export interface TenderLine {
  id: string
  method: PaymentMethod
  amount: number
}

export interface TenderStatus {
  /** Sum of entered tender amounts. */
  entered: number
  /** Still owed. */
  remaining: number
  /** Excess tendered (given back as change). */
  change: number
  /** Tender covers the total — required to complete. */
  covered: boolean
  /** Recorded tender lines, change netted out, summing exactly to total. */
  netTenders: { method: PaymentMethod; amount: number }[]
}

/**
 * Split-payment guard. Completion requires `covered` (tenders sum to at
 * least the total); the recorded lines net change out of cash first so
 * sale_payments always sums to the sale total.
 */
export function tenderStatus(total: number, tenders: TenderLine[]): TenderStatus {
  const t = round2(total)
  const lines = tenders
    .map((x) => ({ method: x.method, amount: round2(Math.max(0, x.amount || 0)) }))
    .filter((x) => x.amount > 0)
  const entered = round2(lines.reduce((s, x) => s + x.amount, 0))
  const change = round2(Math.max(0, entered - t))
  const remaining = round2(Math.max(0, t - entered))

  // Net change out of cash lines (last cash first), then any line.
  const net = lines.map((x) => ({ ...x }))
  let left = change
  for (let i = net.length - 1; i >= 0 && left > 0; i--) {
    if (left > 0 && net[i].method === 'cash') {
      const take = Math.min(left, net[i].amount)
      net[i].amount = round2(net[i].amount - take)
      left = round2(left - take)
    }
  }
  for (let i = net.length - 1; i >= 0 && left > 0; i--) {
    const take = Math.min(left, net[i].amount)
    net[i].amount = round2(net[i].amount - take)
    left = round2(left - take)
  }
  const netTenders = net.filter((x) => x.amount > 0)
  return { entered, remaining, change, covered: t <= 0.005 || (entered >= t - 0.005 && entered > 0), netTenders }
}

// ─── Press-and-hold stepper acceleration ─────────────────────────

/** Delay before the first auto-repeat step fires. */
export const HOLD_START_DELAY_MS = 380
/** Repeat delay given elapsed hold time — accelerates the longer you hold. */
export function holdRepeatDelay(elapsedMs: number): number {
  if (elapsedMs < 1500) return 160
  if (elapsedMs < 4000) return 110
  return 70
}
/** Units added per repeat tick given elapsed hold time. */
export function holdStep(elapsedMs: number): number {
  if (elapsedMs < 1200) return 1
  if (elapsedMs < 3000) return 2
  return 5
}

// ─── Frequent / recent items ─────────────────────────────────────

export interface SoldProductStat {
  productId: string
  name: string
  /** Number of sale lines the product appeared in. */
  count: number
  unitsSold: number
}

/**
 * Aggregate top-selling products from recent transactions — powers the
 * "frequent items" row above the product grid.
 */
export function topSoldProducts(
  txns: { items: { product_id: string; name: string; quantity: number }[] | null }[],
  limit = 8,
): SoldProductStat[] {
  const map = new Map<string, SoldProductStat>()
  for (const txn of txns) {
    for (const it of txn.items || []) {
      if (!it?.product_id) continue
      const cur = map.get(it.product_id) || { productId: it.product_id, name: it.name || it.product_id, count: 0, unitsSold: 0 }
      cur.count += 1
      cur.unitsSold += Number(it.quantity) || 0
      map.set(it.product_id, cur)
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

// ─── End-of-day cash reconciliation ──────────────────────────────

/**
 * Expected cash for a day: cash tender lines (sale_payments) plus any
 * legacy same-day cash sales recorded before tender lines existed
 * (payment_method = 'cash' with no tender rows). Voided sales are
 * excluded by passing only non-void transactions.
 */
export function expectedCashForDay(
  txns: Pick<Transaction, 'id' | 'total' | 'payment_method' | 'status'>[],
  cashPayments: Pick<SalePayment, 'transaction_id' | 'amount'>[],
): number {
  const tenderedBy = new Set(cashPayments.map((p) => p.transaction_id))
  const fromTenders = round2(cashPayments.reduce((s, p) => s + Number(p.amount || 0), 0))
  const legacy = txns
    .filter((t) => t.status === 'completed' && t.payment_method === 'cash' && !tenderedBy.has(t.id))
    .reduce((s, t) => s + Number(t.total || 0), 0)
  return round2(fromTenders + legacy)
}

// ─── Small helpers ───────────────────────────────────────────────

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), Math.max(min, max))
}

/** Human age for held-cart entries: 'just now', '12m ago', '2h ago', '3d ago'. */
export function ageLabel(iso: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(iso).getTime())
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ─── Receipt text (WhatsApp) ─────────────────────────────────────

export interface ReceiptLineModel {
  name: string
  quantity: number
  unit_price: number
  unit?: string | null
  amount: number
}

export interface ReceiptModel {
  shopName: string
  address?: string | null
  phone?: string | null
  gstin?: string | null
  upiId?: string | null
  receiptNumber: string
  date: string | Date
  customerName?: string | null
  lines: ReceiptLineModel[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  tenders: { method: string; amount: number }[]
  change: number
  servedBy?: string | null
}

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card', upi: 'UPI', wallet: 'Wallet', other: 'Other', split: 'Split',
}

/** Plain-text receipt for WhatsApp — the ₹ symbol is safe in UTF-8 chat. */
export function buildReceiptText(r: ReceiptModel): string {
  const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const lines: string[] = []
  lines.push(`*${r.shopName}*`)
  if (r.address) lines.push(r.address)
  if (r.phone) lines.push(`Phone: ${r.phone}`)
  if (r.gstin) lines.push(`GSTIN: ${r.gstin}`)
  lines.push('')
  lines.push(`Receipt: ${r.receiptNumber}`)
  lines.push(`Date: ${new Date(r.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`)
  if (r.customerName) lines.push(`Customer: ${r.customerName}`)
  lines.push('--------------------------------')
  for (const l of r.lines) {
    const qtyLabel = l.unit ? `${l.quantity} ${l.unit}` : `${l.quantity}`
    lines.push(`${l.name}`)
    lines.push(`  ${qtyLabel} × ${money(l.unit_price)} = ${money(l.amount)}`)
  }
  lines.push('--------------------------------')
  lines.push(`Subtotal: ${money(r.subtotal)}`)
  if (r.discountTotal > 0) lines.push(`Discount: -${money(r.discountTotal)}`)
  if (r.taxTotal > 0) lines.push(`Tax (GST): ${money(r.taxTotal)}`)
  lines.push(`*Total: ${money(r.total)}*`)
  if (r.tenders.length > 1 || (r.tenders[0] && r.tenders[0].method !== 'cash')) {
    for (const t of r.tenders) lines.push(`${METHOD_LABEL[t.method] || t.method}: ${money(t.amount)}`)
  }
  if (r.change > 0) lines.push(`Change: ${money(r.change)}`)
  if (r.servedBy) lines.push(`Served by: ${r.servedBy}`)
  if (r.upiId) lines.push(``, `Pay again anytime: ${r.upiId}`)
  lines.push('', 'Thank you for shopping with us.')
  return lines.join('\n')
}
