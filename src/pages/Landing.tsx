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
          <stop offset="0%" stopColor="#0071e3" />
          <stop offset="100%" stopColor="#3a8eff" />
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
      <div className="h-full transition-[width] duration-150 ease-out" style={{ width: `${width}%`, background: 'linear-gradient(90deg, #0071e3, #3a8eff)' }} />
    </div>
  )
}

// ═══ Reveal — scroll-triggered fade-in / translate-up ═══
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
    up: 'opacity-0 translate-y-7',
    left: 'opacity-0 -translate-x-7',
    right: 'opacity-0 translate-x-7',
    scale: 'opacity-0 scale-[0.97]',
  }
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms`, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)', transitionDuration: '900ms' }} className={`transition-all ${visible ? 'opacity-100 translate-x-0 translate-y-0 scale-100' : hidden[dir]} ${className}`}>
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

  return (
    <div className="min-h-screen font-sans" style={{ background: '#fbfbfd', color: '#1d1d1f' }}>
      <ScrollProgress />

      {/* ═══ 1. NAV ═══ */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'py-2' : 'py-3'}`}
        style={{
          background: scrolled ? 'rgba(251,251,253,0.85)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid #e8e8ed' : '1px solid transparent',
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={scrolled ? 28 : 32} />
            <span
              className="font-semibold tracking-tight transition-all"
              style={{ fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif', fontSize: scrolled ? '18px' : '20px' }}
            >Cashiea</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <button
                key={l.href}
                onClick={() => scrollTo(l.href)}
                className="text-sm font-medium transition-colors"
                style={{ color: '#424245' }}
                onMouseEnter={e => e.currentTarget.style.color = '#0071e3'}
                onMouseLeave={e => e.currentTarget.style.color = '#424245'}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium transition-colors hidden sm:block"
              style={{ color: '#424245' }}
            >Login</Link>
            <Link
              to="/signup"
              className="text-sm font-medium text-white px-5 py-2.5 rounded-full transition-all hover:scale-[1.03]"
              style={{ background: 'linear-gradient(135deg, #0071e3, #3a8eff)', boxShadow: '0 4px 14px rgba(0,113,227,0.30)' }}
            >Start Free</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden" style={{ color: '#424245' }}>
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4 space-y-3 animate-fade-in" style={{ background: '#fbfbfd', borderBottom: '1px solid #e8e8ed' }}>
            {NAV_LINKS.map((l) => (
              <button key={l.href} onClick={() => scrollTo(l.href)} className="block text-sm font-medium" style={{ color: '#424245' }}>{l.label}</button>
            ))}
            <Link to="/login" className="block text-sm font-medium" style={{ color: '#424245' }}>Login</Link>
          </div>
        )}
      </nav>

      {/* ═══ 2. HERO ═══ */}
      <section className="relative overflow-hidden" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(0,113,227,0.10) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(58,142,255,0.06) 0%, transparent 70%)' }} />

        <div className="relative max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Reveal>
                <h1
                  className="font-semibold tracking-tight"
                  style={{ fontFamily: '-apple-system, "SF Pro Display", Inter, sans-serif', fontSize: 'clamp(40px, 5.5vw, 64px)', lineHeight: 1.07, color: '#1d1d1f' }}
                >
                  Your Retail Business,<br />
                  <span style={{ background: 'linear-gradient(135deg, #0071e3, #3a8eff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Automated.</span>
                </h1>
              </Reveal>
              <Reveal delay={100}>
                <p className="mt-6 leading-relaxed" style={{ fontSize: '20px', color: '#6e6e73', maxWidth: '540px' }}>
                  POS billing + customer insights + AI shortcuts. Built for India's small shops. No complex training, no monthly CFO needed.
                </p>
              </Reveal>
              <Reveal delay={200}>
                <div className="mt-5 flex items-center gap-2 font-medium" style={{ fontSize: '17px', color: '#00863a' }}>
                  <Check className="w-5 h-5" /> Replace your 30-hour/month assistant — at half the cost
                </div>
              </Reveal>
              <Reveal delay={300}>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/signup"
                    className="inline-flex items-center justify-center gap-2 font-medium text-white px-8 py-4 rounded-full transition-all hover:scale-[1.03]"
                    style={{ fontSize: '17px', background: 'linear-gradient(135deg, #0071e3, #3a8eff)', boxShadow: '0 6px 20px rgba(0,113,227,0.30)' }}
                  >
                    Start 14-Day Free Trial <ArrowRight className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => scrollTo('#features')}
                    className="inline-flex items-center justify-center gap-2 font-normal text-sm transition-colors"
                    style={{ color: '#0071e3' }}
                  >
                    <Play className="w-4 h-4" /> Watch Demo
                  </button>
                </div>
              </Reveal>
              <Reveal delay={400}>
                <p className="mt-6 text-sm" style={{ color: '#86868b' }}>Used by 47 shops in Bihar, Gujarat, Maharashtra. No credit card required.</p>
              </Reveal>
            </div>

            {/* Phone mockup */}
            <Reveal delay={300} className="hidden md:block">
              <div className="relative mx-auto animate-float" style={{ maxWidth: '320px' }}>
                <div className="absolute inset-0 rounded-[3rem] blur-2xl opacity-30" style={{ background: 'linear-gradient(135deg, #0071e3, #3a8eff)' }} />
                <div className="relative bg-ink-800 rounded-[2.5rem] p-3 shadow-2xl">
                  <div className="bg-white rounded-[2rem] overflow-hidden">
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Logo size={24} />
                          <span className="font-semibold text-base" style={{ fontFamily: '-apple-system, "SF Pro Display"' }}>Cashiea</span>
                        </div>
                        <span className="w-2 h-2 bg-[#00863a] rounded-full animate-pulse" />
                      </div>
                      <div className="rounded-xl p-4" style={{ background: '#f5f5f7' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-ink-500">TODAY'S SALES</span>
                          <TrendingUp className="w-4 h-4 text-[#00863a]" />
                        </div>
                        <p className="text-3xl font-semibold" style={{ color: '#1d1d1f' }}>{'\u20b9'}14,250</p>
                        <p className="text-xs text-[#00863a] mt-1 font-medium">{'↑'} 23% vs yesterday</p>
                      </div>
                      <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#eaf3ff', border: '1px solid rgba(0,113,227,0.12)' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,113,227,0.12)' }}>
                          <MessageCircle className="w-4 h-4" style={{ color: '#0071e3' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink-800 truncate">Daily report sent to WhatsApp</p>
                          <p className="text-xs text-ink-500">23 bills {'·'} {'\u20b9'}14,250 total</p>
                        </div>
                      </div>
                      <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#e8f8ee', border: '1px solid rgba(0,134,58,0.12)' }}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,134,58,0.12)' }}>
                          <Zap className="w-4 h-4 text-[#00863a]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-ink-800 truncate">AI: 3 items low on stock</p>
                          <p className="text-xs text-ink-500">Tap to reorder {'→'}</p>
                        </div>
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
      <section style={{ paddingTop: '72px', paddingBottom: '72px', background: '#f5f5f7' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal>
            <h2
              className="text-center font-semibold mb-14"
              style={{ fontFamily: '-apple-system, "SF Pro Display"', fontSize: 'clamp(32px, 4vw, 44px)', lineHeight: 1.15, color: '#1d1d1f' }}
            >Small shops run on spreadsheets and stress.</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Clock, stat: '2 hours/day', problem: 'Manual invoicing + stock tracking', fix: 'Billed in 60 seconds via AI' },
              { icon: Brain, stat: '\u20b915,000/month', problem: "Assistant salary you can't afford", fix: 'AI does the follow-ups, you sell' },
              { icon: AlertCircle, stat: 'Zero visibility', problem: "You don't know what's selling", fix: 'Daily reports, WhatsApp alerts, no login needed' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 120}>
                <div
                  className="rounded-2xl p-8 text-center transition-all duration-300 hover:-translate-y-1 bg-white"
                  style={{ border: '1px solid #e8e8ed' }}
                >
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(0,113,227,0.08)' }}>
                    <item.icon className="w-7 h-7" style={{ color: '#0071e3' }} />
                  </div>
                  <p className="text-2xl font-semibold mb-2" style={{ color: '#1d1d1f' }}>{item.stat}</p>
                  <p className="text-sm mb-3" style={{ color: '#86868b' }}>{item.problem}</p>
                  <p className="text-sm font-medium" style={{ color: '#00863a' }}>{item.fix}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. FEATURES ═══ */}
      <section id="features" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal>
            <h2
              className="text-center font-semibold mb-3"
              style={{ fontFamily: '-apple-system, "SF Pro Display"', fontSize: 'clamp(32px, 4vw, 44px)', color: '#1d1d1f' }}
            >Everything You Actually Need<br />(Nothing You Don't)</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 mt-14">
            {[
              { icon: Receipt, title: 'Billing in 60 Seconds', desc: 'Voice-to-invoice, customer memory, auto-PDF sharing. Customers get WhatsApp receipts instantly.', emoji: '⚡' },
              { icon: Users, title: 'Smart Customer Tracking', desc: "Auto-capture phone numbers, purchase history, loyalty math. Send WhatsApp reminders when they're likely to buy again.", emoji: '🧠' },
              { icon: Zap, title: 'AI Does the Admin Work', desc: 'Daily closing reports. Low-stock alerts. Hinglish customer replies. Voice commands in Hindi.', emoji: '⚙️' },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 120}>
                <div
                  className="rounded-2xl p-9 transition-all duration-500 group relative overflow-hidden hover:-translate-y-1 bg-white"
                  style={{ border: '1px solid #e8e8ed' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110" style={{ background: '#e8f8ee' }}>
                    <card.icon className="w-5 h-5" style={{ color: '#00863a' }} />
                  </div>
                  <h3 className="font-semibold text-xl mb-3" style={{ fontFamily: '-apple-system, "SF Pro Display"', color: '#1d1d1f' }}>{card.emoji} {card.title}</h3>
                  <p className="leading-relaxed mb-5" style={{ fontSize: '16px', color: '#424245' }}>{card.desc}</p>
                  <button className="text-sm font-normal transition-colors flex items-center gap-1" style={{ color: '#0071e3' }}>
                    See how <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. TESTIMONIALS ═══ */}
      <section style={{ paddingTop: '72px', paddingBottom: '72px', background: '#f5f5f7' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal>
            <h2
              className="text-center font-semibold mb-14"
              style={{ fontFamily: '-apple-system, "SF Pro Display"', fontSize: 'clamp(32px, 4vw, 44px)', color: '#1d1d1f' }}
            >Shop Owners Are Saving Time<br />(And Making More)</h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={i} delay={i * 120}>
                <div className="rounded-2xl p-7 bg-white" style={{ border: '1px solid #e8e8ed' }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-full text-white flex items-center justify-center font-semibold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0071e3, #3a8eff)' }}>{t.initials}</div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm" style={{ color: '#1d1d1f' }}>{t.name}</p>
                      <p className="text-xs" style={{ color: '#86868b' }}>{t.shop} {'·'} {t.city}</p>
                    </div>
                  </div>
                  <p className="text-base italic leading-relaxed mb-5" style={{ color: '#1d1d1f' }}>"{t.quote}"</p>
                  <div className="pt-4" style={{ borderTop: '1px solid #e8e8ed' }}>
                    <span className="text-3xl font-semibold" style={{ color: '#00863a' }}>{t.stat}</span>
                    <span className="text-sm ml-2" style={{ color: '#86868b' }}>{t.metric}</span>
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
          <Reveal>
            <h2
              className="text-center font-semibold mb-3"
              style={{ fontFamily: '-apple-system, "SF Pro Display"', fontSize: 'clamp(32px, 4vw, 44px)', color: '#1d1d1f' }}
            >One Plan. Transparent Pricing.</h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="text-center mb-14" style={{ fontSize: '17px', color: '#86868b' }}>No tiers, no upsells, no confusion.</p>
          </Reveal>
          <Reveal delay={200}>
            <div className="max-w-md mx-auto rounded-2xl p-12 text-center relative bg-white" style={{ border: '2px solid #0071e3' }}>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold text-white px-4 py-1.5 rounded-full whitespace-nowrap" style={{ background: '#00863a' }}>14 days free. No card required.</div>
              <h3 className="font-semibold text-lg mb-3" style={{ fontFamily: '-apple-system, "SF Pro Display"', color: '#1d1d1f' }}>Cashiea Pro</h3>
              <div className="mb-8">
                <span className="text-5xl font-semibold" style={{ color: '#0071e3' }}>{'\u20b9'}7,500</span>
                <span className="text-sm ml-1" style={{ color: '#86868b' }}>/month</span>
              </div>
              <ul className="text-left space-y-3.5 mb-10">
                {['Unlimited invoices & customers', 'AI quick tasks (4 per day free)', 'WhatsApp integration & auto-replies', 'Daily reports & low-stock alerts', 'Voice invoicing in Hinglish', 'Email + WhatsApp support (replies in 2 hours)'].map((f) => (
                  <li key={f} className="flex items-start gap-2.5" style={{ fontSize: '16px', color: '#424245' }}>
                    <Check className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#00863a' }} /> {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 font-medium text-white px-8 py-4 rounded-full transition-all hover:scale-[1.03] w-full"
                style={{ background: 'linear-gradient(135deg, #0071e3, #3a8eff)', boxShadow: '0 6px 20px rgba(0,113,227,0.30)' }}
              >Start Free Trial</Link>
              <p className="text-xs mt-5" style={{ color: '#86868b' }}>Cancel anytime. No hidden fees. We don't lock you in.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 7. FAQ ═══ */}
      <section id="faq" style={{ paddingTop: '72px', paddingBottom: '72px', background: '#f5f5f7' }}>
        <div className="max-w-[640px] mx-auto px-6">
          <Reveal>
            <h2
              className="text-center font-semibold mb-12"
              style={{ fontFamily: '-apple-system, "SF Pro Display"', fontSize: 'clamp(32px, 4vw, 44px)', color: '#1d1d1f' }}
            >Questions? We Have Answers.</h2>
          </Reveal>
          <div className="space-y-3">
            {FAQS.map((faq, i) => <Reveal key={i} delay={i * 60}><FAQItem faq={faq} /></Reveal>)}
          </div>
        </div>
      </section>

      {/* ═══ 8. FINAL CTA ═══ */}
      <section
        className="relative overflow-hidden"
        style={{ paddingTop: '90px', paddingBottom: '90px', background: 'linear-gradient(135deg, #0071e3 0%, #0055aa 100%)' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 70%)' }} />
        <div className="relative max-w-[1200px] mx-auto px-6 text-center">
          <Reveal>
            <h2
              className="font-semibold text-white mb-5"
              style={{ fontFamily: '-apple-system, "SF Pro Display"', fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.15 }}
            >Your Retail Business Deserves Better.</h2>
            <p className="mb-10 mx-auto" style={{ fontSize: '19px', color: 'rgba(255,255,255,0.85)', maxWidth: '520px' }}>
              Try Cashiea free for 14 days. No credit card. No commitment. See what {'\u20b9'}7,500 can do.
            </p>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center gap-2 font-medium px-10 py-4 rounded-full transition-all hover:scale-[1.04]"
              style={{ backgroundColor: 'white', color: '#0071e3', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}
            >
              Start Free Trial Now <ArrowRight className="w-5 h-5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══ 9. FOOTER ═══ */}
      <footer style={{ background: '#1d1d1f', paddingTop: '56px', paddingBottom: '56px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Logo size={32} />
                <span className="font-semibold text-lg text-white">Cashiea</span>
              </div>
              <p className="text-sm" style={{ color: '#86868b' }}>POS + CRM + AI for Indian retail</p>
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-4">Product</p>
              <div className="space-y-2.5">
                <button onClick={() => scrollTo('#features')} className="block text-sm transition-colors" style={{ color: '#86868b' }}>Features</button>
                <button onClick={() => scrollTo('#pricing')} className="block text-sm transition-colors" style={{ color: '#86868b' }}>Pricing</button>
                <button onClick={() => scrollTo('#faq')} className="block text-sm transition-colors" style={{ color: '#86868b' }}>FAQ</button>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-4">Company</p>
              <div className="space-y-2.5">
                <Link to="/privacy" className="block text-sm transition-colors" style={{ color: '#86868b' }}>Privacy</Link>
                <Link to="/terms" className="block text-sm transition-colors" style={{ color: '#86868b' }}>Terms</Link>
                <Link to="/case-study" className="block text-sm transition-colors" style={{ color: '#86868b' }}>Case Study</Link>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-white mb-4">Support</p>
              <div className="space-y-2.5">
                <Link to="/app/support" className="block text-sm transition-colors" style={{ color: '#86868b' }}>Help Center</Link>
                <a href="mailto:supportcashiea@gmail.com" className="block text-sm transition-colors" style={{ color: '#86868b' }}>supportcashiea@gmail.com</a>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6" style={{ borderTop: '1px solid #424245' }}>
            <p className="text-xs text-center" style={{ color: '#6e6e73' }}>{'\u00a9'} 2026 Cashiea. Made with care for India's small businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FAQItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl overflow-hidden transition-all bg-white" style={{ border: '1px solid #e8e8ed' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-6 text-left">
        <span className="font-medium text-base" style={{ color: '#1d1d1f' }}>{faq.q}</span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 ml-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} style={{ color: '#0071e3' }} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96' : 'max-h-0'}`}>
        <p className="px-6 pb-6 leading-relaxed" style={{ fontSize: '16px', color: '#424245' }}>{faq.a}</p>
      </div>
    </div>
  )
}
