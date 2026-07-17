# 🤖 BizAutomate AI

> **AI-powered business & startup task automation SaaS.** Generate invoices, create reports, automate data entry, write emails, and summarize documents — all in seconds. Multi-provider AI (OpenAI, Gemini, Claude) with a subscription model and real Stripe payments.

![Tech Stack](https://img.shields.io/badge/Stack-React%20%2B%20Supabase%20%2B%20AI-blueviolet)
![Payments](https://img.shields.io/badge/Payments-Stripe-635bff)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Tool | What it does |
|------|-------------|
| 🧾 **AI Invoices** | Describe what you billed in plain English → get a complete calculated invoice |
| 📊 **AI Reports** | Paste raw data → get professional financial/sales/operations reports |
| 🗃️ **Data Entry** | Extract & organize data from 200+ emails daily → eliminate manual entry forever |
| 📝 **Summaries** | Condense long documents into brief, bullet, detailed, or executive summaries |
| 📧 **Email Assistant** | Draft professional cold outreach, follow-ups & proposals with tone control |
| 📣 **Email Campaigns** | Send 50 personalized emails in 5 min — A/B testing, follow-ups & sentiment-tracked replies |

**Plus platform features:**
- 🔐 Email/password authentication (Supabase Auth)
- 💳 4-tier subscription plans (Free, Starter, Pro, Enterprise) with usage limits
- 🎁 **14-day free Pro trial** on signup (no credit card)
- 💰 **Real Stripe checkout** + webhooks (auto-provisions & cancels plans)
- ⏱️ **Usage Tracker** — hours & money saved, live on the dashboard
- 📜 **Activity Logs** — full audit trail with CSV/JSON export
- 🔌 **Public API** (`/api-generate-invoice`, `/api-draft-email`) with API key management for 3rd-party integrations
- 📤 **Export options** — CSV & JSON from every data table
- 🛡️ **Compliance page** — GDPR, SOC 2, CCPA, ISO 27001, HIPAA, PCI DSS
- 🔁 **Multi-provider AI** — switch between OpenAI, Gemini & Claude anytime
- 📰 **Case Study page** — convert visitors with real customer ROI stories
- 🎨 Modern, responsive dark UI with Tailwind CSS

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Backend / Auth / DB** | Supabase (PostgreSQL + Auth + Edge Functions) |
| **AI** | Multi-provider: OpenAI GPT-4o, Google Gemini, Anthropic Claude |
| **Payments** | Stripe (Checkout + Webhooks) |
| **Icons** | Lucide React |
| **Deploy** | Vercel (frontend) + Supabase (backend) |

---

## 🚀 Quick Start

### 1. Install
```bash
cd businessautomate-ai
npm install
```

### 2. Set up Supabase
1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → API** and copy your `Project URL` and `anon key`
3. Copy `.env.example` to `.env` and fill in the values:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_STRIPE_ENABLED=false
   ```

### 3. Create the database
1. Open **SQL Editor** in your Supabase dashboard
2. Paste [`supabase/schema.sql`](supabase/schema.sql) → **Run**
3. Paste [`supabase/schema-additions.sql`](supabase/schema-additions.sql) → **Run**

This creates all tables (invoices, reports, data_entries, summaries, emails, subscriptions), Row Level Security policies, triggers, and functions.

### 4. Deploy the AI Edge Function
```bash
npm install -g supabase          # if you don't have the CLI
supabase link --project-ref your-project-ref

# Set at least ONE AI provider key
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

supabase functions deploy ai-automation
```

### 5. Run the app
```bash
npm run dev
```
Open **http://localhost:5173** and sign up! 🎉

> **Note:** With `VITE_STRIPE_ENABLED=false`, plan upgrades run in **demo mode** (instant, no charge) so you can test everything immediately. See the Stripe section below to go live.

---

## 💳 Stripe Setup (Real Payments)

When you're ready to accept money, configure Stripe in 5 steps:

### 1. Create products & prices in Stripe
In the [Stripe Dashboard](https://dashboard.stripe.com/products), create 3 recurring (monthly) products and copy each **Price ID** (`price_...`):
- **Starter** — $19/mo
- **Pro** — $49/mo
- **Enterprise** — $149/mo

### 2. Set the secrets
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PRICE_STARTER=price_...
supabase secrets set STRIPE_PRICE_PRO=price_...
supabase secrets set STRIPE_PRICE_ENTERPRISE=price_...
supabase secrets set APP_URL=https://yourdomain.com
```

### 3. Deploy the payment functions
```bash
supabase functions deploy create-checkout
supabase functions deploy stripe-webhook
```

### 4. Register the webhook
- In Stripe → **Developers → Webhooks → Add endpoint**
- Endpoint URL: `https://<project>.functions.supabase.co/stripe-webhook`
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Copy the **Signing secret** (`whsec_...`) and set it:
  ```bash
  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
  ```

### 5. Flip the flag
Set `VITE_STRIPE_ENABLED=true` in `.env`, rebuild, and you're live! 💰

> The webhook automatically upgrades/downgrades plans and resets usage limits based on Stripe events — no manual work needed.

---

## 📁 Project Structure

```
businessautomate-ai/
├── src/
│   ├── components/           # Layout, Sidebar, UI components
│   ├── context/              # AuthContext (Supabase auth)
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   ├── ai/index.ts       # Multi-provider AI client
│   │   └── types.ts          # TypeScript types & plans
│   └── pages/
│       ├── Landing.tsx       # Marketing page with pricing
│       ├── auth/             # Login & Signup
│       ├── Dashboard.tsx     # Overview & stats
│       ├── Invoices.tsx      # AI invoice generation
│       ├── Reports.tsx       # AI business reports
│       ├── DataEntry.tsx     # AI data extraction
│       ├── Summaries.tsx     # AI text summarization
│       ├── EmailAssistant.tsx# AI email drafting
│       ├── Subscription.tsx  # Plans + Stripe checkout
│       └── Settings.tsx      # Profile & AI provider config
├── supabase/
│   ├── schema.sql            # Core database schema + RLS
│   ├── schema-additions.sql  # Emails table + index
│   ├── config.toml           # Supabase project config
│   └── functions/
│       ├── ai-automation/    # Multi-provider AI edge function
│       ├── create-checkout/  # Stripe Checkout session
│       └── stripe-webhook/   # Stripe event handler
├── vercel.json               # SPA routing for Vercel deploy
├── .env.example
└── package.json
```

---

## 🔑 How the Multi-Provider AI Works

```
┌─────────────┐     ┌──────────────────────┐     ┌──────────────┐
│  React App  │────▶│  Supabase Edge       │────▶│ OpenAI API   │
│  (frontend) │     │  Function            │     │ Gemini API   │
│             │◀────│  (ai-automation)     │◀────│ Claude API   │
└─────────────┘     └──────────────────────┘     └──────────────┘
```

- **API keys never touch the frontend** — they live only as Supabase secrets
- The edge function verifies the user, checks usage limits, calls the selected provider, and increments usage
- Users pick their preferred provider in **Settings** — switch anytime

---

## ☁️ Deployment

### Frontend → Vercel
1. Push this repo to GitHub
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_ENABLED`)
4. Deploy — `vercel.json` handles SPA routing automatically

**Or via CLI:**
```bash
npm i -g vercel
vercel
```

### Backend → Supabase (already hosted)
Your database, auth, and edge functions run on Supabase's infrastructure. Just make sure `APP_URL` secret points to your live Vercel domain.

---

## 🛡️ Security

- ✅ **Row Level Security** on every table — users can only access their own data
- ✅ API keys stored as **Supabase Edge Function secrets** (never in client code)
- ✅ Auth-gated edge function with per-user usage limits
- ✅ Stripe webhooks verified via signature signing
- ✅ `.env` is gitignored — never commit secrets

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (localhost:5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

### 5. (Optional) Email delivery for campaigns

To actually send campaign emails to inboxes (otherwise they're generated as reviewable drafts), connect **Resend**:
1. Create a free account at [resend.com](https://resend.com) and verify your sending domain
2. Set the secrets:
   ```bash
   supabase secrets set RESEND_API_KEY=re_...
   supabase secrets set MAIL_FROM=you@yourdomain.com
   ```
3. Redeploy `campaign-send`. Campaigns will now deliver + track opens automatically.

---

## 📄 License

MIT — free to use for your own SaaS. Build something great! 🚀

---

## 🤝 Need Help?

1. Check the Supabase docs: [supabase.com/docs](https://supabase.com/docs)
2. Make sure your `.env` values are correct
3. Confirm the edge functions deployed and secrets are set
4. Verify both SQL scripts ran successfully
5. For Stripe, confirm the webhook signing secret matches

---

Built with ❤️ for founders and small businesses.
