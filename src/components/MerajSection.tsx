import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import MerajDevice, { MerajInteractionState } from './MerajDevice'
import { useBusinessMood } from '../lib/businessMood'
import { useMerajThought } from '../lib/useMerajThought'
import { askAssistant } from '../lib/ai'
import { useSpeech } from '../lib/useSpeech'
import { renderMd } from '../lib/markdown'
import { formatINR } from '../lib/format'
import { Send, Mic, ArrowUpRight, Zap, Heart, Coffee, Moon, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * MerajSection — the PROACTIVE AI zone on the Dashboard.
 *
 *   • A soft mint gradient marks it as Meraj's own space (no outline).
 *   • The avatar carries a slow "breathing" glow so he feels alive.
 *   • The bubble is an ACTIONABLE insight card, not a static chat line:
 *     one real, number-backed observation plus the two next moves
 *     ([View Report] / [Boost Sales]).
 *   • A soft, borderless "Ask Meraj anything…" field sits at the bottom.
 *
 * Analytics that used to be duplicated here (the 5-tile pulse strip) now
 * live exactly once, in the Dashboard's Business Pulse card.
 */

type Tone = 'good' | 'bad' | 'warn' | 'neutral'

function toneBg(tone: Tone) {
  switch (tone) {
    case 'good': return 'bg-positive/10 text-positive'
    case 'bad': return 'bg-negative/10 text-negative'
    case 'warn': return 'bg-warning/10 text-warning'
    default: return 'bg-surface-2 text-fg-subtle'
  }
}

export default function MerajSection({ weekProfit }: { weekProfit?: number } = {}) {
  const navigate = useNavigate()
  const { ownerId } = useAuth()
  const businessMood = useBusinessMood() ?? 'neutral'
  const { text: thought, awake, refreshNow } = useMerajThought(ownerId)

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

  // NOTE: this component used to fire SIX Supabase queries on every
  // dashboard load to populate a 5-tile pulse strip. That strip is gone
  // (its numbers are now stated once, in the Dashboard's Business Pulse
  // card), so the queries were pure dead cost and have been removed.
  // Meraj's thought templates already receive live numbers from the
  // single dashboard RPC via useMerajThought.

  // The insight line. Meraj's daily thought templates inject live numbers of
  // their own; until the first one resolves we fall back to the week's profit
  // — but ONLY once the Dashboard has actually loaded it. `weekProfit` is
  // undefined while the stats RPC is in flight, and printing a placeholder
  // "₹0" there would contradict the Business Pulse card a few hundred pixels
  // below. A number Meraj states must always be a number the shop really has.
  const insightText = thought
    || (weekProfit != null
      ? `Profit so far this week: ${formatINR(weekProfit, 0)}. Small margins, big dreams.`
      : 'Let me pull today\u2019s numbers together\u2026')

  // Decorative time-of-day icon/ambient (sun/moon/coffee/heart).
  const hourIST = new Date(Date.now() + 5.5 * 3600000).getUTCHours()
  const AmbientIcon: LucideIcon = !awake ? Moon : hourIST < 11 ? Coffee : hourIST < 17 ? Sun : hourIST < 21 ? Heart : Zap

  return (
    <section
      className="relative card meraj-panel overflow-hidden cursor-pointer group"
      onClick={() => navigate('/app/assistant')}
      aria-label="Open Meraj"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/app/assistant') }}
    >
      {/* Soft mint fade — distinguishes Meraj's zone from the rest of the
          page without adding an outline or a heavy tinted block. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: businessMood === 'sad'
            ? 'linear-gradient(160deg, rgb(var(--surface)) 0%, rgb(var(--warning) / 0.05) 100%)'
            : 'linear-gradient(160deg, rgb(var(--surface)) 0%, rgb(var(--accent) / 0.07) 100%)',
        }}
      />

      <div className="relative p-5 sm:p-6 flex flex-col gap-5">
        {/* Top row: label + open arrow */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${toneBg(businessMood === 'happy' ? 'good' : businessMood === 'sad' ? 'warn' : 'neutral')}`}>
              <AmbientIcon className="w-3 h-3" /> Meraj
            </span>
            <span className="text-xs text-fg-subtle">
              {awake ? 'Here with you' : 'Sleeping'}
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-accent-strong group-hover:gap-1.5 transition-all">
            Chat <ArrowUpRight className="w-4 h-4" />
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
            {/* Breathing halo — Meraj feels alive and "thinking", never static. */}
            <span className="relative flex items-center justify-center">
              <span className="meraj-breathe absolute w-24 h-24 rounded-full bg-accent/20 blur-2xl" aria-hidden="true" />
              <MerajDevice
                interactionState={interaction}
                businessMood={businessMood}
                size="lg"
                context="card"
                className="relative scale-110 sm:scale-125"
              />
            </span>
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
                  {/* ACTIONABLE INSIGHT — not a static chat bubble. Meraj
                      states the fact, then offers the two next moves. */}
                  <div
                    onClick={(e) => { e.stopPropagation(); refreshNow(); restartCycle() }}
                    className="meraj-bubble-float rounded-[1.75rem] bg-surface px-5 py-4 shadow-card cursor-pointer"
                    role="button"
                    aria-label="Meraj's insight — tap for another"
                  >
                    <p className="text-[15px] font-semibold text-fg leading-snug">
                      {awake ? `💡 ${insightText}` : '😴 So raha hoon… subah milte hain.'}
                    </p>
                    {awake ? (
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('/app/reports') }}
                          className="rounded-full bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-fg active:scale-95 transition-transform hover:bg-surface-3"
                        >
                          View Report
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); askInPlace('Give me three specific, practical ways to boost sales this week based on my shop data.') }}
                          className="rounded-full bg-accent-strong px-3.5 py-1.5 text-xs font-semibold text-accent-fg active:scale-95 transition-transform hover:bg-accent"
                        >
                          Boost Sales
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-fg-subtle mt-1.5">🌅 I rest between 2–5 AM so I am sharp at 5</p>
                    )}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* Ask is part of Meraj now: one character, one conversation surface. */}
        {/* Soft, borderless ask field — no heavy black outline. */}
        <form onSubmit={(e) => { e.preventDefault(); const q = ask.trim(); if (q) { askInPlace(q) } }} className="flex items-center gap-1.5 rounded-full bg-surface-2 pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-accent/40 transition-shadow" onClick={(e) => e.stopPropagation()}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask Meraj anything…" className="flex-1 bg-transparent py-1.5 text-sm text-fg placeholder:text-fg-subtle outline-none min-w-0" />
          <button type="button" onClick={() => navigate('/app/assistant')} aria-label="Voice" className="w-9 h-9 rounded-full text-fg-muted hover:text-fg hover:bg-surface-3 flex items-center justify-center active:scale-95 transition-transform"><Mic className="w-4 h-4" /></button>
          <button type="submit" aria-label="Send" className="w-9 h-9 rounded-full bg-accent-strong text-accent-fg flex items-center justify-center hover:bg-accent active:scale-95 transition-transform"><Send className="w-4 h-4" /></button>
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

        {/* NOTE: the old 5-tile "pulse chip" strip lived here. Every one of
            those numbers (sales today, low stock, pending, week, customers)
            is now stated exactly once in the Dashboard's Business Pulse
            card — repeating them here was the page's main source of
            duplicate information and visual noise. */}
      </div>
    </section>
  )
}
