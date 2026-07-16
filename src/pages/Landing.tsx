import { Link } from 'react-router-dom'
import {
  Sparkles,
  FileText,
  BarChart3,
  Database,
  ScrollText,
  Check,
  ArrowRight,
  Zap,
  Shield,
  Clock,
} from 'lucide-react'
import { PLANS } from '../lib/types'

const features = [
  {
    icon: FileText,
    title: 'AI Invoice Generation',
    description: 'Describe what you billed in plain English. Get a complete, calculated invoice in seconds.',
  },
  {
    icon: BarChart3,
    title: 'Smart Business Reports',
    description: 'Paste raw data and get professional financial, sales, or operations reports with insights.',
  },
  {
    icon: Database,
    title: 'Automated Data Entry',
    description: 'Extract structured data from messy text, emails, or notes into clean JSON automatically.',
  },
  {
    icon: ScrollText,
    title: 'Instant Summaries',
    description: 'Summarize documents, meetings, or long emails into brief, detailed, or executive formats.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white text-lg">BizAutomate AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="btn-ghost text-sm">Sign In</Link>
            <Link to="/signup" className="btn-primary text-sm">
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950/40 via-slate-950 to-slate-950" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-600/10 border border-brand-700/50 text-brand-300 text-sm font-medium mb-6 animate-fade-in">
            <Zap className="w-4 h-4" />
            Powered by GPT-4o, Gemini & Claude
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white leading-tight mb-6 animate-slide-up">
            Automate Your Business
            <br />
            <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-purple-400 bg-clip-text text-transparent">
              Tasks with AI
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-10 animate-slide-up">
            Generate invoices, create reports, automate data entry, and summarize documents —
            all in seconds. The all-in-one AI toolkit for startups and small businesses.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link to="/signup" className="btn-primary text-base px-8 py-3.5">
              Start Free — 50 AI Actions <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/login" className="btn-secondary text-base px-8 py-3.5">
              Sign In
            </Link>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-brand-400" /> Secure</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-brand-400" /> No setup</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-brand-400" /> Cancel anytime</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Everything you need to automate ops</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Four powerful AI tools, one subscription. Stop doing busywork.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
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

      {/* Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-slate-400">Start free. Upgrade when you grow. Cancel anytime.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Object.entries(PLANS).map(([key, plan]) => {
            const popular = key === 'pro'
            return (
              <div
                key={key}
                className={`card p-6 relative ${popular ? 'border-brand-600 ring-1 ring-brand-600/50' : ''}`}
              >
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-bold">
                    Most Popular
                  </div>
                )}
                <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                <div className="my-4">
                  <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                  <span className="text-slate-500 text-sm">/mo</span>
                </div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-slate-400">
                      <Check className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block text-center text-sm py-2.5 rounded-xl font-semibold transition-all ${
                    popular
                      ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white hover:from-brand-500 hover:to-brand-400'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {plan.price === 0 ? 'Start Free' : `Choose ${plan.name}`}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-20">
        <div className="card p-10 sm:p-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-950/30 to-transparent" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white mb-3">Ready to automate your business?</h2>
            <p className="text-slate-400 mb-8">Join startups saving hours every week with BizAutomate AI.</p>
            <Link to="/signup" className="btn-primary text-base px-8 py-3.5">
              Get Started Free <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm">© 2026 BizAutomate AI. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
