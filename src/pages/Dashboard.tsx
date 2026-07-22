import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  DollarSign, ShoppingCart, Users, Package, TrendingUp, ArrowRight,
  Clock, AlertTriangle, Receipt, Megaphone, Zap, Sparkles,
} from 'lucide-react'
import { PLANS } from '../lib/types'
import type { ActivityLog, Transaction, Product, Customer } from '../lib/types'

// ════════════════════════════════════════════════════════════════
// Reveal — Apple-style scroll-reveal helper (inlined to keep this
// file self-contained).
// ════════════════════════════════════════════════════════════════
function Reveal({ children, delay = 0, dir = 'up', className = '' }: {
  children: ReactNode; delay?: number; dir?: 'up' | 'fade'; className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  const hidden = dir === 'fade' ? 'opacity-0' : 'opacity-0 translate-y-7'
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms`, transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)', transitionDuration: '900ms' }}
      className={`transition-all ${visible ? 'opacity-100 translate-y-0' : hidden} ${className}`}
    >
      {children}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Dashboard — Apple-inspired Today page.
//
// Type-led hero (eyebrow → display title → subtitle → CTA row),
// then three large feature cards, KPI strip, 2×2 detail grid, and
// an AI activity timeline. Every section reveals on scroll.
// ════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({ todayRevenue: 0, todayOrders: 0, monthRevenue: 0, customers: 0, products: 0 })
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([])
  const [recentSales, setRecentSales] = useState<Transaction[]>([])
  const [lowStock, setLowStock] = useState<Product[]>([])
  const [dormantCount, setDormantCount] = useState(0)
  const [savings, setSavings] = useState({ timeMinutes: 0, money: 0, actions: 0 })
  const [recent, setRecent] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadOverview()
  }, [profile])

  const loadOverview = async () => {
    setLoading(true)
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [todayTx, monthTx, cust, prod, logs] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', profile!.id).eq('status', 'completed').gte('created_at', startToday),
      supabase.from('transactions').select('*').eq('user_id', profile!.id).eq('status', 'completed').gte('created_at', startMonth),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('user_id', profile!.id),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', profile!.id),
      supabase.from('activity_logs').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false }).limit(50),
    ])

    const todayData = (todayTx.data as Transaction[]) || []
    const monthData = (monthTx.data as Transaction[]) || []
    const todayRevenue = todayData.reduce((s, t) => s + Number(t.total), 0)
    const monthRevenue = monthData.reduce((s, t) => s + Number(t.total), 0)

    setStats({
      todayRevenue, todayOrders: todayData.length, monthRevenue,
      customers: cust.count || 0, products: prod.count || 0,
    })

    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {}
    monthData.forEach((t) => {
      (t.items || []).forEach((item) => {
        const key = item.product_id || item.name
        if (!productMap[key]) productMap[key] = { name: item.name, qty: 0, revenue: 0 }
        productMap[key].qty += item.quantity
        productMap[key].revenue += item.quantity * item.unit_price
      })
    })
    setTopProducts(Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5))
    setRecentSales(todayData.slice(0, 6))

    const { data: allProducts } = await supabase.from('products').select('*').eq('user_id', profile!.id)
    const productsList = (allProducts as Product[]) || []
    setLowStock(productsList.filter((p) => p.stock_quantity <= p.low_stock_threshold).slice(0, 5))

    const { data: custList } = await supabase.from('customers').select('last_purchase_at, total_orders').eq('user_id', profile!.id)
    const dormant = ((custList as Pick<Customer, 'last_purchase_at' | 'total_orders'>[]) || []).filter((c) => {
      if (c.total_orders === 0) return false
      if (!c.last_purchase_at) return false
      return (Date.now() - new Date(c.last_purchase_at).getTime()) / 86400000 > 60
    })
    setDormantCount(dormant.length)

    if (logs.data) {
      const full = logs.data as ActivityLog[]
      setSavings({
        timeMinutes: full.reduce((s, l) => s + (l.time_saved_minutes || 0), 0),
        money: full.reduce((s, l) => s + Number(l.money_saved || 0), 0),
        actions: full.length,
      })
      setRecent(full.slice(0, 5))
    }
    setLoading(false)
  }

  const trialActive = profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date()
  const trialDaysLeft = trialActive ? Math.max(0, Math.ceil((new Date(profile!.trial_ends_at!).getTime() - Date.now()) / 86400000)) : 0
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 5)  return 'Working late'
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Clock className="w-6 h-6 animate-spin text-apple-500" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      {/* ═══ 1. HERO ═══ */}
      <section className="bg-apple-hero rounded-3xl px-6 sm:px-10 py-12 sm:py-16 mb-8">
        <div className="max-w-3xl">
          <Reveal>
            <p className="section-eyebrow">{greeting}, {firstName}</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="text-[40px] sm:text-[52px] lg:text-[60px] font-semibold tracking-tight leading-[1.05] text-ink-800 mt-2">
              Your store,<br />
              <span className="text-ink-500">at a glance.</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-lg sm:text-xl text-ink-600 mt-5 max-w-xl leading-relaxed">
              {stats.todayOrders > 0
                ? <>You've made <span className="text-ink-800 font-medium">${stats.todayRevenue.toFixed(0)}</span> from {stats.todayOrders} sale{stats.todayOrders === 1 ? '' : 's'} today. Here's everything that matters.</>
                : <>A quiet day so far. Ring up your first sale and the numbers will start moving.</>}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to="/app/pos" className="btn-primary px-6 py-3 text-[15px]">
                Start a new sale <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/app/assistant" className="btn-link text-[15px]">
                Ask the AI →
              </Link>
            </div>
          </Reveal>
          {trialActive && (
            <Reveal delay={320}>
              <div className="mt-7 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-ink-200 text-[13px] text-ink-700 backdrop-blur">
                <span className="w-1.5 h-1.5 rounded-full bg-apple-500" />
                Free Pro trial — {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'} left.
                <Link to="/app/subscription" className="text-apple-500 hover:underline ml-1">Manage</Link>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      {/* ═══ 2. PRIMARY STAT — TODAY ═══ */}
      <Reveal>
        <section className="mb-3 mt-2">
          <p className="section-eyebrow">Today</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink-800 mt-1">
            ${stats.todayRevenue.toFixed(2)}
          </h2>
          <p className="text-ink-500 mt-1 text-[15px]">
            {stats.todayOrders === 0
              ? 'No sales yet — start one whenever you’re ready.'
              : `${stats.todayOrders} sale${stats.todayOrders === 1 ? '' : 's'} so far today. ${stats.monthRevenue > stats.todayRevenue ? `$${(stats.monthRevenue - stats.todayRevenue).toFixed(0)} more this month.` : ''}`}
          </p>
        </section>
      </Reveal>

      {/* ═══ 3. THREE FEATURE BANNERS (Apple-style product grid) ═══ */}
      <div className="grid lg:grid-cols-3 gap-5 my-10">
        <Reveal delay={0}>
          <FeatureCard
            to="/app/pos"
            eyebrow="Counter"
            title="New Sale."
            subtitle="Ring up a customer in under a minute. Voice billing, UPI, instant receipt."
            cta="Open POS"
            gradient="bg-apple-gradient-blue"
            icon={<ShoppingCart className="w-7 h-7" />}
            iconBg="bg-apple-500"
            iconColor="text-white"
            stat={stats.todayOrders > 0 ? `${stats.todayOrders} sales today` : 'Ready when you are'}
          />
        </Reveal>
        <Reveal delay={120}>
          <FeatureCard
            to="/app/customers"
            eyebrow="CRM"
            title="Customers."
            subtitle="See who's buying, who's quiet, and who's ready for a win-back nudge."
            cta="View customers"
            gradient="bg-apple-gradient-cream"
            icon={<Users className="w-7 h-7" />}
            iconBg="bg-[#ff9500]"
            iconColor="text-white"
            stat={`${stats.customers} total`}
          />
        </Reveal>
        <Reveal delay={240}>
          <FeatureCard
            to="/app/assistant"
            eyebrow="AI"
            title="Ask anything."
            subtitle="“How was business today?” “Who bought cement last week?” Just ask."
            cta="Open assistant"
            gradient="bg-apple-gradient-gray"
            icon={<Sparkles className="w-7 h-7" />}
            iconBg="bg-ink-800"
            iconColor="text-white"
            stat={savings.actions > 0 ? `${savings.actions} AI actions done` : 'Try a question'}
          />
        </Reveal>
      </div>

      {/* ═══ 4. KPI STRIP ═══ */}
      <Reveal>
        <section className="mb-10">
          <p className="section-eyebrow mb-3">The numbers</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-ink-200 rounded-2xl overflow-hidden border border-ink-200">
            <KPI icon={<DollarSign className="w-4 h-4" />} label="This month" value={`$${stats.monthRevenue.toFixed(0)}`} hint="Total revenue" />
            <KPI icon={<Users className="w-4 h-4" />} label="Customers" value={String(stats.customers)} hint="In your CRM" />
            <KPI icon={<Package className="w-4 h-4" />} label="Products" value={String(stats.products)} hint="In your catalog" />
            <KPI icon={<Zap className="w-4 h-4" />} label="AI time saved" value={`${savings.timeMinutes}m`} hint="Across all actions" />
          </div>
        </section>
      </Reveal>

      {/* ═══ 5. TWO-COLUMN DETAILS ═══ */}
      <div className="grid lg:grid-cols-2 gap-5">
        <Reveal>
          <div className="card p-7 h-full">
            <div className="flex items-end justify-between mb-5">
              <div>
                <p className="section-eyebrow">Today</p>
                <h3 className="text-2xl font-semibold tracking-tight text-ink-800 mt-1">Recent sales.</h3>
              </div>
              <Link to="/app/pos" className="btn-link">New sale →</Link>
            </div>
            {recentSales.length === 0 ? (
              <EmptyHint text="No sales yet today." cta={{ label: 'Start one', to: '/app/pos' }} />
            ) : (
              <ul className="divide-y divide-ink-100">
                {recentSales.map((s) => (
                  <li key={s.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-[15px] text-ink-800 font-medium">{s.receipt_number}</p>
                      <p className="text-[13px] text-ink-500 mt-0.5">
                        {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {s.items?.length || 0} item{(s.items?.length || 0) === 1 ? '' : 's'} · {s.payment_method}
                      </p>
                    </div>
                    <span className="text-[15px] font-medium text-ink-800">${Number(s.total).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="card p-7 h-full">
            <div className="flex items-end justify-between mb-5">
              <div>
                <p className="section-eyebrow">This month</p>
                <h3 className="text-2xl font-semibold tracking-tight text-ink-800 mt-1">Top products.</h3>
              </div>
              <Link to="/app/reports" className="btn-link">Full report →</Link>
            </div>
            {topProducts.length === 0 ? (
              <EmptyHint text="No sales data yet this month." />
            ) : (
              <ul className="space-y-3">
                {topProducts.map((p, i) => (
                  <li key={i} className="flex items-center gap-4">
                    <span className="w-7 h-7 rounded-full bg-ink-100 flex items-center justify-center text-[13px] font-medium text-ink-700 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] text-ink-800 font-medium truncate">{p.name}</p>
                      <p className="text-[13px] text-ink-500 mt-0.5">{p.qty} sold</p>
                    </div>
                    <span className="text-[15px] font-medium text-ink-800">${p.revenue.toFixed(0)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="card p-7 h-full">
            <div className="flex items-end justify-between mb-5">
              <div>
                <p className="section-eyebrow">Inventory</p>
                <h3 className="text-2xl font-semibold tracking-tight text-ink-800 mt-1">Low stock.</h3>
              </div>
              <Link to="/app/products" className="btn-link">Manage →</Link>
            </div>
            {lowStock.length === 0 ? (
              <EmptyHint text="All stocked up. ✅" />
            ) : (
              <ul className="space-y-3">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span className="text-[15px] text-ink-800 font-medium truncate">{p.name}</span>
                    <span className="text-[13px] font-medium text-[#ff9500] ml-3 flex-shrink-0">{p.stock_quantity} left</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="card p-7 h-full bg-apple-gradient-cream border-[#ffd9a3]/40">
            <p className="section-eyebrow">Win-back</p>
            <h3 className="text-2xl font-semibold tracking-tight text-ink-800 mt-1">
              {dormantCount} customer{dormantCount === 1 ? '' : 's'} ready to come back.
            </h3>
            <p className="text-[15px] text-ink-600 mt-3 leading-relaxed">
              People who bought 60+ days ago but haven't returned. A short WhatsApp nudge is usually enough to bring them back.
            </p>
            <div className="mt-6 flex items-center gap-4">
              {dormantCount > 0 ? (
                <Link to="/app/customers?segment=dormant" className="btn-primary px-5 py-2.5">
                  Start a campaign <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <p className="text-[13px] text-ink-500">No dormant customers right now. 🎉</p>
              )}
            </div>
          </div>
        </Reveal>
      </div>

      {/* ═══ 6. AI ACTIVITY STRIP ═══ */}
      {recent.length > 0 && (
        <Reveal>
          <section className="mt-12">
            <p className="section-eyebrow mb-3">AI activity</p>
            <div className="card divide-y divide-ink-100">
              {recent.map((log) => (
                <div key={log.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-ink-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-ink-800 font-medium truncate">{log.description}</p>
                    <p className="text-[13px] text-ink-500 mt-0.5">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                  {log.time_saved_minutes ? (
                    <span className="text-[13px] text-ink-500 flex-shrink-0">−{log.time_saved_minutes}m</span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════

function FeatureCard({
  to, eyebrow, title, subtitle, cta, gradient, icon, iconBg, iconColor, stat,
}: {
  to: string
  eyebrow: string
  title: string
  subtitle: string
  cta: string
  gradient: string
  icon: ReactNode
  iconBg: string
  iconColor: string
  stat: string
}) {
  return (
    <Link
      to={to}
      className={`group block rounded-3xl ${gradient} border border-ink-200/50 p-8 h-full transition-all duration-500 hover:scale-[1.015] hover:shadow-apple-lg overflow-hidden relative`}
    >
      <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-500">{eyebrow}</p>
      <h3 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-ink-800 leading-tight">
        {title}
      </h3>
      <p className="mt-3 text-[15px] text-ink-600 leading-relaxed max-w-xs">
        {subtitle}
      </p>
      <div className="mt-6 flex items-center gap-2 text-apple-500 text-[15px] font-medium group-hover:gap-3 transition-all">
        {cta} <ArrowRight className="w-4 h-4" />
      </div>
      <div className="mt-6 flex items-end justify-between">
        <div className={`w-12 h-12 rounded-2xl ${iconBg} ${iconColor} flex items-center justify-center shadow-sm`}>
          {icon}
        </div>
        <p className="text-[13px] text-ink-500">{stat}</p>
      </div>
    </Link>
  )
}

function KPI({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="bg-white p-5 flex flex-col">
      <div className="flex items-center gap-1.5 text-ink-500 text-[12px] font-medium">
        {icon} {label}
      </div>
      <p className="text-2xl font-semibold text-ink-800 mt-2">{value}</p>
      <p className="text-[12px] text-ink-500 mt-0.5">{hint}</p>
    </div>
  )
}

function EmptyHint({ text, cta }: { text: string; cta?: { label: string; to: string } }) {
  return (
    <div className="py-6 text-center">
      <p className="text-[15px] text-ink-500">{text}</p>
      {cta && (
        <Link to={cta.to} className="btn-link mt-3 inline-flex">
          {cta.label} →
        </Link>
      )}
    </div>
  )
}
