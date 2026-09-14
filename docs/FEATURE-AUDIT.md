# Cashiea — Feature Audit vs the Requested Product List (2026-09-13)

A line-by-line review of the repository against the requested feature list
(GST invoicing, WhatsApp AI assistant, inventory auto-update, multi-user RBAC,
Tally integration, payment reminders, fast billing, realtime stock alerts,
customer khata, analytics dashboard, mobile-first UI, voice commands, text
assistant, smart predictions, barcode scanning, realtime sync).

**Verdict up front:** 13 of 16 requested features already exist and are
production-grade (tested, RLS-scoped, idempotent). 3 were missing or partial:

| # | Requested feature | Status before this pass | After this pass |
|---|---|---|---|
| 1 | GST-compliant invoicing (auto-tax, HSN/SAC, UPI QR) | ✅ Existed — one gap: no HSN→rate master lookup | ✅ HSN/SAC rate master added (schema v38 + `lib/hsnRates.ts`) |
| 2 | AI Assistant on WhatsApp ("Add 50 notebooks at ₹25" → invoice + sent) | ⚠️ Inbound messages were **stored only**, never executed | ✅ Built — inbound order commands parse → invoice → reply (`_shared/order-parser.ts`, webhook, schema v40) |
| 3 | Inventory auto-update + low-stock alerts | ✅ Existed — alerts were schedule-based, not sale-time | ✅ Sale-time low-stock event now pushed live (schema v39) |
| 4 | Multi-user access (RBAC + audit trail) | ✅ Existed | ✅ |
| 5 | **Tally integration (XML export)** | ❌ **Missing** (disabled placeholder on Integrations page) | ✅ Built — full Tally XML export (`lib/tally.ts`, `/app/tally-export`) |
| 6 | Payment reminders (daily scheduler, overdue) | ✅ Existed | ✅ |
| 7 | Lightning-fast billing (local cache, barcode, <2s) | ✅ Existed | ✅ |
| 8 | Real-time stock alerts (live push) | ⚠️ Partial — realtime pipeline existed for automation cards only | ✅ Complete — stock alerts ride the same realtime channel |
| 9 | Customer khata (udhaar ledger) | ✅ Existed | ✅ |
| 10 | Live analytics dashboard (daily/weekly/monthly, profit) | ✅ Existed | ✅ |
| 11 | Mobile-first UI | ✅ Existed as PWA (see note) | ✅ |
| 12 | AI voice commands | ✅ Existed | ✅ |
| 13 | Text-based assistant (NLP) | ✅ Existed | ✅ |
| 14 | Smart predictions (reorder ML) | ✅ Existed | ✅ |
| 15 | Barcode scanning | ✅ Existed | ✅ |
| 16 | Real-time sync (offline-first) | ✅ Existed | ✅ |

---

## 1. GST-Compliant Invoicing — ✅ (gap closed)

**Requested:** server-side tax engine → reads HSN → fetches GST rate (5/12/18/28)
→ auto-calculates → QR-coded invoice PDF.

**What existed:**
- `src/lib/gst.ts` — multi-rate engine (0/5/12/18/28), CGST/SGST vs IGST
  split by interstate flag, HSN-wise summary table.
- `complete_sale` RPC (Supabase) — the *actual* server-side tax engine: it
  re-computes every line's taxable value, discount allocation and tax from the
  locked catalogue rows and **rejects** the sale if the client's numbers
  disagree. Client math is never trusted.
- `src/lib/invoice-pdf.ts` — Rule 46 CGST tax invoice PDF: TAX INVOICE heading,
  GSTINs, HSN column, CGST/SGST/IGST split, amount in words, place of supply,
  signature line **and a UPI QR code** rendered onto the PDF.

**Gap that was closed:** the rate lived only on each product row — there was no
HSN → GST rate *reference table* to fetch a rate from when an HSN is entered.
Added:
- `supabase/schema-v38-hsn-rates.sql` — `hsn_rates` master (HSN chapters,
  headings and common SAC services, seeded from the same dataset the client
  ships), read-only RLS for authenticated users.
- `src/lib/hsnRates.ts` — canonical dataset + longest-prefix lookup
  (8-digit → 6 → 4 → 2-digit chapter), works offline with zero network.
- `src/pages/Products.tsx` — entering an HSN now offers the master's GST rate
  as a one-tap suggestion (never silently overwrites).
- `scripts/generate-hsn-seed.mjs` — regenerates the SQL seed from the TS
  dataset so the two can never drift (same convention as the other generators).

## 2. AI Assistant (WhatsApp) — ⚠️ → ✅ built

**Requested:** "Add 50 notebooks at ₹25" → invoice created + sent to customer.
NLP parse → extract product/qty/price → update DB → send formatted bill.

**What existed:**
- In-app assistant (Meraj) already had `create_invoice`, `add_product`,
  `add_products`, `add_customer` function-calling tools with a
  prepare → confirm → execute flow (`supabase/functions/ai-assistant`).
- Outbound WhatsApp (`whatsapp-send`, `_shared/whatsapp.ts`) with Cloud API.
- Inbound webhook (`whatsapp-webhook`) verified Meta's HMAC signature,
  resolved the tenant and… **stored the message**. No command was ever parsed
  or executed. The "type it on WhatsApp and Cashiea bills it" loop did not
  close.

**What was built:**
- `supabase/functions/_shared/order-parser.ts` — a dependency-free, fully
  unit-tested natural-language order parser:
  - quantities in digits and Hindi/English number words (50, fifty, pachaas),
  - prices with `@`, `at`, `₹`, `rs`, `per` ("50 notebooks at ₹25",
    "notebook 50 @ 25"),
  - multiple lines in one message, "for <customer>" extraction,
  - strict guards: rejects nonsense, caps qty (≤ 10,000) and price (≤ ₹10 lakh
    per line), needs at least one item.
- `whatsapp-webhook` now runs the parser on every inbound text. When the
  owner has **WhatsApp Billing turned on** (new `profiles.whatsapp_billing_enabled`,
  default OFF — schema v40) a detected order is:
  1. fuzzy-matched against the owner's catalogue (never guesses a price —
     unknown items are reported back, not invented),
  2. written as a GST invoice with the same maths as the in-app assistant,
  3. replied to the customer with a formatted bill + UPI deep link,
  4. logged to `activity_logs` and pushed as a realtime card via
     `automation_events`.
  Errors reply with an actionable message instead of failing silently.
- `src/lib/whatsappOrder.test.ts` — 40+ vitest cases run against the exact
  module the edge function imports (single source of truth, no drift).
- Settings → WhatsApp section gained the on/off toggle with honest limits
  (commands only create the bill; nothing is auto-"collected").

## 3. Inventory Auto-Update — ✅ (alerts strengthened)

**Requested:** every sale/purchase writes inventory, threshold check,
notification, live dashboard update.

**What existed:**
- `complete_sale` decrements stock **atomically per line** with a
  `stock_quantity >= consumed` guard — no oversell, no drift; `void_sale`
  reverses it. Purchases/restock go through products/POs.
- `automation-engine` (30-min heartbeat) + `lib/autoReorder.ts` did the
  threshold sweep and reorder maths on a schedule.

**What was strengthened:** the threshold check now also happens **inside the
sale itself** — `schema-v39-stock-alerts.sql` recreates `complete_sale` to
compare post-decrement stock against `low_stock_threshold` and immediately
insert a `stock_alert` row into `automation_events` (per product, per sale).
Because `automation_events` is already in the `supabase_realtime`
publication, every logged-in device gets the low-stock card pushed over the
websocket the moment the bill is saved — no 30-minute wait, no polling.
(The default threshold stays per-product (`low_stock_threshold`, default 5) —
the "≤ 10" in the brief is just that product's configured threshold.)

## 4. Multi-User Access (RBAC) — ✅

- Roles: **owner / manager / accountant / staff** (the brief's
  Admin/Staff/Accountant), capability matrix in `src/lib/permissions.ts`,
  route guard in `routeCapabilities.ts`, DB-side `can_direct_capability`
  checked inside `complete_sale` (backend enforcement, not just hidden
  buttons).
- Invites: `team-link` edge function; non-owners act through
  `change_requests` (prepare → owner approves in Notifications).
- Audit trail: `activity_logs` (every sale, invoice, AI action) +
  `integration_audit_logs`.

## 5. Tally Integration — ❌ → ✅ built

**Requested:** export financial data to Tally XML schema for import to the
general ledger.

**What existed:** a disabled placeholder card on Integrations ("Tally API
connection is not configured") and the `tally` enum value on
`IntegrationProvider`. No code produced Tally anything.

**What was built** (`src/lib/tally.ts`, `src/pages/TallyExport.tsx`,
route `/app/tally-export`):
- A complete Tally **import-XML** generator (the `ENVELOPE → BODY →
  IMPORTDATA → REQUESTDATA → TALLYMESSAGE` dialect TallyPrime / Tally ERP 9
  accept from *Gateway of Tally → Import → Vouchers*):
  - **Masters:** party ledgers (Sundry Debtors / Creditors, GSTIN, phone,
    address), stock items with HSN + GST rate + units, the standard GST duty
    ledgers (CGST/SGST/IGST Output), Sales / Purchase ledgers and Round-off.
  - **Vouchers:** invoice-mode Sales vouchers from both POS transactions and
    invoices (line-level inventory entries, per-rate CGST/SGST or IGST
    ledger entries, round-off line so the voucher balances to the paisa),
    Receipt vouchers for payments received, Payment vouchers for expenses.
  - Correct Tally conventions: `YYYYMMDD` dates, `ISDEEMEDPOSITIVE`
  accounting signs, XML-escaped text, `PERSISTEDVIEW`/`REPORTID` headers,
  stable voucher numbering (Cashiea doc numbers preserved in
  `REFERENCE`/`VOUCHERNUMBER`).
- The page offers period selection, a pre-export summary (counts + totals by
  voucher type), a preview of the first vouchers, and step-by-step import
  instructions with the honest caveat that a first import should be taken on
  a trial company. Strategy note: file-based import is the *right* Tally
  integration for this product — Tally's XML-over-HTTP listener only exists
  on desktop Tally behind the shop's firewall; an export the CA can import in
  two clicks works for every Tally installation in India.
- Wired into Sidebar (Money section), Command Palette, Meraj desks, route
  capabilities (`reports:view`), page context, and the structural test list.
- `src/lib/tally.test.ts` — structure, escaping, GST split, sign
  conventions, date format, balancing and edge cases (empty input, huge
  values, unicode names).

## 6. Payment Reminders — ✅

- `invoice-reminders` edge function (cron-driven, service-role or
  owner-triggered retry) emails via Resend and/or WhatsApp; overdue marking is
  a daily pg_cron job (`mark-overdue-invoices`), duplicate-send races are
  closed DB-side with a send log + throttle.
- `lib/vasooli.ts` — escalating 3-tier reminder copy (soft → factual →
  direct), 4 languages, written to be submittable as **utility** WhatsApp
  templates (₹0.115/msg, not ₹0.86 marketing) with UPI links.
- Reminders page + WhatsApp 8 PM sales report round it out.

## 7. Lightning-Fast Billing — ✅

POS keeps the whole catalogue in memory (instant search/price lookup, no
per-keystroke server round-trip), barcode scan appends directly to the cart,
and checkout is **one** idempotent RPC (`complete_sale`) — the <2s target is
met by construction. Held carts, quick-qty numpad and split tenders with
change math cut the touches per bill.

## 8. Real-Time Stock Alerts — ⚠️ → ✅ complete

The websocket pipeline existed (`automation_events` in the realtime
publication, consumed by `useAutomationCards` → live cards on the dashboard),
but low-stock detection only ran on the 30-minute automation heartbeat.
Schema v39 (see §3) moves the threshold check into the sale transaction, so
the alert rides the same websocket within the same second the bill is saved.

## 9. Customer Khata (Udhaar) — ✅

`khata_entries` ledger (debit/credit entries with notes), running balance per
customer, one-tap settle, WhatsApp reminder with AI-drafted copy, settled
history, plus the Vasooli collection round for invoice dues.

## 10. Live Analytics Dashboard — ✅

Dashboard RPC returns today's sales, weekly buckets (Mon–Sun), expenses,
income and low-stock counts in one round-trip; SalesTrend (7d/30d/90d/365d
with % change), Profit Dashboard (COGS-based gross/net profit), Reports with
PDF/Excel export. Charts are hand-rolled SVG rather than Chart.js — same
insight, zero chart-library bytes against the 700 kB chunk budget.

## 11. Mobile-First UI — ✅ (PWA, not Flutter)

The brief said Flutter; this product is a web POS. The strategic equivalent
is already shipped: installable PWA (vite-plugin-pwa), bottom-nav +
gesture navigation, `useIsDesktop` responsive layouts, offline queue that
keeps billing through power cuts, ~50 MB-class memory footprint because it's
a browser tab, not a bundled runtime. A second Flutter codebase would
duplicate the business logic for no user gain — deliberately not built.

## 12. AI Voice Commands — ✅

`useSpeech` records on any browser (iOS Safari included) → `voice-stt`
edge function (Groq Whisper large-v3-turbo) → text. `lib/voiceOrder.ts`
parses Hinglish quantities ("do notebook daalo") and only commits a cart add
when exactly one catalogue product clearly wins — speech noise asks instead
of guessing. Meraj speaks back with Indian-voice preference TTS.

## 13. Text-Based Assistant — ✅

Meraj chat (`/app/assistant`) with task mode + function calling over the
shop's real snapshot, DoAnythingBar, command palette. Deterministic parsing
lives in the order parser for WhatsApp and voiceOrder for the cart.

## 14. Smart Predictions — ✅

`lib/autoReorder.ts` computes 30-day sales velocity per product, days of
cover, and `reorder qty = (lead + cover) × velocity − stock` (the brief's
`(avg daily sales × lead time) + safety stock`, same formula with cover as
the safety term), plus alert-level fallbacks for no-sale items. The
automation engine can draft the PO automatically (undoable) and `ai_predictions`
persists suggestions.

## 15. Barcode Scanning — ✅

`useBarcodeScanner` uses the browser-native `BarcodeDetector` (UPC/EAN/QR)
with a manual-entry fallback for iOS Safari. Native detection is the right
substitute for OpenCV in a web app — no WASM payload, hardware-accelerated,
and the fallback keeps every device billing.

## 16. Real-Time Sync — ✅

Offline mutation queue in localStorage (intent, not tokens), replayed on
reconnect against the current session with per-business isolation,
dead-lettering on validation failures, `SyncIndicator` + `OfflineBanner`
surfacing state, idempotency keys so a replayed sale can never double-charge.

---

## What was added in this pass (file map)

| Area | Files |
|---|---|
| Audit (this doc) | `docs/FEATURE-AUDIT.md` |
| Tally XML export | `src/lib/tally.ts`, `src/lib/tally.test.ts`, `src/pages/TallyExport.tsx` |
| WhatsApp order commands | `supabase/functions/_shared/order-parser.ts`, `src/lib/whatsappOrder.test.ts`, updated `whatsapp-webhook/index.ts`, `src/pages/Settings.tsx` (toggle) |
| Sale-time stock alerts | `supabase/schema-v39-stock-alerts.sql` |
| HSN/SAC rate master | `src/lib/hsnRates.ts`, `src/lib/hsnRates.test.ts`, `scripts/generate-hsn-seed.mjs`, `supabase/schema-v38-hsn-rates.sql`, `src/pages/Products.tsx` (suggest) |
| WhatsApp billing opt-in | `supabase/schema-v40-whatsapp-billing.sql` |
| Wiring | `src/App.tsx` (route), `src/components/Sidebar.tsx`, `src/components/CommandPalette.tsx`, `src/lib/routeCapabilities.ts`, `src/lib/pageContext.ts`, `src/lib/merajDesks.ts`, `src/lib/types.ts`, `src/test/structure.test.ts` |

**Deploy order for the backend pieces:** schema v38 → v39 → v40 in the SQL
editor, then `supabase functions deploy whatsapp-webhook`. Everything else is
client-side and ships with the next Vercel deploy.

---

# Part 2 — Competitive Audit (2026-09-14)

A second feature audit against the leading POS platforms: **Shopify POS, Square,
Lightspeed, KORONA, Clover, Springboard Retail**. Every gap was checked not
just for value but for **harmlessness to Cashiea** — competitive parity is not
a mandate, and features that would add regulatory, security or scope risk to
a single-shop Indian retail app were deliberately excluded.

## Already existed (verified, tested)

Variant pricing, reorder points + auto-reorder, dashboards, purchase-order
automation, customer segmentation, `served_by` on sales (commission source),
mobile-first POS, held carts, invoicing, RBAC + audit trail, offline-first
sync, multi-format exports (PDF/XLSX/Tally XML/GST).

## Built in this pass

| Feature | vs the market | Where |
|---|---|---|
| **Loyalty program** — points per ₹100, redeem as ₹ at the counter, min-redemption guard, Bronze→Platinum lifetime tiers, DB-trigger earning | Square Loyalty, KORONA tiered loyalty | `schema-v41-loyalty.sql`, `lib/loyalty.ts`, Customers page (owner config), POS (redeem modal) |
| **Promotions engine** — BOGO (product/category), tiered spend discounts, percent-off with cap; windows, pause, never stack, capped at cart value | Shopify dynamic discounting, Lightspeed markdowns | `schema-v43-promotions.sql`, `lib/promotions.ts`, `/app/promotions` (owner-only), POS auto-apply + deals banner |
| **Workforce** — staff shift clock in/out with break deduction; commission rules per staff; 30-day performance table (sales, revenue, hours, rev/hr, commission) | Square Teams/Shifts, Lightspeed staff commissions, Clover shift mgmt | `schema-v42-staff-workforce.sql`, `lib/workforce.ts`, Team page |
| **Abandoned-cart recovery** — held carts aged into a follow-up window surface on the Dashboard with a one-tap WhatsApp nudge (drafted message, wa.me deep link) | Shopify abandoned checkout | `lib/abandonedCarts.ts`, Dashboard card |

## Deliberately NOT built — harmful or misfit for Cashiea

| Feature | Why excluded |
|---|---|
| Payment processing network (Square/Fiserv) | Moves money — needs PCI-DSS, RBI PSS licensing and fraud liability. One bug = lost shop money. Third-party UPI already covers payments. |
| 8,000-app marketplace | Maintenance + review liability for third-party code we can't vet. |
| Square Capital / merchant advances | Lending is a regulated activity (RBI NBFC licence). |
| White-label / enterprise customization (KORONA) | Conflicts with the single-product, single-brand model. |
| High-risk industry modes (KORONA) | Cannabis/firearms/gambling verticals — legal exposure in India. |
| Restaurant/kitchen hybrid (KORONA) | Different product: kitchen display, tickets, course timing. Retail POS focus stays. |
| Hardware ecosystem (Clover terminals) | Physical hardware supply chain; browser/barcode-camera already works. |
| Shopify/WooCommerce channel sync | Requires storing merchants' external API keys/credentials — a security surface we shouldn't hold. |
| 50+ multi-location (Lightspeed) | Cashiea is single-business by design; RLS and pricing assume one shop per account. |

**Deploy order:** v38 → v39 → v40 → v41 (loyalty) → v42 (workforce) → v43
(promotions) in the SQL editor, then `supabase functions deploy
whatsapp-webhook`. Client changes ship with the next Vercel deploy.

**Test totals after this pass:** 924 passing, 70 of them new (loyalty,
promotions, workforce, abandoned carts). `tsc`, ESLint (0 errors) and the
production build are all clean.
