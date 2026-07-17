import { Link } from 'react-router-dom'
import {
  Sparkles,
  FileText,
  BarChart3,
  Database,
  ScrollText,
  Mail,
  Megaphone,
  Check,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Quote,
} from 'lucide-react'
import { PLANS } from '../lib/types'

const features = [
  { icon: FileText, title: 'AI Invoice Generation', description: 'Describe what you billed in plain English. Get a complete, calculated invoice in seconds.' },
  { icon: BarChart3, title: 'Smart Business Reports', description: 'Paste raw data and get professional financial, sales, or operations reports with insights.' },
  { icon: Database, title: 'Automated Data Entry', description: 'Extract and organize data from 200+ emails daily. Eliminate manual data entry forever.' },
  { icon: ScrollText, title: 'Instant Summaries', description: 'Summarize documents, meetings, or long emails into brief, detailed, or executive formats.' },
  { icon: Mail, title: 'AI Email Assistant', description: 'Draft professional cold outreach, follow-ups, and proposals in your chosen tone instantly.' },
  { icon: Megaphone, title: 'Email Campaign Builder', description: 'Send 50 personalized emails in 5 minutes. A/B testing, follow-ups & sentiment-tracked replies.' },
]

const heroStats = [
  { value: '40+', label: 'hours saved / month' },
  { value: '+38%', label: 'reply rate lift' },
  { value: '5 min', label: 'to send 50 emails' },
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
            <Link to="/case-study" className="hidden sm:inline btn-ghost text-sm">Case Study</Link>
            <Link to="/login" className="btn-ghost text-sm">Sign In</Link>
            <Link to="/signup" className="btn-primary text-sm">
              Start Free <ArrowRight className="w-4 h-4" />
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
            Invoices, reports, data entry, emails & summaries — all automated in seconds.
            The all-in-one AI toolkit for startups and small businesses.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
            <Link to="/signup" className="btn-primary text-base px-8 py-3.5">
              Start 14-Day Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/case-study" className="btn-secondary text-base px-8 py-3.5">
              See Case Study
            </Link>
          </div>
          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-brand-400" /> No credit card</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-brand-400" /> No setup</span>
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-brand-400" /> Cancel anytime</span>
          </div>

          {/* Hero stats */}
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

      {/* Testimonial strip */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="card p-8 bg-gradient-to-br from-brand-900/20 to-transparent">
          <Quote className="w-8 h-8 text-brand-500 mb-3" />
          <p className="text-lg text-slate-200 italic mb-4">
            "I sent 50 personalized follow-ups in five minutes. BizAutomate saved me 40 hours a month and lifted my reply rate by 38%."
          </p>
          <Link to="/case-study" className="text-sm font-semibold text-brand-400 hover:text-brand-300">
            Read Rahul's full story →
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Everything you need to automate ops</h2>
          <p className="text-slate-400 max-w-xl mx-auto">Six powerful AI tools, one subscription. Stop doing busywork.</p>
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

      {/* Pricing */}
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
                {popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-bold whitespace-nowrap">
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
                  Start Free Trial
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
            <p className="text-slate-400 mb-8">Join startups saving 40+ hours every week with BizAutomate AI.</p>
            <Link to="/signup" className="btn-primary text-base px-8 py-3.5">
              Start 14-Day Free Trial <ArrowRight className="w-5 h-5" />
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
            <Link to="/case-study" className="hover:text-white transition-colors">Case Study</Link>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <Link to="/signup" className="hover:text-white transition-colors">Compliance</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
