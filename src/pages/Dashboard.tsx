import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { MerajAvatar } from '../components/MerajAvatar'
import { MerajMark } from '../components/MerajMark'
import { formatINR } from '../lib/format'
import type { Prediction } from '../lib/types'
import {
  TrendingUp, Wallet, Package, MessageCircle, FileSignature, Users,
  ArrowRight, Circle, Send,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Today's Workspace ────────────────────────────────────────────
// Opens with a professional "staff briefing + command bar" from Meraj
// (not a fluffy AI bubble), then a dense health strip and resolvable
// focus items. The dashboard is the conversion surface — keep it crisp.

interface Metric { label: string; value: string; count: number; alert?: boolean; icon: LucideIcon }
interface FocusItem { title: string; body: string; action: string; to: string }

export default function Dashboard() {
  const { profile, ownerId } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [focus, setFocus] = useState<FocusItem[]>([])
  const [suggestions, setSuggestions] = useState<Prediction[]>([])
  const [briefing, setBriefing] = useState('Pulling together today’s numbers.')
  const [ask, setAsk] = useState('')

  useEffect(() => {
    if (!profile) return
    const today = new Date()
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
    const dayAgo = new Date(Date.now() - 86400000).toISOString()

    ;(async () => {
      const [tx, inv, prod, msg, quotes, staff, preds] = await Promise.all([
        supabase.from('transactions').select('total').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', startToday),
        supabase.from('invoices').select('total,status').eq('user_id', ownerId).in('status', ['sent', 'viewed', 'partial', 'overdue']),
        supabase.from('products').select('stock_quantity,low_stock_threshold').eq('user_id', ownerId),
        supabase.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('direction', 'inbound').gte('created_at', dayAgo),
        supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'sent'),
        supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'active'),
        supabase.from('ai_predictions').select('*').eq('user_id', ownerId).eq('status', 'pending').order('created_at', { ascending: false }).limit(6),
      ])

      const salesToday = (tx.data || []).reduce((s, r: any) => s + Number(r.total || 0), 0)
      const unpaid = (inv.data || []) as any[]
      const pendingCount = unpaid.length
      const pendingSum = unpaid.reduce((s, r) => s + Number(r.total || 0), 0)
      const lowStock = (prod.data || []).filter((p: any) => Number(p.stock_quantity) <= Number(p.low_stock_threshold)).length
      const messages = msg.count || 0
      const orders = quotes.count || 0
      const staffN = staff.count || 0

      setMetrics([
        { label: 'Sales today', value: formatINR(salesToday, 0), count: salesToday, icon: TrendingUp },
        { label: 'Pending payments', value: pendingCount ? `${pendingCount} · ${formatINR(pendingSum, 0)}` : '—', count: pendingCount, alert: true, icon: Wallet },
        { label: 'Low stock', value: `${lowStock}`, count: lowStock, alert: true, icon: Package },
        { label: 'Customer messages', value: `${messages}`, count: messages, icon: MessageCircle },
        { label: 'Orders waiting', value: `${orders}`, count: orders, icon: FileSignature },
        { label: 'Active staff', value: `${staffN}`, count: staffN, icon: Users },
      ])

      const f: FocusItem[] = []
      if (lowStock > 0) f.push({ title: `${lowStock} ${lowStock === 1 ? 'item is' : 'items are'} running low`, body: 'Restock to avoid stockouts.', action: 'Review stock', to: '/app/products' })
      if (pendingCount > 0) f.push({ title: `${pendingCount} ${pendingCount === 1 ? 'invoice is' : 'invoices are'} unpaid`, body: `${formatINR(pendingSum, 0)} outstanding.`, action: 'See invoices', to: '/app/invoices' })
      if (orders > 0) f.push({ title: `${orders} ${orders === 1 ? 'quote awaits' : 'quotes await'} a reply`, body: 'Customers are waiting on your response.', action: 'Follow up', to: '/app/quotations' })
      if (messages > 0) f.push({ title: `${messages} customer ${messages === 1 ? 'message' : 'messages'} since yesterday`, body: 'Reply to keep them engaged.', action: 'Open', to: '/app/notifications' })
      setFocus(f)

      // Professional one-line briefing (data-driven, no fluff)
      const parts: string[] = []
      if (salesToday > 0) parts.push(`${formatINR(salesToday, 0)} in sales today`)
      if (pendingCount > 0) parts.push(`${pendingCount} unpaid invoice${pendingCount > 1 ? 's' : ''} · ${formatINR(pendingSum, 0)} outstanding`)
      if (lowStock > 0) parts.push(`${lowStock} item${lowStock > 1 ? 's' : ''} low on stock`)
      if (messages > 0) parts.push(`${messages} new message${messages > 1 ? 's' : ''}`)
      setBriefing(parts.length ? parts.join(' · ') : 'Everything looks clear for today.')

      setSuggestions((preds.data as Prediction[]) || [])
      setLoading(false)
    })()
  }, [profile])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = (profile?.full_name || 'there').split(' ')[0]

  const goAsk = (q?: string) => {
    const text = (q ?? ask).trim()
    navigate(text ? `/app/assistant?q=${encodeURIComponent(text)}` : '/app/assistant')
  }

  const chips = ["Summarize today's sales", 'Who owes me money?', "What's low on stock?", 'Top customers this month']

  return (
    <div className="animate-fade-in space-y-7">
      {/* 1 ─ MERAJ STAFF BRIEFING + COMMAND BAR */}
      <section className="card p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <MerajAvatar state="idle" context="icon" size="md" className="flex-shrink-0" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-base font-bold text-fg leading-tight">{greeting}, {firstName}.</p>
            <p className="text-sm text-fg-muted mt-1 leading-snug">{briefing}</p>
          </div>
          <Link to="/app/assistant" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline flex-shrink-0 mt-1">
            Open Meraj <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Command-style assistant bar */}
        <form onSubmit={(e) => { e.preventDefault(); goAsk() }} className="mt-4 flex items-center gap-2 rounded-control border border-line bg-surface-2 focus-within:border-accent/50 transition-colors">
          <span className="pl-3.5 text-fg-subtle"><MerajMark size={16} /></span>
          <input
            value={ask}
            onChange={(e) => setAsk(e.target.value)}
            placeholder="Ask Meraj anything — sales, stock, customers…"
            className="flex-1 bg-transparent px-1.5 py-3 text-sm text-fg placeholder:text-fg-subtle outline-none"
          />
          <button type="submit" aria-label="Ask Meraj" className="m-1 w-9 h-9 rounded-control bg-accent text-accent-fg flex items-center justify-center flex-shrink-0 hover:bg-accent-strong transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {chips.map((c) => (
            <button key={c} onClick={() => goAsk(c)} className="text-xs font-medium text-fg-muted bg-surface-2 border border-line rounded-full px-3 py-1.5 hover:text-fg hover:border-accent/40 transition-colors">{c}</button>
          ))}
        </div>
      </section>

      {/* 2 ─ BUSINESS HEALTH STRIP (dense, zero-state recedes) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-px rounded-card overflow-hidden border border-line bg-line">
        {metrics.map((m) => {
          const muted = m.count === 0
          const tone = m.alert && !muted ? 'text-warning' : 'text-fg'
          return (
            <div key={m.label} className="bg-surface px-3 py-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <m.icon className="w-3.5 h-3.5 text-fg-subtle" strokeWidth={1.75} />
                <span className="text-[10px] font-semibold tracking-wide uppercase text-fg-subtle">{m.label}</span>
              </div>
              <span className={`text-lg font-bold tabular-nums ${muted ? 'text-fg-subtle' : tone}`}>{m.value}</span>
            </div>
          )
        })}
      </div>

      {/* 3 ─ TODAY'S FOCUS (resolvable task cards) */}
      <section>
        <h2 className="text-xs font-bold tracking-[0.1em] uppercase text-fg-subtle mb-3">Today’s focus</h2>
        {focus.length === 0 ? (
          <div className="card p-5 flex items-center gap-3">
            <Circle className="w-4 h-4 text-positive" />
            <p className="text-sm text-fg-muted">Nothing needs your attention right now.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {focus.slice(0, 4).map((f, i) => (
              <div key={i} className="card p-4 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-fg">{f.title}</p>
                  <p className="text-xs text-fg-subtle mt-0.5">{f.body}</p>
                </div>
                <Link to={f.to} className="btn-secondary text-xs h-8 px-3 flex-shrink-0 whitespace-nowrap">
                  {f.action} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4 ─ FOR YOUR REVIEW (staff notes from Meraj) */}
      {suggestions.length > 0 && (
        <section>
          <h2 className="text-xs font-bold tracking-[0.1em] uppercase text-fg-subtle mb-3">For your review</h2>
          <div className="card divide-y divide-line">
            {suggestions.slice(0, 3).map((s) => (
              <Link key={s.id} to="/app/assistant?scope=tasks" className="flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors">
                <span className="w-7 h-7 rounded-control bg-surface-2 text-fg-muted flex items-center justify-center flex-shrink-0"><MerajMark size={15} /></span>
                <p className="text-sm text-fg flex-1 min-w-0 truncate">{staffTone(s)}</p>
                <ArrowRight className="w-4 h-4 text-fg-subtle flex-shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// Render a prediction as a first-person staff note (no "AI" framing).
function staffTone(p: Prediction): string {
  const t = p.title?.trim()
  if (t) return t.endsWith('.') || t.endsWith('?') ? t : `${t}.`
  return p.description || 'Noted for your review.'
}
