// ════════════════════════════════════════════════════════════════
// Product visuals — a distinct colour + glyph per product.
//
// The old grid drew the same apple icon on every tile, so a wall of
// products was visually identical and the cashier had to READ every
// card. Colour is the fastest thing the eye sorts, so each product
// gets a stable hue: matched by category where we recognise one, and
// otherwise derived from the name so it is at least consistent for
// that product forever (never random per render).
//
// No product imagery is stored today (`products` has no image column),
// so `imageUrl` is read defensively: if a future migration adds one,
// the grid lights up with photos without any change here.
// ════════════════════════════════════════════════════════════════

import {
  Apple, Beef, Book, Candy, Coffee, CupSoda, Droplets, Footprints, Laptop,
  Package, PaintRoller, Pill, Shirt, Smartphone, SprayCan, Utensils, Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** A visual identity: the glyph plus the Tailwind classes that tint it. */
export interface ProductVisual {
  icon: LucideIcon
  /** Tinted plate behind the glyph. */
  tile: string
  /** Glyph colour on that plate. */
  fg: string
}

/**
 * The palette. Each entry is a soft tint + a saturated foreground, all
 * legible on white and none of them competing with the accent green
 * reserved for prices and the charge button.
 */
// Soft-filled plates (Tailwind's -50 tint on light, -950 on dark) with a
// saturated -600/-300 glyph. Arbitrary hex values keep the palette
// self-contained: the app-wide theme remaps every palette NAME onto the
// semantic tokens, so the stock `bg-emerald-50` classes never resolve.
const PALETTE = {
  emerald: { tile: 'bg-[#ECFDF5] dark:bg-[#064E3B]', fg: 'text-[#059669] dark:text-[#6EE7B7]' },
  amber: { tile: 'bg-[#FFFBEB] dark:bg-[#451A03]', fg: 'text-[#D97706] dark:text-[#FCD34D]' },
  rose: { tile: 'bg-[#FFF1F2] dark:bg-[#4C0519]', fg: 'text-[#E11D48] dark:text-[#FDA4AF]' },
  violet: { tile: 'bg-[#F5F3FF] dark:bg-[#2E1065]', fg: 'text-[#7C3AED] dark:text-[#C4B5FD]' },
  sky: { tile: 'bg-[#F0F9FF] dark:bg-[#082F49]', fg: 'text-[#0284C7] dark:text-[#7DD3FC]' },
  orange: { tile: 'bg-[#FFF7ED] dark:bg-[#431407]', fg: 'text-[#EA580C] dark:text-[#FDBA74]' },
  teal: { tile: 'bg-[#F0FDFA] dark:bg-[#042F2E]', fg: 'text-[#0D9488] dark:text-[#5EEAD4]' },
  indigo: { tile: 'bg-[#EEF2FF] dark:bg-[#1E1B4B]', fg: 'text-[#4F46E5] dark:text-[#A5B4FC]' },
  lime: { tile: 'bg-[#F7FEE7] dark:bg-[#1A2E05]', fg: 'text-[#65A30D] dark:text-[#BEF264]' },
  fuchsia: { tile: 'bg-[#FDF4FF] dark:bg-[#4A044E]', fg: 'text-[#C026D3] dark:text-[#F0ABFC]' },
} as const

type PaletteKey = keyof typeof PALETTE

/** Category → glyph + hue. Order matters: first match wins. */
const CATEGORY_RULES: [RegExp, LucideIcon, PaletteKey][] = [
  [/fruit|veg|sabzi|produce/i, Apple, 'lime'],
  [/grocer|kirana|grain|rice|atta|flour|dal|pulse|masala|spice|oil|sugar|salt/i, Package, 'amber'],
  [/dairy|milk|curd|paneer|butter|ghee|cheese/i, Coffee, 'sky'],
  [/bread|bakery|cake|biscuit|rusk/i, Candy, 'orange'],
  [/meat|fish|chicken|mutton|egg/i, Beef, 'rose'],
  [/drink|beverage|juice|soda|cola|water|tea|coffee|cold/i, CupSoda, 'teal'],
  [/snack|chips|namkeen|chocolate|candy|sweet|confection/i, Candy, 'fuchsia'],
  [/medicine|pharma|health|tablet|syrup/i, Pill, 'emerald'],
  [/beauty|cosmetic|perfume|deodor|shampoo/i, SprayCan, 'violet'],
  [/clean|wash|soap|detergent|phenyl|home care/i, Droplets, 'sky'],
  [/cloth|fashion|apparel|garment|saree|shirt/i, Shirt, 'indigo'],
  [/shoe|footwear|chappal|sandal/i, Footprints, 'orange'],
  [/electronic|mobile|phone|charger|gadget|battery/i, Smartphone, 'indigo'],
  [/computer|laptop|printer|accessor/i, Laptop, 'violet'],
  [/hardware|tool|plumb|electric|wire|nail|pipe/i, Wrench, 'amber'],
  [/paint|build|construct|cement|steel|sand/i, PaintRoller, 'orange'],
  [/stationer|book|paper|pen|office|school/i, Book, 'sky'],
  [/restaurant|hotel|utensil|kitchen|cater|crockery/i, Utensils, 'teal'],
]

const FALLBACK_HUES: PaletteKey[] = ['emerald', 'amber', 'rose', 'violet', 'sky', 'orange', 'teal', 'indigo', 'lime', 'fuchsia']

/** Stable small hash so an unrecognised product keeps one hue forever. */
function hueFor(seed: string): PaletteKey {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_HUES[h % FALLBACK_HUES.length]
}

export function productVisual(product: { name?: string | null; category?: string | null }): ProductVisual {
  const hay = `${product.category || ''} ${product.name || ''}`
  for (const [re, icon, hue] of CATEGORY_RULES) {
    if (re.test(hay)) return { icon, ...PALETTE[hue] }
  }
  // Unknown category: a consistent hue derived from the name, generic glyph.
  return { icon: Package, ...PALETTE[hueFor(product.name || product.category || '?')] }
}

/**
 * Category labels come from free-text data entry, so they arrive as
 * "fffgeneral", "GENERAL", " general ". Tidy them for display WITHOUT
 * rewriting the stored value: trim, collapse whitespace, drop a leading
 * run of repeated letters that is obvious keyboard mash, then title-case.
 */
export function prettyCategory(raw: string): string {
  const s = String(raw || '').trim().replace(/\s+/g, ' ')
  if (!s) return 'General'
  if (s.toLowerCase() === 'all') return 'All'
  // "fffgeneral" → "general": a 3+ repeat of one letter glued to a word.
  const demashed = s.replace(/^([a-z])\1{2,}(?=[a-z])/i, '')
  const base = demashed.length >= 3 ? demashed : s
  return base.charAt(0).toUpperCase() + base.slice(1)
}

/**
 * Canonical category — the clean, stable label used to BUILD the tabs and
 * FILTER the grid. Free-text category entry produces junk like "Generally",
 * "General", "Fffgeneral" that would otherwise render as three different
 * tabs for one idea. This collapses known aliases onto a small, real set
 * (Grocery / Stationery / Electronics / Drinks) and title-cases anything
 * unrecognised — so the tab strip is always tidy without rewriting the
 * stored value.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  general: 'Grocery',
  generally: 'Grocery',
  generalitems: 'Grocery',
  'general items': 'Grocery',
  grocery: 'Grocery',
  groceries: 'Grocery',
  kirana: 'Grocery',
  staples: 'Grocery',
  stationery: 'Stationery',
  stationary: 'Stationery',
  'office supplies': 'Stationery',
  electronic: 'Electronics',
  electronics: 'Electronics',
  gadget: 'Electronics',
  gadgets: 'Electronics',
  drink: 'Drinks',
  drinks: 'Drinks',
  beverage: 'Drinks',
  beverages: 'Drinks',
  'cold drink': 'Drinks',
  'cold drinks': 'Drinks',
}

export function canonicalCategory(raw?: string | null): string {
  const s = String(raw || '').trim().replace(/\s+/g, ' ')
  if (!s) return 'Grocery'
  const demashed = s.replace(/^([a-z])\1{2,}(?=[a-z])/i, '')
  const key = (demashed.length >= 2 ? demashed : s).toLowerCase()
  if (key === 'all') return 'All'
  return CATEGORY_ALIASES[key] ?? key.charAt(0).toUpperCase() + key.slice(1)
}

/** Future-proofing: read a photo URL if the row ever carries one. */
export function productImageUrl(product: unknown): string | null {
  const p = product as Record<string, unknown> | null
  const url = p && (p.image_url ?? p.photo_url ?? p.image)
  return typeof url === 'string' && /^https?:\/\//.test(url) ? url : null
}
