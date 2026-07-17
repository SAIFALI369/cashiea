import { Link } from 'react-router-dom'
import {
  Sparkles, ShoppingCart, Users, BarChart3, Megaphone, Package,
  Check, ArrowRight, Zap, Shield, Clock, Quote, Receipt,
} from 'lucide-react'
import { PLANS } from '../lib/types'

const features = [
  { icon: ShoppingCart, title: 'Cashier / POS Checkout', description: 'Ring up sales fast at the counter — cart, tax, discounts, and instant receipts. Card, cash, UPI or wallet.' },
  { icon: Users, title: 'Customer CRM', description: 'Capture every client\'s details, purchase history, lifetime value, and segment them for smarter selling.' },
  { icon: BarChart3, title: 'Full Sales Overview', description: 'Real-time dashboard — today\'s revenue, top products, best customers, and low-stock alerts.' },
  { icon: Megaphone, title: 'Retargeting Campaigns', description: 'Win back dormant customers with personalized offers. Bulk email with A/B testing and tracking.' },
  { icon: Package, title: 'Products & Inventory', description: 'Track stock levels, set low-stock alerts, and watch inventory value — auto-decrement on every sale.' },
  { icon: Receipt, title: 'AI Invoices & Receipts', description: 'Generate professional invoices and receipts in seconds. Export, print, or email to customers.' },
]

const heroStats = [
  { value: '3×', label: 'faster checkout' },
  { value: '+27%', label: 'repeat customers' },
  { value: '0', label: 'missed restocks' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg">BizAutomate</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/case-study" className="hidden sm:inline btn-ghost text-sm">Case Study</Link>
            <Link to="/login" className="btn-ghost text-sm">Sign In</Link>
            <Link to="/signup" className="btn-primary text-sm">Start Free <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950/40 via-slate-950 to-slate-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-700/50 text-brand-300 text-sm font-medium mb-6 animate-fade-in">
            <Zap className="w-4 h-4" /> POS + CRM + Retargeting, in one place
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-tight mb-6 animate-slide-up">
            Run your cashier desk.
            <br />
            <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-purple-400 bg-clip-text text-transparent">
              Grow your customers.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 animate-slide-up">
            Bill customers, capture their details, see your whole business at a glance, and win them
            back with smart retargeting. The all-in-one counter & customer-growth platform for any retail business.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link to="/signup" className="btn-primary text-base px-8 py-3.5">Start 14-Day Free Trial <ArrowRight className="w-5 h-5" /></Link>
            <Link to="/case-study" className="btn-secondary text-base px-8 py-3.5">See Case Study</Link>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-brand-400" /> No card needed</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-brand-400" /> Setup in minutes</span>
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-brand-400" /> Any product type</span>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-12">
            {heroStats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="card p-8 bg-gradient-to-br from-brand-900/20 to-transparent">
          <Quote className="w-8 h-8 text-brand-500 mb-3" />
          <p className="text-lg text-slate-200 italic mb-4">
            "Checkout got 3× faster and my repeat customers jumped 27%. BizAutomate runs my counter and brings people back — I just ring up sales."
          </p>
          <Link to="/case-study" className="text-sm font-semibold text-brand-400 hover:text-brand-300">Read Maya's full story →</Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Everything your counter needs</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Bill, track, understand, and re-engage — all from one dashboard.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div key={f.title} className="card p-6 hover:border-brand-700/50 transition-all hover:-translate-y-1 group">
              <div className="w-12 h-12 rounded-xl bg-brand-600/15 border border-brand-700/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="font-semibold text-white text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-slate-400">14-day free trial on every plan. No credit card required.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Object.entries(PLANS).map(([key, plan]) => {
            const popular = key === 'pro'
            return (
              <div key={key} className={`card p-6 relative ${popular ? 'border-brand-600 ring-1 ring-brand-600/50' : ''}`}>
                {popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-bold whitespace-nowrap">Most Popular</div>}
                <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                <div className="my-4"><span className="text-4xl font-extrabold text-white">${plan.price}</span><span className="text-slate-500 text-sm">/mo</span></div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-slate-400"><Check className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />{feat}</li>
                  ))}
                </ul>
                <Link to="/signup" className={`block text-center text-sm py-2.5 rounded-xl font-semibold transition-all ${popular ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>Start Free Trial</Link>
              </div>
            )
          })}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
        <div className="card p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-950/30 to-transparent" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white mb-3">Ready to upgrade your counter?</h2>
            <p className="text-slate-400 mb-8">Join retail businesses ringing up sales and growing customers with BizAutomate.</p>
            <Link to="/signup" className="btn-primary text-base px-8 py-3.5">Start 14-Day Free Trial <ArrowRight className="w-5 h-5" /></Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">© 2026 BizAutomate. Cashier, CRM & customer growth for retail.</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/case-study" className="hover:text-white transition-colors">Case Study</Link>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
