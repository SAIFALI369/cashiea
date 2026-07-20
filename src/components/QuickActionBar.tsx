// ════════════════════════════════════════════════════════════════
// QuickActionBar — premium floating AI task bar for shop owners.
//
// Features:
//   • 3 primary tasks by default + "More options" for the rest
//   • Voice input with HI/EN toggle
//   • Safe markdown rendering (marked + DOMPurify)
//   • Repeat-last-task one-tap shortcut
//   • TODO 1: "View past report" — rerun daily_closing for any date
//   • TODO 2: Task history (last 10 runs, localStorage)
//   • TODO 3: Auto-schedule daily_closing toggle
// ════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { runQuickTask, type QuickTaskMode } from '../lib/ai'
import { logFailedTask } from '../lib/logging'
import { buildWhatsappLink, copyToClipboard } from '../lib/payments'
import { getHistory, addToHistory, relativeTime, yesterdayIST, type HistoryEntry } from '../lib/task-history'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Zap, Mic, AlertTriangle, FileBarChart, MessageCircle, Receipt,
  Sparkles, X, Loader2, CheckCircle2, Copy, Send, Square,
  ChevronDown, ChevronUp, Globe, Clock, Calendar, History, Bell,
} from 'lucide-react'
import toast from 'react-hot-toast'

function renderSafeMarkdown(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['h2', 'h3', 'p', 'strong', 'em', 'ul', 'li', 'br'],
    ALLOWED_ATTR: [],
  })
}

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
  const { profile, refreshProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<QuickTaskMode>>(new Set())
  const [text, setText] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<{ mode: string; result: string; meta: any }[]>([])
  const [listening, setListening] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [voiceLang, setVoiceLang] = useState<'hi-IN' | 'en-IN'>('hi-IN')
  const [lastUsedTask, setLastUsedTask] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyDetail, setHistoryDetail] = useState<HistoryEntry | null>(null)
  const [rerunDate, setRerunDate] = useState<string>('')
  const [autoSchedule, setAutoSchedule] = useState(profile?.daily_briefing ?? false)
  const [togglingSchedule, setTogglingSchedule] = useState(false)
  const recognitionRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory())
  }, [])

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

  // ── Voice input ────────────────────────────────────────────────
  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error('Voice input not supported on this browser.'); return }
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    const rec = new SR()
    rec.lang = voiceLang
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = (e: any) => { setListening(false); toast.error('Mic: ' + e.error) }
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setText((prev) => (prev ? prev + ' ' : '') + transcript)
      toast.success('Heard: ' + transcript.slice(0, 50))
    }
    recognitionRef.current = rec
    rec.start()
  }
  const stopListening = useCallback(() => { recognitionRef.current?.stop(); setListening(false) }, [])
  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  // ── Run tasks ──────────────────────────────────────────────────
  const runSingle = async (mode: QuickTaskMode, taskText?: string, extra?: Record<string, unknown>) => {
    setRunning(true)
    try {
      const r = await runQuickTask(mode, taskText || undefined, extra)
      const def = TASKS.find((t) => t.id === mode)
      // Save to history
      addToHistory({
        mode, label: def?.label || mode,
        resultPreview: r.result.slice(0, 120),
        fullResult: r.result, meta: r.meta,
      })
      setHistory(getHistory())
      setResults([{ mode, result: r.result, meta: r.meta }])
      setLastUsedTask(mode)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed'
      setResults([{ mode, result: FRIENDLY_ERROR, meta: {} }])
      logFailedTask(mode, errorMessage, { text: taskText }).catch(() => {})
    } finally {
      setRunning(false)
    }
  }

  const runAll = async () => {
    if (selected.size === 0) return toast.error('Pick at least one task')
    for (const id of selected) {
      const def = TASKS.find((t) => t.id === id)
      if (def?.needsText && !text.trim()) return toast.error(`${def.label} needs input`)
    }
    setRunning(true)
    const out: { mode: string; result: string; meta: any }[] = []
    const taskIds = Array.from(selected)
    if (taskIds.length === 1) setLastUsedTask(taskIds[0])
    for (const id of selected) {
      try {
        const r = await runQuickTask(id, text || undefined)
        out.push({ mode: id, result: r.result, meta: r.meta })
        const def = TASKS.find((t) => t.id === id)
        addToHistory({ mode: id, label: def?.label || id, resultPreview: r.result.slice(0, 120), fullResult: r.result, meta: r.meta })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed'
        out.push({ mode: id, result: FRIENDLY_ERROR, meta: {} })
        logFailedTask(id, errorMessage, { text }).catch(() => {})
      }
    }
    setHistory(getHistory())
    setResults(out)
    setRunning(false)
    toast.success(`${out.length} task${out.length === 1 ? '' : 's'} done`)
  }

  // TODO 1: Rerun daily closing for a specific date
  const rerunForDate = async (date: string) => {
    if (!date) return
    setRunning(true)
    try {
      const r = await runQuickTask('daily_closing', undefined, { target_date: date })
      addToHistory({ mode: 'daily_closing', label: 'Daily Closing', resultPreview: r.result.slice(0, 120), fullResult: r.result, meta: { ...r.meta, report_date: date } })
      setHistory(getHistory())
      setResults([{ mode: 'daily_closing', result: r.result, meta: { ...r.meta, report_date: date } }])
    } catch (err) {
      toast.error('Could not load that date')
    } finally {
      setRunning(false)
      setRerunDate('')
    }
  }

  // TODO 3: Toggle auto-schedule
  const toggleAutoSchedule = async () => {
    setTogglingSchedule(true)
    try {
      const newVal = !autoSchedule
      const { error } = await supabase.from('profiles').update({ daily_briefing: newVal }).eq('id', profile!.id)
      if (error) throw error
      setAutoSchedule(newVal)
      await refreshProfile()
      toast.success(newVal ? 'Auto daily report turned ON' : 'Auto daily report turned OFF')
    } catch (err) {
      toast.error('Could not update schedule')
    } finally {
      setTogglingSchedule(false)
    }
  }

  const reset = () => { stopListening(); setSelected(new Set()); setText(''); setResults([]); setOpen(false); setHistoryDetail(null); setShowHistory(false) }

  const repeatLastTask = () => {
    if (!lastUsedTask) return
    setOpen(true); setSelected(new Set([lastUsedTask as QuickTaskMode]))
    const def = TASKS.find((t) => t.id === lastUsedTask)
    if (def?.needsText) setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const shareResult = (mode: string, result: string) => {
    if (mode === 'daily_closing' || mode === 'low_stock_alert' || mode === 'hindi_bot')
      window.open(buildWhatsappLink(undefined, result), '_blank')
    else
      copyToClipboard(result).then((ok) => ok ? toast.success('Copied!') : toast.error('Copy failed'))
  }

  // ── IST time display for schedule ──────────────────────────────
  const reportTimeIST = (() => {
    if (!profile?.report_time_utc) return '10:30 PM'
    const [h, m] = profile.report_time_utc.split(':').map(Number)
    let istMin = (h * 60 + m) + (5 * 60 + 30)
    if (istMin >= 24 * 60) istMin -= 24 * 60
    const ih = Math.floor(istMin / 60)
    const ampm = ih >= 12 ? 'PM' : 'AM'
    const h12 = ih % 12 || 12
    return `${h12}:${String(istMin % 60).padStart(2, '0')} ${ampm}`
  })()

  return (
    <>
      {/* Repeat last task shortcut */}
      {!open && lastUsedTask && (
        <button onClick={repeatLastTask} className="fixed z-40 px-4 py-2.5 rounded-full bg-slate-800/90 backdrop-blur border border-brand-600/40 text-brand-300 text-sm font-medium shadow-lg hover:bg-slate-700 transition-all flex items-center gap-2" style={{ bottom: '5.5rem', right: '1.25rem' }}>
          <Zap className="w-4 h-4" /> Repeat: {TASKS.find((t) => t.id === lastUsedTask)?.label || 'Last'}
        </button>
      )}

      {/* Floating button */}
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-900/40 flex items-center justify-center hover:scale-105 transition-transform group" title="Quick Actions">
          <Zap className="w-6 h-6 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-950 animate-pulse" />
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" onClick={reset}>
          <div className="card w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-700/50" onClick={(e) => e.stopPropagation()}>

            {/* ── History detail overlay ──────────────────────────── */}
            {historyDetail ? (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2"><History className="w-4 h-4 text-brand-400" /> {historyDetail.label}</h2>
                  <button onClick={() => setHistoryDetail(null)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-xs text-slate-500 mb-3">{new Date(historyDetail.timestamp).toLocaleString()}</p>
                <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
                  <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(historyDetail.fullResult) }} />
                </div>
                <button onClick={() => { copyToClipboard(historyDetail.fullResult).then(() => toast.success('Copied!')) }} className="btn-secondary w-full mt-4 text-sm"><Copy className="w-4 h-4" /> Copy result</button>
              </div>
            ) : results.length > 0 ? (
              /* ── Results view ──────────────────────────────────── */
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-400" /> Done</h2>
                  <div className="flex items-center gap-2">
                    {/* TODO 2: history toggle */}
                    {history.length > 0 && (
                      <button onClick={() => setShowHistory(!showHistory)} className={`text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${showHistory ? 'bg-brand-600/20 text-brand-300' : 'text-slate-500 hover:text-white'}`}>
                        <History className="w-3.5 h-3.5" /> Recent
                      </button>
                    )}
                    <button onClick={reset} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                </div>

                {/* TODO 2: History panel */}
                {showHistory && history.length > 0 && (
                  <div className="mb-4 space-y-1.5 animate-fade-in">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Last {history.length} runs</p>
                    {history.map((h, i) => (
                      <button key={i} onClick={() => setHistoryDetail(h)} className="w-full p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 text-left transition-all flex items-center gap-3">
                        <span className="text-lg flex-shrink-0">{TASKS.find(t => t.id === h.mode)?.icon ? '' : '\u2728'}</span>
                        {(() => { const d = TASKS.find(t => t.id === h.mode); return d ? <d.icon className={`w-4 h-4 ${d.iconColor} flex-shrink-0`} /> : null })()}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{h.label}</p>
                          <p className="text-xs text-slate-500 truncate">{h.resultPreview.slice(0, 60)}</p>
                        </div>
                        <span className="text-xs text-slate-600 flex-shrink-0">{relativeTime(h.timestamp)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Results */}
                <div className="space-y-4">
                  {results.map((r, i) => {
                    const def = TASKS.find((t) => t.id === r.mode)
                    const shareable = ['daily_closing', 'low_stock_alert', 'hindi_bot'].includes(r.mode)
                    return (
                      <div key={i} className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {def && <def.icon className={`w-4 h-4 ${def.iconColor}`} />}
                            <h3 className="font-semibold text-white text-sm">{def?.label || r.mode}</h3>
                            {r.meta?.report_date && <span className="text-xs text-slate-500">{r.meta.report_date}</span>}
                          </div>
                          <button onClick={() => shareResult(r.mode, r.result)} className="btn-ghost text-xs">{shareable ? <Send className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
                        </div>
                        <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(r.result) }} />
                        {r.meta?.items?.length > 0 && <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-500">{r.meta.items.length} items flagged</div>}
                        {r.meta?.invoice && <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-green-400">Invoice {r.meta.invoice.invoice_number} created - Rs.{r.meta.invoice.total}</div>}

                        {/* TODO 1: "View past report" — date rerun for daily_closing */}
                        {r.mode === 'daily_closing' && (
                          <div className="mt-3 pt-3 border-t border-slate-800">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-xs text-slate-400">View another day</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => rerunForDate(yesterdayIST())} disabled={running} className="btn-ghost text-xs whitespace-nowrap">
                                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />} Yesterday
                              </button>
                              <input type="date" value={rerunDate} max={yesterdayIST()} onChange={(e) => setRerunDate(e.target.value)} className="input-field text-xs py-1.5 flex-1" />
                              <button onClick={() => rerunDate && rerunForDate(rerunDate)} disabled={running || !rerunDate} className="btn-secondary text-xs">Go</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <button onClick={() => { setResults([]); setSelected(new Set()); setText('') }} className="btn-secondary w-full mt-4 text-sm">Run more tasks</button>
              </div>
            ) : (
              /* ── Task picker view ─────────────────────────────── */
              <div className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2"><Zap className="w-5 h-5 text-brand-400" /> Quick Actions</h2>
                  <div className="flex items-center gap-2">
                    {history.length > 0 && (
                      <button onClick={() => setShowHistory(!showHistory)} className={`text-xs px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${showHistory ? 'bg-brand-600/20 text-brand-300' : 'text-slate-500 hover:text-white'}`}>
                        <History className="w-3.5 h-3.5" /> History
                      </button>
                    )}
                    <button onClick={reset} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-5">Pick one or more — tasks run after you confirm</p>

                {/* TODO 2: Inline history in picker */}
                {showHistory && history.length > 0 && (
                  <div className="mb-5 space-y-1.5 animate-fade-in">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Recent</p>
                    {history.slice(0, 5).map((h, i) => (
                      <button key={i} onClick={() => setHistoryDetail(h)} className="w-full p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 text-left transition-all flex items-center gap-3">
                        {(() => { const d = TASKS.find(t => t.id === h.mode); return d ? <d.icon className={`w-4 h-4 ${d.iconColor} flex-shrink-0`} /> : <Sparkles className="w-4 h-4 flex-shrink-0" /> })()}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 truncate">{h.label}</p>
                          <p className="text-xs text-slate-500 truncate">{h.resultPreview.slice(0, 50)}</p>
                        </div>
                        <span className="text-xs text-slate-600">{relativeTime(h.timestamp)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Task cards */}
                <div className="space-y-2 mb-4">
                  {visibleTasks.map((t) => {
                    const on = selected.has(t.id)
                    return (
                      <div key={t.id}>
                        <button onClick={() => toggle(t.id)} className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 ${on ? 'border-brand-600 bg-brand-600/10' : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'}`}>
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center flex-shrink-0`}><t.icon className={`w-5 h-5 ${t.iconColor}`} /></div>
                          <div className="flex-1 min-w-0"><p className="font-semibold text-white text-sm">{t.label}</p><p className="text-xs text-slate-400">{t.desc}</p></div>
                          {on && <CheckCircle2 className="w-5 h-5 text-brand-400 flex-shrink-0" />}
                        </button>

                        {/* TODO 3: Auto-schedule toggle on daily_closing */}
                        {t.id === 'daily_closing' && (
                          <div className="mt-1.5 ml-1 p-2.5 rounded-lg bg-slate-900/30 border border-slate-800/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Bell className={`w-3.5 h-3.5 ${autoSchedule ? 'text-green-400' : 'text-slate-600'}`} />
                              <div>
                                <p className="text-xs text-slate-300">Auto-run daily at {reportTimeIST} IST</p>
                                <p className="text-[10px] text-slate-600">{autoSchedule ? 'Report arrives on WhatsApp automatically' : 'Tap to enable automatic daily reports'}</p>
                              </div>
                            </div>
                            <button onClick={toggleAutoSchedule} disabled={togglingSchedule} className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${autoSchedule ? 'bg-green-500' : 'bg-slate-700'}`}>
                              {togglingSchedule ? <Loader2 className="absolute inset-0 m-auto w-3 h-3 animate-spin text-white" /> : <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoSchedule ? 'translate-x-5' : 'translate-x-0.5'}`} />}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* More options */}
                {!showMore && secondaryTasks.length > 0 && (
                  <button onClick={() => setShowMore(true)} className="btn-ghost text-xs w-full mb-4"><ChevronDown className="w-3.5 h-3.5" /> More options</button>
                )}
                {showMore && <button onClick={() => setShowMore(false)} className="btn-ghost text-xs w-full mb-4"><ChevronUp className="w-3.5 h-3.5" /> Show less</button>}

                {/* Text + voice */}
                {(() => {
                  const anyNeedsText = Array.from(selected).some((id) => TASKS.find((t) => t.id === id)?.needsText)
                  const activeDef = TASKS.find((t) => selected.has(t.id) && t.needsText)
                  if (selected.size === 0) return null
                  return (
                    <div className="mb-4">
                      <label className="label flex items-center justify-between">
                        <span>{activeDef?.textLabel || 'Optional input'}</span>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => setVoiceLang(voiceLang === 'hi-IN' ? 'en-IN' : 'hi-IN')} className="text-xs text-slate-500 hover:text-brand-400 flex items-center gap-1" title="Toggle language"><Globe className="w-3.5 h-3.5" /> {voiceLang === 'hi-IN' ? 'HI' : 'EN'}</button>
                          {!listening ? (
                            <button type="button" onClick={startListening} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"><Mic className="w-3.5 h-3.5" /> Speak</button>
                          ) : (
                            <button type="button" onClick={stopListening} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 animate-pulse"><Square className="w-3.5 h-3.5" /> Stop</button>
                          )}
                        </div>
                      </label>
                      <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} rows={anyNeedsText ? 3 : 2} className="input-field resize-none" placeholder={activeDef?.textPlaceholder || 'Add details...'} />
                      {listening && <p className="text-xs text-red-400 mt-1 animate-pulse">Listening in {voiceLang === 'hi-IN' ? 'Hindi' : 'English'}...</p>}
                    </div>
                  )
                })()}

                <button onClick={runAll} disabled={running || selected.size === 0} className="btn-primary w-full py-3">
                  {running ? <><Loader2 className="w-5 h-5 animate-spin" /> Working...</> : <><CheckCircle2 className="w-5 h-5" /> Confirm & Run {selected.size > 0 && `(${selected.size})`}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
