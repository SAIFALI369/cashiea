// ════════════════════════════════════════════════════════════════
// Duplicate detection — customers (phone / email / fuzzy name) and
// products (SKU / fuzzy name). Pure functions.
//
// Merge is a *suggestion*: the page copies missing contact fields
// onto the keeper. We never silently delete a card that has orders
// (those sales would lose their customer link).
// ════════════════════════════════════════════════════════════════

export function levenshtein(a: string, b: string): number {
  const s = a || ''
  const t = b || ''
  if (s === t) return 0
  if (!s.length) return t.length
  if (!t.length) return s.length
  const prev = new Array(t.length + 1)
  const curr = new Array(t.length + 1)
  for (let j = 0; j <= t.length; j++) prev[j] = j
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= t.length; j++) prev[j] = curr[j]
  }
  return prev[t.length]
}

/** 1 = identical, 0 = unrelated. Empty strings score 0 against anything. */
export function similarity(a: string, b: string): number {
  const s = a || ''
  const t = b || ''
  if (!s && !t) return 1
  if (!s || !t) return 0
  const dist = levenshtein(s, t)
  return 1 - dist / Math.max(s.length, t.length)
}

/** Lowercase, strip punctuation, collapse spaces — "Ramesh  Kumar." → "ramesh kumar". */
export function normalizeName(input: string | null | undefined): string {
  return String(input || '')
    .toLowerCase()
    // \u0900-\u097F is the Devanagari block: Indian names are matched in
    // Hindi as well as English. The block includes combining vowels, which
    // is exactly what we want to keep.
    // eslint-disable-next-line no-misleading-character-class
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Indian phones: last 10 digits. Returns null when there aren't 10. */
export function normalizePhone(input: string | null | undefined): string | null {
  const digits = String(input || '').replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

export function normalizeEmail(input: string | null | undefined): string | null {
  const s = String(input || '').trim().toLowerCase()
  if (!s || !s.includes('@')) return null
  return s
}

export function normalizeSku(input: string | null | undefined): string | null {
  const s = String(input || '').trim().toLowerCase()
  return s || null
}

export type DuplicateReason = 'phone' | 'email' | 'sku' | 'name' | 'repeat_bill'

export interface DuplicatePair {
  aId: string
  bId: string
  aLabel: string
  bLabel: string
  reason: DuplicateReason
  score: number
  detail: string
}

export interface DupCustomer {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  total_spent?: number | null
  total_orders?: number | null
}

export interface DupProduct {
  id: string
  name: string
  sku?: string | null
}

const NAME_THRESHOLD = 0.86

function pushPair(out: DuplicatePair[], seen: Set<string>, pair: DuplicatePair) {
  const key = pair.aId < pair.bId ? `${pair.aId}|${pair.bId}|${pair.reason}` : `${pair.bId}|${pair.aId}|${pair.reason}`
  if (seen.has(key)) return
  seen.add(key)
  out.push(pair)
}

export function findCustomerDuplicates(customers: DupCustomer[]): DuplicatePair[] {
  const out: DuplicatePair[] = []
  const seen = new Set<string>()
  const byPhone = new Map<string, DupCustomer[]>()
  const byEmail = new Map<string, DupCustomer[]>()

  for (const c of customers) {
    const phone = normalizePhone(c.phone)
    if (phone) {
      const list = byPhone.get(phone) || []
      list.push(c)
      byPhone.set(phone, list)
    }
    const email = normalizeEmail(c.email)
    if (email) {
      const list = byEmail.get(email) || []
      list.push(c)
      byEmail.set(email, list)
    }
  }

  for (const [phone, list] of byPhone) {
    if (list.length < 2) continue
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        pushPair(out, seen, {
          aId: list[i].id, bId: list[j].id,
          aLabel: list[i].name, bLabel: list[j].name,
          reason: 'phone', score: 1,
          detail: `Same phone · ${phone}`,
        })
      }
    }
  }

  for (const [email, list] of byEmail) {
    if (list.length < 2) continue
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        pushPair(out, seen, {
          aId: list[i].id, bId: list[j].id,
          aLabel: list[i].name, bLabel: list[j].name,
          reason: 'email', score: 1,
          detail: `Same email · ${email}`,
        })
      }
    }
  }

  const named = customers.map((c) => ({ c, n: normalizeName(c.name) })).filter((x) => x.n.length >= 4)
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const score = similarity(named[i].n, named[j].n)
      if (score < NAME_THRESHOLD) continue
      // Skip if we already flagged them on phone/email.
      const already = out.some((p) =>
        (p.aId === named[i].c.id && p.bId === named[j].c.id) ||
        (p.aId === named[j].c.id && p.bId === named[i].c.id),
      )
      if (already) continue
      pushPair(out, seen, {
        aId: named[i].c.id, bId: named[j].c.id,
        aLabel: named[i].c.name, bLabel: named[j].c.name,
        reason: 'name', score,
        detail: `Similar name · ${Math.round(score * 100)}% match`,
      })
    }
  }

  return out.sort((a, b) => b.score - a.score)
}

export function findProductDuplicates(products: DupProduct[]): DuplicatePair[] {
  const out: DuplicatePair[] = []
  const seen = new Set<string>()
  const bySku = new Map<string, DupProduct[]>()

  for (const p of products) {
    const sku = normalizeSku(p.sku)
    if (!sku) continue
    const list = bySku.get(sku) || []
    list.push(p)
    bySku.set(sku, list)
  }

  for (const [sku, list] of bySku) {
    if (list.length < 2) continue
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        pushPair(out, seen, {
          aId: list[i].id, bId: list[j].id,
          aLabel: list[i].name, bLabel: list[j].name,
          reason: 'sku', score: 1,
          detail: `Same SKU · ${sku}`,
        })
      }
    }
  }

  const named = products.map((p) => ({ p, n: normalizeName(p.name) })).filter((x) => x.n.length >= 4)
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const score = similarity(named[i].n, named[j].n)
      if (score < NAME_THRESHOLD) continue
      const already = out.some((d) =>
        (d.aId === named[i].p.id && d.bId === named[j].p.id) ||
        (d.aId === named[j].p.id && d.bId === named[i].p.id),
      )
      if (already) continue
      pushPair(out, seen, {
        aId: named[i].p.id, bId: named[j].p.id,
        aLabel: named[i].p.name, bLabel: named[j].p.name,
        reason: 'name', score,
        detail: `Similar name · ${Math.round(score * 100)}% match`,
      })
    }
  }

  return out.sort((a, b) => b.score - a.score)
}

export interface DupInvoice {
  id: string
  invoice_number: string
  client_name?: string | null
  total: number
  created_at: string
  status?: string | null
}

function localYmdFromIso(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Same customer + same rupee total + same local calendar day.
 * Flagged only — we do not void or merge bills.
 */
export function findRepeatInvoices(invoices: DupInvoice[]): DuplicatePair[] {
  const out: DuplicatePair[] = []
  const seen = new Set<string>()
  const groups = new Map<string, DupInvoice[]>()

  for (const inv of invoices) {
    if (inv.status === 'draft') continue
    const name = normalizeName(inv.client_name || '')
    const day = localYmdFromIso(inv.created_at)
    if (name.length < 2 || !day) continue
    const amount = Math.round(Number(inv.total) || 0)
    const key = `${name}|${amount}|${day}`
    const list = groups.get(key) || []
    list.push(inv)
    groups.set(key, list)
  }

  for (const [, list] of groups) {
    if (list.length < 2) continue
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const amount = Math.round(Number(list[i].total) || 0)
        pushPair(out, seen, {
          aId: list[i].id, bId: list[j].id,
          aLabel: list[i].invoice_number, bLabel: list[j].invoice_number,
          reason: 'repeat_bill', score: 1,
          detail: `Same customer · ₹${amount.toLocaleString('en-IN')} · ${localYmdFromIso(list[i].created_at)}`,
        })
      }
    }
  }
  return out
}

export interface StaleProduct {
  id: string
  name: string
  sku: string | null
  stock: number
  lastSoldAt: string | null
  daysSinceSale: number | null
}

const STALE_DAYS = 90

/**
 * Active products still on the shelf with no completed sale in `days` days.
 * Brand-new SKUs (created inside the window) are not stale.
 */
export function findStaleProducts(
  products: { id: string; name: string; sku?: string | null; stock_quantity?: number | null; active?: boolean | null; created_at?: string | null }[],
  sales: { created_at: string; status?: string | null; items?: { product_id?: string | null }[] | null }[],
  now = Date.now(),
  days = STALE_DAYS,
): StaleProduct[] {
  const since = now - days * 86_400_000
  const last = new Map<string, number>()
  for (const t of sales) {
    if (t.status && t.status !== 'completed') continue
    const at = new Date(t.created_at).getTime()
    if (!Number.isFinite(at) || at > now) continue
    for (const it of t.items || []) {
      if (!it.product_id) continue
      const prev = last.get(it.product_id) || 0
      if (at > prev) last.set(it.product_id, at)
    }
  }

  const out: StaleProduct[] = []
  for (const p of products) {
    if (p.active === false) continue
    const stock = Number(p.stock_quantity) || 0
    if (stock <= 0) continue
    const created = p.created_at ? new Date(p.created_at).getTime() : 0
    if (created && created >= since) continue
    const soldAt = last.get(p.id)
    if (soldAt && soldAt >= since) continue
    const daysSince = soldAt ? Math.floor((now - soldAt) / 86_400_000) : null
    out.push({
      id: p.id,
      name: p.name,
      sku: p.sku || null,
      stock,
      lastSoldAt: soldAt ? new Date(soldAt).toISOString() : null,
      daysSinceSale: daysSince,
    })
  }
  return out.sort((a, b) => (b.daysSinceSale ?? 9999) - (a.daysSinceSale ?? 9999) || a.name.localeCompare(b.name))
}

/** Prefer the card with more orders, then more spent, then the older id. */
export function pickKeeper<T extends DupCustomer>(a: T, b: T): { keeper: T; extra: T } {
  const ao = Number(a.total_orders) || 0
  const bo = Number(b.total_orders) || 0
  if (ao !== bo) return ao >= bo ? { keeper: a, extra: b } : { keeper: b, extra: a }
  const as = Number(a.total_spent) || 0
  const bs = Number(b.total_spent) || 0
  if (as !== bs) return as >= bs ? { keeper: a, extra: b } : { keeper: b, extra: a }
  return a.id < b.id ? { keeper: a, extra: b } : { keeper: b, extra: a }
}

/** Fields on `extra` that `keeper` is missing — safe to copy across. */
export function missingContactFields(
  keeper: { phone?: string | null; email?: string | null; address?: string | null; company?: string | null; notes?: string | null },
  extra: { phone?: string | null; email?: string | null; address?: string | null; company?: string | null; notes?: string | null },
): Record<string, string> {
  const patch: Record<string, string> = {}
  if (!String(keeper.phone || '').trim() && extra.phone) patch.phone = extra.phone
  if (!String(keeper.email || '').trim() && extra.email) patch.email = extra.email
  if (!String(keeper.address || '').trim() && extra.address) patch.address = extra.address
  if (!String(keeper.company || '').trim() && extra.company) patch.company = extra.company
  if (!String(keeper.notes || '').trim() && extra.notes) patch.notes = extra.notes
  return patch
}
