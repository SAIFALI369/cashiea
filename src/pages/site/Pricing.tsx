import { Link } from 'react-router-dom'
import { Check, ArrowRight, ShieldCheck, Lock, WifiOff, Zap } from 'lucide-react'
import PublicPageShell, { SectionEyebrow, Mono } from '../../components/PublicPageShell'
import { PLANS } from '../../lib/types'
import { formatINR } from '../../lib/format'

// ────────────────────────────────────────────────────────────────
// Public pricing page. Plans, prices and feature lists render
// straight from the app's PLANS source of truth (src/lib/types.ts)
// so this page can never drift from the product or change pricing.
// Trial / no-card language mirrors the existing landing page.
// ────────────────────────────────────────────────────────────────

const PLAN_ORDER = ['free', 'pro'] as const

const COMPARE = [
  {
    label: 'A normal shop runs on',
    tone: 'muted',
    lines: [
      'A register only you can read',
      'Dues remembered by memory',
      'Stock looked at when it’s empty',
      'GST invoicing after the customer leaves',
      'Reports only when someone forces it',
    ],
  },
  {
    label: 'Cashiea runs it on',
    tone: 'accent',
    lines: [
      'A live ledger of every bill & payment',
      'Automatic reminders + follow-ups',
      'Low-stock alerts before it hurts',
      'Rule-46 invoices at the counter',
      'Tomorrow’s plan in today’s report',
    ],
  },
] as const

const FAQS = [
  { q: 'Can I try it before paying?', a: 'Yes — the ₹0 plan is your 14-day trial with 50 AI actions. No card required.' },
  { q: 'Can I cancel anytime?', a: 'Yes. No lock-in contracts, no setup fees, no hidden charges. Cancel from your dashboard.' },
  { q: 'Any setup fees?', a: 'None. One price per plan, everything listed included. GST as applicable.' },
]

export default function SitePricing() {
  return (
    <PublicPageShell>
      <section className="px-4 pt-14 pb-10 sm:pt-20">
        <div className="max-w-3xl mx-auto text-center">
          <SectionEyebrow>PRICING</SectionEyebrow>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold leading-tight text-fg">
            The price that makes sense.
          </h1>
          <p className="mt-4 text-sm sm:text-base text-fg-muted max-w-xl mx-auto leading-relaxed">
            Most shops waste more than ₹8,000 a month on forgotten dues, late stock and hours of bookkeeping. Start with the free trial, upgrade when it’s paying for itself.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-fg-muted"><ShieldCheck className="w-3.5 h-3.5 text-accent" /> No card required</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-fg-muted"><Lock className="w-3.5 h-3.5 text-accent" /> No lock-in</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-fg-muted"><WifiOff className="w-3.5 h-3.5 text-accent" /> Works offline</span>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-4 items-stretch max-w-4xl mx-auto">
            {PLAN_ORDER.map((key) => {
              const plan = PLANS[key]
              const highlight = key === 'pro'
              return (
                <div key={key} className={`card card-hover p-6 flex flex-col ${highlight ? 'ring-1 ring-accent/40' : ''}`}>
                  <div className="flex items-center justify-between">
                    <Mono className="text-fg-subtle">{plan.name}</Mono>
                    {highlight && <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-mono text-accent-strong">FULLY PREMIUM</span>}
                  </div>
                  <p className="mt-3 text-4xl font-bold text-fg">
                    {plan.price === 0 ? '₹0' : formatINR(plan.price, 0)}
                    <span className="text-base font-medium text-fg-muted">/mo</span>
                  </p>
                  {key === 'pro' && <p className="text-xs text-fg-muted mt-1">That’s <strong className="text-fg">₹267/day</strong> — about one biryani.</p>}
                  <div className="mt-5 space-y-2 text-left flex-1">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2 text-sm text-fg-muted"><Check className="w-4 h-4 text-positive flex-shrink-0 mt-0.5" /> {f}</div>
                    ))}
                  </div>
                  <Link to="/signup" className={`${highlight ? 'btn-primary' : 'btn-secondary'} w-full mt-6 rounded-full`}>
                    {plan.price === 0 ? 'Start free' : 'Start free trial'}
                  </Link>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-fg-subtle mt-4 text-center">No setup fee. No lock-in. Cancel anytime. GST as applicable.</p>

          <div className="grid lg:grid-cols-2 gap-5 items-start mt-10">
            <div className="card card-hover p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                {COMPARE.map((c) => (
                  <div key={c.label} className={`rounded-2xl border p-5 ${c.tone === 'accent' ? 'border-accent/30 bg-accent/5' : 'border-line bg-surface-2/50'}`}>
                    <p className={`text-sm font-bold ${c.tone === 'accent' ? 'text-accent-strong' : 'text-fg'}`}>{c.label}</p>
                    <ul className="mt-4 space-y-2.5">
                      {c.lines.map((line) => (
                        <li key={line} className="flex items-start gap-2 text-xs text-fg-muted leading-relaxed">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${c.tone === 'accent' ? 'bg-accent text-accent-fg' : 'bg-surface-3 text-fg-subtle'}`}><Check className="w-2.5 h-2.5" /></span>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <div className="card card-hover p-6">
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
                <p className="text-sm text-fg font-semibold">Your return math</p>
                <p className="mt-1 text-xs text-fg-muted leading-relaxed">If Cashiea helps you recover <strong className="text-fg">₹8,000</strong> of pending payment — or avoids one stock-out — a month of Premium is paid for. Your typical owners report recovering far more.</p>
              </div>
              <div className="mt-4 space-y-2.5">
                {FAQS.map((item) => (
                  <div key={item.q} className="rounded-2xl bg-surface-2/40 p-4">
                    <p className="text-sm font-semibold text-fg">{item.q}</p>
                    <p className="text-xs text-fg-muted mt-1 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-accent-strong text-accent-fg text-sm font-bold hover:bg-accent hover:shadow-lift transition-all">Start your 14-day free trial <ArrowRight className="w-4 h-4" /></Link>
            <p className="mt-4 flex justify-center gap-4 text-[11px] text-fg-subtle">
              <span className="inline-flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-accent" /> If it doesn’t pay for itself, walk away</span>
            </p>
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
