# Cashiea — everything an Indian shop needs to run the business

**Cashiea** is a POS + CRM + AI business OS for Indian retail shops. It bills at the counter, keeps the khata, tracks stock and customers, collects via UPI, and comes with **Meraj** — an AI staff member who does ~90% of a manager's daily work: reports, follow-ups, stock watches, payment chasing, and reconciliation. Every action Meraj proposes waits for the owner's confirmation.

Live at **[cashiea.vercel.app](https://cashiea.vercel.app)**

---

## What's inside

### Counter & billing
- **New Sale (POS)** — fast product grid/list, barcode scanning (camera), **hold & resume carts**, split payments (cash + UPI + card with live change math), quick-quantity numpad, digital receipts (PDF / WhatsApp / print)
- **GST tax invoices** — Rule 46 CGST Rules compliant: TAX INVOICE heading, supplier + buyer GSTIN, HSN/SAC, CGST/SGST or IGST split, **amount in words**, place of supply, reverse-charge indicator, signature line, UPI QR
- **Khata (digital udhaar book)** — who owes what, payment reminders, settled history
- **Recurring invoices** — weekly/monthly/yearly profiles with pause/resume; a scheduled job generates them daily, duplicate-proof by database constraint
- **Offline-first** — keep billing through power cuts and dead zones; sales queue locally and sync on reconnect with a visible sync status

### Stock & customers
- Inventory with low-stock alerts, **multi-unit pricing** (per kg / 500 g / dozen) and **bulk CSV import** (column auto-mapping, duplicate-SKU detection, validation preview)
- Customer CRM with segments, spending history and dormant-regular detection
- Suppliers, purchase orders, quotations, expenses

### Meraj — the AI staff member
- Answers business questions from your **real data** (never hand-typed): "how was business today?", "who bought cement last month?", "which customers should I follow up?"
- **Acts, with approval** — creates invoices, adds products/customers in bulk, sends WhatsApp messages, generates images, syncs stock from Google Sheets — always prepare → confirm → execute
- **Voice in 10 Indian languages** (Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, English)
- Daily briefing at 7 AM, WhatsApp sales report at 8 PM, 9 PM intelligence prompts
- Knows Indian compliance: GST slabs, GSTIN state codes, Rule 46 invoice requirements, filing deadlines, presumptive taxation — with "confirm with your CA" honesty

### Reports & money
- AI reports auto-populated from your transactions/expenses/receivables/stock — **PDF and Excel (real .xlsx) export**, WhatsApp sharing
- End-of-day cash reconciliation (expected vs counted vs variance)
- Payment reminders and overdue automation (scheduled backend job)
- Multi-provider AI routing: Groq → Gemini fallback cascade, all free tiers

### Trust & compliance
- Row-level security on every table — one shop can never read another's data
- Privacy Policy aligned with the **DPDP Act 2023 + DPDP Rules 2025** (consent, data-principal rights, 72-hour breach commitment); Terms drafted for Indian law
- GSTIN checksum validation, HSN reference, state-code utilities

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind (semantic design tokens), framer-motion
- **Backend:** Supabase (Postgres + RLS + pg_cron + 24 edge functions), ap-south-1 (Mumbai)
- **AI:** Groq (primary) + Google Gemini (fallback) with a multi-pass patient cascade; function-calling tools for Meraj's actions
- **Integrations:** WhatsApp Cloud API, Google Sheets/Drive/Gmail, UPI deep links + QR, Pollination.ai (image gen), GNews
- **Testing:** Vitest (270+ tests — sale math, GST split, CSV engine, XLSX writer, compliance knowledge)

## Project layout

```
src/
  pages/          App screens (POS, Invoices, Khata, Reports, …)
  components/     Shared UI — pos/, products/, invoices/ flows
  lib/            Domain logic — pos (sale math), gst, csv, xlsx,
                  india-compliance (GST + DPDP knowledge), validation
supabase/
  functions/      Edge functions (ai-assistant, whatsapp-send, …)
  _shared/        AI routing cascade + India knowledge prompt
  schema-v*.sql   Versioned migrations (RLS everywhere)
```

## Local development

```bash
npm install
cp .env.example .env.local   # fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Tests: `npm test` · Build: `npm run build`

## Deployment

- **Frontend:** Vercel (auto on push to `main`; set the two `VITE_` env vars)
- **Edge functions:** GitHub Actions deploys `supabase/functions/**` on push
- **Database:** versioned SQL migrations in `supabase/`

> If login shows "We couldn't reach the sign-in service", check that Vercel's
> `VITE_SUPABASE_URL` is `https://prwvaetatdidsugczluv.supabase.co`, not the old
> `https://oxlwbxkifyrhggrsaoin.supabase.co` project (that ref no longer resolves,
> so auth fails even when the user's connection is fine).

---

Built for Indian retail. GST-aware, WhatsApp-native, offline-ready.
