// ════════════════════════════════════════════════════════════════
// Bank-statement matching — parsers + pairing, extracted from the
// Bank Import page so the rules are tested, not "whatever the page
// happened to do".
//
// A match is NEVER invented from a wild amount. Amount is the gate;
// name in the narration and due-date proximity only break ties and
// raise confidence. Each unpaid invoice is used at most once.
// ════════════════════════════════════════════════════════════════

import { similarity, normalizeName } from './duplicates'

export interface BankTxnIn {
  date: string
  description: string
  amount: number
}

export interface UnpaidInvoiceIn {
  id: string
  invoice_number: string
  client_name: string
  total: number
  due_date?: string | null
}

export type MatchKind = 'exact' | 'likely' | 'none'

export interface PairScore {
  invoiceId: string
  invoiceNumber: string
  score: number
  amountDiff: number
  nameHit: boolean
  dateDays: number | null
}

export interface TxnMatch {
  kind: MatchKind
  invoiceId: string | null
  invoiceNumber: string | null
  score: number
  reason: string
}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date'],
  description: ['description', 'narration', 'particulars', 'remarks', 'details', 'transaction remarks'],
  amount: ['amount', 'credit', 'deposit', 'credit amount', 'deposits', 'withdrawal amt', 'credit(+)'],
  debit: ['debit', 'withdrawal', 'debit amount', 'debits', 'debit(-)', 'withdrawal amount'],
}

const NAME_STOP = new Set(['the', 'and', 'pvt', 'ltd', 'llp', 'for', 'from', 'pvt ltd'])

/** Map Indian bank-statement headers onto date / narration / amount / debit. */
export function mapBankColumns(headers: string[]): { date?: string; description?: string; amount?: string; debit?: string } {
  const clean = headers.map((h) => h.trim().toLowerCase())
  // Claim a column for a role: exact header match first, then partial —
  // never reusing a column already claimed by another role (so
  // "Withdrawal Amount" can't masquerade as the credit/amount column).
  const find = (aliases: string[], excludeIdx = -1): string | undefined => {
    for (const a of aliases) {
      const exact = clean.findIndex((h, i) => i !== excludeIdx && h === a)
      if (exact !== -1) return headers[exact]
    }
    for (const a of aliases) {
      const partial = clean.findIndex((h, i) => i !== excludeIdx && h.includes(a))
      if (partial !== -1) return headers[partial]
    }
    return undefined
  }
  const debit = find(HEADER_ALIASES.debit)
  const debitIdx = debit ? headers.indexOf(debit) : -1
  const amount = find(HEADER_ALIASES.amount, debitIdx)
  return {
    date: find(HEADER_ALIASES.date),
    description: find(HEADER_ALIASES.description),
    amount,
    debit,
  }
}

export function parseAmount(raw: string): number {
  if (!raw) return NaN
  // Indian formats: "1,23,456.78", "Rs 1,234", "(1,234)" = negative, trailing "Cr"/"Dr"
  let s = raw.trim()
  s = s.replace(/^(inr|rs\.?|₹)\s*/i, '')
  s = s.replace(/[₹,\s]/g, '').replace(/(cr|dr)\.?$/i, '')
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  if (s.startsWith('-')) { negative = true; s = s.slice(1) }
  const n = Number(s)
  return negative ? -n : n
}

export function parseBankDate(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''
  // dd/mm/yyyy and dd-mm-yyyy (Indian default)
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (dmy) {
    const d = dmy[1].padStart(2, '0'), m = dmy[2].padStart(2, '0')
    let y = dmy[3]; if (y.length === 2) y = `20${y}`
    return `${y}-${m}-${d}`
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[0]
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return ''
}

function tokens(s: string): string[] {
  return normalizeName(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !NAME_STOP.has(t))
}

function nameHit(clientName: string, description: string): { hit: boolean; sim: number } {
  const desc = description.toLowerCase()
  const nameToks = tokens(clientName)
  const hit = nameToks.some((t) => desc.includes(t))
  const sim = similarity(normalizeName(clientName), normalizeName(description))
  return { hit, sim }
}

function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null
  const da = new Date(a.slice(0, 10) + 'T00:00:00').getTime()
  const db = new Date(b.slice(0, 10) + 'T00:00:00').getTime()
  if (!Number.isFinite(da) || !Number.isFinite(db)) return null
  return Math.abs(Math.round((da - db) / 86_400_000))
}

/** Score one (txn, invoice) pair. 0 means "do not pair". */
export function scorePair(txn: BankTxnIn, inv: UnpaidInvoiceIn): PairScore {
  const amountDiff = Math.abs(txn.amount - inv.total)
  const closeEnough = Math.max(50, inv.total * 0.02)
  let amountScore = 0
  if (amountDiff <= 1) amountScore = 70
  else if (amountDiff <= closeEnough) amountScore = 20
  else {
    return { invoiceId: inv.id, invoiceNumber: inv.invoice_number, score: 0, amountDiff, nameHit: false, dateDays: null }
  }

  const { hit, sim } = nameHit(inv.client_name, txn.description)
  const nameScore = (hit ? 20 : 0) + Math.round(sim * 15)

  const dateDays = inv.due_date ? daysBetween(inv.due_date, txn.date) : null
  let dateScore = 0
  if (dateDays != null) {
    if (dateDays <= 2) dateScore = 15
    else if (dateDays <= 7) dateScore = 8
    else if (dateDays <= 30) dateScore = 3
  }

  return {
    invoiceId: inv.id,
    invoiceNumber: inv.invoice_number,
    score: amountScore + nameScore + dateScore,
    amountDiff,
    nameHit: hit,
    dateDays,
  }
}

function reasonOf(kind: MatchKind, pair: PairScore | null): string {
  if (!pair || kind === 'none') return 'No unpaid invoice close enough in amount.'
  const bits: string[] = []
  if (pair.amountDiff <= 1) bits.push('amount matches')
  else bits.push(`amount off by ₹${Math.round(pair.amountDiff)}`)
  if (pair.nameHit) bits.push('name in narration')
  if (pair.dateDays != null && pair.dateDays <= 7) bits.push(`due ${pair.dateDays}d from txn`)
  return bits.join(' · ')
}

/**
 * Greedy 1:1 assignment. Highest score first. Auto-pick (`exact`) only
 * when the winner is clearly ahead of the runner-up (≥15 points) and
 * the score itself is strong (≥75). Ties stay `likely` so the owner
 * glances before marking paid.
 */
export function matchBankTxns(txns: BankTxnIn[], invoices: UnpaidInvoiceIn[]): TxnMatch[] {
  type Cand = { ti: number; pair: PairScore }
  const cands: Cand[] = []
  txns.forEach((txn, ti) => {
    for (const inv of invoices) {
      const pair = scorePair(txn, inv)
      if (pair.score > 0) cands.push({ ti, pair })
    }
  })
  cands.sort((a, b) => b.pair.score - a.pair.score || a.pair.amountDiff - b.pair.amountDiff)

  const usedInv = new Set<string>()
  const usedTxn = new Set<number>()
  const assigned = new Map<number, PairScore>()

  for (const c of cands) {
    if (usedTxn.has(c.ti) || usedInv.has(c.pair.invoiceId)) continue
    usedTxn.add(c.ti)
    usedInv.add(c.pair.invoiceId)
    assigned.set(c.ti, c.pair)
  }

  return txns.map((_txn, ti) => {
    const pair = assigned.get(ti) || null
    if (!pair) return { kind: 'none' as const, invoiceId: null, invoiceNumber: null, score: 0, reason: reasonOf('none', null) }

    const rivals = cands.filter((c) => c.ti === ti && c.pair.invoiceId !== pair.invoiceId)
    const runner = rivals[0]?.pair.score ?? 0
    const gap = pair.score - runner
    const unique = rivals.length === 0 || gap >= 15
    // Unique ±₹1 is the old Bank Import contract and still the right call.
    // Close-but-not-exact amounts need a high score (name / due date) to auto-pick.
    const strong = unique && (pair.amountDiff <= 1 || pair.score >= 75)
    const kind: MatchKind = strong ? 'exact' : 'likely'
    return {
      kind,
      invoiceId: pair.invoiceId,
      invoiceNumber: pair.invoiceNumber,
      score: pair.score,
      reason: reasonOf(kind, pair),
    }
  })
}
