import { useState } from 'react'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { motion, AnimatePresence } from 'framer-motion'
import { askAssistant, runQuickTask, type QuickTaskMode } from '../lib/ai'
import { Search, Send, Loader2, Sparkles, AlertTriangle, FileBarChart, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'

const QUICK: { id: QuickTaskMode; label: string; icon: typeof Search }[] = [
  { id: 'daily_closing', label: 'Daily closing', icon: FileBarChart },
  { id: 'low_stock_alert', label: 'Low stock', icon: AlertTriangle },
  { id: 'gst_invoice_voice', label: 'GST invoice', icon: Receipt },
]

function render(md: string) {
  return DOMPurify.sanitize(marked.parse(md, { async: false }) as string, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'code', 'a'],
    ALLOWED_ATTR: ['href'],
  })
}

/** Docked, always-visible "Do Anything" command bar (the old floating quick-action bar, redrawn). */
export default function DoAnythingBar() {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState<string | null>(null)

  const run = async (text: string) => {
    if (!text || loading) return
    setLoading(true)
    setAnswer(null)
    try {
      setAnswer(await askAssistant(text))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const quick = async (id: QuickTaskMode, label: string) => {
    if (loading) return
    setLoading(true)
    setAnswer(null)
    try {
      const r = await runQuickTask(id)
      setAnswer(`**${label}**\n\n${r.result}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="card flex items-center gap-2 p-2 pl-4 shadow-soft">
        <Search className="w-5 h-5 text-fg-subtle flex-shrink-0" strokeWidth={1.75} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run(q)}
          placeholder="Do anything — ask Meraj, run a report, check stock…"
          className="flex-1 bg-transparent outline-none text-sm text-fg placeholder:text-fg-subtle"
        />
        <button onClick={() => run(q)} disabled={loading || !q.trim()} className="btn-primary px-3.5 h-9 text-sm" aria-label="Run">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {QUICK.map((t) => (
          <button
            key={t.id}
            onClick={() => quick(t.id, t.label)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-line bg-surface text-fg-muted hover:text-fg hover:border-line-2 transition-all disabled:opacity-50"
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {answer && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="card mt-4 p-4 border-l-2 border-l-accent"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-fg-subtle">Meraj</span>
            </div>
            <div className="prose-content text-sm" dangerouslySetInnerHTML={{ __html: render(answer) }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
