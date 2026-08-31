import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { askAssistant, runQuickTask, type QuickTaskMode } from '../lib/ai'
import MerajDevice from './MerajDevice'
import type { BusinessMood } from '../lib/businessMood'
import {
  X, Send, Loader2, AlertTriangle, FileBarChart, MessageCircle, Receipt, Sparkles, ArrowUpRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Quick actions (preserves the old QuickActionBar's task set) ──
interface QTask { id: QuickTaskMode; label: string; icon: LucideIcon; color: string; needsText?: boolean }
const TASKS: QTask[] = [
  { id: 'low_stock_alert', label: 'Low stock', icon: AlertTriangle, color: 'text-amber-400' },
  { id: 'daily_closing', label: 'Daily closing', icon: FileBarChart, color: 'text-green-400' },
  { id: 'hindi_bot', label: 'Hinglish reply', icon: MessageCircle, color: 'text-emerald-400', needsText: true },
  { id: 'gst_invoice_voice', label: 'GST invoice', icon: Receipt, color: 'text-purple-400', needsText: true },
  { id: 'custom', label: 'Custom', icon: Sparkles, color: 'text-brand-400', needsText: true },
]

interface Msg { role: 'user' | 'meraj'; text: string }

const POS_KEY = 'cashiea_meraj_fab_pos'
const DEFAULT_MARGIN = 20

function renderSafeMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'br', 'hr', 'code', 'blockquote', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  })
}

export default function FloatingMeraj({
  open,
  onOpenChange,
  businessMood,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessMood: BusinessMood | null
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingTask, setPendingTask] = useState<QuickTaskMode | null>(null)

  // Draggable launcher position (persisted). Default = bottom-right.
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(POS_KEY)
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { x: -1, y: -1 } // sentinel: resolved after mount (viewport-relative)
  })
  const drag = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false })
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Resolve default position relative to viewport on first mount.
  useEffect(() => {
    if (pos.x === -1) {
      setPos({ x: window.innerWidth - 76, y: window.innerHeight - 76 - DEFAULT_MARGIN })
    }
  }, [pos.x])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  // ── Drag handlers (pointer events = mouse + touch) ─────────────
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) drag.current.moved = true
    const size = 64
    const nx = Math.max(DEFAULT_MARGIN, Math.min(window.innerWidth - size - DEFAULT_MARGIN, drag.current.origX + dx))
    const ny = Math.max(DEFAULT_MARGIN, Math.min(window.innerHeight - size - DEFAULT_MARGIN, drag.current.origY + dy))
    setPos({ x: nx, y: ny })
  }
  const onPointerUp = () => {
    if (!drag.current.active) return
    const wasDrag = drag.current.moved
    drag.current.active = false
    if (!wasDrag) {
      onOpenChange(true) // a tap (not a drag) opens the window
    } else {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* ignore */ }
    }
  }

  const push = (m: Msg) => setMessages((prev) => [...prev, m])

  const runTaskNow = async (mode: QuickTaskMode, text?: string) => {
    setLoading(true)
    try {
      const r = await runQuickTask(mode, text)
      push({ role: 'meraj', text: r.result + (r.meta?.invoice ? `\n\n✅ Invoice **${r.meta.invoice.invoice_number}** created — ₹${r.meta.invoice.total}` : '') })
    } catch (e) {
      push({ role: 'meraj', text: '⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.') })
    } finally {
      setLoading(false)
    }
  }

  const onPickTask = (t: QTask) => {
    if (t.needsText) {
      setPendingTask(t.id)
      const hints: Record<string, string> = {
        hindi_bot: 'Type the customer’s message and I’ll reply in Hinglish.',
        gst_invoice_voice: 'Describe the sale (e.g. “Ramesh — 5 cement bags ₹400 each”) and I’ll make the GST invoice.',
        custom: 'What do you need? Ask in Hinglish or English.',
      }
      push({ role: 'meraj', text: hints[t.id] || 'Go ahead — type below.' })
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      push({ role: 'user', text: t.label })
      runTaskNow(t.id)
    }
  }

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    push({ role: 'user', text: q })
    if (pendingTask) {
      const mode = pendingTask
      setPendingTask(null)
      await runTaskNow(mode, q)
      return
    }
    setLoading(true)
    try {
      const reply = await askAssistant(q)
      push({ role: 'meraj', text: reply })
    } catch (e) {
      push({ role: 'meraj', text: '⚠️ ' + (e instanceof Error ? e.message : 'Something went wrong.') })
    } finally {
      setLoading(false)
    }
  }

  const placeholder = pendingTask
    ? (TASKS.find((t) => t.id === pendingTask)?.label + ' — type details…')
    : 'Ask Meraj anything about your business…'

  // Real app state for the device: thinking while a request is in
  // flight; otherwise idle (resting expression = businessMood).
  const interactionState = loading ? 'thinking' as const : 'idle' as const

  return (
    <>
      {/* Draggable Meraj launcher — the device character itself.
          Desktop only: on mobile the bottom-nav center device opens
          the window. Hidden while the window is open. */}
      {!open && pos.x !== -1 && (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="Open Meraj AI assistant (drag to move)"
          title="Meraj — tap to open, drag to move"
          className="fixed z-40 hidden lg:block w-[64px] h-[64px] rounded-full hover:scale-105 active:scale-95 transition-transform touch-none select-none"
          style={{ left: pos.x, top: pos.y }}
        >
          <span className="pointer-events-none block w-full h-full">
            <MerajDevice size="sm" context="nav" interactionState="idle" businessMood={businessMood ?? 'neutral'} />
          </span>
        </button>
      )}

      {/* Floating AI window */}
      {open && (
        <div className="fixed z-50 bottom-20 lg:bottom-4 right-4 left-4 sm:left-auto sm:w-[380px] flex flex-col card rounded-2xl border border-slate-700/60 shadow-2xl shadow-black/50 overflow-hidden animate-scale-in origin-bottom-right"
          style={{ maxHeight: '78vh' }}>
          {/* Header — X is in the UPPER-LEFT corner */}
          <div className="flex items-center gap-2 p-3 border-b border-slate-800 bg-slate-900/60">
            <button onClick={() => onOpenChange(false)} aria-label="Close" className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
            <span className="flex-shrink-0 inline-flex items-center justify-center">
              <MerajDevice size="sm" context="panel" interactionState={interactionState} businessMood={businessMood ?? 'neutral'} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm leading-tight">Meraj</p>
              <p className="text-[11px] text-slate-400 leading-tight">Your Cashiea AI assistant</p>
            </div>
            <Link to="/app/assistant" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-brand-300 flex-shrink-0" title="Open full chat" aria-label="Open full chat">
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Quick actions row */}
          <div className="flex gap-1.5 p-2 overflow-x-auto border-b border-slate-800/60 bg-slate-900/30">
            {TASKS.map((t) => (
              <button
                key={t.id}
                onClick={() => onPickTask(t)}
                disabled={loading}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap border transition-all flex-shrink-0 ${pendingTask === t.id ? 'border-brand-500 bg-brand-600/20 text-white' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-600 hover:text-white'}`}
              >
                <t.icon className={`w-3.5 h-3.5 ${t.color}`} /> {t.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[180px]">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="flex justify-center">
                  <MerajDevice size="md" context="panel" interactionState="idle" businessMood={businessMood ?? 'neutral'} />
                </div>
                <p className="text-sm text-slate-300 mt-3 font-medium">Hi, I'm Meraj 👋</p>
                <p className="text-xs text-slate-500 mt-1 px-2">Ask about sales, stock or customers — or tap a quick action above.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`rounded-2xl px-3 py-2 max-w-[88%] text-sm ${m.role === 'user' ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-200 border border-slate-700/60 rounded-tl-sm'}`}>
                  {m.role === 'meraj'
                    ? <div className="prose-content" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(m.text) }} />
                    : <p className="whitespace-pre-wrap">{m.text}</p>}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-2 border border-slate-700/60">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-400" />
                  <span className="text-xs text-slate-400">Meraj is working…</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2 p-2.5 border-t border-slate-800 bg-slate-900/40">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={placeholder}
              className="input-field flex-1 text-sm"
              disabled={loading}
            />
            <button onClick={send} disabled={loading || !input.trim()} className="btn-primary px-3 flex items-center justify-center" aria-label="Send">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
