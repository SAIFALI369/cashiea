// ════════════════════════════════════════════════════════════════
// QuickActionBar — floating one-click AI task bar for shop owners.
//
// TODO (future task — not built in this session):
//   1. "Repeat yesterday" one-tap button for daily_closing
//   2. Task history log (last 10 runs) accessible from the modal
//   3. Scheduled quick tasks — mark daily_closing as auto-run
// ════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { runQuickTask, type QuickTaskMode } from '../lib/ai'
import { logFailedTask } from '../lib/logging'
import { buildWhatsappLink, copyToClipboard } from '../lib/payments'
import {
  Zap, Mic, AlertTriangle, FileBarChart, MessageCircle, Receipt,
  Sparkles, X, Loader2, CheckCircle2, Copy, Send, Square,
  ChevronDown, ChevronUp, Globe,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── FIX 1: Safe markdown rendering (marked + DOMPurify) ─────────
function renderSafeMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'li', 'br'],
    ALLOWED_ATTR: [],
  })
}

// ─── Task definitions ───────────────────────────────────────────
interface TaskDef {
  id: QuickTaskMode
  label: string
  icon: typeof Zap
  desc: string
  color: string
  iconColor: string
  needsText?: boolean
  textLabel?: string
  textPlaceholder?: string
  primary?: boolean
}

const TASKS: TaskDef[] = [
  { id: 'low_stock_alert', label: 'Low-Stock Alert', icon: AlertTriangle, desc: 'Scan inventory + reorder list', color: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400', primary: true },
  { id: 'daily_closing', label: 'Daily Closing Report', icon: FileBarChart, desc: "Today's sales summary (WhatsApp ready)", color: 'from-green-500/20 to-green-600/5', iconColor: 'text-green-400', primary: true },
  { id: 'gst_invoice_voice', label: 'GST Invoice (Voice)', icon: Receipt, desc: 'Speak a sale, get a GST invoice', color: 'from-purple-500/20 to-purple-600/5', iconColor: 'text-purple-400', needsText: true, textLabel: 'Describe the sale (speak or type)', textPlaceholder: 'Ramesh ko 5 cement bag 400 rupaye each aur 10 paint roll', primary: true },
  { id: 'hindi_bot', label: 'Hindi/Hinglish Bot', icon: MessageCircle, desc: 'Reply to a customer in Hinglish', color: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400', needsText: true, textLabel: "Customer's message", textPlaceholder: 'Bhai, mera order kab tak ready hoga?' },
  { id: 'custom', label: 'Custom AI Task', icon: Sparkles, desc: 'Ask anything in Hinglish or English', color: 'from-brand-500/20 to-brand-600/5', iconColor: 'text-brand-400', needsText: true, textLabel: 'What do you need?', textPlaceholder: 'Kal ka sales report do, ya purane customers ko followup bhejo' },
]

const FRIENDLY_ERROR = 'Something went wrong — we\'ve noted it and you can try again in a moment.'

export default function QuickActionBar() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<QuickTaskMode>>(new Set())
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<{ mode: string; result: string; meta: any }[]>([])
  const [listening, setListening] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [voiceLang, setVoiceLang] = useState<'hi-IN' | 'en-IN'>('hi-IN')
  const [lastUsedTask, setLastUsedTask] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const primaryTasks = TASKS.filter((t) => t.primary)
  const secondaryTasks = TASKS.filter((t) => !t.primary)
  const visibleTasks = showMore ? [...primaryTasks, ...secondaryTasks] : primaryTasks

  const toggle = (id: QuickTaskMode) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else {
      next.add(id)
      const def = TASKS.find((t) => t.id === id)
      if (def?.needsText) setTimeout(() => textareaRef.current?.focus(), 100)
    }
    setSelected(next)
  }

  // ── FIX 2: Voice input with proper cleanup ─────────────────────
  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      toast.error('Voice input not supported on this browser. Please type.')
      return
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch { /* noop */ }
    }
    const rec = new SR()
    rec.lang = voiceLang
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = (e: any) => { setListening(false); toast.error('Mic error: ' + e.error) }
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setText((prev) => (prev ? prev + ' ' : '') + transcript)
      toast.success('Heard: ' + transcript.slice(0, 60))
    }
    recognitionRef.current = rec
    rec.start()
  }
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  // FIX 2: cleanup on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  const runAll = async () => {
    if (selected.size === 0) return toast.error('Pick at least one task')
    for (const id of selected) {
      const def = TASKS.find((t) => t.id === id)
      if (def?.needsText && !text.trim()) {
        return toast.error(`${def.label} needs input — type or speak it`)
      }
    }
    setRunning(true)
    const out: { mode: string; result: string; meta: any }[] = []
    const taskIds = Array.from(selected)
    if (taskIds.length === 1) setLastUsedTask(taskIds[0])

    for (const id of selected) {
      try {
        const r = await runQuickTask(id, text || undefined)
        out.push({ mode: id, result: r.result, meta: r.meta })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed'
        out.push({ mode: id, result: '⚠️ ' + FRIENDLY_ERROR, meta: {} })
        // FIX 3: log the real error to failed_jobs (fire-and-forget)
        logFailedTask(id, errorMessage, { input_text: text }).catch(() => {})
      }
    }
    setResults(out)
    setRunning(false)
    toast.success(`Done — ${out.length} task${out.length === 1 ? '' : 's'} completed`)
  }

  // FIX 2: reset() now stops the mic before closing
  const reset = () => {
    stopListening()
    setSelected(new Set())
    setText('')
    setResults([])
    setOpen(false)
  }

  // UX 3: one-tap repeat
  const repeatLastTask = async () => {
    if (!lastUsedTask) return
    setOpen(true)
    setSelected(new Set([lastUsedTask as QuickTaskMode]))
    const def = TASKS.find((t) => t.id === lastUsedTask)
    if (def?.needsText) setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const shareResult = (mode: string, result: string) => {
    if (mode === 'daily_closing' || mode === 'low_stock_alert' || mode === 'hindi_bot') {
      window.open(buildWhatsappLink(undefined, result), '_blank')
    } else {
      copyToClipboard(result).then((ok) => ok ? toast.success('Copied!') : toast.error('Copy failed'))
    }
  }

  return (
    <>
      {/* UX 3: "Repeat last task" shortcut */}
      {!open && lastUsedTask && (
        <button
          onClick={repeatLastTask}
          className="fixed z-40 px-4 py-2.5 rounded-full bg-slate-800 border border-brand-600/40 text-brand-300 text-sm font-medium shadow-lg hover:bg-slate-700 transition-all flex items-center gap-2"
          style={{ bottom: '5.5rem', right: '1.25rem' }}
        >
          <Zap className="w-4 h-4" />
          Repeat: {TASKS.find((t) => t.id === lastUsedTask)?.label || 'Last Task'}
        </button>
      )}

      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-900/40 flex items-center justify-center hover:scale-105 transition-transform group"
          title="Quick Actions"
        >
          <Zap className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-950 animate-pulse" />
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={reset}>
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            {results.length === 0 ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2"><Zap className="w-5 h-5 text-brand-400" /> Quick Actions</h2>
                    <p className="text-xs text-slate-400">Pick one or more — tasks run after you confirm</p>
                  </div>
                  <button onClick={reset} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                {/* UX 1: 3 primary tasks by default */}
                <div className="space-y-2 mb-4">
                  {visibleTasks.map((t) => {
                    const on = selected.has(t.id)
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggle(t.id)}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${on ? 'border-brand-600 bg-brand-600/10' : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'}`}
                      >
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center flex-shrink-0`}>
                          <t.icon className={`w-5 h-5 ${t.iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm">{t.label}</p>
                          <p className="text-xs text-slate-400">{t.desc}</p>
                        </div>
                        {on && <CheckCircle2 className="w-5 h-5 text-brand-400 flex-shrink-0" />}
                      </button>
                    )
                  })}
                </div>

                {/* UX 1: "More options" toggle */}
                {!showMore && secondaryTasks.length > 0 && (
                  <button onClick={() => setShowMore(true)} className="btn-ghost text-xs w-full mb-4">
                    <ChevronDown className="w-3.5 h-3.5" /> More options
                  </button>
                )}
                {showMore && (
                  <button onClick={() => setShowMore(false)} className="btn-ghost text-xs w-full mb-4">
                    <ChevronUp className="w-3.5 h-3.5" /> Show less
                  </button>
                )}

                {/* Text + voice input */}
                {(() => {
                  const anyNeedsText = Array.from(selected).some((id) => TASKS.find((t) => t.id === id)?.needsText)
                  const activeDef = TASKS.find((t) => selected.has(t.id) && t.needsText)
                  if (selected.size === 0) return null
                  return (
                    <div className="mb-4">
                      <label className="label flex items-center justify-between">
                        <span>{activeDef?.textLabel || 'Optional input'}</span>
                        <div className="flex items-center gap-3">
                          {/* UX 5: language toggle */}
                          <button
                            type="button"
                            onClick={() => setVoiceLang(voiceLang === 'hi-IN' ? 'en-IN' : 'hi-IN')}
                            className="text-xs text-slate-500 hover:text-brand-400 flex items-center gap-1"
                            title="Toggle voice recognition language"
                          >
                            <Globe className="w-3.5 h-3.5" /> {voiceLang === 'hi-IN' ? 'HI' : 'EN'}
                          </button>
                          {!listening ? (
                            <button type="button" onClick={startListening} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                              <Mic className="w-3.5 h-3.5" /> Speak
                            </button>
                          ) : (
                            <button type="button" onClick={stopListening} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 animate-pulse">
                              <Square className="w-3.5 h-3.5" /> Stop
                            </button>
                          )}
                        </div>
                      </label>
                      <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={anyNeedsText ? 3 : 2}
                        className="input-field resize-none"
                        placeholder={activeDef?.textPlaceholder || 'Add details for the task...'}
                      />
                      {listening && <p className="text-xs text-red-400 mt-1 animate-pulse">Listening in {voiceLang === 'hi-IN' ? 'Hindi' : 'English'}... speak now</p>}
                    </div>
                  )
                })()}

                <button onClick={runAll} disabled={running || selected.size === 0} className="btn-primary w-full py-3">
                  {running ? <><Loader2 className="w-5 h-5 animate-spin" /> Working...</> : <><CheckCircle2 className="w-5 h-5" /> Confirm & Run {selected.size > 0 && `(${selected.size})`}</>}
                </button>
              </div>
            ) : (
              /* Results view — FIX 1: uses renderSafeMarkdown */
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-400" /> Done!</h2>
                  <button onClick={reset} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  {results.map((r, i) => {
                    const def = TASKS.find((t) => t.id === r.mode)
                    const shareable = r.mode === 'daily_closing' || r.mode === 'low_stock_alert' || r.mode === 'hindi_bot'
                    return (
                      <div key={i} className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {def && <def.icon className={`w-4 h-4 ${def.iconColor}`} />}
                            <h3 className="font-semibold text-white text-sm">{def?.label || r.mode}</h3>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => shareResult(r.mode, r.result)} className="btn-ghost text-xs">
                              {shareable ? <Send className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        {/* FIX 1: sanitized rendering — XSS surface eliminated */}
                        <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(r.result) }} />
                        {r.meta?.items && r.meta.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-500">
                            {r.meta.items.length} items flagged · Total affected: ₹{r.meta.revenue?.toFixed(0) || '—'}
                          </div>
                        )}
                        {r.meta?.invoice && (
                          <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-green-400">
                            ✅ Invoice {r.meta.invoice.invoice_number} created — total ₹{r.meta.invoice.total}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button onClick={() => { setResults([]); setSelected(new Set()); setText('') }} className="btn-secondary w-full mt-4 text-sm">Run more tasks</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
