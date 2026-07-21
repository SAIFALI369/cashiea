import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, ArrowRight, Play, Clock, Brain, AlertCircle,
  Receipt, Users, Zap, ChevronDown, Check, Menu, X,
  TrendingUp, MessageCircle, Shield, Star,
} from 'lucide-react'

// ─── Scroll-reveal hook (lightweight, no library needed) ─────────
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

// ─── Reveal wrapper ─────────────────────────────────────────────
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-500 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      {children}
    </div>
  )
}

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

const TESTIMONIALS = [
  { initials: 'SM', name: 'Suresh Mallick', shop: 'Electronics Store', city: 'Gaya, Bihar', quote: 'I used to spend 3 hours every evening on invoices. Now it takes 30 minutes. I use the extra time to talk to customers.', stat: '6 hours', metric: 'saved per week' },
  { initials: 'RV', name: 'Ramesh Verma', shop: 'General Store', city: 'Patna, Bihar', quote: 'The daily WhatsApp report changed everything. I know exactly how much I made before I even close the shop.', stat: '₹12,000', metric: 'extra revenue/month' },
  { initials: 'AK', name: 'Amit Kumar', shop: 'Pharmacy', city: 'Siwan, Bihar', quote: 'Voice invoicing in Hindi is brilliant. My staff just speaks the sale and the bill is ready. Customers are impressed.', stat: '90%', metric: 'faster billing' },
]

const FAQS = [
  { q: 'Do I need technical knowledge to set up Cashiea?', a: 'Not at all. Setup takes 5 minutes. Enter your shop name, add a few products, and you are ready to bill. The AI learns your business automatically as you use it.' },
  { q: 'What if I am already using a POS or billing app?', a: 'Cashiea works alongside your existing setup. You can import your product list, and the AI tools (WhatsApp reports, voice invoicing, customer tracking) add value on top. No need to replace anything overnight.' },
  { q: 'Is my data safe?', a: 'Absolutely. Your data is encrypted, stored securely, and protected by row-level security — each shop can only see their own data. We never sell or share your information.' },
  { q: 'Can I scale to multiple shops?', a: 'Yes. One account can manage multiple locations. This is coming in a future update — you will be the first to know when it launches.' },
  { q: 'What if my internet goes down?', a: 'Cashiea queues your transactions locally and syncs automatically when you are back online. You never lose a sale because of connectivity.' },
]

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (href: string) => {
    setMenuOpen(false)
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">

      {/* ═══ 1. NAVIGATION ═══ */}
      <nav className={`sticky top-0 z-50 bg-white transition-shadow duration-200 ${scrolled ? 'shadow-sm' : ''}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Cashiea</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <button key={link.href} onClick={() => scrollTo(link.href)} className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">
                {link.label}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors hidden sm:block">Login</Link>
            <Link to="/signup" className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-all hover:scale-[1.02]">Start Free Trial</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-gray-600">
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 px-6 py-4 space-y-3 animate-fade-in">
            {NAV_LINKS.map((link) => (
              <button key={link.href} onClick={() => scrollTo(link.href)} className="block text-sm font-medium text-gray-600 hover:text-blue-600">{link.label}</button>
            ))}
            <Link to="/login" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-gray-600">Login</Link>
          </div>
        )}
      </nav>

      {/* ═══ 2. HERO ═══ */}
      <section className="bg-gray-50" style={{ paddingTop: '80px', paddingBottom: '60px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: text */}
            <div>
              <h1 className="font-display font-bold tracking-tight" style={{ fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.2, color: '#1a1a1a' }}>
                Your Retail Business,<br />Automated.
              </h1>
              <p className="mt-6 text-lg leading-relaxed" style={{ color: '#4b5563' }}>
                POS billing + customer insights + AI shortcuts. Built for India's small shops. No complex training, no monthly CFO needed.
              </p>
              <div className="mt-4 flex items-center gap-2 text-base font-medium" style={{ color: '#10b981' }}>
                <Check className="w-5 h-5" /> Replace your 30-hour/month assistant — at half the cost
              </div>

              {/* CTAs */}
              <div className="mt-8 flex flex-col gap-3">
                <Link to="/signup" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-lg transition-all hover:scale-[1.02]" style={{ fontSize: '16px' }}>
                  Start 14-Day Free Trial <ArrowRight className="w-5 h-5" />
                </Link>
                <button onClick={() => scrollTo('#features')} className="inline-flex items-center justify-center gap-2 text-blue-600 font-medium text-sm hover:underline">
                  <Play className="w-4 h-4" /> Watch 2-Min Demo
                </button>
              </div>

              {/* Trust badge */}
              <p className="mt-6 text-sm" style={{ color: '#9ca3af' }}>
                Used by 47 shops in Bihar, Gujarat, Maharashtra. No credit card required.
              </p>
            </div>

            {/* Right: phone mockup */}
            <div className="relative hidden md:block">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-green-500/5 rounded-3xl" />
              <div className="relative mx-auto" style={{ maxWidth: '320px' }}>
                {/* Phone frame */}
                <div className="bg-gray-900 rounded-[2.5rem] p-3 shadow-2xl">
                  <div className="bg-white rounded-[2rem] overflow-hidden">
                    {/* Phone screen content */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-lg" style={{ fontFamily: 'Plus Jakarta Sans' }}>Cashiea</span>
                        <span className="w-2 h-2 bg-green-400 rounded-full" />
                      </div>
                      {/* Invoice card */}
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-500">TODAY'S SALES</span>
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold" style={{ color: '#1a1a1a' }}>₹14,250</p>
                        <p className="text-xs text-green-600 mt-1">↑ 23% vs yesterday</p>
                      </div>
                      {/* Notification card */}
                      <div className="bg-blue-50 rounded-xl p-3 border border-blue-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <MessageCircle className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">Daily report sent to WhatsApp</p>
                          <p className="text-xs text-gray-500">23 bills · ₹14,250 total</p>
                        </div>
                      </div>
                      {/* AI task card */}
                      <div className="bg-green-50 rounded-xl p-3 border border-green-100 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Zap className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">AI: 3 items low on stock</p>
                          <p className="text-xs text-gray-500">Tap to reorder →</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ 3. PROBLEM SECTION ═══ */}
      <section className="bg-white" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal>
            <h2 className="text-center font-display font-semibold mb-12" style={{ fontSize: 'clamp(28px, 4vw, 36px)', lineHeight: 1.3, color: '#1a1a1a' }}>
              Small shops run on spreadsheets and stress.
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Clock, stat: '2 hours/day', problem: 'Manual invoicing + stock tracking', fix: 'Billed in 60 seconds via AI' },
              { icon: Brain, stat: '₹15,000/month', problem: 'Assistant salary you can\'t afford', fix: 'AI does the follow-ups, you sell' },
              { icon: AlertCircle, stat: 'Zero visibility', problem: 'You don\'t know what\'s selling', fix: 'Daily reports, WhatsApp alerts, no login needed' },
            ].map((item, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="rounded-xl p-6 transition-all hover:bg-gray-50 border border-transparent hover:border-gray-200 hover:shadow-sm text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold mb-1" style={{ color: '#1a1a1a' }}>{item.stat}</p>
                  <p className="text-sm text-gray-500 mb-3">{item.problem}</p>
                  <p className="text-sm font-medium" style={{ color: '#10b981' }}>{item.fix}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. CORE FEATURES ═══ */}
      <section id="features" className="bg-white" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal>
            <h2 className="text-center font-display font-semibold mb-3" style={{ fontSize: 'clamp(28px, 4vw, 36px)', color: '#1a1a1a' }}>
              Everything You Actually Need<br />(Nothing You Don't)
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { icon: Receipt, title: '⚡ Billing in 60 Seconds', desc: 'Voice-to-invoice, customer memory, auto-PDF sharing. Customers get WhatsApp receipts instantly.', link: 'See how' },
              { icon: Users, title: '🧠 Smart Customer Tracking', desc: 'Auto-capture phone numbers, purchase history, loyalty math. Send WhatsApp reminders when they\'re likely to buy again.', link: 'Automate follow-ups' },
              { icon: Zap, title: '⚙️ AI Does the Admin Work', desc: 'Daily closing reports. Low-stock alerts. Hinglish customer replies. Voice commands in Hindi.', link: 'See all AI tasks' },
            ].map((card, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="bg-gray-50 rounded-xl p-9 border border-gray-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group relative overflow-hidden">
                  <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-5">
                    <card.icon className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-display font-semibold text-xl mb-3" style={{ color: '#1a1a1a' }}>{card.title}</h3>
                  <p className="text-base leading-relaxed mb-4" style={{ color: '#4b5563' }}>{card.desc}</p>
                  <button className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1">
                    {card.link} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  {/* Bottom border accent on hover */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. TESTIMONIALS ═══ */}
      <section className="bg-white" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal>
            <h2 className="text-center font-display font-semibold mb-12" style={{ fontSize: 'clamp(28px, 4vw, 36px)', color: '#1a1a1a' }}>
              Shop Owners Are Saving Time<br />(And Making More)
            </h2>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{t.initials}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm" style={{ color: '#1a1a1a' }}>{t.name}</p>
                      <p className="text-xs" style={{ color: '#9ca3af' }}>{t.shop} · {t.city}</p>
                    </div>
                  </div>
                  <p className="text-base italic leading-relaxed mb-4" style={{ color: '#1a1a1a' }}>"{t.quote}"</p>
                  <div className="pt-3 border-t border-gray-200">
                    <span className="text-2xl font-bold" style={{ color: '#10b981' }}>{t.stat}</span>
                    <span className="text-sm ml-2" style={{ color: '#9ca3af' }}>{t.metric}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. PRICING ═══ */}
      <section id="pricing" className="bg-white" style={{ paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <Reveal>
            <h2 className="text-center font-display font-semibold mb-3" style={{ fontSize: 'clamp(28px, 4vw, 36px)', color: '#1a1a1a' }}>
              One Plan. Transparent Pricing.
            </h2>
            <p className="text-center text-base mb-12" style={{ color: '#9ca3af' }}>No tiers, no upsells, no confusion.</p>
          </Reveal>
          <Reveal delay={100}>
            <div className="max-w-md mx-auto bg-gray-50 rounded-xl p-12 text-center" style={{ border: '2px solid #2563eb' }}>
              <span className="inline-block text-xs font-semibold text-white bg-green-500 px-3 py-1 rounded-full mb-4">14 days free. No card required.</span>
              <h3 className="font-display font-bold text-lg mb-2" style={{ color: '#1a1a1a' }}>Cashiea Pro</h3>
              <div className="mb-6">
                <span className="text-5xl font-bold" style={{ color: '#2563eb' }}>₹7,500</span>
                <span className="text-sm ml-1" style={{ color: '#9ca3af' }}>/month</span>
              </div>
              <ul className="text-left space-y-3 mb-8">
                {['Unlimited invoices & customers', 'AI quick tasks (4 per day free)', 'WhatsApp integration & auto-replies', 'Daily reports & low-stock alerts', 'Voice invoicing in Hinglish', 'Email + WhatsApp support (replies in 2 hours)'].map((feat) => (
                  <li key={feat} className="flex items-start gap-2 text-base" style={{ color: '#4b5563' }}>
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" /> {feat}
                  </li>
                ))}
              </ul>
              <Link to="/signup" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-lg transition-all hover:scale-[1.02] w-full">
                Start Free Trial
              </Link>
              <p className="text-xs mt-4" style={{ color: '#9ca3af' }}>Cancel anytime. No hidden fees. We don't lock you in.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══ 7. FAQ ═══ */}
      <section id="faq" className="bg-gray-50" style={{ paddingTop: '60px', paddingBottom: '60px' }}>
        <div className="max-w-[600px] mx-auto px-6">
          <Reveal>
            <h2 className="text-center font-display font-semibold mb-12" style={{ fontSize: 'clamp(28px, 4vw, 36px)', color: '#1a1a1a' }}>
              Questions? We Have Answers.
            </h2>
          </Reveal>
          <div className="space-y-1">
            {FAQS.map((faq, i) => (
              <Reveal key={i} delay={i * 50}>
                <FAQItem faq={faq} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 8. FINAL CTA ═══ */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <Reveal>
            <h2 className="font-display font-bold text-white mb-4" style={{ fontSize: 'clamp(32px, 5vw, 48px)', lineHeight: 1.2 }}>
              Your Retail Business Deserves Better.
            </h2>
            <p className="text-lg mb-8 mx-auto" style={{ color: 'rgba(255,255,255,0.7)', maxWidth: '500px' }}>
              Try Cashiea free for 14 days. No credit card. No commitment. See what ₹7,500 can do.
            </p>
            <Link to="/signup" className="inline-flex items-center justify-center gap-2 font-semibold px-8 py-4 rounded-lg transition-all hover:scale-[1.02]" style={{ border: '2px solid white', color: 'white', backgroundColor: 'transparent' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = '#2563eb' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'white' }}
            >
              Start Free Trial Now <ArrowRight className="w-5 h-5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══ 9. FOOTER ═══ */}
      <footer style={{ background: '#1a1a1a', paddingTop: '48px', paddingBottom: '48px' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg text-white">Cashiea</span>
              </div>
              <p className="text-sm" style={{ color: '#9ca3af' }}>POS + CRM + AI for Indian retail</p>
            </div>
            {/* Product */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Product</p>
              <div className="space-y-2">
                <button onClick={() => scrollTo('#features')} className="block text-sm hover:text-white transition-colors" style={{ color: '#9ca3af' }}>Features</button>
                <button onClick={() => scrollTo('#pricing')} className="block text-sm hover:text-white transition-colors" style={{ color: '#9ca3af' }}>Pricing</button>
                <button onClick={() => scrollTo('#faq')} className="block text-sm hover:text-white transition-colors" style={{ color: '#9ca3af' }}>FAQ</button>
              </div>
            </div>
            {/* Company */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Company</p>
              <div className="space-y-2">
                <Link to="/privacy" className="block text-sm hover:text-white transition-colors" style={{ color: '#9ca3af' }}>Privacy</Link>
                <Link to="/terms" className="block text-sm hover:text-white transition-colors" style={{ color: '#9ca3af' }}>Terms</Link>
                <Link to="/case-study" className="block text-sm hover:text-white transition-colors" style={{ color: '#9ca3af' }}>Case Study</Link>
              </div>
            </div>
            {/* Support */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Support</p>
              <div className="space-y-2">
                <Link to="/app/support" className="block text-sm hover:text-white transition-colors" style={{ color: '#9ca3af' }}>Help Center</Link>
                <a href="mailto:supportcashiea@gmail.com" className="block text-sm hover:text-white transition-colors" style={{ color: '#9ca3af' }}>supportcashiea@gmail.com</a>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 pt-6" style={{ borderTop: '1px solid #333' }}>
            <p className="text-xs text-center" style={{ color: '#666' }}>© 2026 Cashiea. Made with care for India's small businesses.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── FAQ accordion item ─────────────────────────────────────────
function FAQItem({ faq }: { faq: { q: string; a: string } }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-6 text-left">
        <span className="font-semibold text-base hover:text-blue-600 transition-colors" style={{ color: '#1a1a1a' }}>{faq.q}</span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 ml-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} style={{ color: '#9ca3af' }} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-96' : 'max-h-0'}`}>
        <p className="px-6 pb-6 text-base leading-relaxed" style={{ color: '#4b5563' }}>{faq.a}</p>
      </div>
    </div>
  )
}
