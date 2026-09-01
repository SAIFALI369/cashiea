import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import MerajDevice, { MerajInteractionState } from './MerajDevice'
import { useBusinessMood } from '../lib/businessMood'
import { useMerajThought } from '../lib/useMerajThought'
import { formatINR } from '../lib/format'
import {
  TrendingUp, TrendingDown, Package, Wallet, AlertTriangle, Sparkles,
  Users, Receipt, ArrowUpRight, Zap, Heart, Coffee, Moon, Sun,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * MerajSection — the larger rectangular Meraj zone on the Dashboard (replaces
 * the old "Meraj noticed X things for you" card). Meraj lives here:
 *   • He animates/reacting to business mood
 *   • A thought-bubble (💭) above him cycles a fresh short friend-phrase
 *     every hour from the 24h refreshment storage
 *   • A creative business-at-a-glance strip shows what's happening right now:
 *     profit direction, stock health, sales pulse, problems, growth
 *   • Tapping the whole panel opens the full Meraj assistant.
 *
 * On desktop this stretches wide (bigger than the old card); on mobile it's
 * still a comfortable, readable rectangle.
 */

interface Pulse {
  label: string
  icon: LucideIcon
  value: string | number
  tone: 'good' | 'bad' | 'warn' | 'neutral'
  hint?: string
}

function toneColor(tone: Pulse['tone']) {
  switch (tone) {
    case 'good': return 'text-positive'
    case 'bad': return 'text-negative'
    case 'warn': return 'text-warning'
    default: return 'text-fg-muted'
  }
}
function toneBg(tone: Pulse['tone']) {
  switch (tone) {
    case 'good': return 'bg-positive/10 text-positive'
    case 'bad': return 'bg-negative/10 text-negative'
    case 'warn': return 'bg-warning/10 text-warning'
    default: return 'bg-surface-2 text-fg-subtle'
  }
}

export default function MerajSection() {
  const navigate = useNavigate()
  const { ownerId, profile } = useAuth()
  const businessMood = useBusinessMood() ?? 'neutral'
  const { text: thought, awake, refreshNow } = useMerajThought(ownerId)

  // Pulses are small, live business signals shown alongside Meraj.
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [interaction, setInteraction] = useState<MerajInteractionState>('idle')
  const idleTimer = useRef<number | null>(null)

  // Brief "bounce" when Meraj says a new thought.
  useEffect(() => {
    if (!thought) return
    setInteraction('speaking')
    if (idleTimer.current) window.clearTimeout(idleTimer.current)
    idleTimer.current = window.setTimeout(() => setInteraction('idle'), 2200)
    return () => { if (idleTimer.current) window.clearTimeout(idleTimer.current) }
  }, [thought])

  // Fetch tiny live snapshot (just enough to render the creative strip).
  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      try {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

        const [salesT, salesY, inv, prod, txWeek, custRes] = await Promise.all([
          supabase.from('transactions').select('total').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', today),
          supabase.from('transactions').select('total').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', yesterday).lt('created_at', today),
          supabase.from('invoices').select('total').eq('user_id', ownerId).eq('status', 'overdue'),
          supabase.from('products').select('stock_quantity,low_stock_threshold').eq('user_id', ownerId),
          supabase.from('transactions').select('total').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString()),
          supabase.from('customers').select('id', { count: 'exact', head: true }).eq('user_id', ownerId),
        ])
        if (cancelled) return

        const todaySales = (salesT.data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
        const yesterdaySales = (salesY.data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
        const overdueCount = (inv.data || []).length
        const overdueSum = (inv.data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
        const lowStock = (prod.data || []).filter((p: any) => Number(p.stock_quantity ?? 0) <= Number(p.low_stock_threshold ?? 0)).length
        const weekSales = (txWeek.data || []).reduce((s: number, r: any) => s + Number(r.total || 0), 0)
        const customerCount = custRes.count ?? 0

        const delta = yesterdaySales > 0 ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 100) : null
        const list: Pulse[] = [
          {
            label: 'Sales today', icon: delta !== null && delta >= 0 ? TrendingUp : TrendingDown,
            value: formatINR(todaySales, 0),
            tone: delta === null ? 'neutral' : delta >= 0 ? 'good' : 'bad',
            hint: delta !== null ? `${delta >= 0 ? '+' : ''}${delta}% vs yesterday` : undefined,
          },
          {
            label: 'Low stock', icon: Package,
            value: lowStock ? `${lowStock} item${lowStock > 1 ? 's' : ''}` : 'All good',
            tone: lowStock > 3 ? 'bad' : lowStock > 0 ? 'warn' : 'good',
            hint: lowStock ? 'Reorder soon' : 'Stock healthy',
          },
          {
            label: 'Pending', icon: overdueCount > 0 ? AlertTriangle : Wallet,
            value: overdueCount ? formatINR(overdueSum, 0) : 'All clear',
            tone: overdueCount > 0 ? 'warn' : 'good',
            hint: overdueCount ? `${overdueCount} overdue` : 'Collected',
          },
          {
            label: 'This week', icon: Sparkles,
            value: formatINR(weekSales, 0),
            tone: weekSales > todaySales * 4 ? 'good' : 'neutral',
            hint: 'Week running total',
          },
          {
            label: 'Customers', icon: Users,
            value: customerCount,
            tone: 'neutral',
            hint: 'In your book',
          },
        ]
        setPulses(list)
      } catch {
        if (!cancelled) setPulses([])
      }
    })()
    return () => { cancelled = true }
  }, [ownerId])

  // Decorative time-of-day icon/ambient (sun/moon/coffee/heart).
  const hourIST = new Date(Date.now() + 5.5 * 3600000).getUTCHours()
  const AmbientIcon: LucideIcon = !awake ? Moon : hourIST < 11 ? Coffee : hourIST < 17 ? Sun : hourIST < 21 ? Heart : Zap

  return (
    <section
      className="relative card overflow-hidden cursor-pointer group hover:border-accent/40 transition-all"
      onClick={() => navigate('/app/assistant')}
      aria-label="Open Meraj"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/app/assistant') }}
    >
      {/* Decorative ambient gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background: businessMood === 'happy'
            ? 'radial-gradient(120% 90% at 12% 20%, rgb(var(--accent-soft)) 0%, transparent 55%), radial-gradient(80% 70% at 90% 80%, rgb(var(--gold)/0.15) 0%, transparent 60%)'
            : businessMood === 'sad'
              ? 'radial-gradient(120% 90% at 12% 20%, rgb(var(--warning)/0.1) 0%, transparent 55%), radial-gradient(80% 70% at 90% 80%, rgb(var(--negative)/0.08) 0%, transparent 60%)'
              : 'radial-gradient(120% 90% at 12% 20%, rgb(var(--accent-soft)/0.6) 0%, transparent 55%), radial-gradient(80% 70% at 90% 80%, rgb(var(--surface-2)) 0%, transparent 60%)'
        }}
      />

      <div className="relative p-4 sm:p-5 lg:p-6 flex flex-col gap-4">
        {/* Top row: label + open arrow */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${toneBg(businessMood === 'happy' ? 'good' : businessMood === 'sad' ? 'warn' : 'neutral')}`}>
              <AmbientIcon className="w-3 h-3" /> Meraj
            </span>
            <span className="text-[10px] font-semibold text-fg-subtle">
              {awake ? 'Here with you' : 'Sleeping'}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent group-hover:gap-1.5 transition-all">
            Chat <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>

        {/* Middle: Meraj + thought bubble (rectangular, bigger than before) */}
        <div className="flex items-start gap-4 sm:gap-5 min-h-[120px] sm:min-h-[140px]">
          <div className="flex-shrink-0 flex flex-col items-center pt-2">
            <MerajDevice
              interactionState={interaction}
              businessMood={businessMood}
              size="lg"
              context="card"
              className="scale-110 sm:scale-125"
            />
            {/* Friendly idle pulse dots */}
            <div className="flex items-center gap-1 mt-3">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-accent/60"
                  animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: d * 0.2 }}
                />
              ))}
            </div>
          </div>

          {/* Thought bubble */}
          <div className="relative flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={thought || 'sleep'}
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                onClick={(e) => { e.stopPropagation(); refreshNow() }}
                className="relative rounded-2xl rounded-tl-sm bg-surface border border-line px-4 py-3 shadow-soft cursor-pointer hover:border-accent/30 transition-colors"
              >
                <span className="absolute -left-2 top-4 text-accent/40 text-2xl leading-none select-none">💭</span>
                <p className="text-sm sm:text-base font-semibold text-fg leading-snug pl-3">
                  {awake ? (thought || 'Sab theek hai, bhai.') : 'So raha hoon… subah milte hain.'}
                </p>
                <p className="text-[10px] text-fg-subtle mt-1 pl-3">
                  {awake ? 'Tap bubble for another · Tap card to chat' : 'I rest between 2–5 AM so I am sharp at 5 🌅'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom: business-at-a-glance pulse chips (creative read) */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 pt-1">
          {pulses.map((p) => (
            <div key={p.label} className="rounded-xl bg-surface/80 border border-line px-2.5 py-2 sm:px-3 sm:py-2.5">
              <div className="flex items-center gap-1.5">
                <p.icon className={`w-3.5 h-3.5 ${toneColor(p.tone)}`} strokeWidth={2} />
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-fg-subtle truncate">{p.label}</span>
              </div>
              <p className={`text-sm sm:text-base font-bold leading-tight mt-1 ${toneColor(p.tone)} tabular-nums truncate`}>{p.value}</p>
              {p.hint && <p className="text-[9px] sm:text-[10px] text-fg-subtle mt-0.5 truncate">{p.hint}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
