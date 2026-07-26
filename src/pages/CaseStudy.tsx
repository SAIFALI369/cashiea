import { Link } from 'react-router-dom'
import { Sparkles, ArrowLeft, Clock, TrendingUp, Users, Quote, Check, ShoppingCart } from 'lucide-react'

const results = [
  { icon: Clock, value: '3×', label: 'faster checkout', color: 'text-green-400' },
  { icon: TrendingUp, value: '+27%', label: 'repeat customers', color: 'text-brand-400' },
  { icon: Users, value: '6 hrs', label: 'saved per week', color: 'text-purple-400' },
]

const before = [
  'Slow manual checkout with paper receipts',
  'No customer records — returning buyers were strangers',
  'No idea which products sold best or when to restock',
  'Customers bought once and never came back',
]

const after = [
  'Fast cart-based POS with instant receipts and any payment method',
  'Every customer tracked — lifetime value, history, and segments',
  'Real-time dashboard shows top products and low-stock alerts',
  'Automated win-back campaigns bring dormant customers back',
]

export default function CaseStudy() {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">Cashiea</span>
          </Link>
          <Link to="/" className="btn-ghost text-sm"><ArrowLeft className="w-4 h-4" /> Home</Link>
        </div>
      </nav>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-600/15 text-brand-300 text-xs font-semibold mb-4">CASE STUDY</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
          How a neighborhood retailer tripled checkout speed and grew repeat customers 27%
        </h1>
        <p className="text-slate-400 mb-10">Independent Retail Store · 6-month journey · Published July 2026</p>

        <div className="grid grid-cols-3 gap-4 mb-12">
          {results.map((r) => (
            <div key={r.label} className="card p-4 text-center">
              <r.icon className={`w-7 h-7 mx-auto mb-2 ${r.color}`} />
              <p className="text-3xl font-extrabold text-white">{r.value}</p>
              <p className="text-xs text-slate-400">{r.label}</p>
            </div>
          ))}
        </div>

        <div className="card p-5 mb-12 bg-gradient-to-br from-brand-900/30 to-transparent">
          <Quote className="w-8 h-8 text-brand-500 mb-3" />
          <p className="text-xl text-slate-200 leading-relaxed italic mb-4">
            "Checkout got 3× faster, I finally know who my customers are, and win-back campaigns bring people back every week. Cashiea runs my counter and my growth."
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">M</div>
            <div>
              <p className="font-semibold text-white">Maya Chen</p>
              <p className="text-sm text-slate-400">Owner, Bright Goods Store</p>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          <div className="card p-4">
            <h2 className="font-bold text-white mb-4 text-red-400">Before</h2>
            <ul className="space-y-3">
              {before.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-slate-400"><span className="text-red-400 mt-0.5">✕</span> {b}</li>
              ))}
            </ul>
          </div>
          <div className="card p-4 border-brand-700/40">
            <h2 className="font-bold text-white mb-4 text-green-400">After</h2>
            <ul className="space-y-3">
              {after.map((a) => (
                <li key={a} className="flex items-start gap-2 text-sm text-slate-300"><Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" /> {a}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="prose-content max-w-none space-y-4 text-slate-300 leading-relaxed mb-12">
          <h2>The problem</h2>
          <p>Running a busy retail store, Maya handled checkout manually, kept no customer records, and had no visibility into what sold. Lines built up at the counter, and one-time buyers never returned.</p>
          <h2>The setup</h2>
          <p>In under 20 minutes, Maya added her products to Cashiea, set stock levels, and started ringing up sales on the POS — card, cash, or UPI.</p>
          <h2>The breakthrough</h2>
          <p>The Customer CRM changed everything. Every sale automatically linked to a customer profile, building lifetime value and purchase history. Cashiea flagged dormant customers, and Maya launched a win-back campaign with personalized offers.</p>
          <p>"I sent 60 win-back emails in ten minutes. A third of them came back to shop."</p>
          <h2>The result</h2>
          <p>Six months in, checkout was 3× faster, repeat customers grew 27%, and Maya saved 6 hours a week on admin. She used the full overview dashboard to spot best-sellers and restock before running out.</p>
        </div>

        <div className="card p-6 text-center bg-gradient-to-br from-brand-950/30 to-transparent">
          <h2 className="text-xl font-bold text-white mb-3">Want results like Maya's?</h2>
          <p className="text-slate-400 mb-6">Start your 14-day free trial. No credit card required.</p>
          <Link to="/signup" className="btn-primary px-8 py-3.5">Get Started Free</Link>
        </div>
      </article>
    </div>
  )
}
