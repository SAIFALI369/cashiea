import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import MerajSection from '../components/MerajSection'
import { FitAmount } from '../components/FitAmount'
import { formatINR } from '../lib/format'
import {
  TrendingUp, Wallet, Package, MessageCircle, FileSignature, Users,
  AlertTriangle, Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Today's Workspace ────────────────────────────────────────────
// Bare greeting → top-priority overdue hero → Meraj insights → Ask bar +
// suggestion pills → enriched dense stats (every card navigates to its page)
// + Business at a glance (weekly bars). Real data; insights in Meraj's voice.

interface Stat {
  label: string; value: string; count: number; icon: LucideIcon
  delta?: string; deltaTone?: 'good' | 'bad' | 'neutral'
  footer: string; footerTone: 'warning' | 'negative' | 'positive' | 'muted'
  to: string
  /** Soft warning tint for the card (pending funds, needs action). */
  tone?: 'warning'
  /** Primary in-card action (fintech style) — shown when there's something to act on. */
  action?: { label: string; query: string }
  /** Success state shown instead of a bare "0" — when zero is GOOD news. */
  positive?: { label: string }
}
interface Insight { severity: 'critical' | 'warning' | 'healthy'; title: string; subtitle: string }
interface OverdueInv { id: string; invoice_number: string; client_name: string; total: number; due_date: string | null }

function Sparkline({ values, height = 48, quiet = false }: { values: number[]; height?: number; quiet?: boolean }) {
  const pts = values.length ? values : [0, 0, 0, 0, 0, 0, 0]
  const max = Math.max(1, ...pts)
  const w = 100, h = height
  const step = pts.length > 1 ? w / (pts.length - 1) : w
  const y = (v: number) => h - 4 - (v / max) * (h - 8)
  const line = pts.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} ${w},${h} 0,${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} fill="rgb(var(--accent) / 0.12)" />
      <polyline points={line} fill="none" stroke="rgb(var(--accent))" strokeWidth={quiet ? 1.5 : 2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pts.map((v, i) => i === pts.length - 1 ? <circle key={i} cx={i * step} cy={y(v)} r={quiet ? 1.5 : 2.5} fill="rgb(var(--accent))" /> : null)}
    </svg>
  )
}

export default function Dashboard() {
  const { profile, ownerId } = useAuth()
  const navigate = useNavigate()
  // The data effect below still sets loading/insights (MerajSection renders
  // the insight surface today); the values themselves are not read here.
  const [, setLoading] = useState(true)
  const [stats, setStats] = useState<Stat[]>([])
  const [topPriority, setTopPriority] = useState<OverdueInv | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [overdueSum, setOverdueSum] = useState(0)
  const [, setInsights] = useState<Insight[]>([])
  const [daily, setDaily] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [dailyExp, setDailyExp] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [weekSales, setWeekSales] = useState(0)
  const [weekExpenses, setWeekExpenses] = useState(0)
  const [weekIncome, setWeekIncome] = useState(0)
  const [aiGreeting, setAiGreeting] = useState('')
  const [activeDay, setActiveDay] = useState<number | null>(null)

  // Static rotating greeting — zero AI credits, zero network, instant load.
  // AI credits are saved for actual business questions.
  useEffect(() => {
    if (!profile) return
    const fn = (profile?.full_name || 'there').split(' ')[0]
    const hour = new Date().getHours()
    const morning = [
      `Ready to win today, ${fn}?`,
      `Fresh day, fresh sales, ${fn}.`,
      `Aaj ka din shubh ho, ${fn}!`,
      `New day, new opportunities, ${fn}.`,
    ]
    const afternoon = [
      `Halfway there, ${fn} — keep going.`,
      `Dopahar ho gayi, ${fn}. Sales check karein?`,
      `Good afternoon, ${fn}. What's moving today?`,
    ]
    const evening = [
      `Wrapping up, ${fn}? Let's check today's numbers.`,
      `Evening time, ${fn}. How was the day?`,
      `Din khatam hone wala hai, ${fn}. Final push?`,
    ]
    const pool = hour < 12 ? morning : hour < 17 ? afternoon : evening
    setAiGreeting(pool[Math.floor(Math.random() * pool.length)])
  }, [profile])

  useEffect(() => {
    if (!profile) return


    ;(async () => {
      // SINGLE RPC — all dashboard stats in ONE round-trip (was 10+ queries)
      const { data: stats, error: statsErr } = await supabase.rpc('get_dashboard_stats', { target_user_id: ownerId })
      if (statsErr) throw statsErr
      const s = stats || {}

      const salesToday = Number(s.sales_today) || 0
      const salesYesterday = Number(s.sales_yesterday) || 0
      const pendingCount = Number(s.pending_count) || 0
      const pendingSum = Number(s.pending_sum) || 0
      const lowStock = Number(s.low_stock_count) || 0
      const messages = Number(s.unread_messages) || 0
      const orders = Number(s.pending_orders) || 0
      const staffN = Number(s.active_staff) || 0
      const expensesWeek = Number(s.week_expenses) || 0
      const incomeWeek = Number(s.week_income) || 0

      // overdue (from the single RPC)
      const overdue = (s.overdue || []) as OverdueInv[]
      setOverdueCount(overdue.length)
      setOverdueSum(overdue.reduce((s2: number, r: any) => s2 + Number(r.total || 0), 0))
      setTopPriority(overdue[0] || null)

      // weekly buckets (Mon–Sun) — from the single RPC
      const buckets = (s.week_daily || []).map((d: any) => Number(d.amount) || 0)
      while (buckets.length < 7) buckets.push(0)
      setDaily(buckets)
      setWeekSales(Number(s.week_sales_total) || buckets.reduce((s2: number, v: number) => s2 + v, 0))
      const expBuckets = (s.week_expenses_daily || []).map((d: any) => Number(d.amount) || 0)
      while (expBuckets.length < 7) expBuckets.push(0)
      setDailyExp(expBuckets)
      setWeekExpenses(expensesWeek)
      setWeekIncome(incomeWeek)

      // stats (enriched, dense)
      // Zero sales is NOT a loss — an empty morning stays neutral.
      setStats([
        {
          label: 'Sales today', value: formatINR(salesToday, 0), count: salesToday, icon: TrendingUp,

          footer: `Yesterday ${formatINR(salesYesterday, 0)}`, footerTone: 'muted',
          to: '/app/reports',
        },
        {
          label: 'Pending payments', value: pendingCount ? formatINR(pendingSum, 0) : '—', count: pendingCount, icon: Wallet,
          delta: pendingCount ? `${pendingCount} invoice${pendingCount > 1 ? 's' : ''} awaiting collection` : 'All clear',
          deltaTone: pendingCount ? 'bad' : 'good',
          footer: 'Tap card to view invoices', footerTone: 'warning',
          to: '/app/invoices',
          tone: pendingCount ? 'warning' : undefined,
          action: pendingCount ? { label: 'Remind Debtors', query: 'Draft payment reminder messages for my customers with pending payments — polite, WhatsApp-ready.' } : undefined,
          positive: { label: 'All Collected' },
        },
        {
          label: 'Low stock', value: `${lowStock}`, count: lowStock, icon: Package,
          delta: lowStock ? `${lowStock} need reorder` : 'Stocked',
          deltaTone: lowStock ? 'bad' : 'good',
          footer: lowStock ? 'Review inventory' : 'Levels healthy', footerTone: lowStock ? 'warning' : 'positive',
          to: '/app/products',
          positive: { label: 'Inventory Optimal' },
        },
        {
          label: 'Unread Messages', value: `${messages}`, count: messages, icon: MessageCircle,
          delta: messages ? 'Awaiting reply' : 'Inbox empty',
          deltaTone: messages ? 'neutral' : 'good',
          footer: 'Since yesterday', footerTone: 'muted',
          to: '/app/customers',
        },
        {
          label: 'Pending Orders', value: `${orders}`, count: orders, icon: FileSignature,
          delta: orders ? 'Needs response' : 'None',
          deltaTone: orders ? 'neutral' : 'good',
          footer: 'Quotes sent', footerTone: 'muted',
          to: '/app/quotations',
        },
        {
          label: 'Active staff', value: `${staffN}`, count: staffN, icon: Users,
          delta: staffN ? 'On the floor' : 'Just you',
          deltaTone: 'neutral',
          footer: 'Team members', footerTone: 'muted',
          to: '/app/team',
        },
      ])

      // Meraj insights (Hinglish voice, real-derived)
      const ins: Insight[] = []
      if (overdue.length > 0) ins.push({ severity: 'critical', title: `${overdue.length} bill${overdue.length > 1 ? 's' : ''} overdue`, subtitle: `${formatINR(overdue.reduce((s, r) => s + Number(r.total || 0), 0), 0)} collect karna baki hai` })
      if (salesToday > 0 && salesYesterday > 0 && salesToday < salesYesterday) {
        const pct = Math.round(((salesYesterday - salesToday) / salesYesterday) * 100)
        ins.push({ severity: 'warning', title: 'Aaj sales thodi kam hain', subtitle: `Kal ke mukable ${pct}% kam abhi tak` })
      } else if (salesToday > 0) {
        ins.push({ severity: 'healthy', title: 'Sales theek chal rahi hai', subtitle: `Aaj ${formatINR(salesToday, 0)} tak abhi` })
      }
      if (lowStock > 0) ins.push({ severity: 'warning', title: `${lowStock} item low stock par`, subtitle: 'Time rahe toh reorder kar lein' })
      else ins.push({ severity: 'healthy', title: 'Stock healthy hai', subtitle: 'Sab items available hain' })
      setInsights(ins.slice(0, 3))

      // NOTE: the old "AI suggestion pills" block lived here and fired a
      // dashboardSuggestions() AI call 8s after each dashboard load, feeding
      // a state the redesigned page no longer renders — it was dead cost,
      // removed in the production hardening pass (docs/PRODUCTION_AUDIT.md).

      setLoading(false)
    })()
  }, [profile])

  const firstName = (profile?.full_name || 'there').split(' ')[0]

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const maxDay = Math.max(1, ...daily, ...dailyExp)
  const todayIdx = (new Date().getDay() + 6) % 7
  // Honest weekly net: sales + other income − expenses. ₹0 on a quiet week is neutral, not a profit.
  const weekProfit = weekSales + weekIncome - weekExpenses

  return (
    <div className="animate-fade-in space-y-6 lg:space-y-8">
      {/* GREETING — bare page text, no card */}
      <div className="animate-rise-in">
        <h1 className="text-2xl font-semibold text-fg leading-tight">{aiGreeting || `Welcome back, ${firstName}.`}</h1>
        <p className="text-sm text-fg-muted mt-1">Here's what's happening in your business today. <Link to="/app/goals" className="text-accent font-semibold">Goals &amp; streak</Link></p>
      </div>

      {/* 1 · MONEY HERO — quiet luxury: one number owns the screen */}
      <section className="card relative overflow-hidden p-6 sm:p-8 animate-rise-in" style={{ animationDelay: '60ms' }}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgb(var(--accent) / 0.5), transparent)' }} aria-hidden="true" />
        <div className="flex flex-col items-center text-center gap-4">
          <p className="section-title">Today's revenue</p>
          <FitAmount value={stats[0]?.value || '₹0'} base="text-6xl sm:text-7xl" minTier="text-4xl" className="font-extrabold text-fg tracking-tight" />
          <p className="text-xs text-fg-subtle">{stats[0]?.footer || 'First sale of the day is waiting'}</p>
          <div className="hidden lg:block w-full max-w-md">
            <Sparkline values={daily} height={56} />
            <p className="text-[10px] text-fg-subtle mt-1.5">Last 7 days</p>
          </div>
        </div>
        {topPriority && (
          <button onClick={() => navigate('/app/invoices')} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-negative hover:opacity-80 transition-opacity">
            <AlertTriangle className="w-4 h-4" /> {formatINR(overdueSum, 0)} overdue — collect now
          </button>
        )}
      </section>

      {/* MERAJ SECTION — large rectangular reserved space for Meraj.
          He's always present here, playing/reacting, with a 💭 thought bubble
          that cycles a friend-phrase every hour, and a creative business
          pulse strip showing profit/stocks/sales/problems/growth. */}
      <MerajSection />

      {/* 2 · KPI BENTO — four quiet tiles (Stripe rhythm: label small, number heroic) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 animate-rise-in" style={{ animationDelay: '120ms' }}>
        <Link to="/app/reports" className="card card-hover p-4 sm:p-5">
          <p className="section-title">Sales today</p>
          <p className="text-2xl font-bold text-fg tabular-nums mt-1.5">{stats[0]?.value || '₹0'}</p>
          <div className="mt-2.5"><Sparkline values={daily} height={28} quiet /></div>
        </Link>
        <Link to="/app/invoices" className={'card card-hover p-4 sm:p-5 ' + (stats[1]?.count ? 'border-warning/30' : '')}>
          <p className="section-title">To collect</p>
          <p className={'text-2xl font-bold tabular-nums mt-1.5 ' + (stats[1]?.count ? 'text-warning' : 'text-fg')}>{stats[1]?.count ? stats[1].value : '—'}</p>
          <p className="text-[11px] text-fg-subtle mt-1">{stats[1]?.count ? stats[1].count + ' invoice' + (stats[1].count > 1 ? 's' : '') + ' waiting' : 'All collected'}</p>
        </Link>
        <Link to="/app/profit-dashboard" className="card card-hover p-4 sm:p-5">
          <p className="section-title">Week profit</p>
          <p className={'text-2xl font-bold tabular-nums mt-1.5 ' + (weekProfit > 0 ? 'text-positive' : weekProfit < 0 ? 'text-negative' : 'text-fg')}>{formatINR(weekProfit, 0)}</p>
          <p className="text-[11px] text-fg-subtle mt-1">{weekIncome > 0 ? 'incl. ' + formatINR(weekIncome, 0) + ' income' : 'sales − expenses'}</p>
        </Link>
        <Link to="/app/products" className={'card card-hover p-4 sm:p-5 ' + (stats[2]?.count ? 'border-warning/30' : '')}>
          <p className="section-title">Low stock</p>
          <p className={'text-2xl font-bold tabular-nums mt-1.5 ' + (stats[2]?.count ? 'text-warning' : 'text-positive')}>{stats[2]?.count || 'All stocked'}</p>
          <p className="text-[11px] text-fg-subtle mt-1">{stats[2]?.count ? 'Reorder soon' : 'Levels healthy'}</p>
        </Link>
      </div>

      {/* 4 · PULSE + PRIORITIES — bento */}
      <div className="grid lg:grid-cols-3 gap-3 lg:gap-4 animate-rise-in" style={{ animationDelay: '180ms' }}>
        <section onClick={() => navigate('/app/reports')} className="lg:col-span-2 card p-4 sm:p-5 cursor-pointer hover:border-accent/40 transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-bold text-fg">This week</h2>
            <div className="flex gap-4">
              <span className="text-[11px]"><span className="text-fg-subtle">Sales </span><span className="font-bold text-fg tabular-nums">{formatINR(weekSales, 0)}</span></span>
              <span className="text-[11px]"><span className="text-fg-subtle">Expenses </span><span className="font-bold text-fg-muted tabular-nums">{formatINR(weekExpenses, 0)}</span></span>
              <span className="text-[11px]"><span className="text-fg-subtle">Profit </span><span className={'font-bold tabular-nums ' + (weekProfit > 0 ? 'text-positive' : weekProfit < 0 ? 'text-negative' : 'text-fg-muted')}>{formatINR(weekProfit, 0)}</span></span>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted"><span className="w-2.5 h-2.5 rounded-[3px] bg-accent" /> Sales</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: 'rgb(var(--fg) / 0.18)' }} /> Expenses</span>
            <span className="text-[11px] text-fg-subtle ml-auto hidden sm:block">Tap a day for details</span>
          </div>

          {/* Mon–Sun grouped bars · gridlines · tap-to-reveal tooltip */}
          <div className="relative flex items-end justify-between gap-1.5 h-28" onMouseLeave={() => setActiveDay(null)}>
            {[25, 50, 75].map((p) => (
              <div key={p} className="absolute inset-x-0 border-t border-dashed border-line/70 pointer-events-none" style={{ bottom: `${p}%` }} />
            ))}
            {daily.map((v, i) => {
              const e = dailyExp[i] || 0
              const hs = Math.max(3, Math.round((v / maxDay) * 100))
              const he = Math.max(3, Math.round((e / maxDay) * 100))
              const isToday = i === todayIdx
              const active = activeDay === i
              return (
                <button
                  key={i}
                  onClick={() => setActiveDay(active ? null : i)}
                  onMouseEnter={() => setActiveDay(i)}
                  className="relative z-10 flex-1 h-full flex flex-col items-center justify-end min-w-0"
                  aria-label={`${days[i]} — sales ${formatINR(v, 0)}, expenses ${formatINR(e, 0)}`}
                >
                  {active && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 card px-2.5 py-1.5 shadow-float whitespace-nowrap">
                      <p className="text-[10px] font-bold text-fg">{days[i]} · Sales {formatINR(v, 0)}</p>
                      <p className="text-[9px] text-fg-muted">Expenses {formatINR(e, 0)}</p>
                    </div>
                  )}
                  <div className="w-full flex items-end justify-center gap-[3px] flex-1 min-h-0">
                    <div className="w-[40%] rounded-t-[5px]" style={{ height: `${hs}%`, background: isToday ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.55)' }} />
                    <div className="w-[40%] rounded-t-[5px]" style={{ height: `${he}%`, background: 'rgb(var(--fg) / 0.18)' }} />
                  </div>
                  <span className={`text-[9px] mt-1 ${isToday ? 'text-fg font-bold' : 'text-fg-subtle'}`}>{days[i]}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <h2 className="text-sm font-bold text-fg mb-3">Today's priorities</h2>
          <div className="space-y-2">
            {topPriority ? (
              <button onClick={() => navigate('/app/invoices')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-negative/5 border border-negative/20 hover:border-negative/40 transition-colors text-left">
                <AlertTriangle className="w-4 h-4 text-negative flex-shrink-0" />
                <span className="min-w-0"><span className="block text-sm font-bold text-fg truncate">Collect {formatINR(overdueSum, 0)}</span><span className="block text-[11px] text-fg-subtle">{overdueCount} overdue invoice{overdueCount > 1 ? 's' : ''}</span></span>
              </button>
            ) : null}
            <button onClick={() => navigate('/app/auto-reorder')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-2/60 hover:bg-surface-2 transition-colors text-left">
              <Package className="w-4 h-4 text-secondary-strong flex-shrink-0" />
              <span className="min-w-0"><span className="block text-sm font-bold text-fg truncate">{stats[2]?.count ? 'Reorder ' + stats[2].count + ' item' + (stats[2].count > 1 ? 's' : '') : 'Stock is healthy'}</span><span className="block text-[11px] text-fg-subtle">Meraj sizes the draft PO</span></span>
            </button>
            <button onClick={() => navigate('/app/manifest')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-2/60 hover:bg-surface-2 transition-colors text-left">
              <Sparkles className="w-4 h-4 text-secondary-strong flex-shrink-0" />
              <span className="min-w-0"><span className="block text-sm font-bold text-fg truncate">Meraj's full plan</span><span className="block text-[11px] text-fg-subtle">Approvals · collections · reorders</span></span>
            </button>
          </div>
          <div className="border-t border-line mt-4 pt-3 grid grid-cols-2 gap-y-2">
            {[['/app/cash-flow', 'Cash flow'], ['/app/reminders', 'Reminders'], ['/app/pricing', 'Pricing'], ['/app/goals', 'Goals & streak']].map(([to, label]) => (
              <Link key={to} to={to} className="text-[11px] font-semibold text-secondary-strong hover:underline">{label}</Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
