import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { MerajAvatar } from '../components/MerajAvatar'
import { formatINR } from '../lib/format'
import { askAssistant } from '../lib/ai'
import {
  TrendingUp, Wallet, Package, MessageCircle, FileSignature, Users,
  ArrowRight, AlertTriangle, Send, Mic, ChevronDown, BellRing, Check,
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

  // Dynamic AI greeting — refreshed every 1 hour, cached in localStorage
  useEffect(() => {
    if (!profile) return
    try {
      const cached = JSON.parse(localStorage.getItem('cashiea_greeting') || '{}')
      if (cached.ts && Date.now() - cached.ts < 3600000 && cached.text) { setAiGreeting(cached.text); return }
    } catch {}
    const fn = (profile?.full_name || 'there').split(' ')[0]
    askAssistant(`Generate a warm, brief (1 sentence) greeting for ${fn}, a shop owner in India. Rules: do NOT say "Good morning/afternoon/evening". Be creative and personal — reference the time of day freshly, the business, or a quick observation. Vary it each time. Keep it casual Hinglish or English. One sentence, no emojis, no markdown.`, false, undefined, 'ask')
      .then((res) => { if (res.reply) { const t = res.reply.replace(/[*#`]/g, '').trim(); setAiGreeting(t); try { localStorage.setItem('cashiea_greeting', JSON.stringify({ text: t, ts: Date.now() })) } catch {} } })
      .catch(() => {})
  }, [profile])

  useEffect(() => {
    if (!profile) return
    const now = new Date()
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const startYesterday = new Date(now.getTime() - DAY).toISOString()
    const startMon = startOfWeek(now).toISOString()
    const dayAgo = new Date(now.getTime() - DAY).toISOString()

    ;(async () => {
      const [txToday, txYesterday, txWeek, invUnpaid, invOverdue, prod, msg, quotes, staff, expWeek] = await Promise.all([
        supabase.from('transactions').select('total').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', startToday),
        supabase.from('transactions').select('total').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', startYesterday).lt('created_at', startToday),
        supabase.from('transactions').select('total,created_at').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', startMon),
        supabase.from('invoices').select('total,status').eq('user_id', ownerId).in('status', ['sent', 'viewed', 'partial', 'overdue']),
        supabase.from('invoices').select('id,invoice_number,client_name,total,due_date').eq('user_id', ownerId).eq('status', 'overdue').order('total', { ascending: false }),
        supabase.from('products').select('stock_quantity,low_stock_threshold').eq('user_id', ownerId),
        supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('direction', 'inbound').gte('created_at', dayAgo),
        supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'sent'),
        supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'active'),
        supabase.from('expenses').select('amount,date').eq('user_id', ownerId).eq('type', 'expense').gte('date', startMon),
      ])

      const sum = (rows: any[] | null) => (rows || []).reduce((s, r) => s + Number(r.total || r.amount || 0), 0)
      const salesToday = sum(txToday.data as any[])
      const salesYesterday = sum(txYesterday.data as any[])
      const unpaid = (invUnpaid.data || []) as any[]
      const pendingCount = unpaid.length
      const pendingSum = unpaid.reduce((s, r) => s + Number(r.total || 0), 0)
      const lowStock = (prod.data || []).filter((p: any) => Number(p.stock_quantity) <= Number(p.low_stock_threshold)).length
      const messages = msg.count || 0
      const orders = quotes.count || 0
      const staffN = staff.count || 0
      const expensesWeek = sum(expWeek.data as any[])

      // overdue
      const overdue = (invOverdue.data || []) as OverdueInv[]
      setOverdueCount(overdue.length)
      setOverdueSum(overdue.reduce((s, r) => s + Number(r.total || 0), 0))
      setTopPriority(overdue[0] || null)

      // weekly buckets (Mon–Sun)
      const buckets = [0, 0, 0, 0, 0, 0, 0]
      ;(txWeek.data || []).forEach((t: any) => {
        const idx = (new Date(t.created_at).getDay() + 6) % 7
        buckets[idx] += Number(t.total || 0)
      })
      setDaily(buckets)
      setWeekSales(buckets.reduce((s, v) => s + v, 0))

      // weekly expense buckets (Mon-Sun) for the Sales-vs-Expenses chart
      const expBuckets = [0, 0, 0, 0, 0, 0, 0]
      ;(expWeek.data || []).forEach((e: any) => {
        if (!e.date) return
        const idx = (new Date(e.date).getDay() + 6) % 7
        expBuckets[idx] += Number(e.amount || 0)
      })
      setDailyExp(expBuckets)
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

      setLoading(false)
    })()
  }, [profile])

  const firstName = (profile?.full_name || 'there').split(' ')[0]

  const goAsk = (q?: string) => {
    const text = (q ?? ask).trim()
    navigate(text ? `/app/assistant?q=${encodeURIComponent(text)}` : '/app/assistant')
  }

  const topAmount = topPriority ? Number(topPriority.total) : overdueSum
  const suggestions = [
    'Why did sales drop today?',
    topPriority ? `Should I follow up with ${formatINR(topAmount, 0)} invoice?` : 'Which customers may delay payments?',
    'Which customers may delay payments?',
    'What should I reorder this week?',
  ]

  const sevDot = { critical: 'bg-negative', warning: 'bg-warning', healthy: 'bg-positive' } as const
  const footerCls = { warning: 'text-warning', negative: 'text-negative', positive: 'text-positive', muted: 'text-fg-subtle' } as const
  const deltaCls = { good: 'text-positive', bad: 'text-negative', neutral: 'text-fg-subtle' } as const

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const maxDay = Math.max(1, ...daily, ...dailyExp)
  const todayIdx = (new Date().getDay() + 6) % 7
  const weekProfit = weekSales - weekExpenses

  return (
    <div className="animate-fade-in space-y-5">
      {/* GREETING — bare page text, no card */}
      <div>
        <h1 className="text-2xl font-semibold text-fg leading-tight">{aiGreeting || `Welcome back, ${firstName}.`}</h1>
        <p className="text-sm text-fg-muted mt-1">Here's what's happening in your business today.</p>
      </div>

      {/* TOP PRIORITY — overdue hero */}
      {topPriority && (
        <section className="card p-4 sm:p-5 border-negative/30">
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

      {/* MERAJ INSIGHTS */}
      {insights.length > 0 && (
        <section className="card p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-3">
            <MerajAvatar state="idle" context="icon" size="sm" className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-fg">Meraj noticed {insights.length} things</p>
              <p className="text-[11px] text-fg-subtle">A quick look at your business</p>
            </div>
          </div>
          <div className="space-y-2.5">
            {insights.map((it, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sevDot[it.severity]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg leading-snug truncate">{it.title}</p>
                  <p className="text-xs text-fg-subtle leading-snug">{it.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ASK MERAJ bar */}
      <section>
        <form onSubmit={(e) => { e.preventDefault(); goAsk() }} className="flex items-center gap-2 rounded-control border border-line bg-surface px-2 focus-within:border-accent/50 transition-colors">
          <span className="pl-1.5"><MerajAvatar state="idle" context="icon" size="xs" /></span>
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="Ask Meraj anything…"
            className="flex-1 bg-transparent py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none min-w-0"
          />
          <button type="button" onClick={() => navigate('/app/assistant')} aria-label="Voice" className="w-8 h-8 rounded-control text-fg-muted hover:text-fg hover:bg-surface-2 flex items-center justify-center flex-shrink-0"><Mic className="w-4 h-4" /></button>
          <button type="submit" aria-label="Send" className="w-8 h-8 rounded-control bg-fg text-paper flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity"><Send className="w-4 h-4" /></button>
        </form>
        {/* Suggestion pills — horizontal, wraps */}
        <div className="flex flex-wrap gap-2 mt-2.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => goAsk(s)} className="text-xs font-medium text-fg-muted bg-surface-2 border border-line rounded-full px-3 py-1.5 hover:text-fg hover:border-accent/40 transition-colors">{s}</button>
          ))}
          <button onClick={() => navigate('/app/assistant')} className="text-xs font-medium text-accent bg-surface-2 border border-line rounded-full px-3 py-1.5 hover:border-accent/40 transition-colors inline-flex items-center gap-1">More <ChevronDown className="w-3 h-3" /></button>
        </div>
      </section>

      {/* STATS grid — dense, enriched */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                <p className={`text-xl sm:text-2xl font-bold tabular-nums mt-1.5 leading-tight break-words ${m.count === 0 ? 'text-fg-subtle' : 'text-fg'}`}>{m.value}</p>
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
          <div className="grid grid-cols-3 gap-3 mb-4">
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
