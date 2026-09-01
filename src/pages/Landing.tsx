import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import MerajDevice, { MerajGlyph } from '../components/MerajDevice'
import { ArrowRight, ArrowDown, ChevronDown, Check, Menu, X, Sparkles, Receipt, Package, Users, Wallet, MessageCircle, FileBarChart, ScanBarcode, WifiOff, Calculator, Mic, Repeat, FileSpreadsheet, BookOpen, Landmark } from 'lucide-react'

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

// ── The manager's week: what Meraj takes off your plate ──
const MANAGER_JOBS = [
  { job: 'Morning cash count & day-open', meraj: 'End-of-day reconciliation — expected vs counted, variance flagged' },
  { job: 'Billing at the counter', meraj: 'Fast POS — split payments (cash + UPI), hold carts, barcode scan' },
  { job: 'GST-compliant invoices', meraj: 'Tax invoices with HSN, CGST/SGST/IGST split, amount in words' },
  { job: 'Watching stock levels', meraj: 'Low-stock alerts, reorder suggestions from last month’s sales' },
  { job: 'Chasing pending payments', meraj: 'Khata (udhaar) tracking + payment reminders on WhatsApp' },
  { job: 'Following up with customers', meraj: 'Spots dormant regulars, drafts the follow-up — you approve' },
  { job: 'Daily sales report', meraj: 'Every morning in your WhatsApp: sales, top items, dues, stock' },
  { job: 'Monthly accounts & reports', meraj: 'AI reports from your real data — PDF and Excel' },
  { job: 'Rent & repeat billing', meraj: 'Recurring invoices generate themselves — weekly, monthly, yearly' },
  { job: 'Answering “how’s business?”', meraj: 'Ask Meraj anything, by voice, in 10 Indian languages' },
]

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
              <span className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}><MerajGlyph size={18} className="text-white" /></span>
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

// ── Feature grid ──
const FEATURES = [
  { icon: ScanBarcode, label: 'Counter POS', desc: 'Split payments (cash + UPI), hold & resume carts, barcode scan, offline sales that sync themselves' },
  { icon: Receipt, label: 'GST tax invoices', desc: 'Rule-46 compliant: HSN, CGST/SGST/IGST split, amount in words, digital signature line, UPI QR' },
  { icon: BookOpen, label: 'Khata (udhaar book)', desc: 'Digital credit ledger — who owes what, reminders, settled history' },
  { icon: Package, label: 'Stock & inventory', desc: 'Low-stock alerts, multi-unit pricing (per kg / 500g / dozen), CSV bulk import' },
  { icon: Users, label: 'Customers', desc: 'Spending history, segments, dormant-regular detection, one-tap WhatsApp' },
  { icon: MessageCircle, label: 'WhatsApp automation', desc: 'Daily sales report, payment reminders, bills and receipts on WhatsApp' },
  { icon: Repeat, label: 'Recurring invoices', desc: 'Rent and retainers bill themselves — weekly, monthly, yearly, pause anytime' },
  { icon: FileBarChart, label: 'AI reports', desc: 'Built from your real sales and expenses — export to PDF or Excel' },
  { icon: Calculator, label: 'Cash reconciliation', desc: 'End-of-day: expected vs counted cash, variance flagged' },
  { icon: Mic, label: 'Voice, 10 languages', desc: 'Talk to Meraj in Hindi, Bengali, Tamil, Telugu, Marathi and more' },
  { icon: WifiOff, label: 'Works offline', desc: 'Keep billing during power cuts and dead zones — syncs when you reconnect' },
  { icon: Landmark, label: 'India-first compliance', desc: 'GSTIN validation, state codes, filing calendar — Meraj knows the rules' },
]

const FAQS = [
  { q: 'Do I need technical knowledge?', a: 'No. Setup takes 5 minutes — enter your shop name, add products (or import your whole list from a CSV), and you are ready to bill.' },
  { q: 'Is my data safe?', a: 'Your data is encrypted in transit, hosted in India, and protected by row-level security — each shop can only see its own records. We follow India’s DPDP Act 2023 and never sell your data.' },
  { q: 'Does Cashiea work offline?', a: 'Yes. Keep billing during internet cuts — sales are saved on your device and sync automatically when you reconnect, with a visible sync status.' },
  { q: 'Can Meraj really replace a manager?', a: 'Meraj handles about 90% of a manager’s daily work — reports, follow-ups, stock watches, payment chasing, reconciliation — and asks you before anything goes out. The 10% that needs you stays yours: decisions, relationships, and the shop floor.' },
  { q: 'Which languages does Meraj understand?', a: 'Voice and chat in Hindi/Hinglish, English and 8 more Indian languages — Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam and Punjabi.' },
  { q: 'What about my GST invoices?', a: 'Cashiea creates Rule-46 compliant tax invoices — TAX INVOICE heading, HSN codes, CGST/SGST or IGST split, amount in words, place of supply and signature. For GST specifics, Meraj gives general guidance and reminds you to confirm with your CA.' },
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
          <a href="#meraj" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">What Meraj does</a>
          <a href="#features" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">Features</a>
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
              <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" /> CASHIEA / EVERYTHING A SHOP NEEDS
            </Mono>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight text-fg">
              Meet Meraj — the staff member<br className="hidden sm:block" /> who does a <span className="text-accent">manager’s job</span>.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-fg-muted max-w-xl mx-auto leading-relaxed">
              He bills, tracks stock, chases payments, keeps the khata, and reports to you every morning. Cashiea is all a shop needs to run the business — from counter to books.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
              <Link to="/signup" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-accent-strong text-accent-fg text-sm font-bold hover:bg-accent transition-colors">
                Start free trial <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#meraj" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-fg text-paper text-sm font-bold hover:opacity-90 transition-opacity">
                See what Meraj does <ArrowDown className="w-4 h-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ 3. SIGNAL & FLOATING CARDS ══ */}
      <section id="meraj" className="relative px-4 py-20" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-12"><Mono className="text-fg-subtle">01 / MERAJ WATCHES YOUR SHOP</Mono></Reveal>

          <div className="relative max-w-2xl mx-auto">
            <div className="relative mx-auto w-56 h-56 mb-8 sm:mb-0">
              <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-radial-gradient(circle, transparent 0, transparent 35px, rgb(var(--line) / 0.15) 35px, rgb(var(--line) / 0.15) 36px)' }} />
              <div className="absolute inset-4 rounded-full border border-line/40" />
              <div className="absolute inset-12 rounded-full border border-line/30" />
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="absolute inset-0 flex items-center justify-center">
                <MerajDevice interactionState="idle" businessMood="happy" size="md" context="panel" />
              </motion.div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-fg text-paper text-[10px] font-mono whitespace-nowrap z-10">
                Meraj is watching
              </div>
            </div>

            <div className="hidden sm:block">
              <SignalCard s={SIGNALS[0]} className="absolute top-0 -left-4 w-52 animate-[float_4s_ease-in-out_infinite]" />
              <SignalCard s={SIGNALS[1]} className="absolute top-8 -right-4 w-52 animate-[float_4s_ease-in-out_1s_infinite]" />
              <SignalCard s={SIGNALS[2]} className="absolute bottom-8 -left-4 w-52 animate-[float_4s_ease-in-out_2s_infinite]" />
              <SignalCard s={SIGNALS[3]} className="absolute bottom-0 -right-4 w-52 animate-[float_4s_ease-in-out_0.5s_infinite]" />
            </div>
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
              <span className="px-3">GST tax invoices</span><span className="text-accent">●</span>
              <span className="px-3">Split payments</span><span className="text-accent">●</span>
              <span className="px-3">Khata</span><span className="text-accent">●</span>
              <span className="px-3">Stock alerts</span><span className="text-accent">●</span>
              <span className="px-3">WhatsApp reports</span><span className="text-accent">●</span>
              <span className="px-3">Offline billing</span><span className="text-accent">●</span>
              <span className="px-3">CSV import</span><span className="text-accent">●</span>
              <span className="px-3">Recurring invoices</span><span className="text-accent">●</span>
              <span className="px-3">Voice in 10 languages</span><span className="text-accent">●</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* ══ 4. THE 90% SHOWCASE — a manager's job list ══ */}
      <section className="relative px-4 py-24 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgb(var(--accent) / 0.06), transparent 50%)' }} />
        <Reveal className="relative max-w-3xl mx-auto text-center">
          <Mono className="text-fg-subtle block mb-3">02 / THE MANAGER’S JOB LIST</Mono>
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight text-fg">90% of a manager’s work,<br /><span className="text-accent">done before you ask.</span></h2>
          <p className="mt-4 text-sm text-fg-muted max-w-xl mx-auto">The jobs that eat a shop owner’s evening are exactly what Meraj does all day. You keep the decisions — he does the legwork.</p>
        </Reveal>
        <div className="relative max-w-2xl mx-auto mt-10 space-y-2">
          {MANAGER_JOBS.map((row, i) => (
            <Reveal key={row.job} delay={i * 40}>
              <div className="card p-3.5 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-positive/15 text-positive flex items-center justify-center flex-shrink-0"><Check className="w-3.5 h-3.5" strokeWidth={2.5} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg-subtle line-through decoration-fg-subtle/50">{row.job}</p>
                  <p className="text-sm font-medium text-fg mt-0.5">{row.meraj}</p>
                </div>
                <Mono className="text-accent flex-shrink-0 hidden sm:block">MERAJ</Mono>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150} className="text-center mt-8">
          <p className="text-sm text-fg-muted max-w-md mx-auto">Meraj prepares every action — invoices, messages, reminders — and waits for your OK. Nothing goes out without you.</p>
        </Reveal>
      </section>

      {/* ══ 5. HOW MERAJ THINKS ══ */}
      <section id="thinking" className="px-4 py-8">
        <Reveal className="max-w-5xl mx-auto">
          <div className="rounded-3xl p-8 sm:p-14" style={{ background: 'rgb(var(--accent-strong))' }}>
            <Mono className="text-white/70 block mb-4">03 / HOW MERAJ THINKS</Mono>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">Spots. Understands. Guides.</h2>
            <p className="text-sm text-white/80 max-w-lg mb-8 leading-relaxed">
              Meraj watches every invoice, product, and payment as it happens. When something needs you, you get one clear action — ready to send. You approve before it goes out.
            </p>
            <ThinkingRoom />
          </div>
        </Reveal>
      </section>

      {/* ══ 6. FEATURE GRID — everything a shop needs ══ */}
      <section id="features" className="px-4 py-20" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-10">
            <Mono className="text-fg-subtle block mb-3">04 / THE COMPLETE TOOLKIT</Mono>
            <h2 className="text-2xl sm:text-3xl font-bold text-fg leading-tight">One app. <span className="text-accent">The whole shop.</span></h2>
            <p className="text-sm text-fg-muted mt-3 max-w-lg mx-auto">Stop stitching together a billing machine, a khata register, WhatsApp, and an accountant’s spreadsheet. Cashiea runs it all.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.label} delay={i * 40}>
                <div className="card p-4 h-full">
                  <span className="w-9 h-9 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-3"><f.icon className="w-4 h-4" strokeWidth={1.75} /></span>
                  <p className="text-sm font-bold text-fg">{f.label}</p>
                  <p className="text-xs text-fg-muted mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={200} className="flex justify-center mt-8">
            <Link to="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-fg text-paper text-sm font-bold hover:opacity-90 transition-opacity">
              <FileSpreadsheet className="w-4 h-4" /> Start with your own shop — free
            </Link>
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
              {['Meraj AI — 90% of a manager’s work', 'GST tax invoices + UPI QR payments', 'Counter POS with split payments & offline mode', 'Khata, stock alerts, CSV import', 'Daily WhatsApp reports & payment reminders', 'AI reports with PDF & Excel export', 'Recurring invoices & cash reconciliation', '14-day free trial'].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-fg-muted"><Check className="w-4 h-4 text-positive flex-shrink-0" /> {f}</div>
              ))}
            </div>
            <Link to="/signup" className="btn-primary w-full mt-6 rounded-full">Start free trial</Link>
            <p className="text-xs text-fg-subtle mt-3">No setup fee. Cancel anytime. GST as applicable.</p>
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
          <div className="flex justify-center mb-5"><motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}><MerajDevice interactionState="idle" businessMood="happy" size="sm" context="panel" /></motion.div></div>
          <h2 className="text-2xl sm:text-3xl font-bold text-fg leading-tight">Hire Meraj.<br /><span className="text-accent">Keep the shop that runs itself.</span></h2>
          <p className="text-sm text-fg-muted mt-3">14-day free trial. No card required. Works on the phone in your pocket.</p>
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
