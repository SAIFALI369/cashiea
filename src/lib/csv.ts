// ════════════════════════════════════════════════════════════════
// CSV engine for the product importer — RFC-4180-style parsing,
// column auto-mapping, row validation (duplicate SKUs, bad prices,
// invalid HSN/GST) and the downloadable template. Pure functions,
// fully unit-tested.
// ════════════════════════════════════════════════════════════════

import type { Product } from './types'

// ─── Parsing ─────────────────────────────────────────────────────

export interface CsvParseResult {
  headers: string[]
  rows: string[][]
  /** File-level problems (unterminated quote, etc.). */
  errors: string[]
}

/**
 * Parse CSV text: quoted fields, escaped quotes (""), commas and
 * newlines inside quotes, CRLF or LF line endings, BOM.
 */
export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = []
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const pushField = () => { row.push(field); field = '' }
  const pushRow = () => {
    // Skip rows that are entirely empty (blank lines / stray commas).
    if (row.some((c) => c.trim() !== '')) rows.push(row)
    row = []
  }

  while (i < src.length) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += ch; i++; continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === ',') { pushField(); i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') { pushField(); pushRow(); i++; continue }
    field += ch; i++
  }
  // Final field/row (file without trailing newline).
  if (field !== '' || row.length > 0) { pushField(); pushRow() }
  if (inQuotes) errors.push('File ended inside an open quote — check the last rows.')

  const headers = rows.length ? rows[0].map((h) => h.trim()) : []
  return { headers, rows: rows.slice(1), errors }
}

/** Escape one CSV field (quotes/doubles on demand). */
export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ─── Column mapping ──────────────────────────────────────────────

export type ProductCsvField =
  | 'name' | 'sku' | 'category' | 'price' | 'cost' | 'stock_quantity'
  | 'low_stock_threshold' | 'hsn_code' | 'gst_rate' | 'description'

export const PRODUCT_CSV_FIELDS: { key: ProductCsvField; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'sku', label: 'SKU' },
  { key: 'category', label: 'Category' },
  { key: 'price', label: 'Price (₹)' },
  { key: 'cost', label: 'Cost (₹)' },
  { key: 'stock_quantity', label: 'Stock quantity' },
  { key: 'low_stock_threshold', label: 'Low-stock alert at' },
  { key: 'hsn_code', label: 'HSN code' },
  { key: 'gst_rate', label: 'GST rate %' },
  { key: 'description', label: 'Description' },
]

export type ProductMapping = Partial<Record<ProductCsvField, string | null>>

const HEADER_ALIASES: Partial<Record<ProductCsvField, string[]>> = {
  name: ['name', 'product', 'product name', 'item', 'item name', 'title', 'naam'],
  sku: ['sku', 'code', 'item code', 'product code', 'barcode'],
  category: ['category', 'cat', 'type', 'department'],
  price: ['price', 'mrp', 'selling price', 'sale price', 'rate', 'price (₹)', 'selling_price'],
  cost: ['cost', 'purchase price', 'buy price', 'buying price', 'cost price', 'cp'],
  stock_quantity: ['stock', 'stock quantity', 'quantity', 'qty', 'inventory', 'stock qty', 'opening stock', 'qty in stock', 'stock in hand', 'current stock'],
  low_stock_threshold: ['low stock', 'low stock alert', 'low_stock_threshold', 'low stock alert at', 'min stock'],
  hsn_code: ['hsn', 'hsn code', 'hsn/sac', 'hsn sac'],
  gst_rate: ['gst', 'gst rate', 'gst %', 'gst rate %', 'tax', 'tax rate'],
  description: ['description', 'details', 'notes'],
}

/** Guess the mapping from header names to Cashiea product fields. */
export function autoMapHeaders(headers: string[]): ProductMapping {
  const mapping: ProductMapping = {}
  const used = new Set<string>()
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [ProductCsvField, string[]][]) {
    const found = headers.find((h) => {
      const clean = h.trim().toLowerCase()
      return !used.has(h) && (aliases.includes(clean) || aliases.some((a) => clean === a || clean.replace(/[^a-z]/g, '') === a.replace(/[^a-z]/g, '')))
    })
    if (found !== undefined) { mapping[field] = found; used.add(found) }
  }
  return mapping
}

// ─── Row validation ──────────────────────────────────────────────

export interface ImportProductRow {
  index: number          // 1-based row number as shown to the user
  raw: Record<string, string>
  product: {
    name: string
    sku: string | null
    category: string
    price: number
    cost: number
    stock_quantity: number
    low_stock_threshold: number
    hsn_code: string | null
    gst_rate: number
    description: string | null
  } | null
  errors: string[]
  warnings: string[]
}

const GST_RATES = [0, 5, 12, 18, 28]

/**
 * Validate every row BEFORE anything is imported:
 *   • name required, price required and ≥ 0
 *   • stock / low-stock numbers ≥ 0
 *   • GST must be a real slab, HSN 2–8 digits
 *   • duplicate SKUs inside the file → error
 *   • SKUs that already exist in the catalog → warning (row skipped)
 */
export function validateProductRows(
  rows: string[][],
  mapping: ProductMapping,
  headers: string[],
  existingSkus: Set<string>,
  existingCategories: string[] = [],
): ImportProductRow[] {
  const seenSkus = new Map<string, number>()

  const cell = (row: string[], field: ProductCsvField): string => {
    const col = mapping[field]
    if (!col) return ''
    const idx = headers.indexOf(col)
    return idx >= 0 && idx < row.length ? (row[idx] ?? '').trim() : ''
  }

  return rows.map((row, i) => {
    const errors: string[] = []
    const warnings: string[] = []
    const raw: Record<string, string> = {}
    headers.forEach((h, idx) => { raw[h] = row[idx] ?? '' })

    const name = cell(row, 'name')
    const sku = cell(row, 'sku')
    const categoryRaw = cell(row, 'category')
    const priceStr = cell(row, 'price')
    const costStr = cell(row, 'cost')
    const stockStr = cell(row, 'stock_quantity')
    const lowStr = cell(row, 'low_stock_threshold')
    const hsn = cell(row, 'hsn_code')
    const gstStr = cell(row, 'gst_rate')
    const description = cell(row, 'description')

    if (!name) errors.push('Name is missing')

    const price = Number(priceStr)
    if (priceStr === '') errors.push('Price is missing')
    else if (!Number.isFinite(price) || price < 0) errors.push(`Price "${priceStr}" is not a valid amount`)

    const cost = costStr === '' ? 0 : Number(costStr)
    if (costStr !== '' && (!Number.isFinite(cost) || cost < 0)) errors.push(`Cost "${costStr}" is not a valid amount`)

    const stock = stockStr === '' ? 0 : Number(stockStr)
    if (stockStr !== '' && (!Number.isFinite(stock) || stock < 0)) errors.push(`Stock "${stockStr}" is not a valid quantity`)

    const low = lowStr === '' ? 5 : Number(lowStr)
    if (lowStr !== '' && (!Number.isFinite(low) || low < 0)) errors.push(`Low-stock "${lowStr}" is not a valid quantity`)

    let gst = 0
    if (gstStr !== '') {
      gst = Number(gstStr)
      if (!Number.isFinite(gst) || !GST_RATES.includes(gst)) errors.push(`GST "${gstStr}" must be one of 0, 5, 12, 18, 28`)
    }

    if (hsn && !/^\d{2,8}$/.test(hsn)) errors.push(`HSN "${hsn}" must be 2–8 digits`)

    if (sku) {
      const lowerSku = sku.toLowerCase()
      const firstSeen = seenSkus.has(lowerSku) ? seenSkus.get(lowerSku)! : null
      if (firstSeen !== null && firstSeen !== i) {
        errors.push(`Duplicate SKU "${sku}" — also on row ${firstSeen + 1}`)
      } else if (existingSkus.has(lowerSku)) {
        warnings.push(`SKU "${sku}" already exists in your catalog — this row will be skipped`)
      }
      if (firstSeen === null) seenSkus.set(lowerSku, i)
    }

    const product = errors.length ? null : {
      name,
      sku: sku || null,
      category: categoryRaw ? normalizeCategoryLocal(categoryRaw, existingCategories) : 'general',
      price: Number(price.toFixed(2)),
      cost: Number(cost.toFixed(2)),
      stock_quantity: stock,
      low_stock_threshold: low,
      hsn_code: hsn || null,
      gst_rate: gst,
      description: description || null,
    }

    return { index: i + 1, raw, product, errors, warnings }
  })
}


/** Same normalization rule as the manual form: reuse the existing spelling. */
function normalizeCategoryLocal(input: string, existing: string[]): string {
  const trimmed = input.trim().replace(/\s+/g, ' ')
  const lower = trimmed.toLowerCase()
  return existing.find((c) => (c || '').trim().toLowerCase() === lower) ?? trimmed
}

// ─── Template & export ───────────────────────────────────────────

/** The downloadable template — headers + two example rows. */
export function buildProductCsvTemplate(): string {
  const headers = PRODUCT_CSV_FIELDS.map((f) => f.label).join(',')
  const examples = [
    ['Basmati Rice 5kg', 'RICE-5', 'grocery', '520', '410', '25', '5', '1006', '5', 'Premium long grain'],
    ['Dettol Soap 125g', 'SOAP-125', 'personal care', '35', '27', '80', '10', '3401', '18', ''],
  ].map((r) => r.map(csvEscape).join(','))
  return [headers, ...examples].join('\r\n')
}

/** Serialize current products (catalog export / round-trip). */
export function productsToCsv(products: Product[]): string {
  const headers = PRODUCT_CSV_FIELDS.map((f) => f.label)
  const rows = products.map((p) => [
    p.name, p.sku || '', p.category, String(p.price), String(p.cost),
    String(p.stock_quantity), String(p.low_stock_threshold), p.hsn_code || '',
    String(p.gst_rate ?? 0), p.description || '',
  ].map(csvEscape).join(','))
  return [headers.join(','), ...rows].join('\r\n')
}
