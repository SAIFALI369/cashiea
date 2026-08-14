import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MerajAvatar } from '../components/MerajAvatar'
import { MerajMark } from '../components/MerajMark'
import { ArrowRight, ArrowDown, ChevronDown, Check, Menu, X, Sparkles, Receipt, Package, Users, Wallet, MessageCircle, FileBarChart } from 'lucide-react'

// ── Reveal (scroll-triggered, once) ──
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [v, setV] = useState(false)
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); o.disconnect() } }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' })
    if (ref.current) o.observe(ref.current)
    return () => o.disconnect()
  }, [])
  return <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${v ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className}`}>{children}</div>
}

// ── Logo ──
function Logo({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 100 100" fill="none"><defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="rgb(var(--accent))" /><stop offset="100%" stopColor="rgb(var(--gold))" /></linearGradient></defs><rect width="100" height="100" rx="24" fill="url(#lg)" /><path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" /><circle cx="55" cy="50" r="5" fill="white" /><path d="M55 30L55 42M55 58L55 70M35 50L47 50M63 50L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" /></svg>
}

// ── Monospace label ──
function Mono({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-mono text-[10px] uppercase tracking-[0.18em] ${className}`}>{children}</span>
}

// ── Signal cards data ──
const SIGNALS = [
  { icon: Users, label: 'Customers', text: 'Ramesh hasn’t ordered in 47 days', color: 'var(--accent)' },
  { icon: Package, label: 'Stock', text: 'Cooking oil at 3 units — below reorder', color: 'var(--warning)' },
  { icon: Wallet, label: 'Cash', text: 'Invoice #1047 unpaid 12 days', color: 'var(--negative)' },
  { icon: Receipt, label: 'Sales', text: 'Tuesday revenue down 34%', color: 'var(--info)' },
]
function SignalCard({ s, className = '' }: { s: typeof SIGNALS[0]; className?: string }) {
  return (
    <div className={`card p-3 flex items-center gap-2.5 ${className}`}>
      <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: `rgb(${s.color})` }} />
      <div className="min-w-0">
        <Mono className="text-fg-subtle block mb-0.5">{s.label}</Mono>
        <p className="text-xs font-medium text-fg truncate">{s.text}</p>
      </div>
    </div>
  )
}

// ── Thinking Room ──
const CONCERNS = [
  { key: 'slowing', label: 'Sales are slowing', diagnosis: 'Weekday average dropped 22%. Three products that usually sell daily haven’t moved since Monday.', steps: ['Check if those 3 products are still in stock', 'Send an offer to your top 5 weekday customers', 'Compare foot traffic with last week'] },
  { key: 'regular', label: 'A regular hasn’t come back', diagnosis: 'Ramesh bought every week for 8 months, then stopped 47 days ago.', steps: ['Draft a WhatsApp message to Ramesh', 'Offer a returning-customer discount', 'Set a reminder for next week'] },
  { key: 'cash', label: 'Cash feels tight', diagnosis: '₹18,400 in overdue invoices across 4 customers. Two are 10+ days late.', steps: ['Send reminders to the 2 late payers', 'Offer early-payment on the largest invoice', 'Review habitual late payers'] },
  { key: 'stock', label: 'Stock keeps running out', diagnosis: 'Cooking oil, rice, sugar all hit zero this week. No reorder alerts were set.', steps: ['Turn on low-stock alerts for these 3', 'Set reorder levels from last month’s sales', 'Approve a restocking order'] },
]
function ThinkingRoom() {
  const [sel, setSel] = useState<number | null>(null)
  const c = sel !== null ? CONCERNS[sel] : null
  return (
    <div className="max-w-lg mx-auto">
      <div className="flex flex-wrap gap-2 justify-center mb-6">
        {CONCERNS.map((cn, i) => (
          <button key={cn.key} onClick={() => setSel(i)} className="px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{ background: sel === i ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>
            {cn.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {c && (
          <motion.div key={c.key} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
            className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="flex items-start gap-3 mb-4">
              <span className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}><MerajMark size={18} className="text-white" /></span>
              <p className="text-sm text-white leading-relaxed">{c.diagnosis}</p>
            </div>
            <div className="space-y-2">
              {c.steps.map((step, si) => (
                <motion.div key={si} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + si * 0.09 }}
                  className="flex items-center gap-3 p-2.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 text-white" style={{ background: 'rgba(255,255,255,0.2)' }}>{si + 1}</span>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{step}</span>
                </motion.div>
              ))}
            </div>
            <Link to="/signup" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full bg-white text-sm font-bold" style={{ color: 'rgb(var(--accent-strong))' }}>
              <Sparkles className="w-4 h-4" /> Try with your data
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Hub nodes ──
const HUB = [
  { label: 'Billing', risks: ['Slow checkout', 'Missed customers', 'Manual entry'], icon: Receipt },
  { label: 'Inventory', risks: ['Stockouts', 'Overstock', 'No reorder alerts'], icon: Package },
  { label: 'Customers', risks: ['Lost regulars', 'No follow-up', 'No history'], icon: Users },
  { label: 'Cash', risks: ['Late payments', 'No reminders', 'Manual chasing'], icon: Wallet },
  { label: 'WhatsApp', risks: ['Unanswered questions', 'No automation', 'Missed orders'], icon: MessageCircle },
  { label: 'Reports', risks: ['No daily visibility', 'Manual tallying', 'Late insights'], icon: FileBarChart },
]

const FAQS = [
  { q: 'Do I need technical knowledge?', a: 'No. Setup takes 5 minutes — enter your shop name, add products, and you are ready to bill.' },
  { q: 'Is my data safe?', a: 'Your data is encrypted and protected by row-level security — each shop can only see its own records. AI conversations are processed by Google Gemini. Your data is never sold or shared.' },
  { q: 'Does Cashiea work offline?', a: 'Cashiea currently requires an internet connection. Full offline billing is on the roadmap but not available yet.' },
  { q: 'Which languages does Meraj understand?', a: 'English and Hinglish (Hindi in Roman script). You can ask questions, create invoices, and send messages in either.' },
  { q: 'What if I already use a POS?', a: 'Cashiea works alongside your existing setup. Import your product list and Meraj adds WhatsApp reports, customer tracking, and daily briefings on top.' },
  { q: 'Can I cancel anytime?', a: 'Yes. No lock-in contracts, no setup fees, no hidden charges. Cancel from your dashboard.' },
]

export default function Landing() {
  const [menu, setMenu] = useState(false)
  const [faq, setFaq] = useState<number | null>(null)
  return (
    <div className="min-h-screen bg-paper text-fg">
      {/* ══ 1. NAV ══ */}
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-line" style={{ background: 'rgb(var(--paper) / 0.85)' }}>
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><Logo /><span className="font-bold text-lg">Cashiea</span></Link>
          <div className="flex items-center gap-2">
            <Link to="/signup" className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent-strong text-accent-fg text-sm font-semibold hover:bg-accent transition-colors">Start free trial <ArrowRight className="w-3.5 h-3.5" /></Link>
            <button onClick={() => setMenu(!menu)} className="flex items-center justify-center w-10 h-10 rounded-full border border-line text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors">{menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
          </div>
        </div>
        {menu && <div className="sm:hidden border-t border-line px-4 py-3 space-y-1">
          <Link to="/login" className="block py-2 text-sm text-fg-muted">Login</Link>
          <Link to="/signup" className="block py-2 text-sm font-semibold text-accent">Start free trial</Link>
          <a href="#thinking" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">How Meraj thinks</a>
          <a href="#pricing" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">Pricing</a>
          <a href="#faq" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">FAQ</a>
        </div>}
      </nav>

      {/* ══ 2. HERO ══ */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at top, rgb(var(--accent) / 0.08), transparent 60%)' }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <Reveal>
            <Mono className="text-accent inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-6" >
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" /> CASHIEA / AI SHOP MANAGER
            </Mono>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-fg">
              I’m Meraj.<br />
              <span className="text-accent">I watch your shop</span><br className="hidden sm:block" /> so you can run it.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-fg-muted max-w-xl mx-auto leading-relaxed">
              Invoices, stock, customers, payments. I check them every day. When something needs you, I tell you first.
            </p>
            <a href="#signals" className="inline-flex items-center gap-2 mt-8 px-7 py-3.5 rounded-full bg-fg text-paper text-sm font-bold hover:opacity-90 transition-opacity">
              See how it works <ArrowDown className="w-4 h-4" />
            </a>
          </Reveal>
        </div>
      </section>

      {/* ══ 3. SIGNAL & FLOATING CARDS ══ */}
      <section id="signals" className="relative px-4 py-20" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-12"><Mono className="text-fg-subtle">01 / WHAT MERAJ DOES</Mono></Reveal>

          {/* Central graphic + floating cards */}
          <div className="relative max-w-2xl mx-auto">
            {/* Radar + character */}
            <div className="relative mx-auto w-56 h-56 mb-8 sm:mb-0">
              <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-radial-gradient(circle, transparent 0, transparent 35px, rgb(var(--line) / 0.15) 35px, rgb(var(--line) / 0.15) 36px)' }} />
              <div className="absolute inset-4 rounded-full border border-line/40" />
              <div className="absolute inset-12 rounded-full border border-line/30" />
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="absolute inset-0 flex items-center justify-center">
                <MerajAvatar state="idle" size="md" context="panel" />
              </motion.div>
              {/* Tooltip */}
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-fg text-paper text-[10px] font-mono whitespace-nowrap z-10">
                Meraj is watching
              </div>
            </div>

            {/* Desktop floating cards */}
            <div className="hidden sm:block">
              <SignalCard s={SIGNALS[0]} className="absolute top-0 -left-4 w-52 animate-[float_4s_ease-in-out_infinite]" />
              <SignalCard s={SIGNALS[1]} className="absolute top-8 -right-4 w-52 animate-[float_4s_ease-in-out_1s_infinite]" />
              <SignalCard s={SIGNALS[2]} className="absolute bottom-8 -left-4 w-52 animate-[float_4s_ease-in-out_2s_infinite]" />
              <SignalCard s={SIGNALS[3]} className="absolute bottom-0 -right-4 w-52 animate-[float_4s_ease-in-out_0.5s_infinite]" />
            </div>
            {/* Mobile stacked cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:hidden">
              {SIGNALS.map((s, i) => <SignalCard key={i} s={s} />)}
            </div>
          </div>
        </div>
      </section>

      {/* ══ MARQUEE ══ */}
      <div className="overflow-hidden border-y border-line py-2.5">
        <motion.div animate={{ x: ['0%', '-50%'] }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }} className="flex gap-0 whitespace-nowrap">
          {Array(2).fill(null).map((_, i) => (
            <span key={i} className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle flex">
              <span className="px-3">Invoices</span><span className="text-accent">●</span>
              <span className="px-3">Stock alerts</span><span className="text-accent">●</span>
              <span className="px-3">Follow-ups</span><span className="text-accent">●</span>
              <span className="px-3">Payment reminders</span><span className="text-accent">●</span>
              <span className="px-3">Daily reports</span><span className="text-accent">●</span>
              <span className="px-3">WhatsApp</span><span className="text-accent">●</span>
              <span className="px-3">GST billing</span><span className="text-accent">●</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* ══ 4. STATEMENT & FLOATING ALERTS ══ */}
      <section className="relative px-4 py-24 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgb(var(--accent) / 0.06), transparent 50%)' }} />
        <Reveal className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight text-fg">Small worries.<br /><span className="text-accent">One manager.</span></h2>
          <p className="mt-4 text-sm text-fg-muted">Meraj catches the problems that slip through when you are busy at the counter.</p>
        </Reveal>
        {/* Floating alert cards */}
        <div className="relative max-w-3xl mx-auto mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['Slow checkout', 'Missed follow-ups', 'Late payments', 'Stock running low'].map((alert, i) => (
            <Reveal key={alert} delay={i * 80}>
              <div className="card p-3 text-center" style={{ transform: `translateY(${i % 2 === 0 ? '0' : '12px'})` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-warning mx-auto mb-2" />
                <p className="text-xs font-medium text-fg-muted">{alert}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══ 5. HIGH-CONTRAST FEATURE BLOCK ══ */}
      <section id="thinking" className="px-4 py-8">
        <Reveal className="max-w-5xl mx-auto">
          <div className="rounded-3xl p-8 sm:p-14" style={{ background: 'rgb(var(--accent-strong))' }}>
            <Mono className="text-white/70 block mb-4">02 / HOW MERAJ THINKS</Mono>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">Spots. Understands. Guides.</h2>
            <p className="text-sm text-white/80 max-w-lg mb-8 leading-relaxed">
              Meraj watches every invoice, product, and payment as it happens. When something needs you, you get one clear action — ready to send. You approve before it goes out.
            </p>
            {/* Thinking room on accent background */}
            <ThinkingRoom />
          </div>
        </Reveal>
      </section>

      {/* ══ 6. SYSTEM DIAGRAM ══ */}
      <section className="px-4 py-20" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-2xl mx-auto">
          <Reveal className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-fg leading-tight">One shop.<br className="sm:hidden" /> Many problems. <span className="text-accent">One system.</span></h2>
          </Reveal>
          {/* Central node */}
          <Reveal className="flex justify-center mb-8">
            <div className="relative w-28 h-28">
              <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
              <div className="absolute inset-2 rounded-full" style={{ background: 'rgb(var(--accent-soft))' }} />
              <div className="absolute inset-0 flex items-center justify-center"><MerajMark size={40} className="text-accent" /></div>
              {/* Radiating dots */}
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <span key={deg} className="absolute w-2 h-2 rounded-full bg-accent/40" style={{ top: '50%', left: '50%', transform: `rotate(${deg}deg) translateY(-64px) translateX(-50%)` }} />
              ))}
            </div>
          </Reveal>
          {/* Feature stack */}
          <div className="space-y-2">
            {HUB.map((node, i) => (
              <Reveal key={node.label} delay={i * 50}>
                <div className="card p-3.5 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-2xl bg-accent-soft text-accent flex items-center justify-center flex-shrink-0"><node.icon className="w-4 h-4" strokeWidth={1.75} /></span>
                  <div className="flex-1 min-w-0">
                    <Mono className="text-accent">{node.label}</Mono>
                    <p className="text-xs text-fg-subtle mt-0.5 truncate">{node.risks.join(' · ')}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200} className="text-center mt-6">
            <p className="text-sm text-fg-muted max-w-md mx-auto">Meraj connects every part of the shop, catching problems before they cost a sale.</p>
          </Reveal>
        </div>
      </section>

      {/* ══ PRICING ══ */}
      <section id="pricing" className="px-4 py-20">
        <Reveal className="max-w-md mx-auto text-center">
          <div className="card p-8">
            <Mono className="text-fg-subtle block mb-2">CASHIEA</Mono>
            <p className="text-4xl font-bold text-fg">₹7,500<span className="text-lg font-medium text-fg-muted">/mo</span></p>
            <p className="text-sm text-fg-muted mt-1">Everything included. No tiers.</p>
            <div className="mt-6 space-y-2 text-left">
              {['Meraj AI — spots, understands, guides', 'GST invoicing and billing', 'Stock alerts and reordering', 'Customer tracking', 'Daily WhatsApp reports', 'Payment reminders', '14-day free trial'].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-fg-muted"><Check className="w-4 h-4 text-positive flex-shrink-0" /> {f}</div>
              ))}
            </div>
            <Link to="/signup" className="btn-primary w-full mt-6 rounded-full">Start free trial</Link>
            <p className="text-xs text-fg-subtle mt-3">No setup fee. Cancel anytime.</p>
          </div>
        </Reveal>
      </section>

      {/* ══ FAQ ══ */}
      <section id="faq" className="px-4 py-16" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-2xl mx-auto">
          <Reveal><h2 className="text-xl font-bold text-fg mb-6 text-center">Questions</h2></Reveal>
          <div className="space-y-2.5">
            {FAQS.map((item, i) => (
              <Reveal key={i} delay={i * 30}>
                <button onClick={() => setFaq(faq === i ? null : i)} className="w-full text-left card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-fg">{item.q}</p>
                    <ChevronDown className={`w-4 h-4 text-fg-subtle transition-transform flex-shrink-0 ${faq === i ? 'rotate-180' : ''}`} />
                  </div>
                  <AnimatePresence>{faq === i && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><p className="text-sm text-fg-muted mt-2">{item.a}</p></motion.div>}</AnimatePresence>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══ */}
      <section className="px-4 py-24 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgb(var(--accent) / 0.08), transparent 60%)' }} />
        <Reveal className="relative max-w-xl mx-auto text-center">
          <div className="flex justify-center mb-5"><motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}><MerajAvatar state="idle" size="sm" context="panel" /></motion.div></div>
          <h2 className="text-2xl sm:text-3xl font-bold text-fg leading-tight">You know your shop.<br /><span className="text-accent">Meraj makes sure nothing slips through.</span></h2>
          <p className="text-sm text-fg-muted mt-3">14-day free trial. No card required.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 mt-6 px-7 py-3.5 rounded-full bg-accent-strong text-accent-fg text-sm font-bold hover:bg-accent transition-colors">Start free trial <ArrowRight className="w-4 h-4" /></Link>
        </Reveal>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="border-t border-line py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2"><Logo size={22} /><span className="font-semibold text-sm">Cashiea</span></div>
          <div className="flex items-center gap-4 text-xs text-fg-subtle"><Link to="/privacy" className="hover:text-fg">Privacy</Link><Link to="/terms" className="hover:text-fg">Terms</Link><a href="#faq" className="hover:text-fg">FAQ</a></div>
          <p className="text-xs text-fg-subtle">Built for Indian retail.</p>
        </div>
      </footer>

      {/* Float keyframe */}
      <style>{`@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }`}</style>
    </div>
  )
}
