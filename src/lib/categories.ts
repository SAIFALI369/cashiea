// ════════════════════════════════════════════════════════════════
// Category helpers — placeholder hints per category, normalization
// so "Electronics" and "electronics" are one category, and a set of
// common Indian retail categories to seed the dropdown.
// ════════════════════════════════════════════════════════════════

export interface CategoryHints {
  /** Name placeholder that matches how this shop type actually writes items. */
  name: string
  sku: string
  hsn: string
  /** Suggested base unit, shown in the units editor hint. */
  unit?: string
}

/** Placeholder hints keyed by recognizable category keywords. */
const HINTS: [RegExp, CategoryHints][] = [
  [/grocer|kirana|food|grain|super/i, { name: 'e.g. Aata 10kg bag', sku: 'e.g. AATA-10', hsn: 'e.g. 1101 (wheat flour)', unit: 'kg' }],
  [/dairy|milk|bread|bakery|egg/i, { name: 'e.g. Amul Milk 500ml', sku: 'e.g. MILK-500', hsn: 'e.g. 0401 (milk)', unit: 'pcs' }],
  [/fruit|veg/i, { name: 'e.g. Onion 1kg', sku: 'e.g. VEG-ONION', hsn: 'e.g. 0703 (onions)', unit: 'kg' }],
  [/snack|drink|beverage|cold|chai/i, { name: 'e.g. Parle-G 100g', sku: 'e.g. SNK-PG', hsn: 'e.g. 1905 (biscuits)' }],
  [/personal|cosmetic|beauty|soap/i, { name: 'e.g. Dettol Soap 125g', sku: 'e.g. PC-SOAP4', hsn: 'e.g. 3401 (soap)' }],
  [/medicine|pharma|health/i, { name: 'e.g. Dolo 650 strip', sku: 'e.g. MED-DOLO', hsn: 'e.g. 3004 (medicines)' }],
  [/electronic|mobile|gadget|phone|computer|it\b|accessor/i, { name: 'e.g. Wireless Mouse', sku: 'e.g. WM-001', hsn: 'e.g. 8517 / 8471' }],
  [/electric|wire|hardware|tool|plumb/i, { name: 'e.g. Havells Wire 90m', sku: 'e.g. HW-WIRE90', hsn: 'e.g. 8544 (cables)' }],
  [/cloth|fashion|apparel|garment|textile/i, { name: 'e.g. Cotton Kurta M', sku: 'e.g. CL-KRT-M', hsn: 'e.g. 6211' }],
  [/shoe|footwear/i, { name: 'e.g. Bata Sports Shoes 9', sku: 'e.g. FW-SP9', hsn: 'e.g. 6403' }],
  [/stationer|book|paper|office|school/i, { name: 'e.g. Classmate Notebook 200p', sku: 'e.g. ST-NB200', hsn: 'e.g. 4820' }],
  [/build|construct|cement|steel|paint/i, { name: 'e.g. Ultratech Cement 50kg', sku: 'e.g. BD-CEM50', hsn: 'e.g. 2523 (cement)' }],
  [/toy/i, { name: 'e.g. Rubik Cube 3x3', sku: 'e.g. TOY-RB3', hsn: 'e.g. 9503' }],
  [/service|repair|tailor|salon|other|general/i, { name: 'e.g. Mobile screen repair', sku: 'e.g. SVC-SCR', hsn: 'e.g. 9987 (services)' }],
]

const DEFAULT_HINTS: CategoryHints = {
  name: 'e.g. Wireless Mouse',
  sku: 'e.g. WM-001',
  hsn: 'e.g. 3004',
}

/** Placeholders that adapt to the selected category. */
export function categoryHints(category: string | null | undefined): CategoryHints {
  if (!category) return DEFAULT_HINTS
  for (const [re, hints] of HINTS) {
    if (re.test(category)) return { ...DEFAULT_HINTS, ...hints }
  }
  return DEFAULT_HINTS
}

/**
 * Canonical category for a newly-entered value: if an existing
 * category already matches case-insensitively, reuse ITS spelling so
 * "Electronics" and "electronics" never become two chips.
 */
export function normalizeCategory(input: string, existingCategories: string[]): string {
  const trimmed = (input || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return trimmed
  const lower = trimmed.toLowerCase()
  const match = existingCategories.find((c) => (c || '').trim().toLowerCase() === lower)
  return match ?? trimmed
}

/** Sensible starting categories for an Indian retail shop. */
export const COMMON_CATEGORIES = [
  'grocery', 'dairy', 'snacks', 'personal care', 'electronics',
  'stationery', 'clothing', 'hardware', 'medicine', 'services',
]
