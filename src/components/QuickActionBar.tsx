import { useEffect, useRef, useState } from 'react'
import { runQuickTask, type QuickTaskMode } from '../lib/ai'
import { buildWhatsappLink, copyToClipboard } from '../lib/payments'
import {
  Zap, Mic, AlertTriangle, FileBarChart, MessageCircle, Receipt,
  Sparkles, X, Loader2, CheckCircle2, Copy, Send, Square,
} from 'lucide-react'
import toast from 'react-hot-toast'

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
}

const TASKS: TaskDef[] = [
  { id: 'low_stock_alert', label: 'Low-Stock Alert', icon: AlertTriangle, desc: 'Scan inventory + reorder list', color: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400' },
  { id: 'daily_closing', label: 'Daily Closing Report', icon: FileBarChart, desc: "Today's sales summary (SMS/WhatsApp ready)", color: 'from-green-500/20 to-green-600/5', iconColor: 'text-green-400' },
  { id: 'hindi_bot', label: 'Hindi/Hinglish Bot', icon: MessageCircle, desc: 'Reply to a customer in Hinglish', color: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400', needsText: true, textLabel: "Customer's message", textPlaceholder: 'Bhai, mera order kab tak ready hoga?' },
  { id: 'gst_invoice_voice', label: 'GST Invoice (Voice)', icon: Receipt, desc: 'Speak a sale → GST invoice', color: 'from-purple-500/20 to-purple-600/5', iconColor: 'text-purple-400', needsText: true, textLabel: 'Describe the sale (speak or type)', textPlaceholder: 'Ramesh ko 5 cement bag 400 rupaye each aur 10 paint roll' },
  { id: 'custom', label: 'Custom AI Task', icon: Sparkles, desc: 'Ask anything in Hinglish or English', color: 'from-brand-500/20 to-brand-600/5', iconColor: 'text-brand-400', needsText: true, textLabel: 'What do you need?', textPlaceholder: 'Kal ka sales report do, ya purane customers ko followup bhejo' },
]

// Minimal inline render — keeps the bar component self-contained
function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hlup])(.+)$/gm, '<p>$1</p>')
}

export default function QuickActionBar() {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<QuickTaskMode>>(new Set())
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<{ mode: string; result: string; meta: any }[]>([])
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  const toggle = (id: QuickTaskMode) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  // ── Voice input via the browser's SpeechRecognition (Hindi + English) ──
  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      toast.error('Voice input not supported on this browser. Please type.')
      return
    }
    const rec = new SR()
    rec.lang = 'hi-IN' // Hindi (India) — also understands Hinglish/English
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
  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const runAll = async () => {
    if (selected.size === 0) return toast.error('Pick at least one task')
    // Validate text if any chosen task needs it
    for (const id of selected) {
      const def = TASKS.find((t) => t.id === id)
      if (def?.needsText && !text.trim()) {
        return toast.error(`${def.label} needs input — type or speak it`)
      }
    }
    setRunning(true)
    const out: { mode: string; result: string; meta: any }[] = []
    for (const id of selected) {
      try {
        const r = await runQuickTask(id, text || undefined)
        out.push({ mode: id, result: r.result, meta: r.meta })
      } catch (err) {
        out.push({ mode: id, result: '⚠️ ' + (err instanceof Error ? err.message : 'Failed'), meta: {} })
      }
    }
    setResults(out)
    setRunning(false)
    toast.success(`Done — ${out.length} task${out.length === 1 ? '' : 's'} completed`)
  }

  const reset = () => { setSelected(new Set()); setText(''); setResults([]); setOpen(false) }

  const shareResult = (mode: string, result: string) => {
    if (mode === 'daily_closing' || mode === 'low_stock_alert') {
      // These are meant to be shared via WhatsApp/SMS
      window.open(buildWhatsappLink(undefined, result), '_blank')
    } else {
      copyToClipboard(result).then((ok) => ok ? toast.success('Copied!') : toast.error('Copy failed'))
    }
  }

  return (
    <>
      {/* Floating button — the "magic button" */}
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

      {/* Modal bar */}
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

                {/* Task grid — multi-select */}
                <div className="space-y-2 mb-4">
                  {TASKS.map((t) => {
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

                {/* Text + voice input — shown when any selected task needs text, or always for custom */}
                {(() => {
                  const anyNeedsText = Array.from(selected).some((id) => TASKS.find((t) => t.id === id)?.needsText)
                  const activeDef = TASKS.find((t) => selected.has(t.id) && t.needsText)
                  if (selected.size === 0) return null
                  return (
                    <div className="mb-4">
                      <label className="label flex items-center justify-between">
                        <span>{activeDef?.textLabel || 'Optional input'}</span>
                        {!listening ? (
                          <button type="button" onClick={startListening} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                            <Mic className="w-3.5 h-3.5" /> Speak
                          </button>
                        ) : (
                          <button type="button" onClick={stopListening} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 animate-pulse">
                            <Square className="w-3.5 h-3.5" /> Stop
                          </button>
                        )}
                      </label>
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={anyNeedsText ? 3 : 2}
                        className="input-field resize-none"
                        placeholder={activeDef?.textPlaceholder || 'Add details for the task...'}
                      />
                      {listening && <p className="text-xs text-red-400 mt-1 animate-pulse">🎤 Listening in Hindi... speak now</p>}
                    </div>
                  )
                })()}

                {/* Confirm button */}
                <button onClick={runAll} disabled={running || selected.size === 0} className="btn-primary w-full py-3">
                  {running ? <><Loader2 className="w-5 h-5 animate-spin" /> Working...</> : <><CheckCircle2 className="w-5 h-5" /> Confirm & Run {selected.size > 0 && `(${selected.size})`}</>}
                </button>
              </div>
            ) : (
              /* Results view */
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
                        <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.result) }} />
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
