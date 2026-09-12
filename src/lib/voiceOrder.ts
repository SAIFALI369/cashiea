// ════════════════════════════════════════════════════════════════
// voiceOrder — turn a spoken sentence into a cart instruction.
//
// "Add 2 Aashirvaad Atta to cart" → { quantity: 2, query: "aashirvaad atta" }
//
// Matching is deliberately fuzzy at the edges (speech recognition drops
// and mangles words) but strict about the outcome: we only return a
// product when one candidate clearly wins, because silently adding the
// WRONG item to a real sale is far worse than asking the cashier again.
// ════════════════════════════════════════════════════════════════

export interface VoiceOrder {
  quantity: number
  query: string
}

/** Number words a shopkeeper is likely to say, plus digits. */
const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12,
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, panch: 5, chah: 6, cheh: 6,
  saat: 7, aath: 8, nau: 9, das: 10,
}

/** Words that carry no product meaning and only confuse the match. */
const STOP_WORDS = new Set([
  'add', 'put', 'place', 'scan', 'ring', 'up', 'to', 'in', 'into', 'the', 'my',
  'cart', 'basket', 'bill', 'sale', 'please', 'kar', 'karo', 'daal', 'daalo',
  'dal', 'do', 'and', 'of', 'piece', 'pieces', 'pcs', 'packet', 'packets',
  'item', 'items', 'units', 'unit',
])

/**
 * Parse a spoken phrase into a quantity and a search query.
 * Returns null when nothing usable is left after cleaning.
 */
export function parseVoiceOrder(transcript: string): VoiceOrder | null {
  const cleaned = String(transcript || '').toLowerCase().replace(/[^\p{L}\p{N}\s.]/gu, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return null

  const tokens = cleaned.split(' ')
  let quantity = 1
  let quantityTaken = false
  const words: string[] = []

  for (const raw of tokens) {
    // A trailing dot survives the character filter (it is kept so "1.5"
    // parses), but it must not stop "cart." matching the stop word.
    const t = raw.trim().replace(/\.+$/, '')
    if (!t) continue

    // The FIRST number we meet is the quantity. Later numbers are part of
    // the product name ("Atta 5kg", "Tata Salt 1kg") and must be kept.
    if (!quantityTaken) {
      const digits = /^\d+(\.\d+)?$/.test(t) ? Number(t) : undefined
      // "do" is both Hindi 2 and English filler; only treat it as a number
      // when it opens the phrase, never mid-sentence.
      const isFillerDo = t === 'do' && words.length > 0
      const word = !isFillerDo ? NUMBER_WORDS[t] : undefined
      const n = digits ?? word
      if (n !== undefined && n > 0 && n < 1000) {
        quantity = Math.floor(n)
        quantityTaken = true
        continue
      }
    }

    if (STOP_WORDS.has(t)) continue
    words.push(t)
  }

  const query = words.join(' ').trim()
  if (!query) return null
  return { quantity, query }
}

/**
 * Pick the product a spoken query refers to.
 *
 * Scores exact > prefix > all-words-present > partial, and refuses to
 * guess when the top two candidates score the same: an ambiguous match
 * returns null so the caller can ask instead of charging for the wrong
 * thing.
 */
export function matchProduct<T extends { name?: string | null; sku?: string | null }>(
  query: string,
  products: T[],
): T | null {
  const q = String(query || '').toLowerCase().trim()
  if (!q || products.length === 0) return null
  const qWords = q.split(/\s+/).filter(Boolean)

  let best: { item: T; score: number } | null = null
  let runnerUp = -1

  for (const p of products) {
    const name = String(p.name || '').toLowerCase()
    if (!name) continue
    const sku = String(p.sku || '').toLowerCase()

    let score = 0
    if (name === q || (sku && sku === q)) score = 100
    else if (name.startsWith(q)) score = 80
    else if (name.includes(q)) score = 60
    else {
      const hits = qWords.filter((w) => name.includes(w)).length
      if (hits === qWords.length) score = 45
      else if (hits > 0) score = 20 * (hits / qWords.length)
    }
    // Shorter names win ties: "Atta" beats "Atta Container Lid" for "atta".
    if (score > 0) score += Math.max(0, 10 - name.length / 8)

    if (!best || score > best.score) {
      runnerUp = best ? best.score : runnerUp
      best = { item: p, score }
    } else if (score > runnerUp) {
      runnerUp = score
    }
  }

  if (!best || best.score < 20) return null
  // Too close to call — don't guess with someone's money.
  if (runnerUp >= 0 && best.score - runnerUp < 1) return null
  return best.item
}
