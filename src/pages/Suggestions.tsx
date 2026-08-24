import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { Lightbulb, Loader2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface Pred {
  id: string; title: string; description: string | null
  priority: string | null; prediction_type: string | null; status: string; created_at: string
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
  const [filter, setFilter] = useState<'pending' | 'done' | 'all'>('pending')

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ai_predictions')
      .select('id,title,description,priority,prediction_type,status,created_at')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(60)
    setItems((data as Pred[]) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [ownerId])

  const act = async (p: Pred, status: 'approved' | 'dismissed') => {
    const { error } = await supabase.from('ai_predictions').update({ status }).eq('id', p.id)
    if (error) { toast.error('Could not update'); return }
    setItems((cur) => cur.map((x) => (x.id === p.id ? { ...x, status } : x)))
    toast.success(status === 'approved' ? 'Marked as done' : 'Dismissed')
  }

  const shown = items.filter((p) =>
    filter === 'all' ? true : filter === 'pending' ? p.status === 'pending' : p.status !== 'pending'
  )

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader title="Suggestions" subtitle="Smart recommendations from Meraj, based on your business." icon={<Lightbulb className="w-5 h-5" />} />

      <div className="flex gap-2 mb-4">
        {(['pending', 'done', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              filter === f ? 'bg-fg text-paper border-fg' : 'bg-surface text-fg-muted border-line hover:text-fg'
            }`}
          >
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
          <p className="text-xs text-fg-subtle mt-1">Meraj generates fresh suggestions every evening and surfaces them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((p) => (
            <div key={p.id} className={`card p-4 ${p.status !== 'pending' ? 'opacity-60' : ''}`}>
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
                  </div>
                  {p.description && <p className="text-xs text-fg-muted mt-1 leading-relaxed">{p.description}</p>}
                  {p.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => act(p, 'approved')} className="inline-flex items-center gap-1 text-xs font-semibold bg-fg text-paper rounded-control px-2.5 h-7 hover:opacity-90 transition-opacity">
                        <Check className="w-3.5 h-3.5" /> Done
                      </button>
                      <button onClick={() => act(p, 'dismissed')} className="inline-flex items-center gap-1 text-xs font-semibold border border-line text-fg-muted rounded-control px-2.5 h-7 hover:text-negative transition-colors">
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
    </div>
  )
}
