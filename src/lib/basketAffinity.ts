// ════════════════════════════════════════════════════════════════
// basketAffinity — "customers usually buy X with Y", computed from
// THIS shop's own completed sales.
//
// The rule is simple co-occurrence: among baskets that contained the
// anchor product, which other product appeared most often? A claim
// like "usually" is only worth making when the evidence supports it,
// so a pair must clear a minimum number of shared baskets AND a
// minimum share of the anchor's baskets before it is ever shown.
// Below that bar we return nothing and Meraj stays quiet — an assistant
// that invents patterns is worse than one that says less.
// ════════════════════════════════════════════════════════════════

export interface BasketTxn {
  items: { product_id: string; name: string; quantity: number }[] | null
}

export interface Affinity {
  productId: string
  name: string
  /** Baskets containing both the anchor and this product. */
  together: number
  /** Share of the anchor's baskets that also had this product (0–1). */
  confidence: number
}

/** A pair needs at least this many shared baskets to be worth mentioning. */
export const MIN_TOGETHER = 3
/** …and must appear in at least this share of the anchor's baskets. */
export const MIN_CONFIDENCE = 0.3

/**
 * Best companion product for `anchorId`, or null when the history does
 * not support a confident claim.
 */
export function topCompanion(
  txns: BasketTxn[],
  anchorId: string,
  opts: { minTogether?: number; minConfidence?: number } = {},
): Affinity | null {
  const minTogether = opts.minTogether ?? MIN_TOGETHER
  const minConfidence = opts.minConfidence ?? MIN_CONFIDENCE
  if (!anchorId) return null

  let anchorBaskets = 0
  const together = new Map<string, { name: string; count: number }>()

  for (const txn of txns || []) {
    const items = txn?.items
    if (!Array.isArray(items) || items.length === 0) continue

    // Deduplicate within a basket: buying 3 packets is still ONE basket.
    const ids = new Set<string>()
    const names = new Map<string, string>()
    for (const it of items) {
      if (!it?.product_id) continue
      ids.add(it.product_id)
      if (it.name) names.set(it.product_id, it.name)
    }
    if (!ids.has(anchorId)) continue

    anchorBaskets += 1
    for (const id of ids) {
      if (id === anchorId) continue
      const cur = together.get(id) || { name: names.get(id) || id, count: 0 }
      cur.count += 1
      if (!cur.name || cur.name === id) cur.name = names.get(id) || cur.name
      together.set(id, cur)
    }
  }

  if (anchorBaskets === 0 || together.size === 0) return null

  let best: Affinity | null = null
  for (const [productId, { name, count }] of together) {
    const confidence = count / anchorBaskets
    if (!best || count > best.together || (count === best.together && confidence > best.confidence)) {
      best = { productId, name, together: count, confidence }
    }
  }

  if (!best) return null
  if (best.together < minTogether || best.confidence < minConfidence) return null
  return best
}

/**
 * Phrase the suggestion. Kept factual — it reports what the shop's own
 * sales show, and never promises a discount the app cannot honour.
 */
export function companionTip(anchorName: string, companion: Affinity): string {
  const pct = Math.round(companion.confidence * 100)
  return `${pct}% of ${anchorName} sales also included ${companion.name}. Offer it?`
}
