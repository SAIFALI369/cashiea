import { Link } from 'react-router-dom'
import {
  ScanBarcode, Receipt, BookOpen, Package, Users, MessageCircle, Repeat, FileBarChart,
  Calculator, WifiOff, Landmark, Sparkles, ShieldCheck, ArrowRight, FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react'
import PublicPageShell, { SectionEyebrow, Mono } from '../../components/PublicPageShell'

// ────────────────────────────────────────────────────────────────
// Public features page. Documents shipped behaviour only — the same
// capabilities listed on the landing page and in the product.
// ────────────────────────────────────────────────────────────────

interface Feature {
  icon: LucideIcon
  label: string
  desc: string
  points: string[]
}

const GROUPS: { title: string; blurb: string; items: Feature[] }[] = [
  {
    title: 'Counter & billing',
    blurb: 'The rush hour is the job. Everything here is built to keep the line moving.',
    items: [
      {
        icon: ScanBarcode,
        label: 'Counter POS',
        desc: 'A fast product grid with camera barcode scanning, held & resumed carts and a quick-quantity numpad.',
        points: ['Split payments — cash + UPI + card with live change math', 'Hold a cart when a customer steps away, resume anytime', 'Digital receipts: print, WhatsApp or PDF'],
      },
      {
        icon: Receipt,
        label: 'GST tax invoices',
        desc: 'Rule-46 compliant tax invoices generated at the counter, not after the customer leaves.',
        points: ['HSN codes and CGST/SGST or IGST split by place of supply', 'Amount in words, signature line, UPI QR', 'GSTIN checksum validation on your details'],
      },
      {
        icon: Calculator,
        label: 'Cash reconciliation',
        desc: 'End-of-day in a minute: expected cash vs counted cash, with the variance flagged and recorded.',
        points: ['Daily closing summary kept with your reports', 'Splits by payment method so the drawer always explains itself'],
      },
      {
        icon: WifiOff,
        label: 'Works offline',
        desc: 'Power cuts and dead zones don’t stop billing. Sales queue on your device and sync when you reconnect.',
        points: ['Visible sync status and queue review', 'No re-entry, no duplicates on reconnect'],
      },
    ],
  },
  {
    title: 'Stock & customers',
    blurb: 'Know what you have and who owes you — without walking the shelves at midnight.',
    items: [
      {
        icon: Package,
        label: 'Stock & inventory',
        desc: 'Live stock that decrements with every sale, with low-stock alerts before it hurts.',
        points: ['Multi-unit pricing — per kg / 500 g / dozen', 'Reorder suggestions built from last month’s sales', 'Bulk CSV import with column auto-mapping and duplicate-SKU detection'],
      },
      {
        icon: BookOpen,
        label: 'Khata (udhaar book)',
        desc: 'A digital credit ledger: who owes what, reminders on WhatsApp, settled history kept.',
        points: ['Record part-payments as they come in', 'Polite overdue reminders, drafted for your approval'],
      },
      {
        icon: Users,
        label: 'Customers',
        desc: 'Every bill builds a history. Segments and dormant-regular detection show who to call this week.',
        points: ['Lifetime value and full purchase history per customer', 'One-tap WhatsApp follow-ups'],
      },
      {
        icon: Repeat,
        label: 'Recurring invoices',
        desc: 'Rent and retainers bill themselves — weekly, monthly or yearly, duplicate-proof, pause anytime.',
        points: ['Scheduled generation with your approval flow', 'Pause or resume a profile in one tap'],
      },
    ],
  },
  {
    title: 'Meraj & automation',
    blurb: 'The 90% of a manager’s work that shouldn’t eat your evening.',
    items: [
      {
        icon: Sparkles,
        label: 'Meraj, the AI manager',
        desc: 'Answers from your real data — “how was business today?”, “who bought cement last month?” — by voice or chat.',
        points: ['10 Indian languages: Hindi/Hinglish, English, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi', 'Prepare → confirm → execute: nothing goes out without your OK', 'India-compliance aware, and honest about its limits'],
      },
      {
        icon: MessageCircle,
        label: 'WhatsApp automation',
        desc: 'The daily sales report, payment reminders, bills and receipts — on the app you already live in.',
        points: ['Daily report at your chosen time: sales, top items, dues, stock', 'Reminders drafted by Meraj, sent only with approval'],
      },
      {
        icon: FileBarChart,
        label: 'AI reports',
        desc: 'Reports written from your real transactions, expenses, receivables and stock — never hand-typed.',
        points: ['Export to PDF or genuine Excel (.xlsx)', 'GST export prepared for your accountant'],
      },
      {
        icon: FileSpreadsheet,
        label: 'Connected apps',
        desc: 'Google Sheets, Drive and Gmail connections let Meraj work where your records already are.',
        points: ['Sync stock from a Google Sheet', 'Read orders and inquiries from connected Gmail'],
      },
    ],
  },
  {
    title: 'Trust & control',
    blurb: 'Your data, your shop, your approval on everything.',
    items: [
      {
        icon: ShieldCheck,
        label: 'Security by design',
        desc: 'Row-level security means each shop only sees itself. Data encrypted in transit, hosted in India.',
        points: ['DPDP Act 2023 aligned privacy practices', 'Export anytime, cancel anytime'],
      },
      {
        icon: Landmark,
        label: 'India-first compliance',
        desc: 'GSTIN validation, state codes, HSN reference and the filing calendar — Meraj knows the rules.',
        points: ['Rule-46 invoice structure built in', 'General guidance with a “confirm with your CA” honesty'],
      },
      {
        icon: Users,
        label: 'Team roles',
        desc: 'Owner, manager, accountant and staff — each role sees exactly the powers it should.',
        points: ['Only the owner touches prices, subscription and settings', 'Invite staff from the Team screen'],
      },
    ],
  },
]

export default function SiteFeatures() {
  return (
    <PublicPageShell>
      <section className="px-4 pt-14 pb-10 sm:pt-20 text-center">
        <div className="max-w-3xl mx-auto">
          <SectionEyebrow>FEATURES</SectionEyebrow>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold leading-tight text-fg">
            One app. <span className="text-accent">The whole shop.</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-fg-muted max-w-xl mx-auto leading-relaxed">
            Stop stitching together a billing machine, a khata register, WhatsApp and an accountant’s spreadsheet. Cashiea runs it all — and Meraj runs the boring 90%.
          </p>
        </div>
      </section>

      {GROUPS.map((group, gi) => (
        <section key={group.title} className="px-4 py-12" style={gi % 2 === 0 ? { background: 'rgb(var(--surface))' } : undefined}>
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <Mono className="text-accent-strong">0{gi + 1}</Mono>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-fg">{group.title}</h2>
              <p className="mt-2 text-sm text-fg-muted">{group.blurb}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {group.items.map((f) => (
                <div key={f.label} className="card card-hover p-5 h-full">
                  <span className="w-10 h-10 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-3"><f.icon className="w-4 h-4" strokeWidth={1.75} /></span>
                  <p className="text-base font-bold text-fg">{f.label}</p>
                  <p className="text-sm text-fg-muted mt-1 leading-relaxed">{f.desc}</p>
                  <ul className="mt-3 space-y-1.5">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-xs text-fg-muted leading-relaxed">
                        <span className="w-1 h-1 rounded-full bg-accent inline-block mt-1.5 flex-shrink-0" />{p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className="px-4 py-16 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-fg">See it with your own shop’s data.</h2>
          <p className="mt-3 text-sm text-fg-muted">14-day free trial. No card required. Setup in about five minutes.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 mt-6 px-8 py-4 rounded-full bg-accent-strong text-accent-fg text-sm font-bold hover:bg-accent hover:shadow-lift transition-all">Start free trial <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </section>
    </PublicPageShell>
  )
}
