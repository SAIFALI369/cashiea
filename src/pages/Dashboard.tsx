import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import MerajSection from '../components/MerajSection'
import { useBusinessMood } from '../lib/businessMood'
import { FitAmount } from '../components/FitAmount'
import { motion } from '../components/motion'
import { formatINR } from '../lib/format'
import { dashboardSuggestions } from '../lib/ai'
import {
  TrendingUp, Wallet, Package, MessageCircle, FileSignature, Users,
  ArrowRight, AlertTriangle, ChevronDown, BellRing, Check, X, Sparkles,
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

const DAY = 86400000
const startOfWeek = (d = new Date()) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const wd = (r.getDay() + 6) % 7 // Mon=0 … Sun=6
  r.setDate(r.getDate() - wd)
  return r
}

export default function Dashboard() {
  const { profile, ownerId } = useAuth()
  const navigate = useNavigate()
  // Real signal-driven mood (sales trend vs 14-day average, overdue, low stock).
  const merajMood = useBusinessMood() ?? 'neutral'
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stat[]>([])
  const [topPriority, setTopPriority] = useState<OverdueInv | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [overdueSum, setOverdueSum] = useState(0)
  const [insights, setInsights] = useState<Insight[]>([])
  const [daily, setDaily] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [dailyExp, setDailyExp] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [weekSales, setWeekSales] = useState(0)
  const [weekExpenses, setWeekExpenses] = useState(0)
  const [ask, setAsk] = useState('')
  const [aiGreeting, setAiGreeting] = useState('')
  const [activeDay, setActiveDay] = useState<number | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  // Quick bar (suggestion pills) — swipe it away or tap X; it stays away
  // until brought back. One preference per device.
  const [showQuickBar, setShowQuickBar] = useState(() => {
    try { return localStorage.getItem('cashiea_quickbar_hidden') !== '1' } catch { return true }
  })
  const hideQuickBar = () => {
    setShowQuickBar(false)
    try { localStorage.setItem('cashiea_quickbar_hidden', '1') } catch { /* ignore */ }
  }
  const restoreQuickBar = () => {
    setShowQuickBar(true)
    try { localStorage.removeItem('cashiea_quickbar_hidden') } catch { /* ignore */ }
  }

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
      setDailyExp([0, 0, 0, 0, 0, 0, 0]) // expenses per-day not in RPC; total is used for the chart
      setWeekExpenses(expensesWeek)

      // stats (enriched, dense)
      const salesDelta = salesYesterday > 0 ? Math.round(((salesToday - salesYesterday) / salesYesterday) * 100) : null
      setStats([
        {
          label: 'Sales today', value: formatINR(salesToday, 0), count: salesToday, icon: TrendingUp,
          delta: salesDelta !== null ? `${salesDelta >= 0 ? '+' : ''}${salesDelta}% vs yesterday` : undefined,
          deltaTone: salesDelta === null ? 'neutral' : salesDelta >= 0 ? 'good' : 'bad',
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
      if (salesYesterday > 0 && salesToday < salesYesterday) {
        const pct = Math.round(((salesYesterday - salesToday) / salesYesterday) * 100)
        ins.push({ severity: 'warning', title: 'Aaj sales thodi kam hain', subtitle: `Kal ke mukable ${pct}% kam abhi tak` })
      } else if (salesToday > 0) {
        ins.push({ severity: 'healthy', title: 'Sales theek chal rahi hai', subtitle: `Aaj ${formatINR(salesToday, 0)} tak abhi` })
      }
      if (lowStock > 0) ins.push({ severity: 'warning', title: `${lowStock} item low stock par`, subtitle: 'Time rahe toh reorder kar lein' })
      else ins.push({ severity: 'healthy', title: 'Stock healthy hai', subtitle: 'Sab items available hain' })
      setInsights(ins.slice(0, 3))

      // ── AI suggestion pills (search bar) ─────────────────────────
      // INSTANT: smart fallback pills built from the LIVE numbers render
      // on the first paint (the owner never waits). The actual AI call
      // fires 8 SECONDS later — if the owner has already moved to POS or
      // Products by then, the call is skipped entirely (zero tokens
      // wasted on a page nobody is looking at). Cache: 12 hours.
      const suggKey = `cashiea_suggestions_${ownerId}`
      const suggState = {
        date: new Date().toISOString().split('T')[0],
        day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()],
        salesToday, salesYesterday, pendingCount, pendingSum,
        overdueCount: overdue.length, overdueSum,
        lowStock, unreadMessages: messages, pendingOrders: orders,
        weekSales: buckets.reduce((s: number, v: number) => s + v, 0), weekExpenses: expensesWeek,
        topOverdueClient: topPriority?.client_name || null,
      }
      // 1) INSTANT: live-number pills (replaces the old static fallbacks —
      //    these are genuinely smart, built from today's actual data)
      const smartInstant = [
        `Why ${salesToday < salesYesterday ? 'are sales down' : 'is business strong'} today?`,
        topPriority ? `How to collect ${formatINR(topAmount, 0)} from ${topPriority.client_name}?` : 'Which customers may delay payments?',
        lowStock > 0 ? `What to reorder (${lowStock} low-stock items)?` : 'Which products to promote this week?',
        'What should I do differently tomorrow?',
      ]
      setAiSuggestions(smartInstant)

      // 2) DELAYED: AI-generated pills (8s — only if the owner is still
      //    on the Dashboard), cached 12 hours
      try {
        const cached = JSON.parse(localStorage.getItem(suggKey) || 'null')
        if (cached?.ts && Date.now() - cached.ts < 12 * 60 * 60 * 1000 && Array.isArray(cached.pills) && cached.pills.length >= 3) {
          setAiSuggestions(cached.pills)
        } else {
          setTimeout(() => {
            // Still on the Dashboard? Then the AI call is worth it.
            if (document.visibilityState === 'visible' && window.location.pathname === '/app') {
              dashboardSuggestions(suggState)
                .then((p) => {
                  if (p.length) {
                    setAiSuggestions(p)
                    try { localStorage.setItem(suggKey, JSON.stringify({ pills: p, ts: Date.now() })) } catch { /* ignore */ }
                  }
                })
                .catch(() => { /* instant pills remain */ })
            }
          }, 8000)
        }
      } catch { /* ignore */ }

      setLoading(false)
    })()
  }, [profile])

  const firstName = (profile?.full_name || 'there').split(' ')[0]

  const goAsk = (q?: string) => {
    const text = (q ?? ask).trim()
    navigate(text ? `/app/assistant?q=${encodeURIComponent(text)}` : '/app/assistant')
  }

  const topAmount = topPriority ? Number(topPriority.total) : overdueSum
  // Safety net if aiSuggestions is somehow empty (AI failed + instant pills
  // were cleared) — still contextual, built from the live numbers.
  const fallbackSuggestions = [
    'How were sales today?',
    topPriority ? `How do I collect ${formatINR(topAmount, 0)} overdue?` : 'Which customers may delay payments?',
    'What should I reorder this week?',
    'How do I grow sales this week?',
  ]
  const suggestions = aiSuggestions.length ? aiSuggestions : fallbackSuggestions

  const sevDot = { critical: 'bg-negative', warning: 'bg-warning', healthy: 'bg-positive' } as const
  const footerCls = { warning: 'text-warning', negative: 'text-negative', positive: 'text-positive', muted: 'text-fg-subtle' } as const
  const deltaCls = { good: 'text-positive', bad: 'text-negative', neutral: 'text-fg-subtle' } as const

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const maxDay = Math.max(1, ...daily, ...dailyExp)
  const todayIdx = (new Date().getDay() + 6) % 7
  const weekProfit = weekSales - weekExpenses

  return (
    <div className="animate-fade-in space-y-6 lg:space-y-8">
      {/* GREETING — bare page text, no card */}
      <div>
        <h1 className="text-2xl font-semibold text-fg leading-tight">{aiGreeting || `Welcome back, ${firstName}.`}</h1>
        <p className="text-sm text-fg-muted mt-1">Here's what's happening in your business today.</p>
      </div>

      {/* TOP PRIORITY — overdue hero */}
      {topPriority && (
        <section className="card p-5 sm:p-6 border-negative/30">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="w-9 h-9 rounded-control bg-negative/10 text-negative flex items-center justify-center flex-shrink-0"><AlertTriangle className="w-5 h-5" /></span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-negative">Top priority</p>
                <p className="text-base font-bold text-fg leading-tight mt-0.5">{formatINR(topPriority.total, 0)} is overdue</p>
                <p className="text-xs text-fg-muted mt-0.5">
                  {overdueCount > 1 ? `${overdueCount} invoices` : `${topPriority.invoice_number} · ${topPriority.client_name || 'Customer'}`}
                  {topPriority.due_date ? ` · ${Math.max(0, Math.floor((Date.now() - new Date(topPriority.due_date).getTime()) / DAY))} days overdue` : ''}
                </p>
                {topPriority.client_name && overdueCount > 1 && <p className="text-xs text-fg-muted">Largest: {topPriority.client_name}</p>}
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => navigate('/app/invoices')} className="inline-flex items-center gap-1.5 bg-fg text-paper text-xs font-semibold rounded-control px-3 h-8 hover:opacity-90 transition-opacity">Collect payment</button>
                  <Link to="/app/invoices" className="inline-flex items-center gap-1.5 border border-line text-fg text-xs font-semibold rounded-control px-3 h-8 hover:bg-surface-2 transition-colors">View invoice</Link>
                </div>
              </div>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1 sm:text-right sm:border-l sm:border-line sm:pl-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Overdue amount</p>
              <p className="text-2xl font-bold text-negative tabular-nums">{formatINR(overdueSum, 0)}</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-negative/10 text-negative">{overdueCount} invoice{overdueCount > 1 ? 's' : ''}</span>
            </div>
          </div>
        </section>
      )}

      {/* MERAJ SECTION — large rectangular reserved space for Meraj.
          He's always present here, playing/reacting, with a 💭 thought bubble
          that cycles a friend-phrase every hour, and a creative business
          pulse strip showing profit/stocks/sales/problems/growth. */}
      <MerajSection />

      {/* STATS grid — 3 per row (3/3) on tablet+ to feel purpose-built for desktop.
          Kept at 2 per row only on the smallest phones where 3 would crowd. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        {stats.map((m) => {
          const good = m.count === 0 && !!m.positive
          return (
            <Link key={m.label} to={m.to} className={`card p-4 flex flex-col cursor-pointer transition-colors group ${m.tone && m.count > 0 ? 'border-warning/40 bg-warning/5' : 'hover:border-accent/40'}`}>
              <div className="flex items-center gap-1.5">
                <m.icon className="w-[18px] h-[18px] text-fg-subtle" strokeWidth={1.75} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle truncate">{m.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-fg-subtle ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </div>
              {good ? (
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-5 h-5 rounded-full bg-positive/10 text-positive flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3" strokeWidth={2.5} /></span>
                  <p className="text-base font-bold text-positive leading-tight">{m.positive!.label}</p>
                </div>
              ) : (
                <div className="mt-1.5 leading-tight"><FitAmount value={m.value} base="text-2xl" minTier="text-sm" className={`font-bold ${m.count === 0 ? 'text-fg-subtle' : 'text-fg'}`} /></div>
              )}
              {m.delta && !good && <p className={`text-[11px] font-medium mt-0.5 ${deltaCls[m.deltaTone || 'neutral']}`}>{m.delta}</p>}
              {m.action && m.count > 0 ? (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/app/assistant?q=${encodeURIComponent(m.action!.query)}`) }}
                  className="mt-2.5 mb-0.5 inline-flex items-center justify-center gap-1.5 bg-fg text-paper text-xs font-semibold rounded-control h-8 w-full hover:opacity-90 transition-opacity"
                >
                  <BellRing className="w-3.5 h-3.5" /> {m.action.label}
                </button>
              ) : (
                <p className={`text-[11px] mt-auto pt-2 ${footerCls[m.footerTone]}`}>{m.footer}</p>
              )}
            </Link>
          )
        })}
      </div>

      {/* BUSINESS AT A GLANCE */}
      <section onClick={() => navigate('/app/reports')} className="card p-4 sm:p-5 cursor-pointer hover:border-accent/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-fg">Business at a glance</h2>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted border border-line rounded-control px-2 py-1">This week <ChevronDown className="w-3 h-3" /></span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Sales</p><p className="text-xl font-bold text-accent tabular-nums">{formatINR(weekSales, 0)}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Expenses</p><p className="text-xl font-bold text-fg-muted tabular-nums">{formatINR(weekExpenses, 0)}</p></div>
            <div><p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">Profit</p><p className={`text-xl font-bold tabular-nums ${weekProfit >= 0 ? 'text-positive' : 'text-negative'}`}>{formatINR(weekProfit, 0)}</p></div>
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
    </div>
  )
}
