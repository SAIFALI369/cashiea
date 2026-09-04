# 📖 CASHIEA — Complete Project Biography

> **Last updated:** July 24, 2026
> **Status:** Code complete. Backend deployed. Frontend pending Vercel reconnection.
> **Repo:** github.com/SAIFALI369/cashiea
> **Tech:** React 18 + Vite 5 + Tailwind CSS + Supabase + Deno Edge Functions
> **Lines of code:** 16,234 | **Files:** 129 | **Tests:** 217 passing

---

## 🎯 WHAT IS CASHIEA?

Cashiea is a **POS + CRM + AI automation SaaS** built for small retail shops in Tier 2/3 India. It replaces the daily admin work (billing, stock tracking, customer follow-ups, reports) with AI-powered automation that works via WhatsApp and voice — no training needed.

**Target user:** A shop owner in Gaya/Patna/Siwan who currently runs their shop on a notebook and WhatsApp.

**One-line pitch:** *"Your shop, automated. Bill, track stock, follow up with customers — all from your phone. AI does the paperwork."*

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    USER'S PHONE                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Cashiea Web App (React + Vite + Tailwind)       │   │
│  │  Hosted on Vercel                                │   │
│  │                                                  │   │
│  │  • Landing page (signup/login)                   │   │
│  │  • Onboarding wizard (3 steps)                   │   │
│  │  • POS checkout + cart                           │   │
│  │  • Products, Customers, Invoices                 │   │
│  │  • Quick Action Bar (floating ⚡)                │   │
│  │  • AI Assistant (chat)                           │   │
│  │  • Settings (AI provider, UPI, GST)             │   │
│  └───────────────┬──────────────────────────────────┘   │
└──────────────────┼──────────────────────────────────────┘
                   │ HTTPS (JWT auth)
                   ▼
┌──────────────────────────────────────────────────────────┐
│                    SUPABASE                              │
│  ┌────────────────┐  ┌─────────────────────────────┐    │
│  │  PostgreSQL    │  │  18 Edge Functions (Deno)   │    │
│  │  24 tables     │  │                             │    │
│  │  RLS enabled   │  │  • AI calls (Gemini/OpenAI) │    │
│  │  9 RPCs        │  │  • Google OAuth             │    │
│  │  Auth          │  │  • Stripe payments          │    │
│  │  Storage       │  │  • WhatsApp/Email sending   │    │
│  └────────────────┘  │  • Cron jobs (daily)        │    │
│                      └──────────┬──────────────────┘    │
└─────────────────────────────────┼───────────────────────┘
                                  │
                   ┌──────────────┼──────────────┐
                   ▼              ▼              ▼
              ┌─────────┐  ┌──────────┐  ┌────────────┐
              │ Gemini  │  │ OpenAI   │  │ OpenRouter │
              │ (default│  │ (opt.)   │  │ (opt.)     │
              │  key)   │  │          │  │            │
              └─────────┘  └──────────┘  └────────────┘
```

### Key design decisions:
- **API keys are NEVER in frontend code** — all read server-side from Supabase secrets
- **Built-in Gemini key** — AI works out of the box for every new user (zero config)
- **Graceful degradation** — if AI is down, app shows SetupScreen instead of crashing
- **Row Level Security** — every user only sees their own data, enforced at database level

---

## 📄 EVERY PAGE — what it does, what route, who uses it

### Public pages (no login)

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 1 | **Landing** | `/` | Marketing page. Cream background, neon blue design, phone mockup, testimonials, ₹7,500/mo pricing, FAQ accordion, 9 sections with scroll animations |
| 2 | **Login** | `/login` | Two-column: brand panel (left) + login form (right). Email/password, forgot password, remember me, eye toggle |
| 3 | **Signup** | `/signup` | Two-column: brand panel with stats + comprehensive form (name, shop, phone, city, email, password with strength meter, terms checkbox) |
| 4 | **Onboarding** | `/app/onboarding` | 3-step wizard with progress dots: 1) Shop category, 2) First 3 products, 3) WhatsApp number + daily report time. Resumeable on reload |
| 5 | **Case Study** | `/case-study` | Suresh Mallick from Gaya — 6 hours saved/week, customer story with before/after |
| 6 | **Privacy** | `/privacy` | 11-section GDPR/CCPA compliant privacy policy |
| 7 | **Terms** | `/terms` | 15-section terms of use, Indian governing law |

### App pages (login required)

| # | Page | Route | Purpose |
|---|------|-------|---------|
| 8 | **Dashboard** (Today) | `/app` | Sales overview: today's revenue, monthly totals, top products, low stock, retargeting opportunity, recent activity |
| 9 | **POS** (New Sale) | `/app/pos` | Cashier checkout: product grid, cart, tax/discount, 5 payment methods, customer linking, receipt, auto inventory decrement |
| 10 | **Products** (Stock) | `/app/products` | Inventory: add/edit/delete products, stock tracking with +/- , low-stock alerts, margin display |
| 11 | **Customers** | `/app/customers` | CRM: client details, purchase history, lifetime value, segments (VIP/dormant/new), detail drawer with retarget CTA |
| 12 | **Invoices** | `/app/invoices` | Billing: AI invoice + Quick invoice, UPI payment links + QR, WhatsApp/SMS/PDF share, status tracking, unpaid summary |
| 13 | **Quotations** | `/app/quotations` | Create price quotes, one-click convert to invoice |
| 14 | **Accounts** (P&L) | `/app/accounts` | Expenses + income tracking, daily/monthly cash flow, category breakdown, CSV export |
| 15 | **Suppliers** | `/app/suppliers` | Vendor CRM with GSTIN, purchase orders, outstanding tracking |
| 16 | **Reports** | `/app/reports` | 5 report types: Clinical Operations, Revenue Cycle, Patient Outcomes, Compliance, Custom — with structured templates |
| 17 | **AI Assistant** (Ask AI) | `/app/assistant` | Natural-language chat: "How was business today?", "Who bought cement?", morning briefing button |
| 18 | **AI Brain** (AI Memory) | `/app/brain` | Learns your business, generates "About My Business" summary, predicts tasks (approve/deny), learns from corrections |
| 19 | **Connect Apps** | `/app/connect-apps` | App catalog-driven: Google Sheets card with OAuth flow, 3 permission levels, status, disconnect |
| 20 | **Integrations** | `/app/integrations` | Gmail/Sheets/WhatsApp/Shopify/Tally connections with paste-data fallback |
| 21 | **Team** | `/app/team` | Invite manager/accountant/staff with role-based permissions |
| 22 | **Settings** | `/app/settings` | AI provider picker (5 options), GST/UPI/business info, daily briefing toggle, report time picker |
| 23 | **Subscription** | `/app/subscription` | 4 plans (Free/Starter ₹499/Pro ₹999/Enterprise ₹2999), Stripe checkout, demo mode |
| 24 | **Support** | `/app/support` | Contact form → emails supportcashiea@gmail.com, falls back to mailto |
| 25 | **Activity Logs** | `/app/activity` | Every AI action with time/money saved, filterable, CSV/JSON export |
| 26 | **Failed Jobs** | `/app/failed-jobs` | Admin view: every failed automation with retry button + root-cause diagnosis + fix routing |
| 27 | **API Keys** | `/app/api-keys` | Generate/revoke API keys for 3rd-party integrations, curl examples |
| 28 | **Compliance** | `/app/compliance` | HIPAA/GDPR/SOC2/CCPA/ISO27001 certifications + security practices |
| 29 | **Summaries** | `/app/summaries` | 4 styles: brief, bullets, detailed, executive |
| 30 | **Data Entry** | `/app/data-entry` | Single + batch mode: extract structured data from 200+ records at once |
| 31 | **Email Assistant** (Retargeting) | `/app/email-assistant` | Win-back, promo, thank-you, abandoned cart, newsletter templates |
| 32 | **Campaigns** | `/app/campaigns` | Bulk personalized email campaigns with A/B testing, follow-ups, response tracking |

---

## ⚡ EDGE FUNCTIONS — 18 backend services

| # | Function | What it does | JWT? |
|---|----------|-------------|------|
| 1 | **ai-automation** | Core AI: invoices, reports, summaries, emails, sentiment, code lookup. Multi-provider (OpenRouter/OpenAI/Gemini/Anthropic + default Gemini fallback) | Yes |
| 2 | **ai-assistant** | Natural-language Q&A: gathers business data snapshot, lets AI answer "how was today?" | Yes |
| 3 | **business-brain** | 3 modes: learn (build business summary), predict (suggest tasks), correct (store owner feedback) | Yes |
| 4 | **daily-brain** | Cron: runs every morning, generates predictions + sends briefing email | Service role |
| 5 | **daily-reports** | Cron: generates daily sales report, sends via WhatsApp Cloud API, logs failures | Service role |
| 6 | **quick-tasks** | One-click tasks: low-stock alert, daily closing, Hindi bot, voice GST invoice, custom | Yes |
| 7 | **invoice-reminders** | Cron: auto-reminds unpaid customers via email, throttled, logs to failed_jobs | Service role |
| 8 | **campaign-send** | Bulk personalized emails: generates per-recipient, A/B test, delivers via Resend | Yes |
| 9 | **track** | Email open/click/reply tracking pixels + sentiment analysis on replies | No |
| 10 | **integrations-api** | Connect Apps operations: status, list sheets, read, write (confirmed), sync, disconnect, test | Yes |
| 11 | **google-oauth** | Full OAuth flow: authorize → consent → callback → token exchange. Stores in connected_apps | No |
| 12 | **google-fetch** | Syncs live data from Gmail/Sheets using stored OAuth tokens | Yes |
| 13 | **quickbooks-oauth** | Intuit OAuth scaffold for QuickBooks integration | No |
| 14 | **create-checkout** | Stripe Checkout session creation for subscription upgrades | Yes |
| 15 | **stripe-webhook** | Handles Stripe events: checkout completed, subscription created/updated/deleted | No |
| 16 | **support-email** | Sends support form to supportcashiea@gmail.com via Resend (or mailto fallback) | No |
| 17 | **api-generate-invoice** | Public API: generate invoice from description (API key auth) | API key |
| 18 | **api-draft-email** | Public API: draft email from description (API key auth) | API key |

### Shared modules (`_shared/`):
| File | Purpose |
|------|---------|
| `retry.ts` | `withRetry()` exponential backoff + `corsHeaders` + `json()` |
| `ai-default.ts` | Built-in Gemini key fallback — `callDefaultGemini()` + `hasDefaultAI()` |
| `ai-gateway.ts` | Vercel AI Gateway helper — `callGateway()` + `listGatewayModels()` |
| `openrouter.ts` | OpenRouter helper — 6-model fallback chain: Gemini → Kimi K3 → Llama → free models |
| `google.ts` | Google token refresh + `fetchGmail()` + `fetchSheet()` |
| `connectors/google-sheets.ts` | Permission-gated connector: `testConnection()`, `listSpreadsheets()`, `readSheetData()`, `writeSheetData()`, `createSpreadsheet()` |

---

## 🗄️ DATABASE — 24 tables

### Core retail:
| Table | Purpose |
|-------|---------|
| `profiles` | User profile: name, shop, GST, UPI, AI provider, plan, trial, onboarding step |
| `products` | Inventory: name, SKU, price, cost, stock, low-stock threshold |
| `customers` | CRM: name, phone, email, total spent, orders, loyalty points, tags |
| `transactions` | POS sales: receipt number, items, totals, payment method, status |
| `invoices` | Billing: client info, items, tax, UPI links, payment status, reminders |
| `quotations` | Price quotes: items, convert-to-invoice status |
| `suppliers` | Vendors: name, GST, outstanding balance |
| `purchase_orders` | POs to suppliers: items, status, totals |
| `expenses` | Income/expense tracking: category, amount, date |

### AI system:
| Table | Purpose |
|-------|---------|
| `activity_logs` | Every AI action with time/money saved |
| `business_memory` | AI's "About My Business" summary + key facts |
| `ai_predictions` | Proposed tasks awaiting approve/deny |
| `ai_corrections` | Owner feedback the AI learns from |

### Communication:
| Table | Purpose |
|-------|---------|
| `emails` | AI-generated email drafts |
| `email_campaigns` | Bulk campaign metadata + stats |
| `campaign_recipients` | Per-recipient tracking: sent/opened/clicked/replied + sentiment |
| `daily_reports` | Daily WhatsApp sales reports |
| `invoice_reminders` | Reminder log per invoice |

### Platform:
| Table | Purpose |
|-------|---------|
| `subscriptions` | Stripe subscription records |
| `api_keys` | SHA-256 hashed API keys for 3rd-party integrations |
| `team_members` | Invited team with roles (owner/manager/accountant/staff) |
| `failed_jobs` | Failed automation log with retry support |
| `connected_apps` | Google Sheets OAuth connections with permission levels |
| `integration_audit_logs` | Every integration event logged |
| `reports` | Generated business reports |
| `data_entries` | Extracted structured data |
| `summaries` | Generated summaries |
| `code_lookups` | Medical code suggestions (Healthcare edition — not used in Cashiea) |

### RPCs (9 functions):
| Function | Called by | Purpose |
|----------|----------|---------|
| `handle_new_user()` | Trigger on signup | Creates profile with role=owner, plan_tier=trial, trial_ends_at=+14d |
| `grant_trial(uuid)` | Client after signup | Sets 14-day Pro trial |
| `update_onboarding_step(int, jsonb)` | Client during wizard | Advances onboarding steps |
| `increment_api_usage(uuid)` | Edge functions | Increments usage counter |
| `decrement_stock(uuid, int)` | Edge functions | Atomic stock decrement on sale |
| `recompute_customer_stats(uuid)` | Edge functions | Recalculates lifetime value |
| `recompute_supplier_outstanding(uuid)` | Edge functions | Recalculates outstanding balance |
| `sync_campaign_stats(uuid)` | Edge functions | Rolls up campaign counts |
| `log_integration_event(...)` | Edge functions | Logs integration audit events |

---

## 🤖 AI SYSTEM

### Provider hierarchy (tried in order):
1. **User's selected provider** (OpenRouter/OpenAI/Gemini/Anthropic/Vercel Gateway)
2. **Built-in default Gemini** (`DEFAULT_GEMINI_API_KEY` secret — always works)

### Fallback chains:
- **OpenRouter**: Gemini Flash → Kimi K3 → Llama Maverick → Gemini 2.5 → free models
- **Default Gemini**: Direct Gemini Flash API call (always available)

### AI features by page:
| Feature | How AI is used |
|---------|---------------|
| Invoice generation | Natural language → structured JSON invoice |
| Reports | Raw data → professional markdown report with sections |
| Summaries | Long text → brief/detailed/bullet/executive summary |
| Email assistant | Key points → polished email draft |
| Quick Tasks | Voice/text → low-stock alerts, daily reports, Hinglish replies, GST invoices |
| AI Assistant | Business question → AI answers using live data snapshot |
| AI Brain | Learns business, predicts tasks, adapts from corrections |
| Data Entry | Messy text → clean structured JSON |
| Campaigns | Template + recipient → personalized email per person |

---

## 💳 PAYMENTS

### UPI (India — zero setup):
- `upi://pay?...` deep links open any UPI app (PhonePe, GPay, Paytm, BHIM)
- QR codes auto-generated per invoice (scannable)
- WhatsApp invoice sharing with payment link embedded
- Merchant sets UPI ID in Settings → every invoice gets a pay button

### Stripe (international):
- Checkout sessions for subscription upgrades
- Webhook auto-provisions/cancels plans
- Demo mode flag (`VITE_STRIPE_ENABLED=false`) — works without Stripe keys

---

## 📱 WHAT WORKS RIGHT NOW

| Component | Status | Notes |
|-----------|--------|-------|
| Code on GitHub | ✅ | github.com/SAIFALI369/cashiea, 129 files |
| Build | ✅ | Compiles clean, 217 tests pass |
| Database | ✅ | 24 tables, real data, RLS secured |
| Edge functions | ✅ | All 18 deployed and live |
| Gemini key | ✅ | Set as Supabase secret |
| Security warnings | ✅ | All WARN-level resolved |
| Vercel frontend | ❌ | Needs repo reconnection (bizautomate → cashiea rename) |
| Vercel env vars | ❌ | Needs `VITE_SUPABASE_URL` = `https://prwvaetatdidsugczluv.supabase.co` (the old `oxlwbxkifyrhggrsaoin` project no longer resolves) |

---

## 🚀 DEPLOYMENT CHECKLIST (when you get a computer)

### Step 1: Vercel (frontend — 2 min)
1. vercel.com → your project → Settings → Git
2. Disconnect old repo → reconnect to `SAIFALI369/cashiea`
3. Set Environment Variables (use the CURRENT project, not the old one):
   - `VITE_SUPABASE_URL` = `https://prwvaetatdidsugczluv.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (the current project's anon key)
   - `VITE_STRIPE_ENABLED` = `false`
4. Deploy

### Step 2: Verify edge functions (already deployed ✅)
```bash
# If you want to re-deploy manually later:
supabase functions deploy ai-automation ai-assistant business-brain daily-brain quick-tasks
```

### Step 3: Supabase Auth settings
- Authentication → Email → turn OFF "Confirm email" (for instant signup)
- URL Configuration → set Site URL to your Vercel domain

### Step 4: Optional integrations
```bash
# Google OAuth (for Gmail/Sheets sync):
supabase secrets set GOOGLE_CLIENT_ID=...
supabase secrets set GOOGLE_CLIENT_SECRET=...

# WhatsApp Cloud API (for daily reports):
supabase secrets set WHATSAPP_TOKEN=...
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...

# Stripe (for real payments):
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Email delivery (for campaign/support):
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set MAIL_FROM=you@yourdomain.com
```

---

## 📊 NUMBERS

| Metric | Value |
|--------|-------|
| Total files tracked | 129 |
| Lines of code | 16,234 |
| Frontend pages | 32 |
| Edge functions | 18 |
| Database tables | 24 |
| SQL schema files | 14 (v1 through v14) |
| Shared backend modules | 6 |
| Test files | 8 |
| Tests passing | 217 |
| AI providers supported | 5 (OpenRouter, Gemini, OpenAI, Anthropic, Vercel Gateway) |
| Open source dependencies | 12 |
| Plan price | ₹7,500/month |
| Free trial | 14 days, no card |
| Default AI | Gemini Flash (built-in, zero config) |
| Target market | Tier 2/3 India retail shops |

---

## ⚠️ WHAT'S LEFT TO DO

### Must do (blocking launch):
1. **Reconnect Vercel** to `cashiea` repo (phone-doable)
2. **Update Vercel env vars** to correct Supabase project URL (phone-doable)

### Should do (improves experience):
3. Turn off email confirmation in Supabase Auth
4. Set up pg_cron schedule for daily-reports function
5. Add Google OAuth credentials (if offering Gmail/Sheets sync)

### Nice to have (future features):
6. Customer Khata/Credit (udhaar) system — biggest seller feature
7. Two-way WhatsApp ordering (customer texts → AI creates sale)
8. Sales comparison on dashboard ("↑23% vs yesterday")
9. Smart supplier auto-reorder
10. Hindi/Hinglish UI toggle

---

## 📁 FILE STRUCTURE

```
cashiea/
├── .github/workflows/
│   ├── ci.yml                      # Build + test on every push
│   └── deploy-supabase.yml         # Auto-deploy edge functions
├── public/
│   └── favicon.svg                 # Cashiea logo (gradient arc + spark)
├── src/
│   ├── components/
│   │   ├── AppLayout.tsx           # Main layout + QuickActionBar mount
│   │   ├── GoogleSheetsConnect.tsx # OAuth modal with 3 permissions
│   │   ├── ProtectedRoute.tsx      # Auth guard + onboarding redirect
│   │   ├── QuickActionBar.tsx      # Floating ⚡ with 5 tasks + history
│   │   ├── SetupScreen.tsx         # Shown when env vars missing
│   │   ├── Sidebar.tsx             # Collapsible nav (Counter/Money/Assistant/Settings)
│   │   └── ui/ (EmptyState, PageHeader)
│   ├── context/
│   │   └── AuthContext.tsx         # Supabase auth + profile management
│   ├── lib/
│   │   ├── ai/index.ts             # callAI() + retry + parseAIJson + askAssistant + callBrain + runQuickTask
│   │   ├── app-catalog.ts          # Modular app registry (add apps here)
│   │   ├── export.ts               # CSV/JSON export utilities
│   │   ├── invoice-pdf.ts          # Professional PDF generation (jsPDF)
│   │   ├── logging.ts              # logFailedTask() to failed_jobs
│   │   ├── payments.ts             # UPI links, WhatsApp links, QR codes
│   │   ├── report-templates.ts     # 5 report types with structured prompts
│   │   ├── supabase.ts             # Supabase client + supabaseConfigured flag
│   │   ├── task-history.ts         # localStorage task history (last 10)
│   │   └── types.ts                # All TypeScript interfaces + PLANS config
│   ├── pages/ (32 pages — see table above)
│   └── test/
│       └── structure.test.ts       # 100+ assertions: every page/route/file exists
├── supabase/
│   ├── _combined-schema.sql        # ALL 14 schemas in one paste-once file
│   ├── config.toml                 # Project config + per-function JWT settings
│   ├── schema.sql through v14.sql  # Migration history
│   └── functions/ (18 functions + _shared/ — see table above)
├── index.html
├── index.mjs                       # Standalone OpenRouter test script
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── vercel.json
```

---

*CASHIEA — Built with care for India's small businesses. © 2026.*
