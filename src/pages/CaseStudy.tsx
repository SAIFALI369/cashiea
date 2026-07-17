import { Link } from 'react-router-dom'
import { Sparkles, ArrowLeft, Clock, DollarSign, TrendingUp, Quote, Check } from 'lucide-react'

const results = [
  { icon: Clock, value: '40 hrs', label: 'saved per month', color: 'text-green-400' },
  { icon: DollarSign, value: '$5K', label: 'monthly ARR', color: 'text-emerald-400' },
  { icon: TrendingUp, value: '+38%', label: 'reply rate', color: 'text-purple-400' },
]

const before = [
  'Manual invoicing eating 6+ hours weekly',
  'Founder drafting every cold email by hand',
  'Scattered spreadsheets for client data',
  'No follow-up system — deals slipping away',
]

const after = [
  'Invoices generated from a one-line description in seconds',
  'Bulk personalized cold emails with A/B tested subjects',
  'Messy client data auto-extracted into clean records',
  'Automated follow-up sequences close 38% more deals',
]

export default function CaseStudy() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">BizAutomate AI</span>
          </Link>
          <Link to="/" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Home</Link>
        </div>
      </nav>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-600/15 text-brand-300 text-xs font-semibold mb-4">CASE STUDY</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
          How a solo founder saved 40 hours/month and hit $5K ARR with BizAutomate AI
        </h1>
        <p className="text-slate-400 mb-10">SaaS Operations · 6-month journey · Published July 2026</p>

        {/* Result stats */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {results.map((r) => (
            <div key={r.label} className="card p-6 text-center">
              <r.icon className={`w-7 h-7 mx-auto mb-2 ${r.color}`} />
              <p className="text-3xl font-extrabold text-white">{r.value}</p>
              <p className="text-xs text-slate-400">{r.label}</p>
            </div>
          ))}
        </div>

        {/* Quote */}
        <div className="card p-8 mb-12 bg-gradient-to-br from-brand-900/30 to-transparent">
          <Quote className="w-8 h-8 text-brand-500 mb-3" />
          <p className="text-xl text-slate-200 leading-relaxed italic mb-4">
            "I was drowning in admin work — invoices, emails, data entry. BizAutomate gave me back a full work week every month. It's like hiring an assistant for the price of a coffee subscription."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">R</div>
            <div>
              <p className="font-semibold text-white">Rahul Mehta</p>
              <p className="text-sm text-slate-400">Founder, FreelanceStack</p>
            </div>
          </div>
        </div>

        {/* Before / After */}
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          <div className="card p-6">
            <h2 className="font-bold text-white mb-4 text-red-400">Before</h2>
            <ul className="space-y-3">
              {before.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✕</span> {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-6 border-brand-700/40">
            <h2 className="font-bold text-white mb-4 text-green-400">After</h2>
            <ul className="space-y-3">
              {after.map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /> {a}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Story */}
        <div className="prose-content max-w-none space-y-4 text-slate-300 leading-relaxed mb-12">
          <h2>The problem</h2>
          <p>Like most solo founders, Rahul wore every hat — sales, billing, ops, support. The non-billable busywork crept to 10+ hours a week, leaving little time to actually grow the business.</p>
          <h2>The setup</h2>
          <p>In under 15 minutes, Rahul connected his Supabase-backed stack to BizAutomate AI and picked OpenAI as his provider. He started with the two biggest time-sinks: invoicing and cold outreach.</p>
          <h2>The breakthrough</h2>
          <p>The Email Campaign Builder was the turning point. Rahul uploads a list of 50 prospects, writes one base email, and BizAutomate personalizes every single one — with A/B tested subject lines and an automated 3-touch follow-up sequence. Reply rates jumped 38%.</p>
          <p>"I sent 50 personalized follow-ups in five minutes. That used to take me a full day."</p>
          <h2>The result</h2>
          <p>Six months in, Rahul reclaimed 40 hours a month — the equivalent of a part-time hire he never had to make. He reinvested that time into sales and crossed $5K in monthly recurring revenue.</p>
        </div>

        {/* CTA */}
        <div className="card p-10 text-center bg-gradient-to-br from-brand-900/30 to-transparent">
          <h2 className="text-2xl font-bold text-white mb-3">Want results like Rahul's?</h2>
          <p className="text-slate-400 mb-6">Start your 14-day free Pro trial. No credit card required.</p>
          <Link to="/signup" className="btn-primary px-8 py-3.5">Get Started Free</Link>
        </div>
      </article>
    </div>
  )
}
