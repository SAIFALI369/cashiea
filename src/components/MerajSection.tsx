import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import MerajDevice, { MerajInteractionState } from './MerajDevice'
import { useBusinessMood } from '../lib/businessMood'
import { useMerajThought } from '../lib/useMerajThought'
import { askAssistant } from '../lib/ai'
import { useSpeech } from '../lib/useSpeech'
import { renderMd } from '../lib/markdown'
import { salesSignal } from '../lib/salesSignal'
import { formatINR } from '../lib/format'
import {
  TrendingUp, TrendingDown, Package, Wallet, AlertTriangle, Sparkles, Send, Mic,
  Users, ArrowUpRight, Zap, Heart, Coffee, Moon, Sun,
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
  const { ownerId } = useAuth()
  const businessMood = useBusinessMood() ?? 'neutral'
  const { text: thought, awake, refreshNow } = useMerajThought(ownerId)

  // Pulses are small, live business signals shown alongside Meraj.
  const [pulses, setPulses] = useState<Pulse[]>([])
  const [ask, setAsk] = useState('')
  const [reply, setReply] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  // ── VOICE REPLY BUBBLE: when Meraj speaks via bottom NAV, words appear
  //    in the thought bubble one by one (animated), show 3s, rest 2min,
  //    then the normal thought cycle resumes. ──
  const [voiceReplyText, setVoiceReplyText] = useState('')
  const [voiceReplyWords, setVoiceReplyWords] = useState(0)
  const voiceReplyTimeoutRef = useRef<number | null>(null)
  const { speak, unlockTts } = useSpeech()
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

  // ── Thought cycle: the bubble SHOWS 20s, RESTS 60s, then returns with a
  //    NEW thought — an endless gentle loop. Tapping the bubble restarts the
  //    20s window with the next idea immediately.
  const [bubbleVisible, setBubbleVisible] = useState(true)
  const [cycleCount, setCycleCount] = useState(0)
  const cycleRef = useRef({ phase: 'show' as 'show' | 'hide', t: Date.now() })
  const refreshRef = useRef(refreshNow)
  refreshRef.current = refreshNow
  useEffect(() => {
    const tick = window.setInterval(() => {
      const c = cycleRef.current
      const elapsed = Date.now() - c.t
      if (c.phase === 'show' && elapsed >= 20_000) {
        cycleRef.current = { phase: 'hide', t: Date.now() }
        setBubbleVisible(false)
      } else if (c.phase === 'hide' && elapsed >= 40_000) {
        cycleRef.current = { phase: 'show', t: Date.now() }
        setBubbleVisible(true)
        setCycleCount((n) => n + 1)
        refreshRef.current()
      }
    }, 1_000)
    return () => window.clearInterval(tick)
  }, [])
  const restartCycle = () => { cycleRef.current = { phase: 'show', t: Date.now() } }

  // ── VOICE REPLY EVENT: bottom NAV's Meraj speaks → words flow into the
  //    thought bubble with word-by-word animation, then the cycle rests. ──
  useEffect(() => {
    const onVoiceReply = (e: Event) => {
      const text = (e as CustomEvent).detail?.text as string
      if (!text || !text.trim()) return
      if (voiceReplyTimeoutRef.current) window.clearTimeout(voiceReplyTimeoutRef.current)
      cycleRef.current = { phase: 'hide', t: Date.now() }
      setBubbleVisible(false)
      setVoiceReplyText(text)
      setVoiceReplyWords(0)
      const words = text.trim().split(/\s+/)
      let w = 0
      const typeWord = () => {
        w++
        setVoiceReplyWords(w)
        if (w < words.length) {
          voiceReplyTimeoutRef.current = window.setTimeout(typeWord, 60)
        } else {
          voiceReplyTimeoutRef.current = window.setTimeout(() => {
            setVoiceReplyText('')
            setVoiceReplyWords(0)
            voiceReplyTimeoutRef.current = window.setTimeout(() => {
              cycleRef.current = { phase: 'show', t: Date.now() }
              setBubbleVisible(true)
              refreshNow()
            }, 120_000)
          }, 3_000)
        }
      }
      voiceReplyTimeoutRef.current = window.setTimeout(typeWord, 200)
    }
    window.addEventListener('meraj:voice-reply', onVoiceReply)
    return () => {
      window.removeEventListener('meraj:voice-reply', onVoiceReply)
      if (voiceReplyTimeoutRef.current) window.clearTimeout(voiceReplyTimeoutRef.current)
    }
  }, [refreshNow])

  // ── IN-PLACE VOICE REPLY: type a question, Meraj answers right here
  //    (text bubble + ElevenLabs voice) — no page navigation needed.
  const askInPlace = async (q: string) => {
    if (replyLoading) return
    setAsk('')
    setReply('')
    setReplyLoading(true)
    unlockTts() // prime the TTS engine inside this gesture
    try {
      const res = await askAssistant(q, false, undefined, 'ask')
      if (res.reply) {
        setReply(res.reply)
        speak(res.reply) // ElevenLabs premium voice (or browser fallback)
      } else {
        setReply('I could not think of a reply. Try asking in the Meraj chat.')
      }
    } catch {
      setReply('Something went wrong. Open the Meraj chat to try again.')
    } finally {
      setReplyLoading(false)
    }
  }

  // Fetch tiny live snapshot (just enough to render the creative strip).
  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      try {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString()

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

        // Zero sales is NOT a loss — an empty morning stays neutral.
        const sig = salesSignal(todaySales, yesterdaySales)
        const list: Pulse[] = [
          {
            label: 'Sales today',
            icon: sig.tone === 'bad' || (sig.tone === 'neutral' && todaySales === 0) ? TrendingDown : TrendingUp,
            value: formatINR(todaySales, 0),
            tone: sig.tone,
            hint: todaySales > 0 ? 'Today so far' : 'No sales yet',
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

        {/* Middle: Meraj + thought cloud. Resting → Meraj slides to the
            CENTER of the section; a thought arriving slides him smoothly
            back to the left corner with the bubble — no teleporting. */}
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 200, damping: 26 }}
          className="flex items-center min-h-[120px] sm:min-h-[150px] w-full"
          style={{ justifyContent: bubbleVisible ? 'flex-start' : 'center' }}
        >
          <motion.div layout transition={{ type: 'spring', stiffness: 200, damping: 26 }} className="flex-shrink-0 flex flex-col items-center pt-2">
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
          </motion.div>

          {/* Thought bubble — a real cloud: shows 20s, rests 60s, returns with a new thought */}
          {/* VOICE REPLY — Meraj's spoken words flow here word-by-word */}
          {voiceReplyText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 z-10 flex items-center"
            >
              <div className="w-full rounded-[1.9rem] bg-accent-soft/50 border border-accent/30 px-5 py-4 shadow-soft">
                <p className="text-sm sm:text-base font-semibold text-fg leading-snug">
                  {voiceReplyText.trim().split(/\s+/).slice(0, voiceReplyWords).join(' ')}
                  {voiceReplyWords < voiceReplyText.trim().split(/\s+/).length && (
                    <span className="animate-pulse text-accent-strong">▊</span>
                  )}
                </p>
              </div>
            </motion.div>
          )}
          <motion.div layout transition={{ type: 'spring', stiffness: 200, damping: 26 }} className="relative flex-1 min-w-0 min-h-[96px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              {bubbleVisible ? (
                <motion.div
                  key={`bubble-${cycleCount}-${thought || 'sleep'}`}
                  initial={{ opacity: 0, x: -22, scale: 0.82 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 12, scale: 0.88, filter: 'blur(3px)' }}
                  transition={{ type: 'spring', stiffness: 240, damping: 20 }}
                  className="relative"
                >
                  {/* Trailing thought dots — the cloud's tail toward Meraj */}
                  <span className="absolute -left-3.5 bottom-1.5 w-3.5 h-3.5 rounded-full bg-surface border border-accent/25 shadow-soft" aria-hidden="true" />
                  <span className="absolute -left-7 bottom-6 w-2.5 h-2.5 rounded-full bg-surface border border-accent/20 shadow-soft" aria-hidden="true" />
                  <span className="absolute -left-9.5 bottom-11 w-1.5 h-1.5 rounded-full bg-surface border border-accent/20" aria-hidden="true" />
                  <div
                    onClick={(e) => { e.stopPropagation(); refreshNow(); restartCycle() }}
                    className="meraj-bubble-float rounded-[1.9rem] bg-surface/95 border border-accent/20 px-5 py-4 shadow-soft cursor-pointer hover:border-accent/45 transition-colors"
                    role="button"
                    aria-label="Meraj's thought — tap for another"
                  >
                    <p className="text-sm sm:text-base font-semibold text-fg leading-snug">
                      {awake ? `💡 ${thought || 'Sab theek hai, bhai.'}` : '😴 So raha hoon… subah milte hain.'}
                    </p>
                    <p className="text-[10px] text-fg-subtle mt-1.5">
                      {awake ? '✨ Tap for another idea' : '🌅 I rest between 2–5 AM so I am sharp at 5'}
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Ask is part of Meraj now: one character, one conversation surface. */}
        <form onSubmit={(e) => { e.preventDefault(); const q = ask.trim(); if (q) { askInPlace(q) } }} className="flex items-center gap-2 rounded-xl border border-line bg-surface/80 px-2 focus-within:border-accent/50 transition-colors" onClick={(e) => e.stopPropagation()}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="💭 Ask Meraj anything…" className="flex-1 bg-transparent py-2.5 px-2 text-sm text-fg placeholder:text-fg-subtle outline-none min-w-0" />
          <button type="button" onClick={() => navigate('/app/assistant')} aria-label="Voice" className="w-8 h-8 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 flex items-center justify-center"><Mic className="w-4 h-4" /></button>
          <button type="submit" aria-label="Send" className="w-8 h-8 rounded-lg bg-fg text-paper flex items-center justify-center hover:opacity-90"><Send className="w-4 h-4" /></button>
        </form>

        {/* Meraj's in-place reply — text bubble + voice */}
        {(replyLoading || reply) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-2xl bg-accent-soft/40 border border-accent/20 px-4 py-3"
          >
            {replyLoading ? (
              <p className="text-sm text-fg-muted flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Meraj is thinking...
              </p>
            ) : (
              <div
                className="text-sm text-fg leading-relaxed prose-content"
                dangerouslySetInnerHTML={{ __html: renderMd(reply) }}
              />
            )}
          </motion.div>
        )}

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
