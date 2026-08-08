import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MerajCharacter } from '../components/MerajCharacter'
import { MerajMark } from '../components/MerajMark'
import {
  ArrowRight, ChevronDown, Check, Menu, X, Receipt, Package, Users, Wallet,
  MessageCircle, FileBarChart, TrendingDown, AlertTriangle, Send, Sparkles,
} from 'lucide-react'

// ── Reveal (scroll-triggered entrance, once) ──────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className}`}>
      {children}
    </div>
  )
}

// ── Logo ──
function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="rgb(var(--accent))" /><stop offset="100%" stopColor="rgb(var(--gold))" /></linearGradient></defs>
      <rect width="100" height="100" rx="24" fill="url(#lg)" />
      <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <circle cx="55" cy="50" r="5" fill="white" />
      <path d="M55 30L55 42M55 58L55 70M35 50L47 50M63 50L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

// ══ SIGNAL WIDGET (hero interactive demo) ══
const SIGNALS = [
  { icon: Users, label: 'Customers', signal: 'Ramesh hasn’t ordered in 47 days', reasoning: 'He used to buy weekly. A call now could bring him back.', action: 'Draft message', color: 'var(--accent)' },
  { icon: Package, label: 'Stock', signal: 'Cooking oil at 3 units', reasoning: 'Below your reorder level of 10. Runs out by tomorrow at current pace.', action: 'Approve reorder', color: 'var(--warning)' },
  { icon: TrendingDown, label: 'Sales', signal: 'Tuesday revenue down 34%', reasoning: 'Same weekday last week was ₹12,400. Today only ₹8,100 so far.', action: 'See breakdown', color: 'var(--negative)' },
  { icon: Wallet, label: 'Cash', signal: 'Invoice #1047 unpaid 12 days', reasoning: '₹3,200 outstanding. This customer usually pays within a week.', action: 'Send reminder', color: 'var(--info)' },
]
function SignalWidget() {
  const [active, setActive] = useState<number | null>(null)
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="grid grid-cols-2 gap-3">
        {SIGNALS.map((s, i) => (
          <button key={i} onClick={() => setActive(active === i ? null : i)} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            className="text-left p-4 rounded-card border transition-all duration-200"
            style={{ background: 'rgb(var(--surface))', borderColor: active === i ? `rgb(${s.color})` : 'rgb(var(--line))', transform: active === i ? 'scale(1.02)' : 'scale(1)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <s.icon className="w-4 h-4" style={{ color: `rgb(${s.color})` }} strokeWidth={1.75} />
              <span className="text-[10px] font-bold tracking-wide uppercase" style={{ color: 'rgb(var(--fg-subtle))' }}>{s.label}</span>
            </div>
            <p className="text-xs font-medium" style={{ color: 'rgb(var(--fg))' }}>{s.signal}</p>
            <AnimatePresence>
              {active === i && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>{s.reasoning}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-2 px-2 py-1 rounded-control" style={{ background: `rgb(${s.color} / 0.12)`, color: `rgb(${s.color})` }}>
                    <Sparkles className="w-3 h-3" /> {s.action}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>
    </div>
  )
}

// ══ THINKING ROOM (interactive demo) ══
const CONCERNS = [
  { key: 'slowing', label: 'Sales are slowing', diagnosis: 'Your weekday average dropped 22% this week. Three products that usually sell daily haven’t moved since Monday.', steps: ['Check if those 3 products are still in stock', 'Send a quick offer to your top 5 weekday customers', 'Compare today’s foot traffic with last week'] },
  { key: 'regular', label: 'A regular hasn’t come back', diagnosis: 'Ramesh bought every week for 8 months, then stopped 47 days ago. No messages, no follow-up was sent.', steps: ['Draft a personal WhatsApp message to Ramesh', 'Offer a small returning-customer discount', 'Set a reminder to check in again next week'] },
  { key: 'cash', label: 'Cash feels tight', diagnosis: '₹18,400 in invoices are overdue across 4 customers. Two are more than 10 days late.', steps: ['Send reminders to the 2 overdue customers', 'Offer early-payment discount on the largest invoice', 'Review which customers habitually pay late'] },
  { key: 'stock', label: 'Stock keeps running out', diagnosis: 'Cooking oil, rice, and sugar all hit zero this week. None had reorder alerts turned on.', steps: ['Turn on low-stock alerts for these 3 items', 'Set reorder levels based on last month’s sales', 'Approve a restocking order now'] },
]
function ThinkingRoom() {
  const [selected, setSelected] = useState<number | null>(null)
  const concern = selected !== null ? CONCERNS[selected] : null
  return (
    <div className="max-w-xl mx-auto">
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {CONCERNS.map((c, i) => (
          <button key={c.key} onClick={() => setSelected(i)}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
            style={{ background: selected === i ? 'rgb(var(--accent))' : 'rgb(var(--surface))', color: selected === i ? 'rgb(var(--accent-fg))' : 'rgb(var(--fg-muted))', border: `1px solid rgb(var(--${selected === i ? 'accent' : 'line'}))` }}>
            {c.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {concern && (
          <motion.div key={concern.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
            className="card p-5">
            <div className="flex items-start gap-3 mb-4">
              <span className="w-8 h-8 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><MerajMark size={18} /></span>
              <p className="text-sm text-fg leading-relaxed">{concern.diagnosis}</p>
            </div>
            <div className="space-y-2">
              {concern.steps.map((step, si) => (
                <motion.div key={si} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + si * 0.09 }}
                  className="flex items-center gap-3 p-2.5 rounded-control" style={{ background: 'rgb(var(--surface-2))' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0" style={{ background: 'rgb(var(--accent-soft))', color: 'rgb(var(--accent))' }}>{si + 1}</span>
                  <span className="text-sm text-fg-muted">{step}</span>
                </motion.div>
              ))}
            </div>
            <Link to="/signup" className="btn-primary w-full mt-4"><Sparkles className="w-4 h-4" /> Try this with your data</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ══ HUB NODES ══
const HUB_NODES = [
  { label: 'Billing', risks: ['Slow checkout', 'Missed customers', 'Manual entry'] },
  { label: 'Inventory', risks: ['Stockouts', 'Overstock', 'No reorder alerts'] },
  { label: 'Customers', risks: ['Lost regulars', 'No follow-up', 'No purchase history'] },
  { label: 'Cash', risks: ['Late payments', 'No reminders', 'Manual chasing'] },
  { label: 'WhatsApp', risks: ['Unanswered questions', 'No automation', 'Missed orders'] },
  { label: 'Reports', risks: ['No daily visibility', 'Manual tallying', 'Late insights'] },
]

const FAQS = [
  { q: 'Do I need technical knowledge?', a: 'No. Setup takes 5 minutes — enter your shop name, add a few products, and you are ready to bill. Meraj learns your business as you use it.' },
  { q: 'Is my data safe?', a: 'Your data is encrypted and stored with row-level security — a database rule that ensures each shop can only access its own records. Your AI conversations are processed by Google Gemini, and your data is never sold or shared.' },
  { q: 'Does Cashiea work offline?', a: 'Cashiea currently requires an internet connection. If your connection drops mid-action, the app shows your sync status and lets you retry. Full offline billing is on the roadmap but not available yet.' },
  { q: 'Which languages does Meraj understand?', a: 'Meraj understands English and Hinglish (Hindi written in Roman script). You can ask questions, create invoices, and send messages in either language.' },
  { q: 'What if I already use a POS or billing app?', a: 'Cashiea works alongside your existing setup. You can import your product list, and Meraj’s tools (WhatsApp reports, customer tracking, daily briefings) add value on top. No need to switch everything overnight.' },
  { q: 'Can I cancel anytime?', a: 'Yes. There are no lock-in contracts, no setup fees, and no hidden charges. Cancel from your dashboard and your data stays yours.' },
]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-paper text-fg">
      {/* ══ 1. NAV ══ */}
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-line" style={{ background: 'rgb(var(--paper) / 0.85)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><Logo size={32} /><span className="font-bold text-lg">Cashiea</span></Link>
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-fg-muted">
            <a href="#thinking" className="hover:text-fg transition-colors">How Meraj thinks</a>
            <a href="#system" className="hover:text-fg transition-colors">One system</a>
            <a href="#pricing" className="hover:text-fg transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-fg transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex btn-ghost text-sm">Login</Link>
            <Link to="/signup" className="btn-primary text-sm">Start free trial</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden icon-btn">{menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-line px-4 py-3 space-y-2">
            <a href="#thinking" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-fg-muted">How Meraj thinks</a>
            <a href="#system" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-fg-muted">One system</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-fg-muted">Pricing</a>
            <a href="#faq" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-fg-muted">FAQ</a>
          </div>
        )}
      </nav>

      {/* ══ 2. HERO ══ */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-16 pb-20">
        <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(ellipse at top, rgb(var(--accent) / 0.08), transparent 60%)' }} />
        <div className="relative max-w-4xl mx-auto text-center">
          <Reveal>
            <div className="flex justify-center mb-6">
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
                <MerajCharacter state="idle" width={96} />
              </motion.div>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight text-fg">
              I’m Meraj. I watch your shop<br className="hidden sm:block" /> so you can run it.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-fg-muted max-w-xl mx-auto leading-relaxed">
              Invoices, stock, customers, payments. I check them every day.<br className="hidden sm:block" /> When something needs you, I tell you first.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link to="/signup" className="btn-primary text-base px-6 py-3.5 h-auto">Start free trial <ArrowRight className="w-4 h-4" /></Link>
              <a href="#thinking" className="btn-secondary text-base px-6 py-3.5 h-auto">See how Meraj thinks</a>
            </div>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-12">
              <p className="text-[11px] font-bold tracking-wide uppercase text-fg-subtle mb-4">Tap a signal to see what Meraj catches</p>
              <SignalWidget />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ MARQUEE ══ */}
      <div className="overflow-hidden border-y border-line py-3" style={{ background: 'rgb(var(--surface))' }}>
        <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="flex gap-8 whitespace-nowrap text-sm text-fg-subtle">
          {Array(2).fill(null).map((_, i) => (
            <span key={i} className="flex gap-8">
              <span>Invoices</span><span>·</span><span>Stock alerts</span><span>·</span><span>Customer follow-ups</span><span>·</span><span>Payment reminders</span><span>·</span><span>Daily sales reports</span><span>·</span><span>WhatsApp broadcasts</span><span>·</span><span>GST billing</span><span>·</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* ══ 4. POSITIONING STATEMENT ══ */}
      <section className="py-20 px-4">
        <Reveal className="max-w-2xl mx-auto text-center">
          <p className="text-xl sm:text-2xl font-semibold text-fg leading-relaxed">
            Most software tells you what happened.<br />
            <span className="text-accent">Meraj tells you what to do next.</span>
          </p>
        </Reveal>
      </section>

      {/* ══ 5. HUB DIAGRAM ══ */}
      <section id="system" className="py-16 px-4" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-fg">One shop. One thinking system.</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {HUB_NODES.map((node, i) => (
              <Reveal key={node.label} delay={i * 60}>
                <div className="card p-4 h-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <h3 className="font-semibold text-fg text-sm">{node.label}</h3>
                  </div>
                  <ul className="space-y-1">
                    {node.risks.map((r) => <li key={r} className="text-xs text-fg-subtle flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-fg-subtle" /> {r}</li>)}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200} className="text-center mt-8">
            <p className="text-sm text-fg-muted max-w-lg mx-auto">Meraj connects every part of the shop into one system, catching problems before they cost a sale.</p>
          </Reveal>
        </div>
      </section>

      {/* ══ 6. THREE-STEP FRAMEWORK ══ */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-3 gap-8">
          {[
            { num: '01', label: 'Spots', text: 'Meraj watches invoices, stock, and payments as they happen.' },
            { num: '02', label: 'Understands', text: 'Meraj checks which problems are connected and which can wait.' },
            { num: '03', label: 'Guides', text: 'One clear action, ready to send. You approve before it goes out.' },
          ].map((s, i) => (
            <Reveal key={s.num} delay={i * 100}>
              <div className="text-center sm:text-left">
                <p className="text-4xl font-bold text-accent mb-2">{s.num}</p>
                <h3 className="font-bold text-fg text-lg mb-1">{s.label}</h3>
                <p className="text-sm text-fg-muted leading-relaxed">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ 8. THINKING ROOM ══ */}
      <section id="thinking" className="py-20 px-4" style={{ background: 'rgb(var(--surface))' }}>
        <Reveal className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-fg mb-2">What needs attention?</h2>
          <p className="text-sm text-fg-muted">Pick a concern. Meraj will diagnose it and build a plan.</p>
        </Reveal>
        <Reveal delay={150}><ThinkingRoom /></Reveal>
      </section>

      {/* ══ 9. WHO IT'S FOR (replaces fabricated testimonials) ══ */}
      <section className="py-16 px-4">
        <Reveal className="max-w-xl mx-auto text-center">
          <p className="text-sm text-fg-muted leading-relaxed">
            Cashiea is built for Indian retail shops — kirana stores, electronics, pharmacies, hardware, restaurants. If you sell from a counter and want to know what needs your attention today, Meraj is your shop’s digital manager.
          </p>
        </Reveal>
      </section>

      {/* ══ 10. PRICING ══ */}
      <section id="pricing" className="py-20 px-4" style={{ background: 'rgb(var(--surface))' }}>
        <Reveal className="max-w-md mx-auto text-center">
          <div className="card p-8">
            <p className="text-sm font-semibold text-fg-subtle uppercase tracking-wide mb-2">Cashiea</p>
            <p className="text-4xl font-bold text-fg">₹7,500<span className="text-lg font-medium text-fg-muted">/month</span></p>
            <p className="text-sm text-fg-muted mt-1">Everything included. No tiers, no upsells.</p>
            <div className="mt-6 space-y-2.5 text-left">
              {['Meraj AI — spots, understands, guides', 'GST invoicing and billing', 'Stock alerts and reordering', 'Customer tracking and follow-ups', 'Daily WhatsApp sales reports', 'Payment reminders', '14-day free trial, no card required'].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-fg-muted"><Check className="w-4 h-4 text-positive flex-shrink-0" /> {f}</div>
              ))}
            </div>
            <Link to="/signup" className="btn-primary w-full mt-6">Start free trial</Link>
            <p className="text-xs text-fg-subtle mt-3">No setup fee. No hidden charges. Cancel anytime.</p>
          </div>
        </Reveal>
      </section>

      {/* ══ 11. FAQ ══ */}
      <section id="faq" className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <Reveal><h2 className="text-2xl font-bold text-fg mb-8 text-center">Questions</h2></Reveal>
          <div className="space-y-3">
            {FAQS.map((item, i) => (
              <Reveal key={i} delay={i * 40}>
                <button onClick={() => setFaqOpen(faqOpen === i ? null : i)} className="w-full text-left card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-fg">{item.q}</p>
                    <ChevronDown className={`w-4 h-4 text-fg-subtle transition-transform flex-shrink-0 ${faqOpen === i ? 'rotate-180' : ''}`} />
                  </div>
                  <AnimatePresence>
                    {faqOpen === i && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><p className="text-sm text-fg-muted mt-2 leading-relaxed">{item.a}</p></motion.div>}
                  </AnimatePresence>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 12. FINAL CTA ══ */}
      <section className="py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(ellipse at center, rgb(var(--accent) / 0.1), transparent 60%)' }} />
        <Reveal className="relative max-w-xl mx-auto text-center">
          <div className="flex justify-center mb-6"><motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity }}><MerajCharacter state="idle" width={72} /></motion.div></div>
          <h2 className="text-2xl sm:text-3xl font-bold text-fg leading-tight">You already know your shop.<br />Meraj makes sure nothing slips through.</h2>
          <p className="text-sm text-fg-muted mt-3">14-day free trial. No card required.</p>
          <Link to="/signup" className="btn-primary text-base px-6 py-3.5 h-auto mt-6 inline-flex">Start free trial <ArrowRight className="w-4 h-4" /></Link>
        </Reveal>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="border-t border-line py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2"><Logo size={24} /><span className="font-semibold text-sm">Cashiea</span></div>
          <div className="flex items-center gap-4 text-xs text-fg-subtle">
            <Link to="/privacy" className="hover:text-fg">Privacy</Link>
            <Link to="/terms" className="hover:text-fg">Terms</Link>
            <a href="#faq" className="hover:text-fg">FAQ</a>
          </div>
          <p className="text-xs text-fg-subtle">Built for Indian retail.</p>
        </div>
      </footer>
    </div>
  )
}
