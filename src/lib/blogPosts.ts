// ────────────────────────────────────────────────────────────────
// Blog content. Practical, India-relevant, fact-checked notes for
// shopkeepers. No invented statistics, customers or claims — where
// Cashiea is mentioned, only shipped behaviour is described.
// ────────────────────────────────────────────────────────────────

export interface BlogPost {
  slug: string
  title: string
  summary: string
  date: string // ISO
  readMinutes: number
  tag: string
  body: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'what-a-gst-invoice-must-contain',
    title: 'What a GST tax invoice must contain (Rule 46, in plain language)',
    summary:
      'The fields a tax invoice needs under the CGST Rules — heading, GSTIN, HSN, tax split, place of supply — explained for shopkeepers, not lawyers.',
    date: '2026-08-24',
    readMinutes: 5,
    tag: 'GST',
    body: `
When a customer asks for a "proper GST bill", what exactly makes it proper? The answer lives in **Rule 46 of the CGST Rules**, and most of it is common sense once you see it in one list.

A tax invoice generally needs:

- The words **TAX INVOICE** and a sequential invoice number you don't reuse.
- Your **name, address and GSTIN**, and the date of issue.
- The **customer's name, address and GSTIN** when they are registered.
- A description of goods with **HSN codes** (how many digits depends on your turnover slab — your CA will tell you yours).
- **Quantity** and the value of the supply.
- The tax charged, split as **CGST + SGST** for a sale inside your state, or **IGST** for a sale to another state — which is why the *place of supply* matters.
- A note on **reverse charge** if it applies, and your **signature** (digital counts).

Two mistakes we see often in small shops: printing IGST on an in-state sale because the software defaulted wrong, and invoices without the amount in words — not strictly a Rule-46 line for every bill, but buyers' accounts teams love it and it prevents tampering arguments.

This is exactly the checklist Cashiea's invoice builder follows: HSN per line, the right CGST/SGST or IGST split from the place of supply, amount in words, signature line and a UPI QR for payment. The machine remembers the rulebook so you don't have to.

*GST has real edge cases — composition scheme, reverse charge, e-invoicing thresholds. This note is orientation, not advice; confirm specifics with your CA.*`,
  },
  {
    slug: 'ten-minute-closing-routine',
    title: 'A 10-minute closing routine for your shop',
    summary:
      'The daily habit that catches leaks: count the drawer against what the system expects, note the variance, glance at dues and tomorrow’s low stock.',
    date: '2026-09-02',
    readMinutes: 4,
    tag: 'Shop management',
    body: `
Most shop leaks are small. ₹200 of wrong change here, a forgotten udhaar there. Individually invisible; yearly, a festival's profit. The fix is not discipline — it's a routine short enough that you actually do it.

**Minutes 1–3: count the drawer against the expected number.** Not against memory. If your billing system records cash sales, it can tell you what *should* be in the drawer. The difference — the variance — is the whole point. Some days it's zero; the day it isn't, you find out while the day is still fresh.

**Minutes 4–6: walk the shelves you sold from.** Today's best sellers are tomorrow's stockouts. You don't need a forecast; you need to see that the cooking oil shelf is two bottles deep and reorder before the weekend.

**Minutes 7–9: glance at dues.** Who crossed a week? A polite reminder now is the difference between money and a story.

**Minute 10: write tomorrow's one note.** One sentence: "order oil, call Sharma ji, keep change for morning rush." Shops run on these notes.

Cashiea compresses this routine: the end-of-day flow computes expected cash and flags the variance, the daily WhatsApp report lists top items, dues and stock alerts, and Meraj drafts the reminders. But even on paper, ten minutes at closing is the cheapest insurance in retail.`,
  },
  {
    slug: 'reorder-levels-without-guesswork',
    title: 'Reorder levels without guesswork',
    summary:
      'How fast does it sell, how long does a refill take? Two numbers that turn "I think we have some" into a reorder level.',
    date: '2026-09-07',
    readMinutes: 4,
    tag: 'Inventory',
    body: `
"Low stock" is not a feeling; it's arithmetic. You need two numbers per product:

1. **Daily velocity** — how many units you sell on an ordinary day. Last month's sales divided by 30 is a fine estimate for staples.
2. **Lead time** — how many days between "I ordered" and "it's on the shelf". For most distributors in a town market, 2–4 days; for slow movers from outside the district, a week or more.

Your **reorder level** is then simply:

*velocity × lead time, plus a small buffer for busy days.*

Sell 5 packets a day and refills take 3 days? Reorder at 15–20, not at 3. The buffer is the difference between "arrived just in time" and "sold out all weekend".

Review the levels quarterly: festivals shift velocity, and a product that sold 3 a day in summer may sell 8 a day in wedding season.

This is the same math Cashiea's auto-reorder screen runs on your real sales history — it proposes reorder quantities from recent velocity, and you approve before anything is ordered. Thresholds from data beat thresholds from mood.`,
  },
]

export function blogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug)
}
