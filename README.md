# cashiea — POS, CRM & AI Automation for Retail

> **The all-in-one cashier & customer-growth platform for Indian retail businesses.** Ring up sales, manage inventory, track customers, generate GST invoices with UPI payment links, send WhatsApp reports, and let AI handle the busywork.

![Build](https://img.shields.io/badge/Build-passing-brightgreen)
![Tests](https://img.shields.io/badge/Tests-213%20passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🚀 Quick Start (for developers)

```bash
git clone https://github.com/SAIFALI369/cashiea.git
cd cashiea
npm install
cp .env.example .env     # then fill in your Supabase keys
npm run dev              # → http://localhost:5173
```

The app shows a **Setup Screen** until you fill `.env`. That's normal — it means the graceful-degradation guard is working.

---

## 📋 Production Setup (5 steps, ~20 min)

### 1. Create a Supabase project (5 min)
- Go to [supabase.com](https://supabase.com) → New Project
- Project Settings → API → copy **Project URL** and **anon key**
- SQL Editor → paste the contents of [`supabase/_combined-schema.sql`](supabase/_combined-schema.sql) → **Run**
- This creates all 24 tables, 9 RPCs, 26 RLS policies, triggers, and the auth-onboarding flow in one paste.

### 2. Configure auth (2 min)
- Supabase Dashboard → **Authentication** → **Providers** → **Email**
- Turn **OFF** "Confirm email" (so signup goes straight in — no email verification needed)
- **URL Configuration** → set Site URL to your Vercel domain + add `https://yourdomain/**` to Redirect URLs

### 3. Deploy to Vercel (5 min)
- Go to [vercel.com](https://vercel.com) → New Project → import `SAIFALI369/cashiea`
- Before deploy, set Environment Variables:
  - `VITE_SUPABASE_URL` = your Supabase URL
  - `VITE_SUPABASE_ANON_KEY` = your anon key
  - `VITE_STRIPE_ENABLED` = `false` (keep demo mode until Stripe is set up)
- Deploy → you get a live URL

### 4. Set the AI key (3 min, needs CLI)
```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
# Then in the app: Settings → pick "OpenRouter"
```
The OpenRouter fallback chain (Gemini → Kimi K3 → Llama → free model) means AI works even before you purchase credits — it auto-falls to a free model.

### 5. Deploy edge functions (5 min, needs CLI)
```bash
supabase functions deploy ai-automation ai-assistant business-brain daily-brain quick-tasks google-oauth google-fetch invoice-reminders quickbooks-oauth support-email campaign-send track api-generate-invoice api-draft-email create-checkout stripe-webhook daily-reports
```

**Done.** Signup → onboarding (3 steps) → dashboard with inventory → start selling.

---

## ✨ Features

| Category | Features |
|----------|---------|
| **Cashier / POS** | Cart checkout, 5 payment methods (cash/card/UPI/wallet/other), instant receipts, auto inventory decrement |
| **Inventory** | Product catalog with price/cost/margin, stock tracking, low-stock alerts, quick restock |
| **Customers (CRM)** | Client details, purchase history, lifetime value, loyalty points, segments (VIP/dormant/new) |
| **Invoices** | AI + quick invoice, GST-ready, **professional PDF download**, UPI payment links + QR code, WhatsApp share |
| **Quotations** | Create quotes → one-click convert to invoice |
| **Accounts** | Expenses + income, daily/monthly cash flow, profit tracking, CSV export |
| **Suppliers & POs** | Vendor CRM, purchase orders, outstanding tracking |
| **AI Assistant** | Natural-language console: "How was business today?", "Who bought cement?", morning briefing |
| **AI Brain** | Learns your business, predicts tasks, asks approval before acting, adapts from your corrections |
| **Quick Actions** | Floating ⚡ bar: low-stock alert, daily closing report, Hindi/Hinglish bot, voice GST invoice |
| **Daily Reports** | Automated WhatsApp report at owner-configured time, with failure logging + retry |
| **Team** | Invite manager/accountant/staff with role-based permissions |
| **Integrations** | Gmail, Google Sheets (OAuth), WhatsApp, Shopify, Tally, QuickBooks (scaffold) |
| **Payments** | UPI deep links (zero setup, native to Indian phones), Stripe checkout (demo mode built in) |
| **Onboarding** | 3-step wizard (category → first products → WhatsApp time), resumeable on reload |
| **Legal** | Privacy Policy + Terms of Use (customized for Indian retail) |
| **Support** | Contact form that emails supportcashiea@gmail.com |

---

## 🧠 AI Provider Options

The app supports 5 AI providers (pick in Settings):

| Provider | Models | Setup |
|----------|--------|-------|
| **OpenRouter** (recommended) | Gemini → Kimi K3 → Llama auto-fallback, 300+ models | `supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...` |
| Vercel AI Gateway | GPT-5.5, Claude, Gemini | `supabase secrets set AI_GATEWAY_API_KEY=vck_...` (needs card) |
| OpenAI | GPT-4o | `supabase secrets set OPENAI_API_KEY=sk-...` |
| Google Gemini | Gemini 1.5 Flash | `supabase secrets set GEMINI_API_KEY=AIza...` |
| Anthropic | Claude 3.5 Sonnet | `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` |

**API keys are NEVER in frontend code.** All keys are read server-side from Supabase secrets.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind CSS |
| Backend | Supabase (PostgreSQL + Auth + 17 Edge Functions) |
| AI | Multi-provider: OpenRouter / Vercel Gateway / OpenAI / Gemini / Anthropic |
| Payments | UPI deep links (zero setup) + Stripe (with demo mode) |
| PDF | jsPDF (client-side, no server needed) |
| Tests | Vitest (213 tests) |
| Deploy | Vercel (frontend) + Supabase (backend) |

---

## 🎭 The Meraj Mascot (floating green TV)

Meraj is a `<MerajDevice />` character used in the bottom nav, the Dashboard card
and the full AI panel. It's a smooth green squircle body (1.2:1 TV form factor)
with a wide 1.52:1 screen, "CASHIEA" + "Meraj" bezel branding, and six animated
face states — `neutral`, `happy`, `sad`, `listening`, `thinking`, `speaking`.

- **Animation:** 8-frame flipbook sprite sheets (CSS `steps()`) and real **24fps
  .webm video loops** (VP9 + alpha) for the large panel character, with automatic
  fallback. The whole device floats with a gentle ±3° tilt and a green glow.
- **Theme-adaptive screen:** black screen + white eyes/mouth in light mode;
  dark mode inverts it (white screen + black eyes/mouth) via one CSS rule.
- **Faces:** interaction states (listening/thinking/speaking) always beat the
  resting `businessMood` (computed in `src/lib/businessMood.ts` from real
  sales/stock/invoice signals).

**Regenerating the art:**

```bash
python3 scripts/generate-meraj-faces.py   # Pillow — sheets, frames, previews
node scripts/build-meraj-videos.mjs       # needs @ffmpeg-installer/ffmpeg (dev dep)
```

A live demo (light/dark toggle, flipbook vs video) is served at `/meraj/demo.html`.

## 📜 Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (localhost:5173) |
| `npm run build` | Type-check + production build |
| `npm test` | Run 213 tests |
| `npm run test:coverage` | Tests with coverage |
| `node --env-file=.env.local index.mjs` | Test the OpenRouter gateway standalone |

---

## 🔒 Security

- ✅ All API keys are Supabase secrets — **never** in frontend code or git
- ✅ Row Level Security on every table — users only see their own data
- ✅ `.env` and `.env.local` are gitignored
- ✅ Passwords hashed by Supabase Auth
- ✅ API keys hashed with SHA-256
- ✅ Edge functions verify JWT on every request

---

##  nothing

| Problem | Fix |
|---------|-----|
| App shows "Setup Screen" | Missing `.env` — fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| Signup shows "Check your email" | Supabase → Authentication → Email → turn off "Confirm email" |
| AI buttons show error toast | Edge functions not deployed — run `supabase functions deploy ...` |
| WhatsApp reports not arriving | Set `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` secrets |
| "Insufficient credits" from AI | OpenRouter auto-falls to a free model — but you can add credits at openrouter.ai |

---

## 📄 License

MIT — for administrative automation. Built with ❤️ for Indian retail businesses.
