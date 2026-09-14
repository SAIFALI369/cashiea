// ════════════════════════════════════════════════════════════════
// order-parser.ts — turn a WhatsApp text into a billable order.
//
// "Add 50 notebooks at ₹25"          → 50 × Notebook @ ₹25
// "bill for Ramesh: 3 pens @10, 2 notebooks 40" → invoice items + customer
// "5 kg aata aur 2 packet salt"      → mixed Hindi quantities
//
// Design rules (same philosophy as the POS voice parser):
//   1. Be fuzzy about HOW shopkeepers write, but strict about WHAT is
//      committed. A price is never invented; a product is only matched
//      when one catalogue entry clearly wins.
//   2. This module is pure TypeScript — no Deno, no network, no DB —
//      so the exact code the edge function runs is unit-tested with
//      vitest (src/lib/whatsappOrder.test.ts).
// ════════════════════════════════════════════════════════════════

// ── Numbers in words (English + common Hindi) ────────────────────

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  dozen: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5,
  chah: 6, cheh: 6, saat: 7, aath: 8, nau: 9, das: 10, bees: 20,
  pachees: 25, tees: 30, chalis: 40, pachaas: 50, saath: 60, assi: 80,
  nabbe: 90, sau: 100,
}

// ── Vocabulary ───────────────────────────────────────────────────

/** Billing verbs that make a message a COMMAND even when nothing parses. */
const STRONG_INTENT = new Set([
  'add', 'bill', 'invoice', 'banao', 'banaa', 'banado', 'bhejo',
])

/** Verbs that only count as intent when the rest of the message parses. */
const WEAK_INTENT = new Set([
  'send', 'make', 'create', 'generate', 'kaat', 'kaato', 'nikalo',
  'bana', 'bhej', 'total',
])

/** Words stripped from item names (they carry no product meaning). */
const FILLER = new Set([
  'add', 'bill', 'invoice', 'banao', 'banaa', 'banado', 'bana', 'bhejo',
  'bhej', 'send', 'make', 'create', 'generate', 'kaat', 'kaato', 'nikalo',
  'please', 'plz', 'kr', 'karo', 'kar', 'de', 'dein', 'dena', 'ki', 'ka',
  'ke', 'ko', 'se', 'total', 'of', 'the', 'a', 'an', 'jaldi',
])

/** Item separators inside one message. */
const ITEM_SPLIT = /\s*(?:,|;|\n|\+|\/| aur | and | plus | bhi )\s*/

/** Price markers: value must follow immediately. */
const STRONG_PRICE = new Set(['@', 'rs', 'rupees', 'rupee', 'rupaye', 'rupaya'])
const WEAK_PRICE = new Set(['at', 'for', 'per', 'price'])

// ── Types ────────────────────────────────────────────────────────

export interface ParsedOrderItem {
  /** Cleaned product name as typed (before catalogue matching). */
  name: string
  quantity: number
  /** Price per unit in rupees when the message names one. */
  unitPrice?: number
}

export interface ParsedOrder {
  kind: 'order'
  items: ParsedOrderItem[]
  /** Customer name when the message says "for Ramesh" / "Ramesh ke liye". */
  customerName?: string
}

export type ParseResult =
  | ParsedOrder
  /** No billing intent — store it like any other message, never reply. */
  | { kind: 'not_order' }
  /** Billing intent, but nothing usable parsed — reply with help. */
  | { kind: 'unparseable'; reason: string }

// ── Helpers ──────────────────────────────────────────────────────

function normalize(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[₹]/g, ' rs ')
    .replace(/@/g, ' @ ')
    .replace(/\brs\.?(?=\d)/g, ' rs ')
    .replace(/[—–]/g, ' ')
    .replace(/[^\p{L}\p{N}@.,;+\n/ ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toNumber(token: string): number | undefined {
  const digits = token.replace(/,/g, '')
  if (/^\d+(\.\d{1,3})?$/.test(digits)) {
    const n = Number(digits)
    return Number.isFinite(n) ? n : undefined
  }
  return NUMBER_WORDS[digits]
}

/** Pull "for <name>" / "<name> ke liye" out of the message. */
function extractCustomer(text: string): { text: string; customerName?: string } {
  let rest = text
  let customerName: string | undefined

  // "for ramesh" / "for ramesh kumar" (never a number — "for 25" is a price)
  const forMatch = rest.match(/\bfor ([a-z\u0900-\u097F][a-z\u0900-\u097F .]{1,30}?)(?=[.:,;]|\s+(?:add|bill|invoice|\d|ek|do|teen)\b|$)/)
  if (forMatch) {
    const name = forMatch[1].replace(/\s+(ke liye|ke naam)$/g, '').trim()
    const before = rest.slice(0, forMatch.index)
    const after = rest.slice(forMatch.index + forMatch[0].length)
    if (name && !/\d/.test(name)) {
      customerName = titleCase(name)
      rest = (before + ' ' + after).replace(/\s+/g, ' ').trim()
    }
  }

  // "ramesh ke liye" (trailing or leading)
  const liyeMatch = rest.match(/([a-z\u0900-\u097F][a-z\u0900-\u097F .]{1,30}?)\s+ke (?:liye|naam)/)
  if (liyeMatch) {
    const name = liyeMatch[1].trim()
    const before = rest.slice(0, liyeMatch.index)
    const after = rest.slice(liyeMatch.index + liyeMatch[0].length)
    if (name && !/\d/.test(name)) {
      customerName = titleCase(name)
      rest = (before + ' ' + after).replace(/\s+/g, ' ').trim()
    }
  }

  return { text: rest, customerName }
}

function titleCase(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 4)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

// ── Item segment parser ──────────────────────────────────────────

function parseSegment(segment: string): ParsedOrderItem | null {
  const rawTokens = segment.split(' ').filter(Boolean)
  if (!rawTokens.length) return null

  // Locate a price: a marker followed by a number. A weak marker directly
  // before a strong one ("notebooks at rs 25") is dropped, not kept as a name.
  let unitPrice: number | undefined
  const tokens: string[] = []
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i].replace(/\.$/, '')
    const nextRaw = (rawTokens[i + 1] || '').replace(/\.$/, '')
    const nextNum = nextRaw ? toNumber(nextRaw) : undefined
    const isMarker = STRONG_PRICE.has(t) || WEAK_PRICE.has(t)
    const nextIsMarker = STRONG_PRICE.has(nextRaw)
    if (isMarker && nextNum !== undefined && /^\d/.test(nextRaw)) {
      unitPrice = nextNum
      i++ // consume the number
      continue
    }
    if (WEAK_PRICE.has(t) && nextIsMarker) continue // "at rs 25" → "rs 25"
    tokens.push(t)
  }
  if (!tokens.length) return null

  // Quantity: the FIRST number among remaining tokens.
  let quantity = 1
  let quantityTaken = false
  const words: string[] = []
  for (const raw of tokens) {
    const t = raw.replace(/\.$/, '')
    if (!quantityTaken) {
      const n = toNumber(t)
      // "do" mid-sentence is the English filler, not Hindi 2.
      const isFillerDo = t === 'do' && words.length > 0
      if (n !== undefined && !isFillerDo && n > 0) {
        quantity = Math.floor(n)
        quantityTaken = true
        continue
      }
    }
    if (FILLER.has(t)) continue
    words.push(t)
  }

  const name = words.join(' ').trim()
  if (!name || !/[a-z\u0900-\u097F]/.test(name)) return null

  return { name, quantity, unitPrice }
}

// ── Main parser ──────────────────────────────────────────────────

export const ORDER_LIMITS = {
  maxItems: 25,
  maxQuantity: 10000,
  maxUnitPrice: 1000000, // ₹10 lakh per unit
  maxOrderValue: 10000000, // ₹1 crore per command
} as const

export function parseWhatsAppOrder(text: string): ParseResult {
  const normalized = normalize(text)
  if (!normalized || normalized.length > 1000) return { kind: 'not_order' }

  const words = new Set(normalized.split(/\s+/))
  const strongIntent = [...STRONG_INTENT].some((w) => words.has(w))

  const { text: bodyText, customerName } = extractCustomer(normalized)
  const segments = bodyText
    .replace(/^(?:add|bill|invoice)\s*[:\-]?\s*/i, ' ')
    .split(ITEM_SPLIT)
    .map((s) => s.trim())
    .filter(Boolean)

  const items: ParsedOrderItem[] = []
  for (const seg of segments) {
    const item = parseSegment(seg)
    if (item) items.push(item)
  }

  const usable = items.filter((it) => it.name && it.quantity > 0)

  if (!usable.length) {
    // A clear billing verb with nothing parseable deserves help;
    // everything else is just conversation.
    return strongIntent ? { kind: 'unparseable', reason: 'no-items' } : { kind: 'not_order' }
  }

  // Guard rails before anything is billed.
  if (usable.length > ORDER_LIMITS.maxItems) {
    return { kind: 'unparseable', reason: 'too-many-items' }
  }
  for (const it of usable) {
    if (it.quantity > ORDER_LIMITS.maxQuantity) return { kind: 'unparseable', reason: 'quantity' }
    if (it.unitPrice !== undefined && (it.unitPrice > ORDER_LIMITS.maxUnitPrice || it.unitPrice <= 0)) {
      return { kind: 'unparseable', reason: 'price' }
    }
  }
  const value = usable.reduce((s, it) => s + it.quantity * (it.unitPrice || 0), 0)
  if (value > ORDER_LIMITS.maxOrderValue) return { kind: 'unparseable', reason: 'order-value' }

  // Conversation veto: questions and wants ("kitne ka hai?", "chahiye
  // kal") are never bills — unless the sender named a price, which makes
  // it an order regardless of phrasing.
  const chatter = /(chahiye|kya|kab|kitna|kitne|kitne ka|hai|kaise|ok|achha|theek|nahi|matlab|batao|price|rate|available|milega|kaam|bhejna)/
  const namedPrice = usable.some((it) => it.unitPrice !== undefined)
  if (chatter.test(normalized) && !namedPrice) return { kind: 'not_order' }

  // A bare list ("thanks boss" parses as one qty-1 item) is only an
  // order when it looks like one: a real quantity, a price, several
  // items, or an explicit customer / billing verb.
  if (!strongIntent && !customerName) {
    const looksLikeOrder = namedPrice || usable.length > 1 || usable.some((it) => it.quantity > 1)
    if (!looksLikeOrder) return { kind: 'not_order' }
  }

  return { kind: 'order', items: usable.slice(0, ORDER_LIMITS.maxItems), customerName }
}

// ── Catalogue matching (runs server-side against the owner's products) ──

export interface CatalogProduct {
  id: string
  name: string
  price: number
  gst_rate?: number | null
  hsn_code?: string | null
}

export interface CatalogMatch {
  product: CatalogProduct
  score: number
}

function normName(s: string): string {
  return String(s || '').toLowerCase().replace(/[^a-z0-9\u0900-\u097F ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function singular(s: string): string {
  return s.replace(/(ies)$/, 'y').replace(/(ses|xes|zes)$/, 's').replace(/s$/, '')
}

/** Hindi/transliterated shop words → the English a catalogue would use. */
const TOKEN_SYNONYMS: Record<string, string> = {
  aata: 'atta', gehu: 'wheat', chawal: 'rice', dudh: 'milk', namak: 'salt',
  cheeni: 'sugar', shakkar: 'sugar', tel: 'oil', sabun: 'soap', chai: 'tea',
  pani: 'water', dahi: 'curd', makhan: 'butter', anda: 'egg', pyaz: 'onion',
  alu: 'potato', tamatar: 'tomato', dhaniya: 'coriander', mirchi: 'chilli',
  kitaab: 'book',
}

/** Unit words that carry no product meaning ("5 kg aata" → "aata"). */
const UNIT_TOKENS = new Set([
  'kg', 'kgs', 'g', 'gm', 'gram', 'grams', 'l', 'ltr', 'litre', 'litres',
  'ml', 'packet', 'packets', 'pckt', 'piece', 'pieces', 'pcs', 'box',
  'boxes', 'bottle', 'bottles', 'dozen', 'nos', 'unit', 'units', 'sachet',
  'sachets', 'jar', 'pack', 'packs', 'badi', 'chhoti',
])

function tokensOf(s: string): string[] {
  return normName(s).split(' ')
    .filter((t) => t.length > 1 && !UNIT_TOKENS.has(t))
    .map((t) => TOKEN_SYNONYMS[t] || singular(t))
}

/**
 * Match a spoken/typed product name against the catalogue. Returns ranked
 * candidates; only a CLEAR winner (top score ≥ 70 and 10+ points ahead)
 * should be billed automatically — ties must ask, never guess.
 *
 *   100 exact · 90 catalogue name starts with the query · 85 contains
 *    75 every query token hits (query is a subset of the catalogue name)
 */
export function matchCatalogItem(query: string, products: CatalogProduct[]): CatalogMatch[] {
  const q = normName(query)
  if (!q || !products.length) return []
  const qTokens = tokensOf(query)
  if (!qTokens.length) return []
  const qSingular = singular(q)

  const scored: CatalogMatch[] = products.map((p) => {
    const pName = normName(p.name)
    const pTokens = tokensOf(p.name)
    let score = 0
    if (pName === q) score = 100
    else if (pName.startsWith(qSingular) || pName.startsWith(q)) score = 90
    else if (pName.includes(q) || q.includes(pName)) score = 85
    else {
      const hits = qTokens.filter((t) => pTokens.includes(t)).length
      if (hits === qTokens.length && hits > 0) score = 75
      else if (hits > 0) score = Math.round(60 * hits / qTokens.length)
    }
    return { product: p, score }
  })

  return scored.filter((m) => m.score > 0).sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
}

/** The match that may bill without asking — null when unclear. */
export function clearCatalogMatch(query: string, products: CatalogProduct[]): CatalogProduct | null {
  const ranked = matchCatalogItem(query, products)
  if (!ranked.length) return null
  const top = ranked[0]
  const second = ranked[1]
  if (top.score < 70) return null
  if (second && top.score - second.score < 10) return null
  return top.product
}

// ── Reply copy (kept here so wording is tested with the parser) ──

export function orderHelpMessage(shopName: string): string {
  return `To raise a bill on WhatsApp, send something like:\n\n` +
    `• Add 50 notebooks at ₹25\n` +
    `• Bill for Ramesh: 3 pens @10, 2 notebooks @40\n\n` +
    `I use your catalogue prices when you don't give one, and GST is applied from each item's rate. — ${shopName || 'Cashiea'}`
}

export function inr(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

export interface BillMessageInvoice {
  invoice_number: string
  items: { description: string; quantity: number; unit_price: number }[]
  subtotal: number
  tax_amount: number
  total: number
  tax_rate?: number
}

/** The formatted bill text a customer receives (with UPI deep link). */
export function buildCustomerBillMessage(
  invoice: BillMessageInvoice,
  shopName: string,
  upiId?: string | null,
): string {
  const lines = invoice.items
    .map((it) => `• ${it.description} × ${it.quantity} @ ${inr(it.unit_price)} = ${inr(it.quantity * it.unit_price)}`)
    .join('\n')
  let msg = `🧾 *Bill ${invoice.invoice_number}* — ${shopName || 'our shop'}\n\n${lines}\n\n` +
    `Subtotal: ${inr(invoice.subtotal)}\n` +
    (invoice.tax_amount > 0 ? `GST (${invoice.tax_rate ?? 0}%): ${inr(invoice.tax_amount)}\n` : '') +
    `*Total: ${inr(invoice.total)}*\n`
  if (upiId) {
    const link = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName || 'Shop')}&am=${invoice.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Bill ' + invoice.invoice_number)}`
    msg += `\nPay via UPI: ${link}\n`
  }
  msg += `\nThank you for your business! 🙏`
  return msg
}
