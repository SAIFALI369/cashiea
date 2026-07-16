# 🤖 BizAutomate AI

> **AI-powered business & startup task automation SaaS.** Generate invoices, create reports, automate data entry, and summarize documents — all in seconds. Multi-provider AI (OpenAI, Gemini, Claude) with a subscription model.

![Tech Stack](https://img.shields.io/badge/Stack-React%20%2B%20Supabase%20%2B%20AI-blueviolet)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Tool | What it does |
|------|-------------|
| 🧾 **AI Invoices** | Describe what you billed in plain English → get a complete calculated invoice |
| 📊 **AI Reports** | Paste raw data → get professional financial/sales/operations reports |
| 🗃️ **Data Entry** | Extract structured JSON from messy text, emails, or notes |
| 📝 **Summaries** | Condense long documents into brief, bullet, detailed, or executive summaries |

**Plus:**
- 🔐 Email/password authentication (via Supabase Auth)
- 💳 4-tier subscription plans (Free, Starter, Pro, Enterprise) with usage limits
- 🔁 **Multi-provider AI** — switch between OpenAI, Gemini & Claude anytime
- 📊 Usage tracking & metering per user
- 🎨 Modern, responsive dark UI with Tailwind CSS

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Backend / Auth / DB** | Supabase (PostgreSQL + Auth + Edge Functions) |
| **AI** | Multi-provider: OpenAI GPT-4o, Google Gemini, Anthropic Claude |
| **Icons** | Lucide React |

---

## 🚀 Quick Start

### 1. Clone & install
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
   ```

### 3. Create the database
1. Open **SQL Editor** in your Supabase dashboard
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**

This creates all tables, Row Level Security policies, triggers, and functions.

### 4. Deploy the AI Edge Function
```bash
# Install Supabase CLI (if you don't have it)
npm install -g supabase

# Link your project
supabase link --project-ref your-project-ref

# Set your AI API keys as secrets (set at least one)
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# Deploy the function
supabase functions deploy ai-automation
```

### 5. Run the app
```bash
npm run dev
```

Open **http://localhost:5173** and sign up! 🎉

---

## 💳 Adding Real Payments (Stripe)

The app includes a demo checkout that updates the plan directly. To accept real money:

1. Install Stripe: `npm install stripe @stripe/stripe-js`
2. Create a new Edge Function `create-checkout`:
   ```ts
   import Stripe from "https://esm.sh/stripe";
   const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
   // Create a Checkout Session, return the URL
   ```
3. Replace `handleUpgrade` in `src/pages/Subscription.tsx` with:
   ```ts
   const { data } = await supabase.functions.invoke('create-checkout', { body: { plan } });
   window.location.href = data.url;
   ```
4. Add a webhook function to update the plan on successful payment.

---

## 📁 Project Structure

```
businessautomate-ai/
├── src/
│   ├── components/          # Layout, Sidebar, UI components
│   ├── context/             # AuthContext (Supabase auth)
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   ├── ai/index.ts      # Multi-provider AI client
│   │   └── types.ts         # TypeScript types & plans
│   └── pages/
│       ├── Landing.tsx      # Marketing page with pricing
│       ├── auth/            # Login & Signup
│       ├── Dashboard.tsx    # Overview & stats
│       ├── Invoices.tsx     # AI invoice generation
│       ├── Reports.tsx      # AI business reports
│       ├── DataEntry.tsx    # AI data extraction
│       ├── Summaries.tsx    # AI text summarization
│       ├── Subscription.tsx # Plan management
│       └── Settings.tsx     # Profile & AI provider config
├── supabase/
│   ├── schema.sql           # Database schema + RLS
│   └── functions/
│       └── ai-automation/   # Multi-provider AI edge function
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

## 🛡️ Security

- ✅ **Row Level Security** on every table — users can only access their own data
- ✅ API keys stored as **Supabase Edge Function secrets** (never in client code)
- ✅ Auth-gated edge function with per-user usage limits
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

## 📄 License

MIT — free to use for your own SaaS. Build something great! 🚀

---

## 🤝 Need Help?

1. Check the Supabase docs: [supabase.com/docs](https://supabase.com/docs)
2. Make sure your `.env` values are correct
3. Confirm the edge function deployed and secrets are set
4. Verify the SQL schema ran successfully

---

Built with ❤️ for founders and small businesses.
