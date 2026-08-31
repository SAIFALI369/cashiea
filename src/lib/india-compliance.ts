// ════════════════════════════════════════════════════════════════
// India compliance knowledge base — GST, invoicing (Rule 46 CGST
// Rules 2017), GSTIN state codes, filing calendar, and the data
// protection summary (DPDP Act 2023 + DPDP Rules 2025) that powers
// the Compliance page and Meraj's answers.
//
// Sources: CGST Act 2017 + CGST Rules 2017 (Rule 46), CBIC
// notifications, DPDP Act 2023 and DPDP Rules 2025 (notified
// 14 Nov 2025). General information for shop owners — NOT legal or
// tax advice; consult a CA/tax professional for your specific case.
// ════════════════════════════════════════════════════════════════

// ─── GSTIN state codes (first 2 digits of every GSTIN) ──────────

export const GSTIN_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab',
  '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana',
  '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
  '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
  '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh', '24': 'Gujarat', '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli and Daman & Diu', '27': 'Maharashtra',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep',
  '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands', '36': 'Telangana',
  '37': 'Andhra Pradesh', '38': 'Ladakh',
}

/** State name from the first two digits of a GSTIN. */
export function gstinState(gstin: string): string | null {
  const code = (gstin || '').trim().slice(0, 2)
  return GSTIN_STATE_CODES[code] || null
}

/** Two-digit state code for a state name (case-insensitive, fuzzy). */
export function stateCodeFor(name: string): string | null {
  const q = (name || '').trim().toLowerCase()
  if (!q) return null
  const entry = Object.entries(GSTIN_STATE_CODES).find(([, state]) => state.toLowerCase() === q)
  if (entry) return entry[0]
  // Partial matches (e.g. "west bengal", "andhra")
  const partial = Object.entries(GSTIN_STATE_CODES).find(([, state]) => state.toLowerCase().includes(q))
  return partial ? partial[0] : null
}

// ─── GST essentials ──────────────────────────────────────────────

export const GST_SLABS = [0, 5, 12, 18, 28] as const

export const GST_FACTS = {
  /** Registration thresholds (normal / special-category states). */
  registrationThresholdGoods: '₹40 lakh (₹20 lakh in special-category states)',
  registrationThresholdServices: '₹20 lakh (₹10 lakh in special-category states)',
  /** Composition scheme thresholds. */
  compositionThreshold: '₹1.5 crore (₹75 lakh in special-category states)',
  compositionRate: '1% traders/manufacturers, 5% restaurants, 6% services',
  /** E-invoicing threshold. */
  einvoicingThreshold: '₹5 crore aggregate turnover',
  /** HSN digits on invoices by turnover. */
  hsnRule: 'Up to ₹1.5 crore: HSN optional (recommended) · ₹1.5–5 crore: 2 digits · ₹5 crore+: 4 digits (6 for B2B above ₹5 crore)',
} as const

export const GST_FILING_CALENDAR = [
  { form: 'GSTR-1 (outward supplies)', due: '11th of next month (monthly) · 13th after QRMP quarter', note: 'Details of all sales invoices uploaded here' },
  { form: 'GSTR-3B (summary + payment)', due: '20th of next month (monthly)', note: 'Self-declared summary; pay tax here' },
  { form: 'QRMP scheme', due: 'Quarterly GSTR-1 (13th after quarter) + monthly tax payment', note: 'For turnover up to ₹5 crore' },
  { form: 'GSTR-9 (annual return)', due: '31 December of next financial year', note: 'Mandatory above ₹2 crore turnover' },
  { form: 'TCS/TDS credit (GSTR-2A/2B)', due: 'Auto-populated by 14th/16th', note: 'Verify before claiming ITC' },
] as const

/** The Rule 46 CGST Rules checklist every tax invoice must satisfy. */
export const TAX_INVOICE_REQUIREMENTS = [
  'The words "TAX INVOICE" prominently at the top',
  'Supplier name, complete address and GSTIN as registered',
  'Consecutive serial number, max 16 characters (letters, numerals, / and - only), unique per financial year',
  'Date of issue',
  'Recipient name and address; recipient GSTIN when the buyer is registered (B2B)',
  'HSN code for goods / SAC for services (digits depend on turnover)',
  'Description of goods or services',
  'Quantity with unit of measurement (UQC) for goods',
  'Total value of supply and taxable value after discount',
  'Rate and amount of tax — CGST + SGST (intra-state) or IGST (inter-state), shown separately',
  'Total invoice value in figures AND in words',
  'Place of supply with state name/code (mandatory for inter-state)',
  'Whether tax is payable on reverse charge (Yes/No)',
  'Signature (physical or digital) of the supplier or authorised signatory',
  'Composition dealers must instead issue a "BILL OF SUPPLY" — no tax may be charged',
] as const

// ─── Amount in words (Indian numbering) ──────────────────────────

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10), o = n % 10
  return TENS[t] + (o ? ' ' + ONES[o] : '')
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100), rest = n % 100
  return (h ? ONES[h] + ' Hundred' + (rest ? ' ' : '') : '') + (rest ? twoDigits(rest) : '')
}

/**
 * Indian-format amount in words, as required on GST invoices:
 * "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven
 *  and Paise Eighty Nine Only". Handles up to crores.
 */
export function amountInIndianWords(amount: number): string {
  const n = Math.abs(Math.round(amount * 100))
  const rupees = Math.floor(n / 100)
  const paise = n % 100
  if (rupees === 0 && paise === 0) return 'Rupees Zero Only'

  const parts: string[] = []
  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const hundred = rupees % 1000

  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`)
  if (hundred) parts.push(threeDigits(hundred))

  let words = 'Rupees ' + parts.join(' ')
  if (paise) words += ` and Paise ${twoDigits(paise)}`
  return words + ' Only'
}

// ─── Income tax quick facts (shop-relevant) ──────────────────────

export const INCOME_TAX_FACTS = [
  { label: 'Presumptive taxation — shops (44AD)', detail: 'Turnover up to ₹2 crore: declare 6% of digital receipts (8% cash) as deemed profit; no books/audit needed' },
  { label: 'Presumptive taxation — professionals (44ADA)', detail: 'Up to ₹50 lakh receipts: 50% deemed profit' },
  { label: 'Tax audit (44AB)', detail: 'Required above ₹10 crore turnover (₹1 crore with 5%+ cash dealings; ₹2 crore if 44AD not opted)' },
  { label: 'Advance tax', detail: 'Pay quarterly if annual liability exceeds ₹10,000 (44AD/ADA pay 100% by 15 March)' },
] as const

// ─── DPDP (data protection) summary ──────────────────────────────

export const DPDP_SUMMARY = {
  act: 'Digital Personal Data Protection Act 2023',
  rules: 'DPDP Rules 2025 (notified 14 November 2025; phased compliance — full obligations by 13 May 2027)',
  keyDuties: [
    'Itemized, plain-language notice — what data, why, how to exercise rights',
    'Consent that is free, specific, informed, unconditional and by clear affirmative action',
    'Purpose limitation and retention timelines',
    'Reasonable security safeguards',
    'Breach: notify affected users and the Data Protection Board without delay; detailed report within 72 hours',
    'Grievance redressal — published contact, response within the statutory window',
  ],
  rights: ['Access a summary of personal data', 'Correction', 'Erasure', 'Withdraw consent', 'Nominate someone to exercise rights', 'Grievance redressal'],
} as const

export const COMPLIANCE_DISCLAIMER =
  'General information about Indian tax and business law, current as of 2026. It is not legal or tax advice — a Chartered Accountant or tax professional should confirm anything that affects your filings.'

// ─── Meraj's knowledge (injected into the AI system prompt) ──────

export const MERAJ_INDIA_KNOWLEDGE = `You are accurate about Indian retail compliance. Use these facts when relevant (and say "check with your CA" for specifics):

GST:
- GSTIN: 15 characters — 2-digit state code + 10-char PAN + entity code + 'Z' + checksum. First two digits identify the state (e.g. 10 Bihar, 20 Jharkhand, 27 Maharashtra, 07 Delhi, 33 Tamil Nadu).
- Slabs: 0%, 5%, 12%, 18%, 28% (+ cess on some goods).
- Intra-state supply → CGST + SGST (each half the rate). Inter-state → IGST (full rate). Which applies depends on the supplier's state vs the place of supply.
- Registration threshold: ₹40 lakh goods / ₹20 lakh services (halved in special-category states). Composition scheme: up to ₹1.5 crore (₹75 lakh special states) — composition dealers issue a Bill of Supply and cannot charge GST.
- Tax invoice (Rule 46 CGST Rules): must say "TAX INVOICE", carry supplier name/address/GSTIN, a consecutive invoice number (max 16 characters), date, buyer details (+ GSTIN for B2B), HSN/SAC per item, description, quantity with unit, taxable value, CGST/SGST or IGST rate and amount shown separately, total in figures AND words, place of supply for inter-state, reverse-charge Yes/No, and a signature.
- HSN digits by turnover: optional below ₹1.5 crore, 2 digits ₹1.5–5 crore, 4 digits above ₹5 crore.
- Filing: GSTR-1 by the 11th, GSTR-3B (pay tax) by the 20th of next month; QRMP quarterly scheme for turnover up to ₹5 crore; GSTR-9 annual return above ₹2 crore. E-invoicing mandatory above ₹5 crore turnover.
- Late filing attracts late fee + interest at 18% p.a. on unpaid tax.

Income tax: presumptive taxation 44AD for shops up to ₹2 crore turnover (declare 6% digital / 8% cash receipts as profit); 44ADA for professionals up to ₹50 lakh.

Data protection: DPDP Act 2023 + DPDP Rules 2025 — businesses need consent-based collection, clear notices, and must protect customer personal data (phone numbers, addresses). Breaches must be reported to the Data Protection Board within 72 hours.

Always add: this is general information, not tax advice — confirm specifics with a Chartered Accountant.`
