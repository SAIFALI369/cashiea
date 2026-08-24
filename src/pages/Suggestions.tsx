import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { askAssistant } from '../lib/ai'
import PageHeader from '../components/ui/PageHeader'
import { Lightbulb, Loader2, Check, X, Sparkles, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface Pred {
  id: string; title: string; description: string | null
  priority: string | null; prediction_type: string | null; status: string; created_at: string
  action_payload?: { outcome?: string } | null
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

export default function Suggestions() {
  const { ownerId } = useAuth()
  const [items, setItems] = useState<Pred[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [filter, setFilter] = useState<'pending' | 'done' | 'all'>('pending')

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

  // Dismiss = DELETE permanently (not just a status change, so it never lingers).
  const dismiss = async (p: Pred) => {
    const { error } = await supabase.from('ai_predictions').delete().eq('id', p.id)
    if (error) { toast.error('Could not dismiss'); return }
    setItems((cur) => cur.filter((x) => x.id !== p.id))
    toast.success('Dismissed')
  }

  // Accept = hand the recommendation to Meraj to actually DO it (task mode),
  // then show Meraj's outcome on the card and persist it.
  const accept = async (p: Pred) => {
    setRunning(p.id)
    try {
      const instruction = `Act on this business recommendation now: "${p.title}".${p.description ? ' ' + p.description : ''} Carry it out or prepare it — create the invoice, product, or customer, or send the message, whichever applies.`
      const res = await askAssistant(instruction, false, undefined, 'task')
      const outcome = res.reply || 'Done.'
      const { error } = await supabase
        .from('ai_predictions')
        .update({ status: 'approved', action_payload: { outcome } })
        .eq('id', p.id)
      if (error) throw error
      setItems((cur) => cur.map((x) => (x.id === p.id ? { ...x, status: 'approved', action_payload: { outcome } } : x)))
      toast.success('Meraj handled it')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not run')
    } finally {
      setRunning(null)
    }
  }

  const shown = items.filter((p) =>
    filter === 'all' ? true : filter === 'pending' ? p.status === 'pending' : p.status === 'approved'
  )

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader title="Suggestions" subtitle="Smart recommendations from Meraj — accept to put Meraj on it, or dismiss." icon={<Lightbulb className="w-5 h-5" />} />

      <div className="flex gap-2 mb-4">
        {(['pending', 'done', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filter === f ? 'bg-fg text-paper border-fg' : 'bg-surface text-fg-muted border-line hover:text-fg'}`}>
            {f === 'pending' ? 'Pending' : f === 'done' ? 'Done' : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-fg-subtle" /></div>
      ) : shown.length === 0 ? (
        <div className="card p-8 text-center">
          <Lightbulb className="w-8 h-8 text-fg-subtle mx-auto mb-3" />
          <p className="text-sm font-medium text-fg">No {filter === 'pending' ? 'pending' : filter} suggestions right now</p>
          <p className="text-xs text-fg-subtle mt-1">Meraj generates fresh suggestions every morning and surfaces them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotFor(p.priority || 'low')}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-fg">{p.title}</h3>
                    {p.priority && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIO[p.priority] || PRIO.low}`}>{p.priority}</span>}
                    {p.prediction_type && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-2 text-fg-muted">{TYPE_LABEL[p.prediction_type] || p.prediction_type}</span>}
                    {p.status === 'approved' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-positive/10 text-positive">Done</span>}
                  </div>
                  {p.status === 'pending' && p.description && <p className="text-xs text-fg-muted mt-1 leading-relaxed">{p.description}</p>}

                  {p.status === 'approved' && (
                    <div className="mt-2 rounded-control bg-accent-soft/50 border border-accent/20 p-2.5 flex gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-fg leading-relaxed whitespace-pre-wrap">{p.action_payload?.outcome || 'Meraj handled this.'}</p>
                    </div>
                  )}

                  {p.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => accept(p)} disabled={running === p.id} className="inline-flex items-center gap-1 text-xs font-semibold bg-fg text-paper rounded-control px-2.5 h-7 hover:opacity-90 disabled:opacity-50 transition-opacity">
                        {running === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} {running === p.id ? 'Meraj working…' : 'Accept'}
                      </button>
                      <button onClick={() => dismiss(p)} className="inline-flex items-center gap-1 text-xs font-semibold border border-line text-fg-muted rounded-control px-2.5 h-7 hover:text-negative transition-colors">
                        <X className="w-3.5 h-3.5" /> Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/app/assistant" className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">Ask Meraj for more ideas <ArrowRight className="w-3.5 h-3.5" /></Link>
      </div>
    </div>
  )
}
