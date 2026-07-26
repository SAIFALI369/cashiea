import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { askAssistant, runQuickTask, type QuickTaskMode } from '../lib/ai'
import { MerajMark } from './MerajMark'
import {
  X, Send, Loader2, AlertTriangle, FileBarChart, MessageCircle, Receipt, Sparkles, ArrowUpRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Priority quick actions ──
interface QTask { id: QuickTaskMode; label: string; desc: string; icon: LucideIcon; needsText?: boolean }
const TASKS: QTask[] = [
  { id: 'daily_closing', label: 'Daily closing', desc: "Today's sales summary", icon: FileBarChart },
  { id: 'low_stock_alert', label: 'Low stock', desc: 'Reorder list', icon: AlertTriangle },
  { id: 'gst_invoice_voice', label: 'GST invoice', desc: 'Speak a sale', icon: Receipt, needsText: true },
  { id: 'hindi_bot', label: 'Hinglish reply', desc: 'Customer message', icon: MessageCircle, needsText: true },
  { id: 'custom', label: 'Custom', desc: 'Ask anything', icon: Sparkles, needsText: true },
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

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function FloatingMeraj() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingTask, setPendingTask] = useState<QuickTaskMode | null>(null)

  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem(POS_KEY)
      if (saved) return JSON.parse(saved)
    } catch { /* ignore */ }
    return { x: -1, y: -1 }
  })
  const drag = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false })
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pos.x === -1) setPos({ x: window.innerWidth - 76, y: window.innerHeight - 76 - DEFAULT_MARGIN })
  }, [pos.x])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { active: true, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: false }
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) drag.current.moved = true
    const size = 60
    const nx = Math.max(DEFAULT_MARGIN, Math.min(window.innerWidth - size - DEFAULT_MARGIN, drag.current.origX + dx))
    const ny = Math.max(DEFAULT_MARGIN, Math.min(window.innerHeight - size - DEFAULT_MARGIN, drag.current.origY + dy))
    setPos({ x: nx, y: ny })
  }
  const onPointerUp = () => {
    if (!drag.current.active) return
    const wasDrag = drag.current.moved
    drag.current.active = false
    if (!wasDrag) setOpen(true)
    else { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)) } catch { /* ignore */ } }
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

  const briefing = async () => {
    if (loading) return
    setLoading(true)
    push({ role: 'user', text: "Today's briefing" })
    try {
      const reply = await askAssistant('', true)
      push({ role: 'meraj', text: reply })
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
    ? `${TASKS.find((t) => t.id === pendingTask)?.label} — type details…`
    : 'Ask Meraj about sales, stock, customers…'

  return (
    <>
      {/* Draggable launcher (hidden while panel open) */}
      {!open && pos.x !== -1 && (
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="Open Meraj executive briefing (drag to move)"
          title="Meraj — tap to open, drag to move"
          className="fixed z-40 w-[60px] h-[60px] rounded-full shadow-float hover:scale-105 active:scale-95 transition-transform touch-none select-none bg-gradient-to-br from-accent to-accent-strong text-accent-fg flex items-center justify-center"
          style={{ left: pos.x, top: pos.y }}
        >
          <MerajMark size={32} className="pointer-events-none" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-positive rounded-full border-2 border-paper animate-pulse" />
        </button>
      )}

      {/* Executive Briefing panel */}
      {open && (
        <div
          className="fixed z-50 bottom-4 right-4 left-4 sm:left-auto sm:w-[400px] flex flex-col card rounded-xl overflow-hidden animate-scale-in origin-bottom-right shadow-float"
          style={{ maxHeight: '80vh' }}
        >
          {/* Header — X in upper-left */}
          <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-line">
            <button onClick={() => setOpen(false)} aria-label="Close" className="w-7 h-7 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
            <span className="w-8 h-8 rounded-xl bg-accent-soft text-accent ring-1 ring-accent/20 flex-shrink-0 inline-flex items-center justify-center"><MerajMark size={20} /></span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-fg text-sm leading-tight">Meraj</p>
              <p className="text-[11px] text-fg-subtle leading-tight">Executive Briefing</p>
            </div>
            <Link to="/app/assistant" onClick={() => setOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 flex-shrink-0" title="Open full view" aria-label="Open full view">
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-[220px]">
            {messages.length === 0 ? (
              /* Briefing hero (empty state) */
              <div className="p-4">
                <div className="rounded-xl border border-line bg-gradient-to-br from-accent-soft to-surface p-4">
                  <span className="text-[10px] font-semibold tracking-[0.14em] uppercase text-accent">Daily Briefing</span>
                  <p className="text-sm text-fg leading-relaxed mt-2">{greeting()}. Get your snapshot of today's sales, stock alerts, and follow-ups in one tap.</p>
                  <button onClick={briefing} disabled={loading} className="btn-primary w-full mt-3.5 text-sm">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</> : <><Sparkles className="w-4 h-4" /> Generate briefing</>}
                  </button>
                </div>
                <p className="text-center text-[11px] text-fg-subtle mt-3">or pick a priority action below</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {messages.map((m, i) =>
                  m.role === 'user' ? (
                    <div key={i} className="flex justify-end">
                      <span className="text-xs text-fg-muted bg-surface-2 border border-line rounded-full px-3 py-1 max-w-[80%]">{m.text}</span>
                    </div>
                  ) : (
                    <div key={i} className="rounded-xl border border-line border-l-2 border-l-accent bg-surface-2 p-3.5">
                      <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(m.text) }} />
                    </div>
                  )
                )}
                {loading && (
                  <div className="rounded-xl border border-line bg-surface-2 p-3.5 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-surface-3 animate-pulse" />
                    <div className="h-3 w-full rounded bg-surface-3 animate-pulse" />
                    <div className="h-3 w-5/6 rounded bg-surface-3 animate-pulse" />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Priority actions */}
          <div className="px-3 py-2 border-t border-line">
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-fg-subtle px-1 mb-1.5">Priority actions</p>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {TASKS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPickTask(t)}
                  disabled={loading}
                  title={t.desc}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap border transition-all flex-shrink-0 disabled:opacity-50 ${pendingTask === t.id ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-fg-muted hover:border-line-2 hover:text-fg'}`}
                >
                  <t.icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ask input */}
          <div className="p-3 border-t border-line">
            <div className="flex gap-2 items-center">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder={placeholder}
                className="input-field flex-1 text-sm"
                disabled={loading}
              />
              <button onClick={send} disabled={loading || !input.trim()} className="btn-primary px-3 h-[42px] flex items-center justify-center" aria-label="Send">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
