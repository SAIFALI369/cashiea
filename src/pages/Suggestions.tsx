import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { askAssistant } from '../lib/ai'
import { renderMd } from '../lib/markdown'
import PageHeader from '../components/ui/PageHeader'
import { Lightbulb, Loader2, Check, Trash2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface Pred {
  id: string; title: string; description: string | null
  priority: string | null; prediction_type: string | null
  status: string; created_at: string; action_payload?: any
}

const PRIO: Record<string, string> = {
  urgent: 'bg-negative/10 text-negative',
  high: 'bg-warning/10 text-warning',
  medium: 'bg-accent-soft text-accent',
  low: 'bg-surface-2 text-fg-muted',
}
const TYPE_LABEL: Record<string, string> = {
  reorder: 'Reorder', followup: 'Follow up', invoice: 'Invoice',
  offer: 'Offer', alert: 'Alert', expense: 'Expense', custom: 'Idea',
}
const dotFor = (p: string) => (p === 'urgent' ? 'bg-negative' : p === 'high' ? 'bg-warning' : 'bg-accent')
const outcomeOf = (p: Pred) => {
  const o = p.action_payload?.outcome
  return typeof o === 'string' && o.trim() ? o : ''
}

export default function Suggestions() {
  const { ownerId } = useAuth()
  const [items, setItems] = useState<Pred[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'done'>('pending')
  const [runningId, setRunningId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ai_predictions')
      .select('id,title,description,priority,prediction_type,status,created_at,action_payload')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(60)
    setItems((data as Pred[]) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [ownerId])

  // Dismiss = DELETE the suggestion entirely (it disappears from every tab).
  const dismiss = async (p: Pred) => {
    const { error } = await supabase.from('ai_predictions').delete().eq('id', p.id)
    if (error) { toast.error('Could not delete'); return }
    setItems((cur) => cur.filter((x) => x.id !== p.id))
    toast.success('Deleted')
  }

  // Approve = RUN it: Meraj executes the suggestion against the live business
  // data and returns a concrete outcome (draft message / reorder list / etc.),
  // which is stored on the prediction and shown in the card.
  const run = async (p: Pred) => {
    if (runningId) return
    setRunningId(p.id)
    try {
      const { error } = await supabase.from('ai_predictions').update({ status: 'approved' }).eq('id', p.id)
      if (error) throw new Error(error.message)
      const res = await askAssistant(
        `I approved your suggestion: "${p.title}". ${p.description || ''} Execute it now using my business data and give me the concrete outcome I can use directly: if it's a follow-up, write the exact message and who to send it to; if it's a reorder, list the items and quantities; if it's an offer, write the offer message; if it's an alert, tell me exactly what to check and why. Keep it short and actionable — no preamble.`,
        false, undefined, 'ask'
      )
      const outcome = (res.reply || '').trim() || 'Done — no further detail was needed.'
      await supabase
        .from('ai_predictions')
        .update({ status: 'executed', action_payload: { ...(p.action_payload || {}), outcome } })
        .eq('id', p.id)
      setItems((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: 'executed', action_payload: { ...(x.action_payload || {}), outcome } } : x)))
      toast.success('Done — outcome ready')
      setFilter('done')
    } catch (e) {
      // Keep it approved so the owner can retry; surface the error.
      setItems((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: 'approved' } : x)))
      toast.error(e instanceof Error ? e.message : 'Could not run it — try again')
    } finally {
      setRunningId(null)
    }
  }

  const pending = items.filter((p) => p.status === 'pending')
  const done = items.filter((p) => p.status === 'executed' || p.status === 'approved')
  const shown = filter === 'pending' ? pending : done

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader title="Suggestions" subtitle="Smart recommendations from Meraj — approve one and Meraj runs it." icon={<Lightbulb className="w-5 h-5" />} />

      {/* Tabs + counts */}
      <div className="flex items-center gap-2 mb-4">
        {(['pending', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? 'bg-fg text-paper border-fg' : 'bg-surface text-fg-muted border-line hover:text-fg'
            }`}
          >
            {f === 'pending' ? 'Pending' : 'Done'}
            <span className={`text-[10px] ${filter === f ? 'opacity-70' : 'text-fg-subtle'}`}>{f === 'pending' ? pending.length : done.length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-fg-subtle" /></div>
      ) : shown.length === 0 ? (
        <div className="card p-8 text-center">
          <Lightbulb className="w-8 h-8 text-fg-subtle mx-auto mb-3" />
          <p className="text-sm font-medium text-fg">{filter === 'pending' ? 'No pending suggestions right now' : 'Nothing run yet'}</p>
          <p className="text-xs text-fg-subtle mt-1">
            {filter === 'pending'
              ? 'Meraj generates fresh suggestions every morning and surfaces them here.'
              : 'Approve a suggestion on the Pending tab — Meraj will run it and show the outcome here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((p) => {
            const isRunning = runningId === p.id
            const outcome = outcomeOf(p)
            return (
              <div key={p.id} className={`card p-4 ${p.status !== 'pending' && !outcome ? 'opacity-70' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotFor(p.priority || 'low')}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-fg">{p.title}</h3>
                      {p.priority && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIO[p.priority] || PRIO.low}`}>{p.priority}</span>
                      )}
                      {p.prediction_type && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-2 text-fg-muted">
                          {TYPE_LABEL[p.prediction_type] || p.prediction_type}
                        </span>
                      )}
                      {p.status === 'executed' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-positive/10 text-positive inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Ran
                        </span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-fg-muted mt-1 leading-relaxed">{p.description}</p>}

                    {/* Outcome — what Meraj actually produced when it ran */}
                    {outcome && (
                      <div className="mt-3 rounded-control border border-accent/30 bg-accent-soft/40 p-3">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-accent" />
                          <p className="text-[10px] font-bold uppercase tracking-wide text-accent">Meraj ran it — outcome</p>
                        </div>
                        <div className="prose-content text-sm text-fg" dangerouslySetInnerHTML={{ __html: renderMd(outcome) }} />
                      </div>
                    )}

                    {p.status === 'pending' ? (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => run(p)}
                          disabled={!!runningId}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-fg text-paper rounded-control px-3 h-8 hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {isRunning ? 'Meraj is running it…' : 'Do it'}
                        </button>
                        <button
                          onClick={() => dismiss(p)}
                          disabled={!!runningId}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold border border-line text-fg-muted rounded-control px-3 h-8 hover:text-negative hover:border-negative/40 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    ) : p.status === 'approved' && !outcome ? (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => run(p)} disabled={!!runningId} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-fg text-paper rounded-control px-3 h-8 hover:opacity-90 disabled:opacity-50 transition-opacity">
                          {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Retry
                        </button>
                        <button onClick={() => dismiss(p)} className="inline-flex items-center gap-1.5 text-xs font-semibold border border-line text-fg-muted rounded-control px-3 h-8 hover:text-negative transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
