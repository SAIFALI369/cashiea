/**
 * GST calculation for Indian invoices — HSN codes, CGST/SGST/IGST split,
 * and multi-rate GST (0%, 5%, 12%, 18%, 28%).
 */

export interface GstLineItem {
  name: string
  hsnCode?: string | null
  gstRate: number  // 0, 5, 12, 18, 28
  quantity: number
  unitPrice: number // pre-tax price
}

export interface GstCalculation {
  items: (GstLineItem & { taxableValue: number; cgst: number; sgst: number; igst: number; total: number })[]
  subtotal: number       // sum of taxable values
  totalCgst: number
  totalSgst: number
  totalIgst: number
  totalTax: number
  grandTotal: number
  hsnSummary: { hsn: string; rate: number; taxable: number; cgst: number; sgst: number; igst: number }[]
}

/**
 * Calculate GST for a set of line items.
 * @param items Line items with pre-tax prices and GST rates
 * @param isInterstate true if buyer is in a different state than the seller (IGST applies)
 */
export function calculateGst(items: GstLineItem[], isInterstate = false): GstCalculation {
  const calculated = items.map((item) => {
    const taxableValue = item.quantity * item.unitPrice
    const taxAmount = (taxableValue * item.gstRate) / 100
    const cgst = isInterstate ? 0 : taxAmount / 2
    const sgst = isInterstate ? 0 : taxAmount / 2
    const igst = isInterstate ? taxAmount : 0
    const total = taxableValue + taxAmount
    return { ...item, taxableValue, cgst, sgst, igst, total }
  })

  const subtotal = calculated.reduce((s, i) => s + i.taxableValue, 0)
  const totalCgst = calculated.reduce((s, i) => s + i.cgst, 0)
  const totalSgst = calculated.reduce((s, i) => s + i.sgst, 0)
  const totalIgst = calculated.reduce((s, i) => s + i.igst, 0)
  const totalTax = totalCgst + totalSgst + totalIgst
  const grandTotal = subtotal + totalTax

  // HSN summary (unique HSN + rate combinations)
  const hsnMap = new Map<string, GstCalculation['hsnSummary'][0]>()
  for (const item of calculated) {
    const hsn = item.hsnCode || ''
    const key = `${hsn}-${item.gstRate}`
    if (!hsnMap.has(key)) {
      hsnMap.set(key, { hsn, rate: item.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 })
    }
    const entry = hsnMap.get(key)!
    entry.taxable += item.taxableValue
    entry.cgst += item.cgst
    entry.sgst += item.sgst
    entry.igst += item.igst
  }

  return {
    items: calculated,
    subtotal: round2(subtotal),
    totalCgst: round2(totalCgst),
    totalSgst: round2(totalSgst),
    totalIgst: round2(totalIgst),
    totalTax: round2(totalTax),
    grandTotal: round2(grandTotal),
    hsnSummary: Array.from(hsnMap.values()),
  }
}

/** Round to 2 decimal places */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Common HSN codes for quick reference */
export const COMMON_HSN = {
  'Rice': '1006',
  'Wheat flour': '1101',
  'Milk': '0401',
  'Medicines': '3004',
  'Medical devices': '9018',
  'Paint': '3209',
  'Cement': '2523',
  'Steel/iron': '7214',
  'Electrical goods': '8536',
  'Mobile phones': '8517',
  'Clothing': '6109',
  'Footwear': '6403',
  'Cosmetics': '3304',
  'Soap': '3401',
  'Books': '4901',
  'Furniture': '9403',
  'Hardware tools': '8205',
  'Electronics': '8528',
  'Plastic goods': '3926',
  'Paper products': '4820',
}

/** Standard GST rates for common categories */
export const GST_RATES = [0, 5, 12, 18, 28] as const
export type GstRate = (typeof GST_RATES)[number]
