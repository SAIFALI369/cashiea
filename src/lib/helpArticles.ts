// ────────────────────────────────────────────────────────────────
// Help center content. Every article documents behavior that exists
// in the shipped product — never a feature that doesn't. Bodies are
// markdown rendered through the shared renderMd() sanitizer.
// ────────────────────────────────────────────────────────────────

export interface HelpArticle {
  slug: string
  title: string
  summary: string
  category: string
  body: string
}

export const HELP_CATEGORIES = [
  'Getting started',
  'Billing & POS',
  'Invoices & GST',
  'Stock & products',
  'Customers & khata',
  'Reports & WhatsApp',
  'Meraj',
  'Account & settings',
  'Troubleshooting',
] as const

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'getting-started',
    title: 'Getting started with Cashiea',
    summary: 'Sign up, finish the 3-step onboarding, and take your first bill — in about five minutes.',
    category: 'Getting started',
    body: `
Creating your account takes a few fields: your name, shop name, phone, city, email and a password. No card is required for the 14-day trial.

After signup, a short onboarding wizard walks you through three steps:

1. **Shop category** — tell Cashiea what kind of shop you run (kirana, hardware, medical, garments and more).
2. **Your first products** — add a few items by hand, or import your whole list from a CSV. You can also skip this and start empty.
3. **WhatsApp number & report time** — the number that receives your daily sales report, and when you want it.

Onboarding is resumable — if you leave mid-way, it picks up where you stopped.

Once inside, your dashboard shows today's sales, dues and stock alerts at a glance. The fastest way to learn is to create one real sale (see *Creating your first sale*).`,
  },
  {
    slug: 'first-sale',
    title: 'Creating your first sale (POS)',
    summary: 'How the counter POS works: picking products, barcode scanning, held carts and checkout.',
    category: 'Billing & POS',
    body: `
Open **New Sale** from the navigation. The POS shows your products as a grid or list; tap to add, or scan a barcode with your phone camera to add instantly.

While building a bill you can:

- **Change quantities** with the quick numpad.
- **Hold a cart** if a customer steps away, and resume it later — several carts can wait at once.
- **Attach a customer** so the purchase lands in their history, or sell to a walk-in.

At checkout, take **cash, UPI or card — including split payments** (part cash, part UPI). For cash, the POS shows the change to return.

After the sale you get a digital receipt you can **print, share on WhatsApp, or save as PDF**. Stock levels update automatically.

If the internet drops mid-day, keep billing — see *Billing offline*.`,
  },
  {
    slug: 'split-payments',
    title: 'Payments: cash, UPI, card and split payments',
    summary: 'Taking part-cash part-UPI bills, UPI QR on invoices, and how change math works.',
    category: 'Billing & POS',
    body: `
A bill doesn't have to be paid one way. At checkout choose **split payment** and enter each part — for example ₹500 in cash and ₹1,240 on UPI. The POS keeps a running total and shows the balance left and, for cash, the change to return.

For invoices, Cashiea can print a **UPI QR code** for your own UPI ID, so the customer scans and pays you directly. Cashiea never holds your money — UPI payments go to your UPI ID.

Every payment is recorded against the bill, so dues and the khata stay accurate automatically.`,
  },
  {
    slug: 'offline-billing',
    title: 'Billing offline',
    summary: 'Power cuts and dead zones don’t stop the counter. Sales queue on your device and sync later.',
    category: 'Billing & POS',
    body: `
Cashiea is offline-first. When the network drops, the POS keeps working: sales are saved securely on your device and a sync indicator shows that you're offline.

When you reconnect, queued sales sync automatically — no re-entry, no duplicates. You can review anything still waiting in the sync queue from the sync indicator.

Two honest notes:

- While offline, features that need the server (like Meraj answers and WhatsApp sending) wait until you're back online.
- The app shell itself is installed as a PWA, so reopening the app on a phone with no network still loads your counter.`,
  },
  {
    slug: 'eod-reconciliation',
    title: 'Daily cash reconciliation (end of day)',
    summary: 'Close the day in a minute: expected cash vs counted cash, with variance flagged.',
    category: 'Billing & POS',
    body: `
At closing time, open the **end-of-day** flow from the POS. Cashiea computes the cash it expects in the drawer from today's cash payments, and asks you to count and enter what's actually there.

If the two numbers differ, the **variance is flagged** and recorded, so a leak never hides in "roughly right". A short summary of the day — sales, payment split, variance — is kept with your reports.

Doing this every day is the single highest-value habit in shop bookkeeping; Cashiea makes it a one-minute routine.`,
  },
  {
    slug: 'gst-invoice',
    title: 'Creating a GST invoice',
    summary: 'Rule-46 tax invoices at the counter: GSTIN, HSN, CGST/SGST or IGST, amount in words.',
    category: 'Invoices & GST',
    body: `
Open **Invoices** and create a new tax invoice. Cashiea produces Rule-46 compliant GST invoices with the pieces the law expects:

- **TAX INVOICE** heading and a sequential invoice number.
- Your business name, address and **GSTIN** (validated with a checksum), and the buyer's details and GSTIN where present.
- **HSN/SAC codes** per item and the right **CGST/SGST** (same state) or **IGST** (inter-state) split based on place of supply.
- **Amount in words**, plus a signature line and your **UPI QR** for payment.

For unregistered walk-in customers you can issue a bill of supply style receipt from the POS instead.

Meraj can explain any field on an invoice, and reminds you to confirm edge cases (reverse charge, composition scheme) with your CA — GST specifics deserve a human.`,
  },
  {
    slug: 'recurring-invoices',
    title: 'Recurring invoices (rent & retainers)',
    summary: 'Weekly, monthly or yearly bills that generate themselves — and pause anytime.',
    category: 'Invoices & GST',
    body: `
If you bill the same customer on a schedule — shop rent, a stall fee, a monthly retainer — set up a **recurring invoice profile**: customer, line items, and a weekly, monthly or yearly cycle.

A scheduled job generates each invoice on time, with duplicate protection built in, so you never double-bill a tenant and never forget one either.

Pause or resume a profile anytime from the invoice's recurring settings.`,
  },
  {
    slug: 'managing-products',
    title: 'Managing products',
    summary: 'Add, edit and organise your catalog — including multi-unit pricing like per kg / 500 g / dozen.',
    category: 'Stock & products',
    body: `
The **Products** screen is your catalog: name, SKU/barcode, selling price, cost, stock quantity and a low-stock threshold.

Indian retail rarely sells one unit one way, so a product can carry **multi-unit pricing** — for example per kg, per 500 g, or per dozen — and the POS offers those units at the counter.

Use categories to keep the grid browsable, and the barcode field to make camera scanning work. Deactivate (rather than delete) seasonal items to keep history intact.`,
  },
  {
    slug: 'csv-import',
    title: 'Importing products from CSV',
    summary: 'Bring your whole list in one go — columns are auto-mapped and problems are previewed before anything is written.',
    category: 'Stock & products',
    body: `
From **Products → Import**, choose a CSV file (for example an export from your old billing software or a spreadsheet).

Cashiea then:

1. **Auto-maps columns** — it recognises headers like "item name", "rate", "qty" without manual mapping.
2. **Validates with a preview** — you see what will be created and what was rejected (bad prices, missing names) before anything is written.
3. **Detects duplicate SKUs** against your existing catalog so you don't create twins.

Approve the preview and the products are created in one batch.`,
  },
  {
    slug: 'stock-alerts',
    title: 'Stock levels & low-stock alerts',
    summary: 'Set reorder levels, get alerted before it hurts, and let reorder suggestions do the math.',
    category: 'Stock & products',
    body: `
Every product has a **stock quantity** and a **low-stock threshold**. When a sale pulls stock to or below the threshold, it shows up as a low-stock alert on your dashboard and in Meraj's morning notes.

The **auto-reorder** screen goes further: it looks at how fast each item sold recently and suggests reorder quantities, so thresholds come from your real sales rather than guesswork. Nothing is ordered for you — suggestions wait for your approval.

Every sale at the POS decrements stock automatically; purchases received from suppliers add back to it.`,
  },
  {
    slug: 'managing-customers',
    title: 'Managing customers',
    summary: 'History, segments and dormant-regular detection — know who to call before they drift away.',
    category: 'Customers & khata',
    body: `
Attach customers to sales and Cashiea builds a **360° history**: every bill, payment and due per customer, plus lifetime value.

Customers are grouped into **segments** by behaviour, and Cashiea watches for **dormant regulars** — people who bought on a rhythm and quietly stopped — so you can win them back while it's cheap to do so.

One tap opens **WhatsApp** with the customer's number, and Meraj can draft the follow-up message for your approval.`,
  },
  {
    slug: 'khata',
    title: 'Khata: tracking udhaar (credit)',
    summary: 'A digital udhaar book — who owes what, reminders on WhatsApp, and settled history.',
    category: 'Customers & khata',
    body: `
The **Khata** is your digital udhaar book. When a regular takes goods on credit, it lands in their khata instead of a notebook line.

For each customer you see the open balance and every entry; record payments as they come in (cash or UPI) and the balance settles down with a kept history.

For overdue balances, Cashiea drafts a **polite WhatsApp payment reminder** — you approve it before it sends, like everything Meraj prepares.`,
  },
  {
    slug: 'whatsapp-reports',
    title: 'WhatsApp reports & reminders',
    summary: 'Your daily sales report on WhatsApp, plus payment reminders and receipts — all approval-first.',
    category: 'Reports & WhatsApp',
    body: `
Once your WhatsApp number is set in onboarding, Cashiea sends a **daily sales report** at the time you chose: the day's sales, top items, open dues and stock flags — the whole shop in one message.

WhatsApp also carries:

- **Payment reminders** for overdue khata and invoices.
- **Bills and receipts** shared straight from the POS.
- **Reports** you choose to send from the Reports screen.

Cashiea uses the WhatsApp number you connect; messages that go out to customers are prepared by Meraj and wait for your OK.`,
  },
  {
    slug: 'reports-exports',
    title: 'Reports & exports (PDF, Excel)',
    summary: 'AI-written reports built from your real sales and expenses, exportable to PDF and real .xlsx files.',
    category: 'Reports & WhatsApp',
    body: `
The **Reports** screen builds summaries from your actual transactions, expenses, receivables and stock — nothing is hand-typed.

You can export any report as a **PDF** or a genuine **Excel (.xlsx)** file for your accountant, and share a summary on WhatsApp.

For tax season, the **GST export** screen prepares your sales data in a format you can hand over, and the accounts screens track money in and out. As always, Meraj will explain a report in plain language if you ask.`,
  },
  {
    slug: 'meraj',
    title: 'Meraj: your AI shop manager',
    summary: 'Ask anything by voice or chat in 10 Indian languages. Meraj prepares actions — you approve them.',
    category: 'Meraj',
    body: `
Meraj is the AI staff member inside Cashiea. Ask in **Hindi/Hinglish, English, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam or Punjabi** — by voice or text — and the answer comes from your *real* data: "how was business today?", "who bought cement last month?", "which customers should I follow up?"

Meraj also **acts, with approval**: drafting invoices and WhatsApp reminders, adding products or customers in bulk, generating images, and syncing stock from a Google Sheet. Every action follows the same rhythm — *prepare → confirm → execute* — and nothing goes out without your OK.

Meraj knows Indian compliance basics (GST slabs, GSTIN state codes, Rule-46 invoice needs, filing dates) and is honest about its limits: for anything legal or tax-critical it will tell you to confirm with your CA.`,
  },
  {
    slug: 'team-roles',
    title: 'Staff access & roles',
    summary: 'Bring your team on board with roles: owner, manager, accountant and staff see different powers.',
    category: 'Account & settings',
    body: `
From the **Team** screen, the owner can invite staff. Each member gets a role, and roles decide what they can do:

- **Owner** — everything, including products, money, settings and the team.
- **Manager** — customers, marketing and AI, with read access to stock and billing screens.
- **Accountant** — bills, expenses and reports.
- **Staff** — counter sales and Meraj.

Only the owner can change catalog prices, manage the subscription or apply sensitive settings. If a button looks missing for a team member, it is their role working as designed.`,
  },
  {
    slug: 'account-settings',
    title: 'Account & settings',
    summary: 'Your business profile, GSTIN, UPI ID, theme and preferences — in one place.',
    category: 'Account & settings',
    body: `
**Settings** holds the identity of your shop: business name, address, phone, **GSTIN** (checksum-validated) and the **UPI ID** that appears on your invoices' QR.

You can also switch between **light and dark theme**, adjust your WhatsApp report number and time, and review connected apps such as Google Sheets, Drive and Gmail.

The **Account** screen shows your profile and sign-in details, and the **Subscription** screen shows your trial or plan status.`,
  },
  {
    slug: 'subscription',
    title: 'Trial, subscription & cancellation',
    summary: '14-day free trial, no card, no lock-in. Cancel from the dashboard anytime.',
    category: 'Account & settings',
    body: `
New accounts start on a **14-day free trial** — no card required. When the trial ends you move to the paid plan shown on the pricing page; there are no setup fees and no lock-in contracts.

To cancel, open **Subscription** in the dashboard and cancel there. Your data remains exportable (CSV/Excel/PDF) — it belongs to you.

Billing questions? Contact support from **Support** in the app, or email us — see *Contacting support*.`,
  },
  {
    slug: 'data-privacy',
    title: 'Your data & privacy, in short',
    summary: 'Row-level security, India hosting, exports anytime — and we never sell your data.',
    category: 'Account & settings',
    body: `
The short version of our privacy commitments (the full text lives in the Privacy Policy):

- Each shop's data is isolated by **row-level security** — one business can never read another's records.
- Data is encrypted in transit and hosted in India.
- We do **not sell your data** and do not use your business data to train AI models.
- You can export your records anytime, and cancel anytime.

Questions or data requests go to the grievance contact published in the Privacy Policy.`,
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting common issues',
    summary: 'Login trouble, stuck sync, WhatsApp report not arriving — quick checks that fix most cases.',
    category: 'Troubleshooting',
    body: `
**Can't log in?** Check you're using the email you signed up with, and reset the password from the login screen. If the app says the connection is misconfigured, the deployment's Supabase settings need attention — contact support.

**Sync stuck / offline badge won't clear?** Confirm the device has a working connection, then pull to refresh. Queued sales are kept safely on the device until they sync; the sync indicator shows exactly what is waiting.

**WhatsApp report not arriving?** Verify the number and time in Settings, and that the WhatsApp connection is active under connected apps. Reports are generated daily at your chosen time.

**Barcode scan not reading?** Give the camera permission, improve lighting, and check the product's barcode field matches the code on the pack.

Still stuck? See *Contacting support* — include a screenshot and the page where it happened.`,
  },
  {
    slug: 'contacting-support',
    title: 'Contacting support',
    summary: 'The in-app support desk reaches a human. We typically reply within 24 hours, Monday–Friday.',
    category: 'Troubleshooting',
    body: `
Inside the app, open **Support** to send a message straight to our team — choose a category (general, bug, billing, feature request) and describe what happened. Signed-in messages go to our support mailbox, and we typically reply within **24 hours, Monday–Friday**.

You can also email us directly at the address published on our contact page and in the Privacy Policy.

For faster fixes, include: a screenshot if it's a bug, the page where it happened, and your business type. For billing, include the email on your account.`,
  },
]

export function helpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug)
}

export function helpByCategory(category: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === category)
}
