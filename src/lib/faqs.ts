// ────────────────────────────────────────────────────────────────
// faqs — the questions shown on the landing and pricing pages.
//
// Kept in a plain data module (no JSX, no React import) so the same
// answers can be (a) rendered in the accordions, (b) emitted as
// FAQPage JSON-LD for Google rich results / AI Overviews, and
// (c) baked into the prerendered HTML by scripts/prerender.mjs.
// Answers must describe shipped behaviour only.
// ────────────────────────────────────────────────────────────────

export interface Faq {
  q: string
  a: string
}

export const LANDING_FAQS: Faq[] = [
  {
    q: 'What is Cashiea?',
    a: 'Cashiea is an AI-powered POS and shop-management app for small Indian businesses. It handles counter billing, GST invoices, khata (udhaar), stock and customers, sends daily WhatsApp reports, and includes Meraj — an AI shop manager you can talk to in 10 Indian languages.',
  },
  {
    q: 'Do I need technical knowledge?',
    a: 'No. Setup takes 5 minutes — enter your shop name, add products (or import your whole list from a CSV), and you are ready to bill.',
  },
  {
    q: 'How much does Cashiea cost?',
    a: 'Start free for 14 days with 50 AI actions — no card required. After that, Premium is ₹8,000 per month with unlimited billing, WhatsApp reports, payment reminders and team accounts. No setup fee, no lock-in, cancel anytime.',
  },
  {
    q: 'Is my data safe?',
    a: 'Your data is encrypted in transit, hosted in India, and protected by row-level security — each shop can only see its own records. We follow India’s DPDP Act 2023 and never sell your data.',
  },
  {
    q: 'Does Cashiea work offline?',
    a: 'Yes. Keep billing during internet cuts — sales are saved on your device and sync automatically when you reconnect, with a visible sync status.',
  },
  {
    q: 'Can Meraj really replace a manager?',
    a: 'Meraj handles about 90% of a manager’s daily work — reports, follow-ups, stock watches, payment chasing, reconciliation — and asks you before anything goes out. The 10% that needs you stays yours: decisions, relationships, and the shop floor.',
  },
  {
    q: 'Which languages does Meraj understand?',
    a: 'Voice and chat in Hindi/Hinglish, English and 8 more Indian languages — Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam and Punjabi.',
  },
  {
    q: 'What about my GST invoices?',
    a: 'Cashiea creates Rule-46 compliant tax invoices — TAX INVOICE heading, HSN codes, CGST/SGST or IGST split, amount in words, place of supply and signature. For GST specifics, Meraj gives general guidance and reminds you to confirm with your CA.',
  },
  {
    q: 'Which kinds of shops is Cashiea built for?',
    a: 'Counter-based retail: kirana and general stores, hardware, medical and pharmacy, garments and footwear, electronics, stationery, bakeries and salons — especially in Tier 2 and Tier 3 cities.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No lock-in contracts, no setup fees, no hidden charges. Cancel from your dashboard.',
  },
]

export const PRICING_FAQS: Faq[] = [
  {
    q: 'Can I try it before paying?',
    a: 'Yes — the ₹0 plan is your 14-day trial with 50 AI actions. No card required.',
  },
  {
    q: 'How much is Cashiea after the trial?',
    a: 'Premium is ₹8,000 per month. It includes unlimited billing, 10,000 AI actions, WhatsApp daily reports, payment reminders, priority AI and multi-user team accounts.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No lock-in contracts, no setup fees, no hidden charges. Cancel from your dashboard.',
  },
  {
    q: 'Any setup fees?',
    a: 'None. One price per plan, everything listed included. GST as applicable.',
  },
]
