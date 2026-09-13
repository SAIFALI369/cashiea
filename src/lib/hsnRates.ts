// ════════════════════════════════════════════════════════════════
// hsnRates.ts — HSN/SAC → GST rate master (client copy, zero network).
//
// Completes the GST algorithm: "reads the product's HSN code → fetches
// the applicable GST rate". Rates reflect the GST 2.0 rationalisation
// effective 22 September 2025 (0/5/18/40 for most goods; the 12% and
// 28% slabs were largely retired). Items that changed carry their
// legacyRate + wef so historical data can still be understood.
//
// This dataset is the SINGLE SOURCE OF TRUTH —
//   scripts/generate-hsn-seed.mjs regenerates the SQL seed
//   (supabase/schema-v38-hsn-rates.sql) from it, so the server-side
//   table and the client lookup can never drift apart.
//
// Rates here are the COMMON case for a small shop, not a legal
// guarantee: exemptions, composition schemes and notifications move
// individual codes. The UI always says "suggested — confirm with your
// CA", the same honesty rule as the GST export.
// ════════════════════════════════════════════════════════════════

export interface HsnRateEntry {
  /** HSN chapter (2), heading (4), sub-heading (6+) or SAC code. */
  code: string
  kind: 'hsn' | 'sac'
  description: string
  /** Current GST % (post 22-Sep-2025 where it changed). */
  gstRate: number
  /** GST % before GST 2.0 — kept for reference on old bills. */
  legacyRate?: number
  /** Value-based split: at/below this per-piece price `gstRate` applies. */
  threshold?: number
  /** Rate above the threshold (e.g. apparel > ₹2,500 → 18%). */
  altRate?: number
  /** When the current rate took effect (GST 2.0 = '2025-09-22'). */
  wef?: string
}

export const HSN_RATE_ENTRIES: HsnRateEntry[] = [
  // ── Fresh food & groceries (chapters 1–23) ──────────────────────
  { code: '01', kind: 'hsn', description: 'Live animals', gstRate: 0 },
  { code: '02', kind: 'hsn', description: 'Meat & edible offal', gstRate: 0 },
  { code: '03', kind: 'hsn', description: 'Fish & seafood', gstRate: 0 },
  { code: '04', kind: 'hsn', description: 'Dairy, eggs, honey (fresh milk, curd, paneer)', gstRate: 0, legacyRate: 5, wef: '2025-09-22' },
  { code: '0405', kind: 'hsn', description: 'Butter & ghee', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '0406', kind: 'hsn', description: 'Cheese', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '06', kind: 'hsn', description: 'Live plants & flowers', gstRate: 0 },
  { code: '07', kind: 'hsn', description: 'Vegetables', gstRate: 0 },
  { code: '08', kind: 'hsn', description: 'Fruits & nuts (fresh)', gstRate: 0 },
  { code: '09', kind: 'hsn', description: 'Coffee, tea, mate & spices', gstRate: 5 },
  { code: '10', kind: 'hsn', description: 'Cereals (rice, wheat)', gstRate: 0 },
  { code: '11', kind: 'hsn', description: 'Milling products (flour, atta)', gstRate: 5 },
  { code: '12', kind: 'hsn', description: 'Oil seeds', gstRate: 0 },
  { code: '15', kind: 'hsn', description: 'Edible fats & oils', gstRate: 5 },
  { code: '17', kind: 'hsn', description: 'Sugar & jaggery', gstRate: 5 },
  { code: '1704', kind: 'hsn', description: 'Sugar confectionery (toffees, candy)', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '18', kind: 'hsn', description: 'Cocoa & chocolate', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '1806', kind: 'hsn', description: 'Chocolate & chocolate products', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '19', kind: 'hsn', description: 'Cereal & bakery preparations', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '1905', kind: 'hsn', description: 'Bread, bakery & puffed products', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '20', kind: 'hsn', description: 'Preserved vegetables, fruit, jams', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '2008', kind: 'hsn', description: 'Dry fruits & prepared nuts', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '21', kind: 'hsn', description: 'Miscellaneous edible preparations', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '2105', kind: 'hsn', description: 'Ice cream & frozen desserts', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '2106', kind: 'hsn', description: 'Food preparations (namkeen, snacks)', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '22', kind: 'hsn', description: 'Beverages (non-aerated)', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '2201', kind: 'hsn', description: 'Packaged drinking water', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '2202', kind: 'hsn', description: 'Aerated & carbonated drinks', gstRate: 40, legacyRate: 28, wef: '2025-09-22' },
  { code: '23', kind: 'hsn', description: 'Food industry residues & animal feed', gstRate: 5 },
  { code: '24', kind: 'hsn', description: 'Tobacco & tobacco products', gstRate: 28 },

  // ── Household & personal care ────────────────────────────────────
  { code: '25', kind: 'hsn', description: 'Salt, stone & mineral products', gstRate: 5 },
  { code: '2523', kind: 'hsn', description: 'Portland cement', gstRate: 18, legacyRate: 28, wef: '2025-09-22' },
  { code: '3304', kind: 'hsn', description: 'Beauty & make-up preparations', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '3305', kind: 'hsn', description: 'Shampoos, hair oils & hair care', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '3306', kind: 'hsn', description: 'Toothpaste & oral hygiene', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '3307', kind: 'hsn', description: 'Perfumery, cosmetics & personal care', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '3401', kind: 'hsn', description: 'Soap & organic surface cleaners', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '3402', kind: 'hsn', description: 'Detergents & washing preparations', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '39', kind: 'hsn', description: 'Plastics & articles thereof', gstRate: 18 },
  { code: '3924', kind: 'hsn', description: 'Household & kitchen articles of plastics', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '42', kind: 'hsn', description: 'Leather articles & travel goods', gstRate: 18 },
  { code: '48', kind: 'hsn', description: 'Paper & paperboard', gstRate: 5 },
  { code: '4820', kind: 'hsn', description: 'Notebooks, registers & paper stationery', gstRate: 0, legacyRate: 12, wef: '2025-09-22' },
  { code: '49', kind: 'hsn', description: 'Printed books, newspapers & pictures', gstRate: 0 },
  { code: '9609', kind: 'hsn', description: 'Pencils & crayons', gstRate: 0, legacyRate: 12, wef: '2025-09-22' },
  { code: '4010', kind: 'hsn', description: 'Erasers', gstRate: 0, legacyRate: 5, wef: '2025-09-22' },

  // ── Textiles, apparel & footwear ─────────────────────────────────
  { code: '52', kind: 'hsn', description: 'Cotton & cotton fabrics', gstRate: 5 },
  { code: '54', kind: 'hsn', description: 'Man-made filament yarn', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '61', kind: 'hsn', description: 'Knitted apparel (shirts, t-shirts)', gstRate: 5, threshold: 2500, altRate: 18, legacyRate: 5, wef: '2025-09-22' },
  { code: '62', kind: 'hsn', description: 'Woven apparel (sarees, kurtas, trousers)', gstRate: 5, threshold: 2500, altRate: 18, legacyRate: 5, wef: '2025-09-22' },
  { code: '63', kind: 'hsn', description: 'Made-ups (bed linen, towels, curtains)', gstRate: 5, threshold: 2500, altRate: 18, wef: '2025-09-22' },
  { code: '64', kind: 'hsn', description: 'Footwear', gstRate: 5, threshold: 2500, altRate: 18, legacyRate: 12, wef: '2025-09-22' },
  { code: '66', kind: 'hsn', description: 'Umbrellas & sunshades', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },

  // ── Metals, tools & hardware ─────────────────────────────────────
  { code: '72', kind: 'hsn', description: 'Iron & steel', gstRate: 18 },
  { code: '7214', kind: 'hsn', description: 'Steel bars & rods', gstRate: 18 },
  { code: '7323', kind: 'hsn', description: 'Household steel utensils & kitchenware', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '7615', kind: 'hsn', description: 'Household aluminium utensils', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '82', kind: 'hsn', description: 'Tools & hardware', gstRate: 18 },
  { code: '8205', kind: 'hsn', description: 'Hand tools (spanners, hammers)', gstRate: 18 },
  { code: '94', kind: 'hsn', description: 'Furniture, bedding & lighting', gstRate: 18 },

  // ── Electronics & machinery ──────────────────────────────────────
  { code: '84', kind: 'hsn', description: 'Machinery & mechanical appliances', gstRate: 18 },
  { code: '8415', kind: 'hsn', description: 'Air conditioners', gstRate: 18, legacyRate: 28, wef: '2025-09-22' },
  { code: '8450', kind: 'hsn', description: 'Washing machines', gstRate: 18, legacyRate: 28, wef: '2025-09-22' },
  { code: '85', kind: 'hsn', description: 'Electrical machinery & electronics', gstRate: 18 },
  { code: '8517', kind: 'hsn', description: 'Mobile phones & communication devices', gstRate: 18 },
  { code: '8528', kind: 'hsn', description: 'Televisions & monitors', gstRate: 18, legacyRate: 28, wef: '2025-09-22' },
  { code: '8536', kind: 'hsn', description: 'Electrical switches, plugs & fittings', gstRate: 18 },
  { code: '8712', kind: 'hsn', description: 'Bicycles', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '87', kind: 'hsn', description: 'Vehicles & auto parts (small cars, bikes ≤350cc)', gstRate: 18, legacyRate: 28, wef: '2025-09-22' },
  { code: '8703', kind: 'hsn', description: 'Motor cars (luxury/SUV → 40%)', gstRate: 18, altRate: 40, legacyRate: 28, wef: '2025-09-22' },

  // ── Health, gems & instruments ───────────────────────────────────
  { code: '30', kind: 'hsn', description: 'Pharmaceutical products', gstRate: 18 },
  { code: '3004', kind: 'hsn', description: 'Medicines (most; 33 life-saving drugs are nil)', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '90', kind: 'hsn', description: 'Optical, photographic & precision instruments', gstRate: 18 },
  { code: '9004', kind: 'hsn', description: 'Spectacles & corrective eyewear', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '9018', kind: 'hsn', description: 'Medical devices & instruments', gstRate: 5, legacyRate: 12, wef: '2025-09-22' },
  { code: '71', kind: 'hsn', description: 'Precious stones & metals', gstRate: 3 },
  { code: '7103', kind: 'hsn', description: 'Precious & semi-precious stones', gstRate: 3 },
  { code: '7113', kind: 'hsn', description: 'Gold & platinum jewellery', gstRate: 3 },

  // ── Services (SAC) ───────────────────────────────────────────────
  { code: '9963', kind: 'sac', description: 'Food & beverage services (restaurants)', gstRate: 5 },
  { code: '9961', kind: 'sac', description: 'Hotel & lodging (≤ ₹7,500/night)', gstRate: 5, threshold: 7500, altRate: 18, legacyRate: 12, wef: '2025-09-22' },
  { code: '9997', kind: 'sac', description: 'Health, wellness, salons, gyms & yoga', gstRate: 5, legacyRate: 18, wef: '2025-09-22' },
  { code: '9972', kind: 'sac', description: 'IT & software services', gstRate: 18 },
  { code: '9983', kind: 'sac', description: 'Professional & consulting services', gstRate: 18 },
  { code: '9987', kind: 'sac', description: 'Education & training services', gstRate: 0 },
]

/** Longest-prefix match: an 8-digit code resolves to its most specific row. */
export function lookupHsnRate(code: string): HsnRateEntry | null {
  const digits = String(code || '').replace(/\D/g, '')
  if (!digits) return null
  let best: HsnRateEntry | null = null
  for (const entry of HSN_RATE_ENTRIES) {
    if (digits.startsWith(entry.code) && (!best || entry.code.length > best.code.length)) {
      best = entry
    }
  }
  return best
}

export interface HsnSuggestion {
  rate: number
  entry: HsnRateEntry
  /** Why this rate — shown to the shopkeeper next to the suggestion. */
  basis: string
}

/**
 * Suggest a GST rate for an HSN/SAC, honouring value-based splits
 * (apparel ≤ ₹2,500 → 5%, above → 18%).
 */
export function suggestGstRate(code: string, unitPrice?: number | null): HsnSuggestion | null {
  const entry = lookupHsnRate(code)
  if (!entry) return null
  const price = unitPrice === undefined || unitPrice === null ? null : Number(unitPrice)
  if (entry.threshold !== undefined && entry.altRate !== undefined && price !== null && Number.isFinite(price)) {
    if (price > entry.threshold) {
      return {
        rate: entry.altRate,
        entry,
        basis: `${entry.description}: above ₹${entry.threshold.toLocaleString('en-IN')} per piece → ${entry.altRate}%`,
      }
    }
    return {
      rate: entry.gstRate,
      entry,
      basis: `${entry.description}: up to ₹${entry.threshold.toLocaleString('en-IN')} per piece → ${entry.gstRate}%`,
    }
  }
  const change = entry.wef === '2025-09-22' && entry.legacyRate !== undefined
    ? ` (was ${entry.legacyRate}% before 22 Sep 2025)`
    : ''
  return { rate: entry.gstRate, entry, basis: `${entry.description}${change}` }
}
