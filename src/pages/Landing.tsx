import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Play, Clock, Brain, AlertCircle,
  Receipt, Users, Zap, ChevronDown, Check, Menu, X,
  TrendingUp, MessageCircle, Shield,
} from 'lucide-react'

// ═══ Cashiea Logo Component ═══
function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0099ff" />
          <stop offset="100%" stopColor="#00d4ff" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#logoGrad)" />
      <path d="M62 28 A26 26 0 1 0 62 72" fill="none" stroke="white" strokeWidth="9" strokeLinecap="round" />
      <circle cx="55" cy="50" r="5" fill="white" />
      <path d="M55 30 L55 42 M55 58 L55 70 M35 50 L47 50 M63 50 L75 50" stroke="white" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}

// ═══ Scroll progress bar ═══
function ScrollProgress() {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const scrolled = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100
      setWidth(scrolled)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-transparent pointer-events-none">
      <div className="h-full transition-[width] duration-150 ease-out" style={{ width: `${width}%`, background: 'linear-gradient(90deg, #0099ff, #00d4ff)' }} />
    </div>
  )
}

// ═══ Reveal component (premium staggered scroll animation) ═══
type RevealDir = 'up' | 'left' | 'right' | 'scale'
function Reveal({ children, delay = 0, dir = 'up', className = '' }: { children: React.ReactNode; delay?: number; dir?: RevealDir; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  const hidden: Record<RevealDir, string> = {
    up: 'opacity-0 translate-y-10',
    left: 'opacity-0 -translate-x-10',
    right: 'opacity-0 translate-x-10',
    scale: 'opacity-0 scale-95',
  }
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? 'opacity-100 translate-x-0 translate-y-0 scale-100' : hidden[dir]} ${className}`}>
      {children}
    </div>
  )
}

const NAV_LINKS = [{ label: 'Features', href: '#features' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }]

const TESTIMONIALS = [
  { initials: 'SM', name: 'Suresh Mallick', shop: 'Electronics Store', city: 'Gaya, Bihar', quote: 'I used to spend 3 hours every evening on invoices. Now it takes 30 minutes. I use the extra time to talk to customers.', stat: '6 hours', metric: 'saved per week' },
  { initials: 'RV', name: 'Ramesh Verma', shop: 'General Store', city: 'Patna, Bihar', quote: 'The daily WhatsApp report changed everything. I know exactly how much I made before I even close the shop.', stat: '\u20b912,000', metric: 'extra revenue/month' },
  { initials: 'AK', name: 'Amit Kumar', shop: 'Pharmacy', city: 'Siwan, Bihar', quote: 'Voice invoicing in Hindi is brilliant. My staff just speaks the sale and the bill is ready. Customers are impressed.', stat: '90%', metric: 'faster billing' },
]

const FAQS = [
  { q: 'Do I need technical knowledge to set up Cashiea?', a: 'Not at all. Setup takes 5 minutes. Enter your shop name, add a few products, and you are ready to bill. The AI learns your business automatically as you use it.' },
  { q: 'What if I am already using a POS or billing app?', a: 'Cashiea works alongside your existing setup. You can import your product list, and the AI tools (WhatsApp reports, voice invoicing, customer tracking) add value on top. No need to replace anything overnight.' },
  { q: 'Is my data safe?', a: 'Absolutely. Your data is encrypted, stored securely, and protected by row-level security. Each shop can only see their own data. We never sell or share your information.' },
  { q: 'Can I scale to multiple shops?', a: 'Yes. One account can manage multiple locations. This is coming in a future update — you will be the first to know when it launches.' },
  { q: 'What if my internet goes down?', a: 'Cashiea queues your transactions locally and syncs automatically when you are back online. You never lose a sale because of connectivity.' },
]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (href: string) => { setMenuOpen(false); document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' }) }
  const C = { bg: '#fdfbf7', bgAlt: '#faf6ee', bgCard: '#f5efe3', border: '#e8e2d5', blue: '#0099ff', blueDark: '#0066b8', blueLight: '#00d4ff', green: '#10b981', text: '#1a1a1a', textBody: '#4b5563', textMuted: '#9ca3af', dark: '#1a1a1a' }

  return (
    <div style={{ background: C.bg, color: C.text }} className="min-h-screen font-sans">
      <ScrollProgress />

      {/* ═══ 1. NAV ═══ */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'py-2' : 'py-3'}`} style={{ background: scrolled ? 'rgba(253,251,247,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none', borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent' }}>
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={scrolled ? 28 : 32} />
            <span className="font-bold tracking-tight transition-all" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: scrolled ? '18px' : '20px' }}>Cashiea</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => <button key={l.href} onClick={() => scrollTo(l.href)} className="text-sm font-medium transition-colors" style={{ color: C.textBody }} onMouseEnter={e => e.currentTarget.style.color = C.blue} onMouseLeave={e => e.currentTarget.style.color = C.textBody}>{l.label}</button>)}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium transition-colors hidden sm:block" style={{ color: C.textBody }}>Login</Link>
            <Link to="/signup" className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-all hover:scale-[1.03] hover:shadow-lg" style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`, boxShadow: `0 4px 14px ${C.blue}40` }}>Start Free</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden" style={{ color: C.textBody }}>{menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}</button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4 space-y-3 animate-fade-in" style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
            {NAV_LINKS.map((l) => <button key={l.href} onClick={() => scrollTo(l.href)} className="block text-sm font-medium" style={{ color: C.textBody }}>{l.label}</button>)}
            <Link to="/login" className="block text-sm font-medium" style={{ color: C.textBody }}>Login</Link>
          </div>
        )}
      </nav>

      {/* ═══ 2. HERO ═══ */}
      <section className="relative overflow-hidden" style={{ paddingTop: '60px', paddingBottom: '80px' }}>
        {/* Glow background */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${C.blue}08 0%, transparent 70%)` }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${C.blueLight}06 0%, transparent 70%)` }} />

        <div className="relative max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Reveal dir="up">
                <h1 className="font-bold tracking-tight" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontSize: 'clamp(34px, 5.5vw, 56px)', lineHeight: 1.15, color: C.text }}>
                  Your Retail Business,<br />
                  <span style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Automated.</span>
                </h1>
              </Reveal>
              <Reveal dir="up" delay={100}>
                <p className="mt-6 leading-relaxed" style={{ fontSize: '18px', color: C.textBody }}>
                  POS billing + customer insights + AI shortcuts. Built for India's small shops. No complex training, no monthly CFO needed.
                </p>
              </Reveal>
              <Reveal dir="up" delay={200}>
                <div className="mt-4 flex items-center gap-2 font-medium" style={{ fontSize: '16px', color: C.green }}>
                  <Check className="w-5 h-5" /> Replace your 30-hour/month assistant — at half the cost
                </div>
              </Reveal>
              <Reveal dir="up" delay={300}>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link to="/signup" className="inline-flex items-center justify-center gap-2 font-semibold text-white px-8 py-4 rounded-xl transition-all hover:scale-[1.03] hover:shadow-xl" style={{ fontSize: '16px', background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`, boxShadow: `0 6px 20px ${C.blue}30` }}>
                    Start 14-Day Free Trial <ArrowRight className="w-5 h-5" />
                  </Link>
                  <button onClick={() => scrollTo('#features')} className="inline-flex items-center justify-center gap-2 font-medium text-sm transition-colors" style={{ color: C.blue }} onMouseEnter={e => e.currentTarget.style.color = C.blueDark}>
                    <Play className="w-4 h-4" /> Watch Demo
                  </button>
                </div>
              </Reveal>
              <Reveal dir="up" delay={400}>
                <p className="mt-6 text-sm" style={{ color: C.textMuted }}>Used by 47 shops in Bihar, Gujarat, Maharashtra. No credit card required.</p>
              </Reveal>
            </div>

            {/* Phone mockup */}
            <Reveal dir="right" delay={300} className="hidden md:block">
              <div className="relative mx-auto animate-float" style={{ maxWidth: '320px' }}>
                <div className="absolute inset-0 rounded-[3rem] blur-2xl opacity-30" style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})` }} />
                <div className="relative bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                  <div className="bg-white rounded-[2rem] overflow-hidden">
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Logo size={24} /><span className="font-bold text-base" style={{ fontFamily: '"Plus Jakarta Sans"' }}>Cashiea</span></div>
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      </div>
                      <div className="rounded-xl p-4" style={{ background: C.bgCard }}>
                        <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold text-gray-500">TODAY'S SALES</span><TrendingUp className="w-4 h-4 text-green-500" /></div>
                        <p className="text-3xl font-bold" style={{ color: C.text }}>{'\u20b9'}14,250</p>
                        <p className="text-xs text-green-600 mt-1 font-medium">{'\u2191'} 23% vs yesterday</p>
                      </div>
                      <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#e6f7ff', border: `1px solid ${C.blue}20` }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.blue + '20' }}><MessageCircle className="w-4 h-4" style={{ color: C.blue }} /></div>
                        <div className="min-w-0"><p className="text-xs font-medium text-gray-900 truncate">Daily report sent to WhatsApp</p><p className="text-xs text-gray-500">23 bills {'\u00b7'} {'\u20b9'}14,250 total</p></div>
                      </div>
                      <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#ecfdf5', border: '1px solid #10b98120' }}>
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0"><Zap className="w-4 h-4 text-green-600" /></div>
                        <div className="min-w-0"><p className="text-xs font-medium text-gray-900 truncate">AI: 3 items low on stock</p><p className="text-xs text-gray-500">Tap to reorder {'\u2192'}</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══ 3. PROBLEM ═══ */}
      <section style={{ paddingTop: '72px', paddingBottom: '72px', background: C.bgAlt }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal><h2 className="text-center font-semibold mb-14" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: 'clamp(28px, 4vw, 38px)', lineHeight: 1.3, color: C.text }}>Small shops run on spreadsheets and stress.</h2></Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Clock, stat: '2 hours/day', problem: 'Manual invoicing + stock tracking', fix: 'Billed in 60 seconds via AI' },
              { icon: Brain, stat: '\u20b915,000/month', problem: "Assistant salary you can't afford", fix: 'AI does the follow-ups, you sell' },
              { icon: AlertCircle, stat: 'Zero visibility', problem: "You don't know what's selling", fix: 'Daily reports, WhatsApp alerts, no login needed' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 120} dir="scale">
                <div className="rounded-2xl p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: C.blue + '12' }}><item.icon className="w-7 h-7" style={{ color: C.blue }} /></div>
                  <p className="text-2xl font-bold mb-2" style={{ color: C.text }}>{item.stat}</p>
                  <p className="text-sm mb-3" style={{ color: C.textMuted }}>{item.problem}</p>
                  <p className="text-sm font-semibold" style={{ color: C.green }}>{item.fix}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. FEATURES ═══ */}
      <section id="features" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal><h2 className="text-center font-semibold mb-3" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: 'clamp(28px, 4vw, 38px)', color: C.text }}>Everything You Actually Need<br />(Nothing You Don't)</h2></Reveal>
          <div className="grid md:grid-cols-3 gap-6 mt-14">
            {[
              { icon: Receipt, title: 'Billing in 60 Seconds', desc: 'Voice-to-invoice, customer memory, auto-PDF sharing. Customers get WhatsApp receipts instantly.', emoji: '\u26a1' },
              { icon: Users, title: 'Smart Customer Tracking', desc: "Auto-capture phone numbers, purchase history, loyalty math. Send WhatsApp reminders when they're likely to buy again.", emoji: '\ud83e\udde0' },
              { icon: Zap, title: 'AI Does the Admin Work', desc: 'Daily closing reports. Low-stock alerts. Hinglish customer replies. Voice commands in Hindi.', emoji: '\u2699\ufe0f' },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 120} dir={i === 1 ? 'up' : i === 0 ? 'left' : 'right'}>
                <div className="rounded-2xl p-9 transition-all duration-400 group relative overflow-hidden hover:-translate-y-2 hover:shadow-2xl" style={{ background: C.bgAlt, border: `1px solid ${C.border}` }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110" style={{ background: '#ecfdf5' }}><card.icon className="w-5.5 h-5.5" style={{ color: C.green }} /></div>
                  <h3 className="font-semibold text-xl mb-3" style={{ fontFamily: '"Plus Jakarta Sans"', color: C.text }}>{card.emoji} {card.title}</h3>
                  <p className="leading-relaxed mb-5" style={{ fontSize: '16px', color: C.textBody }}>{card.desc}</p>
                  <button className="text-sm font-medium transition-colors flex items-center gap-1" style={{ color: C.blue }} onMouseEnter={e => e.currentTarget.style.color = C.blueDark} onMouseLeave={e => e.currentTarget.style.color = C.blue}>See how <ArrowRight className="w-3.5 h-3.5" /></button>
                  <div className="absolute bottom-0 left-0 right-0 h-1 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-400" style={{ background: `linear-gradient(90deg, ${C.blue}, ${C.blueLight})` }} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. TESTIMONIALS ═══ */}
      <section style={{ paddingTop: '72px', paddingBottom: '72px', background: C.bgAlt }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal><h2 className="text-center font-semibold mb-14" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: 'clamp(28px, 4vw, 38px)', color: C.text }}>Shop Owners Are Saving Time<br />(And Making More)</h2></Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={i} delay={i * 120} dir="up">
                <div className="rounded-2xl p-7" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})` }}>{t.initials}</div>
                    <div className="min-w-0"><p className="font-semibold text-sm" style={{ color: C.text }}>{t.name}</p><p className="text-xs" style={{ color: C.textMuted }}>{t.shop} {'\u00b7'} {t.city}</p></div>
                  </div>
                  <p className="text-base italic leading-relaxed mb-5" style={{ color: C.text }}>"{t.quote}"</p>
                  <div className="pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
                    <span className="text-3xl font-bold" style={{ color: C.green }}>{t.stat}</span>
                    <span className="text-sm ml-2" style={{ color: C.textMuted }}>{t.metric}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. PRICING ═══ */}
      <section id="pricing" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal><h2 className="text-center font-semibold mb-3" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: 'clamp(28px, 4vw, 38px)', color: C.text }}>One Plan. Transparent Pricing.</h2></Reveal>
          <Reveal delay={100}><p className="text-center mb-14" style={{ fontSize: '16px', color: C.textMuted }}>No tiers, no upsells, no confusion.</p></Reveal>
          <Reveal delay={200} dir="scale">
            <div className="max-w-md mx-auto rounded-2xl p-12 text-center relative" style={{ background: C.bgAlt, border: `2px solid ${C.blue}` }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white px-4 py-1.5 rounded-full whitespace-nowrap" style={{ background: C.green }}>14 days free. No card required.</div>
              <h3 className="font-bold text-lg mb-3" style={{ fontFamily: '"Plus Jakarta Sans"', color: C.text }}>Cashiea Pro</h3>
              <div className="mb-8"><span className="text-5xl font-bold" style={{ color: C.blue }}>{'\u20b9'}7,500</span><span className="text-sm ml-1" style={{ color: C.textMuted }}>/month</span></div>
              <ul className="text-left space-y-3.5 mb-10">
                {['Unlimited invoices & customers', 'AI quick tasks (4 per day free)', 'WhatsApp integration & auto-replies', 'Daily reports & low-stock alerts', 'Voice invoicing in Hinglish', 'Email + WhatsApp support (replies in 2 hours)'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5" style={{ fontSize: '16px', color: C.textBody }}><Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: C.green }} /> {f}</li>
                ))}
              </ul>
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 font-semibold text-white px-8 py-4 rounded-xl transition-all hover:scale-[1.03] hover:shadow-xl w-full" style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueLight})`, boxShadow: `0 6px 20px ${C.blue}30` }}>Start Free Trial</Link>
              <p className="text-xs mt-5" style={{ color: C.textMuted }}>Cancel anytime. No hidden fees. We don't lock you in.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 7. FAQ ═══ */}
      <section id="faq" style={{ paddingTop: '72px', paddingBottom: '72px', background: C.bgAlt }}>
        <div className="max-w-[640px] mx-auto px-6">
          <Reveal><h2 className="text-center font-semibold mb-12" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: 'clamp(28px, 4vw, 38px)', color: C.text }}>Questions? We Have Answers.</h2></Reveal>
          <div className="space-y-3">
            {FAQS.map((faq, i) => <Reveal key={i} delay={i * 60}><FAQItem faq={faq} colors={C} /></Reveal>)}
          </div>
        </div>
      </section>

      {/* ═══ 8. FINAL CTA ═══ */}
      <section className="relative overflow-hidden" style={{ paddingTop: '90px', paddingBottom: '90px', background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueDark} 100%)` }}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${C.blueLight}30 0%, transparent 70%)` }} />
        <div className="relative max-w-[1200px] mx-auto px-6 text-center">
          <Reveal dir="scale">
            <h2 className="font-bold text-white mb-5" style={{ fontFamily: '"Plus Jakarta Sans"', fontSize: 'clamp(32px, 5vw, 50px)', lineHeight: 1.2 }}>Your Retail Business Deserves Better.</h2>
            <p className="mb-10 mx-auto" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.75)', maxWidth: '480px' }}>Try Cashiea free for 14 days. No credit card. No commitment. See what {'\u20b9'}7,500 can do.</p>
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 font-semibold px-10 py-4 rounded-xl transition-all hover:scale-[1.04]" style={{ border: '2px solid white', color: C.blue, backgroundColor: 'white', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'white' }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = C.blue }}>
              Start Free Trial Now <ArrowRight className="w-5 h-5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══ 9. FOOTER ═══ */}
      <footer style={{ background: C.dark, paddingTop: '56px', paddingBottom: '56px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3"><Logo size={32} /><span className="font-bold text-lg text-white">Cashiea</span></div>
              <p className="text-sm" style={{ color: '#888' }}>POS + CRM + AI for Indian retail</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-4">Product</p>
              <div className="space-y-2.5">
                <button onClick={() => scrollTo('#features')} className="block text-sm transition-colors hover:text-white" style={{ color: '#888' }}>Features</button>
                <button onClick={() => scrollTo('#pricing')} className="block text-sm transition-colors hover:text-white" style={{ color: '#888' }}>Pricing</button>
                <button onClick={() => scrollTo('#faq')} className="block text-sm transition-colors hover:text-white" style={{ color: '#888' }}>FAQ</button>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-4">Company</p>
              <div className="space-y-2.5">
                <Link to="/privacy" className="block text-sm transition-colors hover:text-white" style={{ color: '#888' }}>Privacy</Link>
                <Link to="/terms" className="block text-sm transition-colors hover:text-white" style={{ color: '#888' }}>Terms</Link>
                <Link to="/case-study" className="block text-sm transition-colors hover:text-white" style={{ color: '#888' }}>Case Study</Link>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-4">Support</p>
              <div className="space-y-2.5">
                <Link to="/app/support" className="block text-sm transition-colors hover:text-white" style={{ color: '#888' }}>Help Center</Link>
                <a href="mailto:supportcashiea@gmail.com" className="block text-sm transition-colors hover:text-white" style={{ color: '#888' }}>supportcashiea@gmail.com</a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6" style={{ borderTop: '1px solid #333' }}>
            <p className="text-xs text-center" style={{ color: '#555' }}>{'\u00a9'} 2026 Cashiea. Made with care for India's small businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FAQItem({ faq, colors: C }: { faq: { q: string; a: string }; colors: Record<string, string> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden transition-all" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-6 text-left">
        <span className="font-semibold text-base" style={{ color: C.text }}>{faq.q}</span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 ml-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} style={{ color: C.blue }} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96' : 'max-h-0'}`}>
        <p className="px-6 pb-6 leading-relaxed" style={{ fontSize: '16px', color: C.textBody }}>{faq.a}</p>
      </div>
    </div>
  )
}
