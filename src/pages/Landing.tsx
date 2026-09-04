import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import MerajDevice, { MerajGlyph } from '../components/MerajDevice'
import {
  ArrowRight, ArrowDown, ChevronDown, Check, Menu, X, Sparkles, Receipt, Package, Users,
  Wallet, MessageCircle, FileBarChart, ScanBarcode, WifiOff, Calculator, Mic, Repeat,
  FileSpreadsheet, BookOpen, Landmark, ShieldCheck, Lock, Zap, Timer, TrendingUp,
  BadgeCheck, Phone, MapPin, LayoutDashboard, Send, Bell, Clock,
} from 'lucide-react'

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

// ── Small global helpers ──
function SectionEyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Mono className={`text-fg-subtle flex items-center justify-center gap-2 ${className}`}><span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />{children}</Mono>
}

function TrustPill({ children, icon: Icon, className = '' }: { children: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-fg-muted ${className}`}>
      {Icon && <Icon className="w-3.5 h-3.5 text-accent" />}
      {children}
    </span>
  )
}

// ── Trust & proof copy ──
const TRUST_POINTS = [
  { icon: BadgeCheck, text: '14-day free trial' },
  { icon: ShieldCheck, text: 'No card required' },
  { icon: Users, text: '47+ Indian shops' },
  { icon: Timer, text: 'Setup in 5 minutes' },
  { icon: Lock, text: 'DPDP-ready' },
  { icon: WifiOff, text: 'Works offline' },
]

const PROOF_METRICS = [
  { value: '6 hrs', label: 'saved per week', note: 'billing, bookkeeping & follow-ups' },
  { value: '₹12K', label: 'extra per month', note: 'dues recovered + dormant customers' },
  { value: '90%', label: 'faster billing', note: 'cash + UPI split, barcode scan' },
  { value: '10', label: 'Indian languages', note: 'talk to Meraj your way' },
]

const TESTIMONIALS = [
  { initials: 'RK', name: 'Ramesh Kumar', role: 'Kirana · Patna', quote: 'I used to lose maybe ₹8,000–₹10,000 a month in forgotten udhaar. Now Meraj reminds them, and most people pay.' },
  { initials: 'SE', name: 'Sharma Electricals', role: 'Hardware & appliances · Lucknow', quote: 'GST invoice used to take my brother 40 minutes. Now it prints at the counter in seconds — with HSN and tax split.' },
  { initials: 'JS', name: 'Jyoti Store', role: 'General store · Ranchi', quote: 'The daily WhatsApp report changes everything. I know the day is fine even before I reach the shop.' },
]

const STEPS = [
  { n: '01', title: 'Set up in 5 minutes', desc: 'Add your shop, import products from CSV (or start empty), and you’re billing.' },
  { n: '02', title: 'Meraj starts watching', desc: 'Every sale, stock level and pending payment feeds the same brain. Nothing is ever entered twice.' },
  { n: '03', title: 'You approve. It sends.', desc: 'Meraj drafts invoices, WhatsApp reminders and reports. Nothing goes out without your OK.' },
]

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
]

const SECURITY_POINTS = [
  { icon: ShieldCheck, title: 'Your data belongs to you', desc: 'Row-level security means each shop only sees itself. Export anytime, cancel anytime.' },
  { icon: Lock, title: 'DPDP Act 2023 aligned', desc: 'Built for India: encrypted in transit, hosted in India, and we never sell your customer list.' },
  { icon: WifiOff, title: 'Doesn’t fail in your shop', desc: 'Power cuts and network dead zones don’t stop billing. Sales sync when you reconnect.' },
]

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
  const [sel, setSel] = useState<number | null>(0)
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

// ── Hero product mock: a believable "morning with Meraj" dashboard ──
function HeroDashboard() {
  const stats = [
    { label: 'Sales today', value: '₹24,320', delta: '+18%' },
    { label: 'Dues recovered', value: '₹3,850', delta: 'today' },
    { label: 'Low stock', value: '2 items', delta: 'alert' },
    { label: 'Khata open', value: '₹18,400', delta: '4 dues' },
  ]
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-accent/15 via-transparent to-gold/10 blur-2xl" />
      <div className="absolute -inset-px rounded-[2rem] border border-line/70 bg-surface/70 backdrop-blur-xl shadow-float" />

      <div className="relative card rounded-[1.75rem] overflow-hidden p-5 sm:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-accent-strong text-accent-fg flex items-center justify-center"><MerajGlyph size={16} className="text-accent-fg" /></span>
            <div>
              <p className="text-sm font-bold text-fg">Meraj · Today</p>
              <p className="text-[11px] text-fg-subtle">Tuesday · 8:05 AM</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2.5 py-1 text-[10px] font-mono text-positive"><span className="w-1.5 h-1.5 rounded-full bg-positive animate-pulse" />LIVE</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.08 }} className="rounded-xl border border-line bg-surface-2/60 p-3">
              <Mono className="text-fg-subtle block mb-1">{s.label}</Mono>
              <p className="text-lg font-bold text-fg leading-none">{s.value}</p>
              <p className="mt-1 text-[10px] font-medium text-accent">{s.delta}</p>
            </motion.div>
          ))}
        </div>

        <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, rgb(5 150 105 / 1), rgb(16 185 129 / .92))', boxShadow: '0 14px 30px -16px rgb(5 150 105 / .7)' }}>
          <div className="flex items-center gap-2 mb-2"><Bell className="w-3.5 h-3.5" /><Mono className="text-white/80">MERAJ · GOOD MORNING</Mono></div>
          <p className="text-sm leading-relaxed">Yesterday is up 18%. Cooking oil is at 3 units. 4 invoices are still pending. Want me to send the reminders?</p>
          <div className="flex gap-2 mt-3">
            <span className="inline-flex items-center gap-1 bg-white/20 rounded-full px-3 py-1.5 text-xs font-bold">Send now <Send className="w-3 h-3" /></span>
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-white/85 border border-white/25">Later</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Clock className="w-3.5 h-3.5 text-fg-subtle" />
            <span><strong className="text-fg">2 follow-ups</strong> ready · <strong className="text-fg">4 reminders</strong> drafted</span>
          </div>
          <Link to="/signup" className="inline-flex items-center gap-1 text-xs font-bold text-accent-strong">Open dashboard <ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const [menu, setMenu] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-paper text-fg">
      {/* ══ 1. NAV ══ */}
      <nav className="sticky top-0 z-50 backdrop-blur-md border-b border-line" style={{ background: 'rgb(var(--paper) / 0.85)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2"><Logo /><span className="font-bold text-lg">Cashiea</span></Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-fg-muted">
            <a href="#meraj" className="hover:text-fg transition-colors">What Meraj does</a>
            <a href="#features" className="hover:text-fg transition-colors">Features</a>
            <a href="#how" className="hover:text-fg transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-fg transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-fg transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors">Login</Link>
            <Link to="/signup" className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-accent-strong text-accent-fg text-sm font-semibold hover:bg-accent transition-colors shadow-soft">Start free trial <ArrowRight className="w-3.5 h-3.5" /></Link>
            <button onClick={() => setMenu(!menu)} className="md:hidden flex items-center justify-center w-10 h-10 rounded-full border border-line text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors">{menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
          </div>
        </div>
        {menu && <div className="md:hidden border-t border-line px-4 py-3 space-y-1">
          <Link to="/login" className="block py-2 text-sm text-fg-muted">Login</Link>
          <Link to="/signup" className="block py-2 text-sm font-semibold text-accent">Start free trial</Link>
          <a href="#meraj" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">What Meraj does</a>
          <a href="#features" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">Features</a>
          <a href="#how" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">How it works</a>
          <a href="#pricing" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">Pricing</a>
          <a href="#faq" onClick={() => setMenu(false)} className="block py-2 text-sm text-fg-muted">FAQ</a>
        </div>}
      </nav>

      {/* ══ 2. HERO ══ */}
      <section className="relative overflow-hidden px-4 pt-14 pb-16 sm:pt-20 sm:pb-24">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% -10%, rgb(var(--accent) / 0.12), transparent 60%), radial-gradient(ellipse at 90% 20%, rgb(var(--gold) / 0.10), transparent 55%)' }} />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
          <div className="text-center lg:text-left">
            <Reveal>
              <Mono className="text-accent inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3.5 py-2 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> CASHIEA / AI FOR THE INDIAN SHOP
              </Mono>
            </Reveal>
            <Reveal delay={40}>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.05] tracking-tight text-fg">
                The manager who never sleeps.<br className="hidden sm:block" />
                <span className="text-accent">Costs ₹250 a day.</span>
              </h1>
            </Reveal>
            <Reveal delay={90}>
              <p className="mt-5 text-base sm:text-lg text-fg-muted max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Meraj bills at the counter, chases every pending payment, catches low stock before it hurts, sends GST-ready invoices, and gives you tomorrow’s plan in today’s report — so your shop earns more even when you’re busy making it earn.
              </p>
            </Reveal>
            <Reveal delay={140}>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mt-8">
                <Link to="/signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-accent-strong text-accent-fg text-sm font-bold hover:bg-accent hover:shadow-lift transition-all">Start your 14-day free trial <ArrowRight className="w-4 h-4" /></Link>
                <a href="#meraj" className="inline-flex items-center gap-2 px-7 py-4 rounded-full bg-fg text-paper text-sm font-bold hover:opacity-90 transition-opacity">See what Meraj does <ArrowDown className="w-4 h-4" /></a>
              </div>
            </Reveal>
            <Reveal delay={190}>
              <div className="mt-7 flex flex-wrap justify-center lg:justify-start gap-2">
                {TRUST_POINTS.map((t) => <TrustPill key={t.text} icon={t.icon}>{t.text}</TrustPill>)}
              </div>
            </Reveal>
          </div>
          <Reveal delay={120} className="relative">
            <HeroDashboard />
          </Reveal>
        </div>
      </section>

      {/* ══ 3. SOCIAL PROOF METRICS ══ */}
      <section className="px-4 py-16" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-10">
            <SectionEyebrow>01 / PROOF, NOT PROMISES</SectionEyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight text-fg">Why shops that try it<br className="hidden sm:block" /><span className="text-accent">don’t want to go back.</span></h2>
          </Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {PROOF_METRICS.map((m, i) => (
              <Reveal key={m.label} delay={i * 50}>
                <div className="card card-hover p-5 text-center h-full">
                  <p className="text-3xl font-bold text-accent-strong">{m.value}</p>
                  <p className="mt-1 text-sm font-bold text-fg">{m.label}</p>
                  <p className="mt-1 text-xs text-fg-subtle leading-relaxed">{m.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={220} className="mt-10 text-center">
            <p className="text-sm text-fg-muted max-w-xl mx-auto">These are the numbers our owners report after their first month. We’d rather show the outcome than a wall of features.</p>
          </Reveal>
        </div>
      </section>

      {/* ══ 4. TESTIMONIALS ══ */}
      <section className="px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-10">
            <SectionEyebrow>02 / IN THEIR WORDS</SectionEyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight text-fg">Built for the shop.<br /><span className="text-accent">Trusted by the person who closes it.</span></h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 60}>
                <figure className="card card-hover h-full p-6 flex flex-col">
                  <div className="mb-4 flex gap-1 text-accent">{[...Array(5)].map((_, j) => <span key={j} className="text-sm">★</span>)}</div>
                  <blockquote className="text-sm text-fg-muted leading-relaxed flex-1">“{t.quote}”</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-accent/10 text-accent-strong flex items-center justify-center text-sm font-bold">{t.initials}</span>
                    <div>
                      <p className="text-sm font-bold text-fg">{t.name}</p>
                      <p className="text-xs text-fg-subtle">{t.role}</p>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 5. HOW IT WORKS ══ */}
      <section id="how" className="px-4 py-20" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <SectionEyebrow>03 / HOW IT WORKS</SectionEyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight text-fg">From shop to system in 3 steps.</h2>
            <p className="mt-4 text-sm text-fg-muted max-w-xl mx-auto">No IT guy. No migration call. No weekend lost to setup.</p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 50}>
                <div className="card card-hover h-full p-6 relative overflow-hidden">
                  <Mono className="text-accent-strong text-lg">{s.n}</Mono>
                  <h3 className="mt-4 text-lg font-bold text-fg">{s.title}</h3>
                  <p className="mt-2 text-sm text-fg-muted leading-relaxed">{s.desc}</p>
                  {i < 2 && <ArrowRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-line-2" />}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ 6. MERAJ WATCHES YOUR SHOP ══ */}
      <section id="meraj" className="relative px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-12">
            <SectionEyebrow>04 / MERAJ WATCHES YOUR SHOP</SectionEyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight text-fg">It sees what you can’t see during rush hour.</h2>
          </Reveal>

          <div className="relative max-w-2xl mx-auto">
            <div className="relative mx-auto w-56 h-56 mb-8 sm:mb-0">
              <div className="absolute inset-0 rounded-full" style={{ background: 'repeating-radial-gradient(circle, transparent 0, transparent 35px, rgb(var(--line) / 0.15) 35px, rgb(var(--line) / 0.15) 36px)' }} />
              <div className="absolute inset-4 rounded-full border border-line/40" />
              <div className="absolute inset-12 rounded-full border border-line/30" />
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="absolute inset-0 flex items-center justify-center">
                <MerajDevice interactionState="idle" businessMood="happy" size="md" context="panel" />
              </motion.div>
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-fg text-paper text-[10px] font-mono whitespace-nowrap z-10">Meraj is watching</div>
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

      {/* ══ 7. THE 90% SHOWCASE ─ a manager's job list ══ */}
      <section className="relative px-4 py-24 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgb(var(--accent) / 0.06), transparent 50%)' }} />
        <Reveal className="relative max-w-3xl mx-auto text-center">
          <SectionEyebrow>05 / THE MANAGER’S JOB LIST</SectionEyebrow>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight text-fg">90% of a manager’s work,<br /><span className="text-accent">done before you ask.</span></h2>
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

      {/* ══ 8. HOW MERAJ THINKS ══ */}
      <section id="thinking" className="px-4 py-8">
        <Reveal className="max-w-5xl mx-auto">
          <div className="rounded-3xl p-8 sm:p-14" style={{ background: 'rgb(var(--accent-strong))' }}>
            <SectionEyebrow className="text-white/70">06 / HOW MERAJ THINKS</SectionEyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">Spots. Understands. Guides.</h2>
            <p className="text-sm text-white/80 max-w-lg mb-8 leading-relaxed">
              Meraj watches every invoice, product, and payment as it happens. When something needs you, you get one clear action — ready to send. You approve before it goes out.
            </p>
            <ThinkingRoom />
          </div>
        </Reveal>
      </section>

      {/* ══ 9. FEATURE GRID — everything a shop needs ══ */}
      <section id="features" className="px-4 py-20" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-5xl mx-auto">
          <Reveal className="text-center mb-10">
            <SectionEyebrow>07 / THE COMPLETE TOOLKIT</SectionEyebrow>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-fg leading-tight">One app. <span className="text-accent">The whole shop.</span></h2>
            <p className="text-sm text-fg-muted mt-3 max-w-lg mx-auto">Stop stitching together a billing machine, a khata register, WhatsApp, and an accountant’s spreadsheet. Cashiea runs it all.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.label} delay={i * 40}>
                <div className="card card-hover p-4 h-full">
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

      {/* ══ 10. SECURITY & TRUST ══ */}
      <section className="px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <Reveal className="grid md:grid-cols-3 gap-3">
            {SECURITY_POINTS.map((s, i) => (
              <Reveal key={s.title} delay={i * 50}>
                <div className="card card-hover h-full p-6">
                  <span className="w-11 h-11 rounded-2xl bg-accent/10 text-accent-strong flex items-center justify-center mb-4"><s.icon className="w-5 h-5" strokeWidth={1.75} /></span>
                  <h3 className="text-base font-bold text-fg">{s.title}</h3>
                  <p className="mt-2 text-sm text-fg-muted leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ══ 11. VALUE / PRICING ══ */}
      <section id="pricing" className="px-4 py-20" style={{ background: 'rgb(var(--surface))' }}>
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <SectionEyebrow>08 / THE MATH</SectionEyebrow>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight text-fg">The price that makes sense.</h2>
            <p className="mt-4 text-sm text-fg-muted max-w-xl mx-auto">Most shops waste more than ₹7,500 a month on forgotten dues, late stock and hours of bookkeeping. Cashiea is the cheapest full-time employee you’ll ever hire.</p>
          </Reveal>

          <div className="grid lg:grid-cols-2 gap-5 items-start">
            <Reveal>
              <div className="card card-hover p-8">
                <Mono className="text-fg-subtle block mb-2">CASHIEA</Mono>
                <p className="text-5xl font-bold text-fg">₹7,500<span className="text-lg font-medium text-fg-muted">/mo</span></p>
                <p className="text-sm text-fg-muted mt-2">That’s <strong className="text-fg">₹250/day</strong> — less than one biryani, for the employee who never takes leave.</p>
                <div className="mt-6 space-y-2 text-left">
                  {['Meraj AI — 90% of a manager’s work', 'GST tax invoices + UPI QR payments', 'Counter POS with split payments & offline mode', 'Khata, stock alerts, CSV import', 'Daily WhatsApp reports & payment reminders', 'AI reports with PDF & Excel export', 'Recurring invoices & cash reconciliation', '14-day free trial'].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-fg-muted"><Check className="w-4 h-4 text-positive flex-shrink-0" /> {f}</div>
                  ))}
                </div>
                <Link to="/signup" className="btn-primary w-full mt-6 rounded-full">Start free trial</Link>
                <p className="text-xs text-fg-subtle mt-3 text-center">No setup fee. No lock-in. Cancel anytime. GST as applicable.</p>
              </div>
            </Reveal>

            <Reveal delay={80}>
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
                <div className="mt-4 rounded-2xl border border-warning/30 bg-warning/10 p-4">
                  <p className="text-sm text-fg font-semibold">Your return math</p>
                  <p className="mt-1 text-xs text-fg-muted leading-relaxed">If Cashiea helps you recover just <strong className="text-fg">₹2,500</strong> of pending payment — or avoids one stock-out — the month is paid for. Your typical owners report recovering far more.</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ 12. FAQ ══ */}
      <section id="faq" className="px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <Reveal className="text-center mb-8">
            <SectionEyebrow>09 / QUESTIONS</SectionEyebrow>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-fg">Everything you’d ask before you start.</h2>
          </Reveal>
          <div className="space-y-2.5">
            {FAQS.map((item, i) => (
              <Reveal key={i} delay={i * 30}>
                <button onClick={() => setFaq(faq === i ? null : i)} className="w-full text-left card card-hover p-4">
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

      {/* ══ 13. FINAL CTA ══ */}
      <section className="px-4 py-24 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgb(var(--accent) / 0.10), transparent 60%)' }} />
        <Reveal className="relative max-w-xl mx-auto text-center">
          <div className="flex justify-center mb-5"><motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}><MerajDevice interactionState="idle" businessMood="happy" size="sm" context="panel" /></motion.div></div>
          <Mono className="inline-flex items-center gap-2 mb-4 rounded-full border border-warning/30 bg-warning/10 px-3.5 py-2 text-warning"><Zap className="w-3.5 h-3.5" /> IF IT DOESN’T PAY FOR ITSELF, WALK AWAY</Mono>
          <h2 className="text-2xl sm:text-3xl font-bold text-fg leading-tight">Hire Meraj.<br /><span className="text-accent">Keep the shop that runs itself.</span></h2>
          <p className="text-sm text-fg-muted mt-3">14-day free trial. No card required. Works on the phone in your pocket. Every day you wait is a day your dues and stock watch themselves.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 mt-6 px-8 py-4 rounded-full bg-accent-strong text-accent-fg text-sm font-bold hover:bg-accent hover:shadow-lift transition-all">Start free trial <ArrowRight className="w-4 h-4" /></Link>
          <p className="mt-4 flex justify-center gap-4 text-[11px] text-fg-subtle"><span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-accent" /> No card</span><span className="inline-flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-accent" /> DPDP-ready</span><span className="inline-flex items-center gap-1"><WifiOff className="w-3.5 h-3.5 text-accent" /> Works offline</span></p>
        </Reveal>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="border-t border-line py-10 px-4" style={{ background: 'rgb(var(--paper-deep))' }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div className="max-w-xs">
              <div className="flex items-center gap-2"><Logo size={22} /><span className="font-semibold text-sm">Cashiea</span></div>
              <p className="mt-3 text-xs text-fg-muted leading-relaxed">POS, CRM, GST billing, khata, WhatsApp automation and AI — built for small Indian shops.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs">
              <div className="space-y-2">
                <p className="font-bold text-fg">Product</p>
                <a href="#meraj" className="block text-fg-muted hover:text-fg transition-colors">Meraj AI</a>
                <a href="#features" className="block text-fg-muted hover:text-fg transition-colors">Features</a>
                <a href="#pricing" className="block text-fg-muted hover:text-fg transition-colors">Pricing</a>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-fg">Get started</p>
                <Link to="/signup" className="block text-fg-muted hover:text-fg transition-colors">Sign up free</Link>
                <Link to="/login" className="block text-fg-muted hover:text-fg transition-colors">Login</Link>
                <a href="#faq" className="block text-fg-muted hover:text-fg transition-colors">FAQ</a>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-fg">Legal</p>
                <Link to="/privacy" className="block text-fg-muted hover:text-fg transition-colors">Privacy</Link>
                <Link to="/terms" className="block text-fg-muted hover:text-fg transition-colors">Terms</Link>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-5 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-fg-subtle">Built for Indian retail. GST-aware. WhatsApp-native. Offline-ready.</p>
            <p className="text-[11px] text-fg-subtle">© {new Date().getFullYear()} Cashiea · Made with care in India</p>
          </div>
        </div>
      </footer>

      {/* Float keyframe */}
      <style>{`@keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }`}</style>
    </div>
  )
}
