// ════════════════════════════════════════════════════════════════
// tally.ts — Tally XML export (TallyPrime / Tally ERP 9 import).
//
// Turns Cashiea's invoices, POS sales, payments received and expenses
// into the ENVELOPE → BODY → IMPORTDATA → REQUESTDATA → TALLYMESSAGE
// dialect Tally accepts from *Gateway of Tally → Import → Vouchers*.
//
// Design decisions (why file import, not an API):
//   · Tally's XML-over-HTTP listener only exists on desktop Tally,
//     inside the shop's own network. An export file the owner or CA
//     imports in two clicks works with every Tally installation.
//   · Masters are exported ALONGSIDE the vouchers (party ledgers with
//     GSTIN, stock items with HSN + GST rate, the standard duty
//     ledgers). Tally creates any master it is missing, so the import
//     never fails on "ledger does not exist".
//   · Tax is posted as explicit CGST/SGST (or IGST) ledger entries so
//     the voucher balances to the paisa against Cashiea's own totals —
//     Tally never has to recompute GST to agree with the bill.
//   · A "Round Off" ledger line absorbs any sub-paisa drift so every
//     voucher is always debit = credit.
//
// Honesty note (same policy as the GST export): this is a bookkeeping
// import. Reconcile after the first import, ideally on a trial company.
// ════════════════════════════════════════════════════════════════

// ── Input models (what the page fetches from Supabase) ───────────

export interface TallySaleItem {
  name: string
  quantity: number
  /** Pre-tax price per unit in rupees. */
  unitPrice: number
  /** GST % on this line (0 / 5 / 12 / 18 / 28). */
  gstRate: number
  hsn?: string | null
  unit?: string | null
  /** Flat discount already removed from this line's taxable value. */
  lineDiscount?: number
}

export interface TallySale {
  /** Source document number (invoice_number / receipt_number). */
  number: string
  /** ISO date. */
  date: string
  /** Party ledger name — 'Cash' for walk-in POS sales. */
  party: string
  partyGstin?: string | null
  items: TallySaleItem[]
  /** Sum of taxable line values after discounts. */
  subtotal: number
  /** Total GST charged. */
  taxAmount: number
  total: number
  interstate?: boolean
  notes?: string | null
}

export interface TallyReceipt {
  number: string
  date: string
  party: string
  amount: number
  method?: string | null
  /** Document the payment settles (goes into the narration). */
  against?: string | null
}

export interface TallyPayment {
  number: string
  date: string
  /** Expense category / payee ledger. */
  party: string
  amount: number
  narration: string
}

export interface TallyParty {
  name: string
  gstin?: string | null
  phone?: string | null
  address?: string | null
  email?: string | null
  kind: 'customer' | 'supplier'
}

export interface TallyStockItem {
  name: string
  hsn?: string | null
  gstRate: number
  unit?: string | null
}

export interface TallyExportInput {
  /** Tally company name to import into. Empty = the open company. */
  company?: string
  sales: TallySale[]
  receipts: TallyReceipt[]
  payments: TallyPayment[]
  parties?: TallyParty[]
  stockItems?: TallyStockItem[]
}

export interface TallyExportStats {
  ledgers: number
  stockItems: number
  salesVouchers: number
  receiptVouchers: number
  paymentVouchers: number
  salesTotal: number
  receiptsTotal: number
  paymentsTotal: number
}

export interface TallyExport {
  xml: string
  stats: TallyExportStats
}

// ── Standard ledger names (created on import if missing) ─────────

export const TALLY_LEDGERS = {
  cgst: 'CGST Output',
  sgst: 'SGST Output',
  igst: 'IGST Output',
  sales: 'Sales',
  roundOff: 'Round Off',
  cash: 'Cash',
} as const

// ── Primitives ───────────────────────────────────────────────────

/** XML-escape text content and attribute values. */
export function xmlEscape(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Tally wants dates as YYYYMMDD. */
export function tallyDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '19700101'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

/** Money as a fixed 2-decimal string — never scientific notation. */
function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return (Math.round(v * 100) / 100).toFixed(2)
}

/** A safe Tally ledger/party name (Tally rejects a few characters). */
export function tallyName(name: string): string {
  return String(name ?? '').trim().slice(0, 99) || 'Unnamed'
}

function unitLabel(unit?: string | null): string {
  const u = String(unit || '').trim()
  return u && u.length <= 12 ? u : 'Nos'
}

// ── Masters ──────────────────────────────────────────────────────

/**
 * Party ledger master. Parents under Sundry Debtors/Creditors so Tally's
 * GST screens pick the party up. PARTYGSTIN + GSTREGISTRATIONTYPE are
 * read by Tally ERP 9 6.x and TallyPrime alike.
 */
export function buildPartyLedgerMessage(party: TallyParty): string {
  const lines: string[] = []
  lines.push(`  <TALLYMESSAGE xmlns:UDF="TallyUDF">`)
  lines.push(`   <LEDGER NAME="${xmlEscape(tallyName(party.name))}" RESERVEDNAME="">`)
  lines.push(`    <PARENT>${party.kind === 'supplier' ? 'Sundry Creditors' : 'Sundry Debtors'}</PARENT>`)
  if (party.address) {
    lines.push('    <ADDRESS.LIST TYPE="String">')
    for (const part of String(party.address).split('\n').slice(0, 5)) {
      if (part.trim()) lines.push(`     <ADDRESS>${xmlEscape(part.trim())}</ADDRESS>`)
    }
    lines.push('    </ADDRESS.LIST>')
  }
  if (party.phone) lines.push(`    <LEDGERPHONE>${xmlEscape(party.phone)}</LEDGERPHONE>`)
  if (party.email) lines.push(`    <LEDGEREMAIL>${xmlEscape(party.email)}</LEDGEREMAIL>`)
  if (party.gstin) {
    lines.push('    <GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>')
    lines.push(`    <PARTYGSTIN>${xmlEscape(party.gstin.toUpperCase())}</PARTYGSTIN>`)
  }
  lines.push('    <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>')
  lines.push('    <ISBILLWISEON>Yes</ISBILLWISEON>')
  lines.push('   </LEDGER>')
  lines.push('  </TALLYMESSAGE>')
  return lines.join('\n')
}

/** Plain ledger master (duties, sales, round-off). */
export function buildLedgerMessage(name: string, parent: string): string {
  return [
    '  <TALLYMESSAGE xmlns:UDF="TallyUDF">',
    `   <LEDGER NAME="${xmlEscape(tallyName(name))}" RESERVEDNAME="">`,
    `    <PARENT>${xmlEscape(parent)}</PARENT>`,
    '   </LEDGER>',
    '  </TALLYMESSAGE>',
  ].join('\n')
}

/** Stock item master with HSN + GST rate so Tally's GST returns work. */
export function buildStockItemMessage(item: TallyStockItem): string {
  const lines: string[] = []
  lines.push('  <TALLYMESSAGE xmlns:UDF="TallyUDF">')
  lines.push(`   <STOCKITEM NAME="${xmlEscape(tallyName(item.name))}" RESERVEDNAME="">`)
  lines.push(`    <BASEUNITS>${xmlEscape(unitLabel(item.unit))}</BASEUNITS>`)
  if (item.hsn) {
    lines.push('    <GSTDETAILS.LIST>')
    lines.push('     <APPLICABLEFROM>20170701</APPLICABLEFROM>')
    lines.push(`     <HSNCODE>${xmlEscape(item.hsn)}</HSNCODE>`)
    lines.push(`     <GSTPERCENT>${money(item.gstRate)}</GSTPERCENT>`)
    lines.push('    </GSTDETAILS.LIST>')
  }
  lines.push('   </STOCKITEM>')
  lines.push('  </TALLYMESSAGE>')
  return lines.join('\n')
}

// ── Tax maths (mirror of gst.ts, kept local so the voucher builder
//    never depends on the client's line shapes) ────────────────────

interface RateBucket {
  rate: number
  taxable: number
  tax: number
}

/** Group line taxable values by GST rate → tax per rate. */
export function bucketTaxByRate(items: TallySaleItem[]): RateBucket[] {
  const map = new Map<number, RateBucket>()
  for (const it of items) {
    const qty = Math.max(0, Number(it.quantity) || 0)
    const price = Math.max(0, Number(it.unitPrice) || 0)
    const disc = Math.max(0, Number(it.lineDiscount) || 0)
    const taxable = Math.max(0, qty * price - disc)
    const rate = Math.max(0, Number(it.gstRate) || 0)
    const bucket = map.get(rate) || { rate, taxable: 0, tax: 0 }
    bucket.taxable += taxable
    bucket.tax += (taxable * rate) / 100
    map.set(rate, bucket)
  }
  return [...map.values()]
    .map((b) => ({ rate: b.rate, taxable: round2(b.taxable), tax: round2(b.tax) }))
    .filter((b) => b.taxable > 0 || b.tax > 0)
    .sort((a, b) => a.rate - b.rate)
}

function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

// ── Vouchers ─────────────────────────────────────────────────────

/**
 * Invoice-mode Sales voucher:
 *   · inventory lines (negative — credits to Sales through stock),
 *   · per-rate CGST/SGST or IGST ledger entries (negative),
 *   · party line (positive — the debtor),
 *   · Round Off line when recorded totals differ from the recomputed
 *     sum, so the voucher always balances.
 */
export function buildSalesVoucherMessage(sale: TallySale): string {
  const party = tallyName(sale.party)
  const buckets = bucketTaxByRate(sale.items)
  const recomputedTax = round2(buckets.reduce((s, b) => s + b.tax, 0))
  const recomputedTaxable = round2(buckets.reduce((s, b) => s + b.taxable, 0))
  const partyAmount = round2(Number(sale.total) || 0)
  const creditTotal = round2(recomputedTaxable + recomputedTax)
  const roundOff = round2(partyAmount - creditTotal)

  const L: string[] = []
  L.push('  <TALLYMESSAGE xmlns:UDF="TallyUDF">')
  L.push(`   <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Invoice View">`)
  L.push(`    <DATE>${tallyDate(sale.date)}</DATE>`)
  L.push(`    <NARRATION>${xmlEscape(narrationFor(sale))}</NARRATION>`)
  L.push('    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>')
  L.push(`    <VOUCHERNUMBER>${xmlEscape(sale.number)}</VOUCHERNUMBER>`)
  L.push(`    <REFERENCE>${xmlEscape(sale.number)}</REFERENCE>`)
  L.push(`    <PARTYLEDGERNAME>${xmlEscape(party)}</PARTYLEDGERNAME>`)
  L.push('    <ISINVOICE>Yes</ISINVOICE>')
  L.push('    <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>')
  L.push('    <VCHENTRYMODE>Item Invoice</VCHENTRYMODE>')
  if (sale.partyGstin) L.push(`    <PARTYGSTIN>${xmlEscape(sale.partyGstin.toUpperCase())}</PARTYGSTIN>`)

  for (const it of sale.items) {
    const qty = Math.max(0, Number(it.quantity) || 0)
    const price = Math.max(0, Number(it.unitPrice) || 0)
    const disc = Math.max(0, Number(it.lineDiscount) || 0)
    const amount = round2(qty * price - disc)
    L.push('    <ALLINVENTORYENTRIES.LIST>')
    L.push(`     <STOCKITEMNAME>${xmlEscape(tallyName(it.name))}</STOCKITEMNAME>`)
    L.push('     <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>')
    L.push(`     <RATE>${money(price)}/${xmlEscape(unitLabel(it.unit))}</RATE>`)
    L.push(`     <AMOUNT>-${money(amount)}</AMOUNT>`)
    L.push('    </ALLINVENTORYENTRIES.LIST>')
  }

  for (const b of buckets) {
    if (b.tax <= 0) continue
    if (sale.interstate) {
      L.push(...ledgerEntry(TALLY_LEDGERS.igst, -round2(b.tax)))
    } else {
      const half = round2(b.tax / 2)
      L.push(...ledgerEntry(TALLY_LEDGERS.cgst, -half))
      L.push(...ledgerEntry(TALLY_LEDGERS.sgst, -(round2(b.tax) - half)))
    }
  }

  if (Math.abs(roundOff) >= 0.01) {
    L.push(...ledgerEntry(TALLY_LEDGERS.roundOff, roundOff > 0 ? roundOff : -Math.abs(roundOff)))
  }

  // Party debit closes the voucher.
  L.push('    <LEDGERENTRIES.LIST>')
  L.push(`     <LEDGERNAME>${xmlEscape(party)}</LEDGERNAME>`)
  L.push('     <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>')
  L.push(`     <AMOUNT>${money(partyAmount)}</AMOUNT>`)
  L.push('    </LEDGERENTRIES.LIST>')

  L.push('   </VOUCHER>')
  L.push('  </TALLYMESSAGE>')
  return L.join('\n')
}

function ledgerEntry(name: string, amount: number): string[] {
  const deemedPositive = amount >= 0 ? 'Yes' : 'No'
  return [
    '    <LEDGERENTRIES.LIST>',
    `     <LEDGERNAME>${xmlEscape(name)}</LEDGERNAME>`,
    `     <ISDEEMEDPOSITIVE>${deemedPositive}</ISDEEMEDPOSITIVE>`,
    `     <AMOUNT>${money(amount)}</AMOUNT>`,
    '    </LEDGERENTRIES.LIST>',
  ]
}

function narrationFor(sale: TallySale): string {
  const bits: string[] = [`Cashiea ${sale.number}`]
  if (sale.notes) bits.push(sale.notes.trim())
  return bits.join(' — ').slice(0, 250)
}

/** Receipt voucher — money in against a bill (or counter cash). */
export function buildReceiptVoucherMessage(r: TallyReceipt): string {
  const party = tallyName(r.party)
  const narration = [`Received ${money(r.amount)}${r.against ? ` against ${r.against}` : ''}`,
    r.method ? `via ${r.method}` : '', `Cashiea ${r.number}`]
    .filter(Boolean).join(' ').slice(0, 250)
  const L: string[] = []
  L.push('  <TALLYMESSAGE xmlns:UDF="TallyUDF">')
  L.push(`   <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">`)
  L.push(`    <DATE>${tallyDate(r.date)}</DATE>`)
  L.push(`    <NARRATION>${xmlEscape(narration)}</NARRATION>`)
  L.push('    <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>')
  L.push(`    <VOUCHERNUMBER>${xmlEscape(r.number)}</VOUCHERNUMBER>`)
  L.push(`    <REFERENCE>${xmlEscape(r.against || r.number)}</REFERENCE>`)
  L.push('    <ISINVOICE>No</ISINVOICE>')
  // Bank/cash line first (debit — money in), then the party credit.
  L.push(...ledgerEntry(r.method === 'cash' ? TALLY_LEDGERS.cash : bankLedgerFor(r.method), round2(r.amount)))
  L.push(...ledgerEntry(party, -round2(r.amount)))
  L.push('   </VOUCHER>')
  L.push('  </TALLYMESSAGE>')
  return L.join('\n')
}

/** Payment voucher — money out (expenses). */
export function buildPaymentVoucherMessage(p: TallyPayment): string {
  const L: string[] = []
  L.push('  <TALLYMESSAGE xmlns:UDF="TallyUDF">')
  L.push(`   <VOUCHER VCHTYPE="Payment" ACTION="Create" OBJVIEW="Accounting Voucher View">`)
  L.push(`    <DATE>${tallyDate(p.date)}</DATE>`)
  L.push(`    <NARRATION>${xmlEscape(p.narration.slice(0, 250))}</NARRATION>`)
  L.push('    <VOUCHERTYPENAME>Payment</VOUCHERTYPENAME>')
  L.push(`    <VOUCHERNUMBER>${xmlEscape(p.number)}</VOUCHERNUMBER>`)
  L.push(`    <REFERENCE>${xmlEscape(p.number)}</REFERENCE>`)
  L.push('    <ISINVOICE>No</ISINVOICE>')
  // Payee debit first, cash/bank credit closes it.
  L.push(...ledgerEntry(tallyName(p.party), round2(p.amount)))
  L.push(...ledgerEntry(TALLY_LEDGERS.cash, -round2(p.amount)))
  L.push('   </VOUCHER>')
  L.push('  </TALLYMESSAGE>')
  return L.join('\n')
}

function bankLedgerFor(method?: string | null): string {
  const m = String(method || '').toLowerCase()
  if (m === 'upi' || m === 'card' || m === 'wallet' || m === 'bank' || m === 'cheque') return 'Bank Account'
  return TALLY_LEDGERS.cash
}

// ── Envelope ─────────────────────────────────────────────────────

function envelope(reportName: string, company: string | undefined, messages: string[]): string {
  const L: string[] = []
  L.push('<ENVELOPE>')
  L.push(' <HEADER>')
  L.push('  <TALLYREQUEST>Import Data</TALLYREQUEST>')
  L.push(' </HEADER>')
  L.push(' <BODY>')
  L.push('  <IMPORTDATA>')
  L.push('   <REQUESTDESC>')
  L.push(`    <REPORTNAME>${xmlEscape(reportName)}</REPORTNAME>`)
  L.push('    <STATICVARIABLES>')
  if (company) L.push(`     <SVCURRENTCOMPANY>${xmlEscape(company)}</SVCURRENTCOMPANY>`)
  L.push('    </STATICVARIABLES>')
  L.push('   </REQUESTDESC>')
  L.push('   <REQUESTDATA>')
  for (const m of messages) L.push(m)
  L.push('   </REQUESTDATA>')
  L.push('  </IMPORTDATA>')
  L.push(' </BODY>')
  L.push('</ENVELOPE>')
  return L.join('\n')
}

/** Master TALLYMESSAGE blocks: parties, stock items, standard ledgers. */
function masterMessages(parties: TallyParty[], stockItems: TallyStockItem[]): string[] {
  const messages: string[] = []
  const partyNames = new Set<string>()
  for (const p of parties) {
    const name = tallyName(p.name)
    if (partyNames.has(name)) continue
    partyNames.add(name)
    messages.push(buildPartyLedgerMessage(p))
  }
  const itemNames = new Set<string>()
  for (const s of stockItems) {
    const name = tallyName(s.name)
    if (itemNames.has(name)) continue
    itemNames.add(name)
    messages.push(buildStockItemMessage(s))
  }
  messages.push(buildLedgerMessage(TALLY_LEDGERS.sales, 'Sales Accounts'))
  messages.push(buildLedgerMessage(TALLY_LEDGERS.cgst, 'Duties & Taxes'))
  messages.push(buildLedgerMessage(TALLY_LEDGERS.sgst, 'Duties & Taxes'))
  messages.push(buildLedgerMessage(TALLY_LEDGERS.igst, 'Duties & Taxes'))
  messages.push(buildLedgerMessage(TALLY_LEDGERS.roundOff, 'Indirect Expenses'))
  messages.push(buildLedgerMessage('Bank Account', 'Bank Accounts'))
  return messages
}

/** Voucher TALLYMESSAGE blocks: sales, receipts, payments. */
function voucherMessages(input: TallyExportInput): string[] {
  const messages: string[] = []
  for (const s of input.sales) messages.push(buildSalesVoucherMessage(s))
  for (const r of input.receipts) messages.push(buildReceiptVoucherMessage(r))
  for (const p of input.payments) messages.push(buildPaymentVoucherMessage(p))
  return messages
}

/** Masters-only file (parties, stock items, duty ledgers). */
export function buildTallyMastersXml(input: TallyExportInput): string {
  return envelope('All Masters', input.company, masterMessages(input.parties || [], input.stockItems || []))
}

/** Vouchers-only file (sales, receipts, payments). */
export function buildTallyVouchersXml(input: TallyExportInput): string {
  return envelope('Vouchers', input.company, voucherMessages(input))
}

/**
 * The default export: ONE file with masters first, then vouchers.
 * Tally creates the masters as it reaches them, so a single import of
 * this file is enough for a fresh company.
 */
export function buildTallyXml(input: TallyExportInput): TallyExport {
  // Masters referenced by the vouchers themselves (party names + item
  // names) are auto-collected so the file is self-sufficient even when
  // the caller didn't pass explicit parties/stockItems.
  const parties = new Map<string, TallyParty>()
  for (const p of input.parties || []) parties.set(tallyName(p.name), p)
  for (const s of input.sales) {
    const name = tallyName(s.party)
    if (name && name !== TALLY_LEDGERS.cash && !parties.has(name)) {
      parties.set(name, { name, gstin: s.partyGstin, kind: 'customer' })
    }
  }
  for (const r of input.receipts) {
    const name = tallyName(r.party)
    if (name && name !== TALLY_LEDGERS.cash && !parties.has(name)) {
      parties.set(name, { name, kind: 'customer' })
    }
  }
  const stockItems = new Map<string, TallyStockItem>()
  for (const s of input.stockItems || []) stockItems.set(tallyName(s.name), s)
  for (const sale of input.sales) {
    for (const it of sale.items) {
      const name = tallyName(it.name)
      if (name && !stockItems.has(name)) {
        stockItems.set(name, { name, hsn: it.hsn || null, gstRate: it.gstRate || 0, unit: it.unit || null })
      }
    }
  }

  const messages = [
    ...masterMessages([...parties.values()], [...stockItems.values()]),
    ...voucherMessages(input),
  ]
  const xml = envelope('Vouchers', input.company, messages)

  const stats: TallyExportStats = {
    ledgers: parties.size + 7,
    stockItems: stockItems.size,
    salesVouchers: input.sales.length,
    receiptVouchers: input.receipts.length,
    paymentVouchers: input.payments.length,
    salesTotal: round2(input.sales.reduce((s, x) => s + (Number(x.total) || 0), 0)),
    receiptsTotal: round2(input.receipts.reduce((s, x) => s + (Number(x.amount) || 0), 0)),
    paymentsTotal: round2(input.payments.reduce((s, x) => s + (Number(x.amount) || 0), 0)),
  }
  return { xml, stats }
}

/** Map a Cashiea payment method to a narration word. */
export function paymentMethodLabel(method?: string | null): string {
  const m = String(method || '').toLowerCase()
  return ({ cash: 'cash', card: 'card', upi: 'UPI', wallet: 'wallet', other: 'other', split: 'split' } as Record<string, string>)[m] || m || 'other'
}
