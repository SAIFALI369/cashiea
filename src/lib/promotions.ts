// ════════════════════════════════════════════════════════════════
// promotions.ts — BOGO / tiered / percent deal engine.
//
// The "Shopify dynamic discounting" answer. Rules are owner-configured
// (schema v43) and evaluated DETERMINISTICALLY at cart time; the
// resulting discounts ride the existing per-line and cart discount
// fields that complete_sale already re-validates server-side — so a
// promotion can never produce an unbalanced or unaudited sale.
//
// Non-stacking contract (predictable for the cashier):
//   · BOGO rules apply per matching LINE (they can overlap with a cart
//     deal only in the sense that different lines can each match their
//     own rule — each line discounts at most once).
//   · Cart-level rules (tiered / percent) NEVER stack with each other:
//     the single best-value one wins.
//   · Total discount is always capped at the cart's pre-discount value.
// ════════════════════════════════════════════════════════════════

export type PromotionKind = 'bogo' | 'tiered' | 'percent'

export interface BogoConfig {
  /** Target one product (matches line.product_id) … */
  productId?: string
  /** … or a whole category (matches product.category, case-insensitive). */
  category?: string
  /** Buy N units… */
  buy: number
  /** …get M units at discountPct% off. */
  get: number
  /** 100 = free items (classic BOGO). */
  discountPct: number
}

export interface TieredConfig {
  /** Spend thresholds with their % off — highest matching wins. */
  tiers: Array<{ minSpend: number; pct: number }>
}

export interface PercentConfig {
  pct: number
  /** Optional cap in rupees. */
  maxDiscount?: number
}

export interface Promotion {
  id: string
  name: string
  kind: PromotionKind
  config: Record<string, unknown>
  /** Inclusive window; null = open-ended. Dates as YYYY-MM-DD. */
  starts_at: string | null
  ends_at: string | null
  enabled: boolean
}

/** A cart line as the engine sees it (POS CartLine compatible subset). */
export interface PromoLine {
  key: string
  product_id: string
  name: string
  quantity: number
  unit_price: number
}

export interface ProductLike {
  id: string
  category?: string | null
}

export interface AppliedLineDiscount {
  lineKey: string
  amount: number
  ruleId: string
  ruleName: string
}

export interface AppliedCartDiscount {
  amount: number
  ruleId: string
  ruleName: string
}

export interface PromotionResult {
  lineDiscounts: AppliedLineDiscount[]
  cartDiscount: AppliedCartDiscount | null
  /** Human labels for the cashier ("2 deals applied"). */
  labels: string[]
  totalDiscount: number
}

const MS_PER_DAY = 86400000

/** A date-only string → midnight local. Invalid → null. */
function dayStart(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = new Date(`${iso}T00:00:00`).getTime()
  return Number.isFinite(t) ? t : null
}

/** Is the rule inside its scheduled window on `now`? */
export function isPromotionActive(rule: Promotion, now = Date.now()): boolean {
  if (!rule.enabled) return false
  const start = dayStart(rule.starts_at)
  const end = dayStart(rule.ends_at)
  if (start !== null && now < start) return false
  // ends_at is inclusive: the deal runs through the END of that day.
  if (end !== null && now > end + MS_PER_DAY - 1) return false
  return true
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function clampPct(v: unknown, max = 100): number {
  return Math.max(0, Math.min(max, num(v)))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── BOGO ─────────────────────────────────────────────────────────

/** Does this line match a BOGO target (product or category)? */
export function lineMatchesBogo(line: PromoLine, product: ProductLike | undefined, cfg: BogoConfig): boolean {
  if (cfg.productId) return line.product_id === cfg.productId
  if (cfg.category) {
    const want = String(cfg.category).trim().toLowerCase()
    if (!want) return false
    const cat = String(product?.category || '').trim().toLowerCase()
    return cat === want
  }
  return false
}

/** Free/discounted unit count for a quantity under buy-N-get-M. */
export function bogoDiscountUnits(quantity: number, buy: number, get: number): number {
  const q = Math.max(0, Math.floor(quantity))
  const b = Math.max(1, Math.floor(buy))
  const g = Math.max(0, Math.floor(get))
  if (g <= 0) return 0
  return Math.floor(q / (b + g)) * g
}

// ── Evaluation ───────────────────────────────────────────────────

/**
 * Evaluate all active rules against the cart. Deterministic and pure —
 * same inputs, same discounts, today and at audit time.
 */
export function evaluatePromotions(
  rules: Promotion[],
  lines: PromoLine[],
  products: ProductLike[],
  now = Date.now(),
): PromotionResult {
  const productById = new Map(products.map((p) => [p.id, p]))
  const lineDiscounts: AppliedLineDiscount[] = []
  const labels: string[] = []

  // 1) Line-level BOGO — each line discounts at most once (best rule wins).
  const active = rules.filter((r) => isPromotionActive(r, now))
  for (const line of lines) {
    const product = productById.get(line.product_id)
    let best: AppliedLineDiscount | null = null
    for (const rule of active) {
      if (rule.kind !== 'bogo') continue
      const cfg = (rule.config || {}) as Partial<BogoConfig>
      if (!lineMatchesBogo(line, product, cfg as BogoConfig)) continue
      const buy = Math.max(1, Math.floor(num(cfg.buy, 1)))
      const get = Math.floor(num(cfg.get, 0))
      const pct = clampPct(cfg.discountPct, 100)
      if (get <= 0 || pct <= 0) continue
      const units = bogoDiscountUnits(line.quantity, buy, get)
      if (units <= 0) continue
      const amount = round2(units * Math.max(0, line.unit_price) * (pct / 100))
      if (amount > 0 && (!best || amount > best.amount)) {
        best = { lineKey: line.key, amount, ruleId: rule.id, ruleName: rule.name }
      }
    }
    if (best) {
      lineDiscounts.push(best)
      labels.push(`${best.ruleName}`)
    }
  }

  // 2) Cart-level tiered / percent — exactly ONE (the best value) applies.
  const spend = round2(lines.reduce((s, l) => s + Math.max(0, l.quantity) * Math.max(0, l.unit_price), 0))
  let cart: AppliedCartDiscount | null = null
  for (const rule of active) {
    if (rule.kind === 'tiered') {
      const cfg = rule.config as Partial<TieredConfig>
      const tiers = Array.isArray(cfg?.tiers) ? (cfg.tiers || []) : []
      const matched = tiers
        .filter((t) => spend >= Math.max(0, num(t.minSpend)))
        .sort((a, b) => clampPct(b.pct) - clampPct(a.pct) || num(b.minSpend) - num(a.minSpend))[0]
      if (!matched) continue
      const pct = clampPct(matched.pct)
      if (pct <= 0) continue
      const amount = round2(spend * (pct / 100))
      if (!cart || amount > cart.amount) {
        cart = { amount, ruleId: rule.id, ruleName: rule.name }
      }
    } else if (rule.kind === 'percent') {
      const cfg = (rule.config || {}) as Partial<PercentConfig>
      const pct = clampPct(cfg.pct)
      if (pct <= 0) continue
      let amount = round2(spend * (pct / 100))
      const cap = num(cfg.maxDiscount, 0)
      if (cap > 0) amount = Math.min(amount, round2(cap))
      if (amount > 0 && (!cart || amount > cart.amount)) {
        cart = { amount, ruleId: rule.id, ruleName: rule.name }
      }
    }
  }
  if (cart) labels.unshift(cart.ruleName)

  // 3) Cap the total at the cart's value (can never go negative).
  const lineTotal = round2(lineDiscounts.reduce((s, d) => s + d.amount, 0))
  let total = round2(lineTotal + (cart?.amount || 0))
  if (total > spend) {
    // Shrink the cart deal first, then lines proportionally.
    const excess = round2(total - spend)
    if (cart) {
      const shrink = Math.min(cart.amount, excess)
      cart = { ...cart, amount: round2(cart.amount - shrink) }
    }
    let remaining = round2(total - spend)
    if (remaining > 0) {
      for (let i = 0; i < lineDiscounts.length && remaining > 0; i++) {
        const shrink = Math.min(lineDiscounts[i].amount, remaining)
        lineDiscounts[i] = { ...lineDiscounts[i], amount: round2(lineDiscounts[i].amount - shrink) }
        remaining = round2(remaining - shrink)
      }
    }
    total = spend
  }

  return {
    lineDiscounts,
    cartDiscount: cart,
    labels: [...new Set(labels)],
    totalDiscount: total,
  }
}

// ── Validation for the management UI ─────────────────────────────

export interface RuleValidation {
  ok: boolean
  error?: string
}

/** Validate a rule before it is saved (mirrors the schema constraints). */
export function validatePromotion(rule: Promotion): RuleValidation {
  const name = String(rule.name || '').trim()
  if (!name) return { ok: false, error: 'Give the deal a name' }
  if (name.length > 60) return { ok: false, error: 'Name is too long (60 chars max)' }
  if (rule.starts_at && rule.ends_at) {
    const s = dayStart(rule.starts_at)
    const e = dayStart(rule.ends_at)
    if (s !== null && e !== null && e < s) return { ok: false, error: 'End date is before the start date' }
  }
  if (rule.kind === 'bogo') {
    const cfg = (rule.config || {}) as Partial<BogoConfig>
    const hasTarget = !!cfg.productId || !!cfg.category
    if (!hasTarget) return { ok: false, error: 'Pick a product or category for the BOGO deal' }
    const buy = Math.floor(num(cfg.buy, 0))
    const get = Math.floor(num(cfg.get, 0))
    if (buy < 1) return { ok: false, error: '"Buy" must be at least 1' }
    if (get < 1) return { ok: false, error: '"Get" must be at least 1' }
    if (buy + get > 1000) return { ok: false, error: 'That deal is too large' }
    const pct = clampPct(cfg.discountPct, 100)
    if (pct <= 0) return { ok: false, error: 'Discount % must be more than 0' }
  } else if (rule.kind === 'tiered') {
    const cfg = rule.config as Partial<TieredConfig>
    const tiers = Array.isArray(cfg?.tiers) ? (cfg.tiers || []) : []
    if (!tiers.length) return { ok: false, error: 'Add at least one spend tier' }
    for (const t of tiers) {
      if (num(t.minSpend) <= 0) return { ok: false, error: 'Tier spend must be more than ₹0' }
      if (clampPct(t.pct) <= 0) return { ok: false, error: 'Tier discount must be more than 0%' }
      if (clampPct(t.pct) > 100) return { ok: false, error: 'Tier discount cannot exceed 100%' }
    }
  } else if (rule.kind === 'percent') {
    const cfg = (rule.config || {}) as Partial<PercentConfig>
    const pct = clampPct(cfg.pct)
    if (pct <= 0) return { ok: false, error: 'Discount % must be more than 0' }
    const cap = num(cfg.maxDiscount, 0)
    if (cap < 0) return { ok: false, error: 'Max discount cannot be negative' }
  }
  return { ok: true }
}

/** The customer-facing line for a receipt, e.g. "Buy 2 Get 1 · Diwali BOGO". */
export function promotionLabel(rule: Promotion): string {
  if (rule.kind === 'bogo') {
    const cfg = (rule.config || {}) as Partial<BogoConfig>
    return `Buy ${Math.max(1, num(cfg.buy, 1))} Get ${num(cfg.get, 0)} · ${rule.name}`
  }
  if (rule.kind === 'tiered') return `Spend & save · ${rule.name}`
  return `${clampPct((rule.config as Partial<PercentConfig>).pct)}% off · ${rule.name}`
}
