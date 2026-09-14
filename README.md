# Cashiea — everything an Indian shop needs to run the business

**Cashiea** is a POS + CRM + AI business OS for Indian retail shops. It bills at the counter, keeps the khata, tracks stock and customers, collects via UPI, and comes with **Meraj** — an AI staff member who does ~90% of a manager's daily work: reports, follow-ups, stock watches, payment chasing, and reconciliation. Every action Meraj proposes waits for the owner's confirmation.

Live at **[cashiea.vercel.app](https://cashiea.vercel.app)**

---

## What's inside

### Counter & billing
- **New Sale (POS)** — fast product grid/list, barcode scanning (camera), **hold & resume carts**, split payments (cash + UPI + card with live change math), quick-quantity numpad, digital receipts (PDF / WhatsApp / print)
- **GST tax invoices** — Rule 46 CGST Rules compliant: TAX INVOICE heading, supplier + buyer GSTIN, HSN/SAC, CGST/SGST or IGST split, **amount in words**, place of supply, reverse-charge indicator, signature line, UPI QR. An **HSN → GST rate master** (`lib/hsnRates.ts` + `schema-v38`) suggests the current rate (GST 2.0, 22-Sep-2025) from the HSN code, honouring value-based splits like apparel ≤ ₹2,500 → 5% / above → 18%
- **WhatsApp billing commands** (opt-in, Settings → AI) — text *"Add 50 notebooks at ₹25"* from the owner's/staff's WhatsApp number: a deterministic parser (no AI tokens, fully unit-tested) matches the catalogue, creates the GST invoice, replies with the bill + UPI link and pushes a live card to the dashboard (`_shared/order-parser.ts`, `whatsapp-webhook`, `schema-v40`)
- **Khata (digital udhaar book)** — who owes what, payment reminders, settled history
- **Deals & promotions engine** (`/app/promotions`) — BOGO (buy X get Y at % off, by product or category), tiered spend discounts ("spend ₹1000 → 10%") and simple percent-off with an optional cap. Rules have start/end windows, pausable, never stack, capped at cart value, and **auto-apply at the POS counter** — the cashier sees a live "Deal applied" banner and each line's discount is recorded on the bill with the rule name
- **Loyalty program** (schema v41) — points on every billed sale (e.g. 1 pt per ₹100), redeemable as rupees at the counter with a minimum-redemption guard; Bronze → Platinum lifetime tiers. Owner configures it on the Customers page; the POS can apply points to a sale in one tap and records the redemption against the receipt (idempotent by reference). Earning is a database trigger — works even if the tab was offline
- **Abandoned-cart recovery** — held carts that cool past 2 hours (and are worth chasing) surface on the Dashboard with a one-tap WhatsApp follow-up drafted for you; no phone on the cart, no nudge
- **Workforce: shift clock & commission** (schema v42/43) — staff clock in/out at Team with break-minute deduction; the owner sets commission % per staff and sees a 30-day table of sales, revenue, hours, revenue/hour and estimated commission (from the "served by" name on each bill)
- **Recurring invoices** — weekly/monthly/yearly profiles with pause/resume; a scheduled job generates them daily, duplicate-proof by database constraint
- **Offline-first** — keep billing through power cuts and dead zones; sales queue locally and sync on reconnect with a visible sync status

### Stock & customers
- Inventory with low-stock alerts, **multi-unit pricing** (per kg / 500 g / dozen) and **bulk CSV import** (column auto-mapping, duplicate-SKU detection, validation preview)
- **Sale-time stock alerts** — the moment a bill pushes an item at/below its threshold, `complete_sale` (schema v39) writes a `stock_alert` into `automation_events`, which the realtime publication pushes to every logged-in device as a live card
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
- **Tally export** (`/app/tally-export`) — invoices, POS sales, receipts and expenses as a **Tally import XML** (TallyPrime / ERP 9): party ledgers with GSTIN, stock items with HSN + GST rate, explicit CGST/SGST/IGST ledger lines and round-off so every voucher balances to the paisa. One file, `Gateway of Tally → Import → Vouchers`
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
- **Testing:** Vitest (854 tests — sale math, GST split, CSV engine, XLSX writer, Tally XML, WhatsApp order parser, HSN rate master, compliance knowledge, error-tracking pipeline); CI gates on lint + type-check + coverage thresholds + build + bundle size

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

## Production operations

See `docs/PRODUCTION_AUDIT.md` for the full audit, prioritized gap list and
remaining sprints. Current state:

- **Security headers** — CSP (`script-src 'self'` — no inline scripts; the
  no-flash theme bootstrap lives in `public/theme-init.js`), HSTS (preload),
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy` — all set in `vercel.json`.
- **Error tracking** — `src/lib/errorTracking.ts` captures uncaught errors,
  unhandled rejections, boundary crashes and auth failures; reports are
  deduped, rate-limited (40/session, 6/min), truncated and batched into the
  `client_errors` table (DDL: `supabase/schema-v33-client-errors.sql` —
  insert-only for the user's own id, service-role-only reads). `src/lib/logger.ts`
  gives every log line a request id that rotates per page view and is sent as
  `X-Request-Id` on AI calls, so a production error correlates with its logs.
- **Rate limiting** — per-user sliding-window burst limits (Postgres-backed,
  `schema-v34-rate-limits.sql`) on the expensive AI functions: `ai-assistant`
  10/60 s, `quick-tasks` 5/60 s, `business-brain` 5/60 s, `meraj-tts` 10/60 s,
  on top of the existing daily AI quota. Limiters fail open on their own
  errors; 429 responses carry `Retry-After`.
- **CI gates** — `npm audit` (high+ fails) → ESLint (0 errors) → `tsc` →
  vitest with coverage thresholds (regression floors in `vitest.config.ts`) →
  build → per-chunk bundle-size report (fail > 700 kB).
- **Staging & rollback** — every PR gets a Vercel preview deploy (staging);
  production is the `main` branch. Rollback = redeploy the previous Vercel
  deployment (one click in the dashboard, or `vercel deploy --prebuilt <hash>`
  from the CLI).
- **Backups / DR** — the source of truth is the Supabase Postgres in
  ap-south-1. Runbook: keep point-in-time recovery enabled (Pro plan), export
  a weekly `pg_dump` of the `public` schema to object storage with 30-day
  retention, and do a quarterly restore test into a scratch project.
  `supabase/_combined-schema.sql` is the idempotent full-schema baseline for
  rebuilding a new project; run `schema-v33-*.sql` and `schema-v34-*.sql`
  afterwards.
- **Secrets** — env-only, per environment: two `VITE_` vars for the frontend
  (Vercel project envs), function secrets via `supabase secrets set` in the
  deploy workflow, service-role key never leaves Supabase.
---

Built for Indian retail. GST-aware, WhatsApp-native, offline-ready.
