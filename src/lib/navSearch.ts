/**
 * navSearch — shopkeeper-vocabulary search for the sidebar.
 *
 * A search box that only finds "Khata" when you type "khata" is useless to
 * someone thinking "udhaar". Synonyms are mapped per route; scoring keeps a
 * literal label match always above a synonym match.
 *
 *   100 exact label · 80 label starts-with · 60 label contains
 *   50 all query words present in label
 *   40 synonym starts-with · 30 synonym contains
 */

export interface NavLike {
  to: string
  label: string
}

export const NAV_SYNONYMS: Record<string, string[]> = {
  '/app/customers': ['khata', 'udhaar', 'credit', 'party'],
  '/app/pos': ['bill', 'billing', 'sell', 'counter'],
  '/app/products': ['stock', 'inventory', 'maal'],
  '/app/accounts': ['kharcha', 'expense', 'expenses'],
  '/app/vasooli': ['recovery', 'dues', 'collection', 'vasooli'],
  '/app/invoices': ['bill', 'gst', 'invoice'],
  '/app/auto-reorder': ['restock', 'purchase', 'order'],
  '/app/khata': ['udhaar', 'credit', 'ledger'],
  '/app/reports': ['hisab', 'report'],
  '/app/suppliers': ['distributor', 'vendor', 'supplier'],
}

export function scoreNavItem(item: NavLike, query: string): number {
  const q = query.trim().toLowerCase()
  if (!q) return 0
  const label = item.label.toLowerCase()
  const syns = (NAV_SYNONYMS[item.to] || []).map((s) => s.toLowerCase())
  if (label === q) return 100
  if (label.startsWith(q)) return 80
  if (label.includes(q)) return 60
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length > 1 && words.every((w) => label.includes(w))) return 50
  if (syns.some((s) => s.startsWith(q))) return 40
  if (syns.some((s) => s.includes(q))) return 30
  return 0
}

/**
 * Filter + rank. An empty query returns the SAME array reference — the
 * normal tree renders completely untouched.
 */
export function filterNav<T extends NavLike>(items: T[], query: string): T[] {
  const q = query.trim()
  if (!q) return items
  return items
    .map((it) => ({ it, score: scoreNavItem(it, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.it)
}

/** Total matches across grouped sections (for "Nothing matches" states). */
export function countNav<T extends NavLike>(groups: { items: T[] }[], query: string): number {
  const q = query.trim()
  if (!q) return groups.reduce((s, g) => s + g.items.length, 0)
  return groups.reduce((s, g) => s + filterNav(g.items, q).length, 0)
}
