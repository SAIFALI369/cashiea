import { buildUpiLink } from './payments'

/**
 * vasooli.ts — the "Vasooli Round" brain.
 *
 * Meraj's collection round: prepare a personalised payment reminder for every
 * customer with dues, show the owner the EXACT message before anything is
 * sent (never blind), and only then execute. Tone escalates with days
 * overdue; language is per-customer, set once.
 *
 * WhatsApp economics (design constraint, not a detail):
 * · Outside the 24-hour customer-service window, WhatsApp requires an
 *   APPROVED template with fixed variables — utility category (≈₹0.115/msg
 *   in India), NEVER marketing (≈₹0.86 — a 7-8x cost gap for no reason).
 * · So each (tier × language) here is written to be submittable as a
 *   utility template with slots {{name}}, {{amount}}, {{days}}, {{shop}},
 *   {{owner}}, {{upi_link}} — Meraj picks the tier and FILLS the variables
 *   instead of free-generating copy on every send.
 * · Inside the 24h window the same strings go as free-text.
 * · Rate cards change ~every 6 months — verify with the BSP before locking.
 */

export type VasooliTier = 'soft' | 'factual' | 'direct'
export type VasooliLanguage = 'hinglish' | 'hindi' | 'bhojpuri' | 'english'

/** Tier by days overdue — the owner's judgment, encoded:
 *  0-7 soft convenience nudge · 8-20 neutral + factual + UPI ·
 *  20+ direct but respectful, signed by the owner — never a collections agency. */
export function vasooliTier(daysOverdue: number): VasooliTier {
  const d = Math.max(0, Math.floor(daysOverdue || 0))
  if (d <= 7) return 'soft'
  if (d <= 20) return 'factual'
  return 'direct'
}

export interface VasooliDebt {
  customerId: string
  customerName: string
  phone: string
  amount: number
  daysOverdue: number
  invoiceNumbers?: string[]
}

export interface VasooliDraft extends VasooliDebt {
  tier: VasooliTier
  language: VasooliLanguage
  upiLink: string
  message: string
  skipped?: false
}

export interface VasooliOptions {
  shopName: string
  ownerName: string
  upiId: string
  /** Customers the owner flagged "don't chase yet" — trust beats automation. */
  skipCustomerIds?: string[]
  /** Per-customer language, set once (falls back to hinglish). */
  languageFor?: (customerId: string) => VasooliLanguage | undefined
  /** Choose a variant per (tier × language) — room for the 3-4 approved
   *  template variants per language; default 0. */
  variantFor?: (d: VasooliDebt, tier: VasooliTier, lang: VasooliLanguage) => number
}

const rs = (n: number) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

/** Message templates. No exclamation marks, no hype — an employee writes,
 *  not a marketer. Variables in {{slots}} so the exact strings can be filed
 *  as utility templates with the BSP. */
const TEMPLATES: Record<VasooliLanguage, Record<VasooliTier, string[]>> = {
  hinglish: {
    soft: [
      'Namaste {{name}} ji. Aapka {{shop}} mein {{amount}} baaki hai ({{days}} din). Jab time mile, yahan se seedha pay kar sakte hain: {{upi_link}}. Dhanyavaad.',
    ],
    factual: [
      '{{name}} ji, {{shop}} par aapka {{amount}} ka bill {{days}} din se baaki hai. Aadhar ke liye yeh amount pending hai. Yahan se pay kar sakte hain: {{upi_link}}. Jodi khatam karne ke liye kripya jaldi karein.',
    ],
    direct: [
      '{{name}} ji, {{shop}} se {{amount}} {{days}} din se pending hai — yeh dukaan ke liye bada amount hai. Kripya is hafte clear kar dein: {{upi_link}}. Aapka apna, {{owner}}.',
    ],
  },
  hindi: {
    soft: [
      'नमस्ते {{name}} जी। {{shop}} में आपका {{amount}} बाकी है ({{days}} दिन)। सुविधा के लिए यहाँ से सीधे भुगतान कर सकते हैं: {{upi_link}}। धन्यवाद।',
    ],
    factual: [
      '{{name}} जी, {{shop}} पर आपका {{amount}} का बिल {{days}} दिन से बाकी है। कृपया निपटान करें: {{upi_link}}।',
    ],
    direct: [
      '{{name}} जी, {{shop}} से {{amount}} {{days}} दिन से लंबित है। कृपया इस सप्ताह समाप्त कर दें: {{upi_link}}। आपका अपना, {{owner}}।',
    ],
  },
  bhojpuri: {
    soft: [
      'प्रणाम {{name}} जी। {{shop}} में आपहिं के {{amount}} बाकी बा ({{days}} दिन)। जब सुबह होखी, इहाँ से सीधे भुगतान कर सकत हईं: {{upi_link}}। धन्यबाद।',
    ],
    factual: [
      '{{name}} जी, {{shop}} पर आपहिं के {{amount}} के बिल {{days}} दिन से बाकी बा। कृपया जल्दी निपटाईं: {{upi_link}}।',
    ],
    direct: [
      '{{name}} जी, {{shop}} से {{amount}} {{days}} दिन से लंबित बा — दुकान बदे ई बड़ी रकम बा। एही हफ्ता साफ कर दीं: {{upi_link}}। आपहिं के अपना, {{owner}}।',
    ],
  },
  english: {
    soft: [
      'Hello {{name}} — a gentle note that {{amount}} is pending at {{shop}} ({{days}} days). You can pay directly from here whenever convenient: {{upi_link}}. Thank you.',
    ],
    factual: [
      '{{name}}, your bill of {{amount}} at {{shop}} has been pending for {{days}} days. Kindly settle it here: {{upi_link}}.',
    ],
    direct: [
      '{{name}}, {{amount}} has now been pending at {{shop}} for {{days}} days. Please clear it this week: {{upi_link}}. — {{owner}}',
    ],
  },
}

/** Fill a template's {{slots}} — this is all Meraj customises on outbound
 *  template sends (the wording stays the approved, filed one). */
export function fillTemplate(tpl: string, v: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '')
}

/** Prepare the full round: one draft per debtor, tiered, per-customer
 *  language, UPI deep-link, owner-approved before anything sends. */
export function prepareVasooliRound(debts: VasooliDebt[], opts: VasooliOptions): VasooliDraft[] {
  const skip = new Set(opts.skipCustomerIds || [])
  return debts
    .filter((d) => !skip.has(d.customerId) && d.phone && d.amount > 0)
    .map((d) => {
      const tier = vasooliTier(d.daysOverdue)
      const language = opts.languageFor?.(d.customerId) || 'hinglish'
      const variant = Math.max(0, opts.variantFor?.(d, tier, language) || 0)
      const variants = TEMPLATES[language][tier]
      const tpl = variants[variant % variants.length]
      const upiLink = buildUpiLink({
        payeeVpa: opts.upiId,
        payeeName: opts.shopName,
        amount: d.amount,
        note: d.invoiceNumbers?.length ? `Bill ${d.invoiceNumbers[0]}` : 'Payment',
      })
      const message = fillTemplate(tpl, {
        name: d.customerName,
        amount: rs(d.amount),
        days: String(Math.max(0, Math.floor(d.daysOverdue || 0))),
        shop: opts.shopName,
        owner: opts.ownerName,
        upi_link: upiLink,
      })
      return { ...d, tier, language, upiLink, message }
    })
    .sort((a, b) => b.amount - a.amount) // biggest money first for the owner's eye
}

/** Summary line for the confirm screen: "6 messages ready · 2 skipped · Rs. 8,450 total". */
export function vasooliSummary(drafts: VasooliDraft[], skippedCount: number): string {
  const total = drafts.reduce((s, d) => s + d.amount, 0)
  return `${drafts.length} message${drafts.length === 1 ? '' : 's'} ready · ${skippedCount} skipped · ${rs(total)} total`
}
