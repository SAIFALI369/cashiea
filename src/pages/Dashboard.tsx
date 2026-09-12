import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import MerajSection from '../components/MerajSection'
import { FitAmount } from '../components/FitAmount'
import { formatINR } from '../lib/format'
import { salesSignal } from '../lib/salesSignal'
import {
  TrendingUp, Wallet, Package, MessageCircle, FileSignature, Users,
  AlertTriangle, ShoppingCart, Receipt, BarChart3, ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Today's Workspace ────────────────────────────────────────────
// Greeting → Hero revenue metric → Meraj (proactive AI) → Quick actions →
// ONE consolidated Business Pulse → Recent activity.
//
// The old layout repeated the same numbers three times ("Today's sales",
// "Low stock" and "This week" each appeared in a KPI tile, in Meraj's pulse
// strip AND in the weekly panel). Everything analytical now lives in a
// single Business Pulse card, so each fact is stated exactly once.

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
interface RecentSale { id: string; total: number; created_at: string; label: string }

/** Quick actions — one tap to the four things an owner does all day. */
const QUICK_ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/app/pos', label: 'New Sale', icon: ShoppingCart },
  { to: '/app/accounts', label: 'Add Expense', icon: Receipt },
  { to: '/app/products', label: 'Check Stock', icon: Package },
  { to: '/app/reports', label: 'View Reports', icon: BarChart3 },
]

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
  // Gates the numbers handed to Meraj: while the stats RPC is in flight the
  // week's figures are still 0, and Meraj must not narrate a zero the rest of
  // the page doesn't agree with.
  const [statsLoaded, setStatsLoaded] = useState(false)
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
  const [salesToday, setSalesToday] = useState(0)
  const [salesYesterday, setSalesYesterday] = useState(0)
  const [greetingLine, setGreetingLine] = useState('')
  const [greetingSub, setGreetingSub] = useState("What's moving today?")
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const [recent, setRecent] = useState<RecentSale[]>([])

  // Static rotating greeting — zero AI credits, zero network, instant load.
  // AI credits are saved for actual business questions.
  //
  // Two lines: a soft, personal time-of-day greeting (secondary gray) and a
  // bold, punchy question underneath (primary) that sets the day's intent.
  useEffect(() => {
    if (!profile) return
    const fn = (profile?.full_name || 'there').split(' ')[0]
    const hour = new Date().getHours()
    const partOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
    setGreetingLine(`Good ${partOfDay}, ${fn}`)
    const subs = {
      morning: ["What's moving today?", 'Ready to win today?', 'Fresh day, fresh sales.'],
      afternoon: ["What's moving today?", 'Halfway there — keep going.', 'Sales check karein?'],
      evening: ["How did today go?", "Let's check today's numbers.", 'Final push?'],
    }[partOfDay]
    setGreetingSub(subs[Math.floor(Math.random() * subs.length)])
  }, [profile])

  // ── Recent activity ──
  // The dashboard felt dead on a quiet morning. The last few sales make it
  // feel alive; when there are none we show a friendly nudge instead.
  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id,total,created_at,items')
        .eq('user_id', ownerId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(3)
      if (cancelled) return
      setRecent(((data as any[]) || []).map((t) => ({
        id: String(t.id),
        total: Number(t.total || 0),
        created_at: String(t.created_at),
        label: ((t.items || []) as any[]).map((i) => i?.name).filter(Boolean).join(', ') || 'Sale',
      })))
    })()
    return () => { cancelled = true }
  }, [ownerId])

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
      setSalesToday(salesToday)
      setSalesYesterday(salesYesterday)

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

      setStatsLoaded(true)
    })()
  }, [profile])

  // ── HERO COUNTER — "Meraj recovered ₹X this month" (corner chip, free tier).
  //    Sum of Meraj's collection activity (ar_escalation money) this month;
  //    hidden entirely when there's nothing to show — never disturbs the hero. ──
  const [recovered, setRecovered] = useState(0)
  useEffect(() => {
    if (!profile?.id) return
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    ;(async () => {
      try {
        const { data } = await supabase.from('automation_events').select('money_impact')
          .eq('user_id', profile.id).eq('type', 'ar_escalation')
          .gte('created_at', monthStart.toISOString()).limit(300)
        setRecovered((data || []).reduce((s: number, e: any) => s + Number(e.money_impact || 0), 0))
      } catch { /* chip stays hidden */ }
    })()
  }, [profile?.id])

  const firstName = (profile?.full_name || 'there').split(' ')[0]

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const maxDay = Math.max(1, ...daily, ...dailyExp)
  const todayIdx = (new Date().getDay() + 6) % 7
  // Honest weekly net: sales + other income − expenses. ₹0 on a quiet week is neutral, not a profit.
  const weekProfit = weekSales + weekIncome - weekExpenses

  // Day-over-day movement for the hero. Delegated to the shared signal helper
  // so the dashboard keeps the app's rule: an empty morning is NEUTRAL, not a
  // "-100%" red alarm, and a first sale with no baseline is good news without
  // a meaningless percentage.
  const signal = salesSignal(salesToday, salesYesterday)
  const lowStockCount = stats[2]?.count || 0
  const pendingSumLabel = stats[1]?.count ? stats[1].value : '₹0'

  return (
    <div className="animate-fade-in space-y-6">
      {/* ── GREETING ── soft personal line, bold intent underneath */}
      <div className="animate-rise-in">
        <p className="text-base text-fg-subtle">{greetingLine || 'Welcome back'}</p>
        <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">{greetingSub}</h1>
      </div>

      {/* ── 1 · HERO METRIC ── the undisputed star of the page */}
      <button
        onClick={() => navigate('/app/reports')}
        aria-label="Today's revenue — open the daily breakdown"
        className="card relative w-full text-left p-5 sm:p-6 animate-rise-in"
        style={{ animationDelay: '60ms' }}
      >
        {/* Meraj's collection win this month — kept from main. Hidden when
            there is nothing recovered, so it never disturbs the hero. */}
        {recovered > 0 && (
          <div className="absolute right-3 top-3 rounded-full bg-positive/10 px-3 py-1.5 text-[10px] sm:text-[11px] font-bold text-positive">
            Meraj recovered {formatINR(recovered, 0)} this month
          </div>
        )}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-fg-subtle">Today's Revenue</p>
            <FitAmount
              value={stats[0]?.value || '₹0'}
              base="text-[2rem] sm:text-4xl"
              minTier="text-2xl"
              className="font-extrabold text-fg tracking-tight leading-none mt-1.5 block"
            />
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-medium text-fg-muted whitespace-nowrap">
              Yesterday {formatINR(salesYesterday, 0)}
            </span>
            {signal.delta != null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${signal.tone === 'bad' ? 'text-negative' : 'text-positive'}`}>
                {signal.delta >= 0
                  ? <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                  : <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={2.5} />}
                {Math.abs(signal.delta)}%
              </span>
            )}
            {signal.delta == null && signal.tone === 'good' && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-positive">
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />First sales in
              </span>
            )}
          </div>
        </div>
        <div className="hidden sm:block mt-5">
          <Sparkline values={daily} height={48} />
          <p className="text-xs text-fg-subtle mt-1.5">Last 7 days</p>
        </div>
        {topPriority && (
          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-negative">
            <AlertTriangle className="w-4 h-4" />
            {formatINR(overdueSum, 0)} overdue across {overdueCount} invoice{overdueCount > 1 ? 's' : ''} — collect now
          </span>
        )}
      </button>

      {/* ── 2 · QUICK ACTIONS ── a clean scrollable row, right under the hero */}
      <div
        className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 animate-rise-in"
        style={{ animationDelay: '100ms' }}
      >
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="tap flex flex-col items-center gap-2 shrink-0 w-[76px]"
          >
            <span className="w-14 h-14 rounded-2xl bg-surface shadow-card flex items-center justify-center text-fg">
              <a.icon className="w-[22px] h-[22px]" strokeWidth={1.9} />
            </span>
            <span className="text-[11px] font-medium text-fg-muted text-center leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* ── 3 · MERAJ ── the proactive AI assistant (brand theme, always here).
          weekProfit is passed only once the stats RPC has resolved, so Meraj
          never quotes a figure that disagrees with the Business Pulse card. */}
      <MerajSection weekProfit={statsLoaded ? weekProfit : undefined} />

      {/* ── 4 · BUSINESS PULSE ── every analytic in ONE card, stated once */}
      <section className="card p-5 sm:p-6 animate-rise-in" style={{ animationDelay: '160ms' }}>
        <h2 className="text-base font-bold text-fg">Business Pulse</h2>

        {/* Row 1 — the two numbers that decide the week */}
        <div className="flex flex-wrap gap-x-10 gap-y-4 mt-4">
          <Link to="/app/profit-dashboard" className="min-w-0">
            <p className="text-sm text-fg-subtle">This Week's Profit</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 leading-none ${weekProfit > 0 ? 'text-positive' : weekProfit < 0 ? 'text-negative' : 'text-fg'}`}>
              {formatINR(weekProfit, 0)}
            </p>
          </Link>
          <Link to="/app/invoices" className="min-w-0">
            <p className="text-sm text-fg-subtle">Pending Dues</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 leading-none flex items-center gap-2 ${stats[1]?.count ? 'text-warning' : 'text-fg'}`}>
              {pendingSumLabel}
              <span
                className={`w-2 h-2 rounded-full ${stats[1]?.count ? 'bg-warning' : 'bg-positive'}`}
                aria-hidden="true"
              />
            </p>
          </Link>
        </div>

        {/* Row 2 — Sales vs Expenses, tap a bar for the exact numbers */}
        <div className="mt-6">
          <div className="flex items-center gap-4 mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-accent" /> Sales
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: 'rgb(var(--fg) / 0.18)' }} /> Expenses
            </span>
            <span className="text-xs text-fg-subtle ml-auto hidden sm:block">Tap a day for details</span>
          </div>

          <div className="relative flex items-end justify-between gap-1.5 h-28" onMouseLeave={() => setActiveDay(null)}>
            {[25, 50, 75].map((p) => (
              <div key={p} className="absolute inset-x-0 border-t border-dashed border-line pointer-events-none" style={{ bottom: `${p}%` }} />
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
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 rounded-xl bg-fg px-3 py-2 shadow-float whitespace-nowrap">
                      <p className="text-[11px] font-semibold text-paper">Sales {formatINR(v, 0)}</p>
                      <p className="text-[10px] text-paper/70">Expenses {formatINR(e, 0)}</p>
                    </div>
                  )}
                  <div className="w-full flex items-end justify-center gap-[3px] flex-1 min-h-0">
                    <div className="w-[40%] rounded-t-[5px] transition-all" style={{ height: `${hs}%`, background: isToday ? 'rgb(var(--accent))' : 'rgb(var(--accent) / 0.5)' }} />
                    <div className="w-[40%] rounded-t-[5px] transition-all" style={{ height: `${he}%`, background: 'rgb(var(--fg) / 0.18)' }} />
                  </div>
                  <span className={`text-[10px] mt-1.5 ${isToday ? 'text-fg font-semibold' : 'text-fg-subtle'}`}>{days[i]}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Row 3 — alerts */}
        <Link
          to="/app/products"
          className="flex items-center gap-2.5 mt-5 pt-5 border-t border-line text-sm"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${lowStockCount ? 'bg-warning' : 'bg-positive'}`} aria-hidden="true" />
          <span className="text-fg-muted">Low Stock:</span>
          <span className={`font-semibold ${lowStockCount ? 'text-warning' : 'text-fg'}`}>
            {lowStockCount ? `${lowStockCount} item${lowStockCount > 1 ? 's' : ''} need attention` : 'All good'}
          </span>
        </Link>
      </section>

      {/* ── 5 · RECENT ACTIVITY ── keeps the page alive on a quiet day */}
      <section className="card p-5 sm:p-6 animate-rise-in" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-fg">Recent Activity</h2>
          {recent.length > 0 && (
            <Link to="/app/reports" className="text-sm font-medium text-secondary-strong">View all</Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm text-fg-subtle">No sales yet today.</p>
            <Link to="/app/pos" className="btn-primary text-sm mt-4">
              <ShoppingCart className="w-4 h-4" /> New Sale
            </Link>
          </div>
        ) : (
          <div className="mt-2 divide-y divide-line">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">{r.label}</p>
                  <p className="text-xs text-fg-subtle mt-0.5">
                    {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
                <p className="text-sm font-semibold text-fg tabular-nums shrink-0">{formatINR(r.total, 0)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quiet footer links — everything else is one tap away, no cards needed */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 pb-2">
        {[
          ['/app/cash-flow', 'Cash flow'],
          ['/app/reminders', 'Reminders'],
          ['/app/pricing', 'Pricing'],
          ['/app/goals', 'Goals & streak'],
          ['/app/auto-reorder', 'Auto-reorder'],
          ['/app/manifest', "Meraj's plan"],
        ].map(([to, label]) => (
          <Link key={to} to={to} className="text-sm text-fg-subtle hover:text-fg transition-colors">{label}</Link>
        ))}
      </div>
    </div>
  )
}
