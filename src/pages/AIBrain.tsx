import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { callBrain } from '../lib/ai'
import type { BusinessMemory, Prediction, Correction } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Brain, Loader2, RefreshCw, CheckCircle2, XCircle, Sparkles, Lightbulb, TrendingUp, GraduationCap, ArrowRight, X, Plug } from 'lucide-react'
import toast from 'react-hot-toast'

const priorityColor: Record<string, string> = {
  urgent: 'border-negative/50 bg-negative/5',
  high: 'border-orange-600/50 bg-orange-600/5',
  medium: 'border-warning/40 bg-warning/5',
  low: 'border-slate-700 bg-slate-900/40',
}
const priorityBadge: Record<string, string> = {
  urgent: 'bg-negative/15 text-negative',
  high: 'bg-orange-500/15 text-orange-400',
  medium: 'bg-warning/15 text-warning',
  low: 'bg-slate-700 text-slate-400',
}
const typeIcon: Record<string, string> = {
  reorder: '📦', followup: '🔄', invoice: '🧾', offer: '🏷️', alert: '⚠️', expense: '💸', custom: '✨',
}

export default function AIBrain() {
  const { profile, ownerId } = useAuth()
  const [memory, setMemory] = useState<BusinessMemory | null>(null)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [loading, setLoading] = useState(true)
  const [learning, setLearning] = useState(false)
  const [predicting, setPredicting] = useState(false)
  const [showCorrect, setShowCorrect] = useState<Prediction | null>(null)
  const [correctionText, setCorrectionText] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [mem, preds, cors] = await Promise.all([
      supabase.from('business_memory').select('*').eq('user_id', ownerId).maybeSingle(),
      supabase.from('ai_predictions').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(30),
      supabase.from('ai_corrections').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(10),
    ])
    setMemory((mem.data as BusinessMemory) || null)
    setPredictions((preds.data as Prediction[]) || [])
    setCorrections((cors.data as Correction[]) || [])
    setLoading(false)
  }

  const learn = async () => {
    setLearning(true)
    try {
      const result = await callBrain('learn', {})
      if (result.memory) setMemory(result.memory)
      toast.success('AI learned about your business and updated the summary')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Learning failed')
    } finally {
      setLearning(false)
    }
  }

  const predict = async () => {
    setPredicting(true)
    try {
      const result = await callBrain('predict', {})
      if (result.predictions?.length) {
        await loadData()
        toast.success(`AI predicted ${result.predictions.length} tasks — review & approve`)
      } else {
        toast('No new predictions right now — try again later.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Prediction failed')
    } finally {
      setPredicting(false)
    }
  }

  const decide = async (p: Prediction, status: 'approved' | 'denied' | 'dismissed', feedback?: string) => {
    const { error } = await supabase.from('ai_predictions').update({
      status, decided_at: new Date().toISOString(), owner_feedback: feedback || null,
    }).eq('id', p.id)
    if (error) { toast.error(error.message); return }

    // If denied with feedback, store a correction so the AI learns
    if (status === 'denied' && feedback) {
      try {
        await callBrain('correct', {
          category: 'prediction',
          context: `Prediction: "${p.title}" — ${p.description || ''}`,
          correction: feedback,
        })
        toast.success('Denied — AI noted your feedback and will adjust')
      } catch { /* correction is best-effort */ }
    } else if (status === 'approved') {
      toast.success('Approved — you can action this now')
    }
    await loadData()
  }

  const saveCorrection = async () => {
    if (!showCorrect || !correctionText.trim()) return
    await decide(showCorrect, 'denied', correctionText)
    setShowCorrect(null); setCorrectionText('')
  }

  const pending = predictions.filter((p) => p.status === 'pending')
  const decided = predictions.filter((p) => p.status !== 'pending').slice(0, 8)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="AI Brain"
        subtitle="Your AI learns your business, predicts tasks, and asks before acting"
        icon={<Brain className="w-5 h-5" />}
        action={
          <div className="flex gap-2">
            <button onClick={predict} disabled={predicting} className="btn-secondary text-sm"><Lightbulb className="w-4 h-4" /> {predicting ? 'Thinking...' : 'Predict tasks'}</button>
            <button onClick={learn} disabled={learning} className="btn-primary text-sm">{learning ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />} {learning ? 'Learning...' : 'Re-learn'}</button>
          </div>
        }
      />

      {/* About My Business — the living summary */}
      <div className="card p-4 mb-6 bg-gradient-to-br from-accent-strong/10 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> About My Business</h2>
          {memory?.last_updated_at && <span className="text-xs text-slate-500">Updated {new Date(memory.last_updated_at).toLocaleString()}</span>}
        </div>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : !memory?.summary ? (
          <div className="text-center py-6">
            <p className="text-slate-400 mb-4">The AI hasn't learned about your business yet. Connect your data sources and let it study your shop.</p>
            <div className="flex justify-center gap-3">
              <Link to="/app/integrations" className="btn-secondary text-sm"><Plug className="w-4 h-4" /> Connect data sources</Link>
              <button onClick={learn} disabled={learning} className="btn-primary text-sm">{learning ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />} Learn from existing data</button>
            </div>
          </div>
        ) : (
          <>
            {memory.business_type && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-strong/15 text-accent-strong text-xs font-medium mb-3">
                <TrendingUp className="w-3.5 h-3.5" /> {memory.business_type}
              </div>
            )}
            <p className="text-slate-200 leading-relaxed">{memory.summary}</p>
            {memory.key_facts?.length > 0 && (
              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                {memory.key_facts.slice(0, 6).map((f, i) => (
                  <div key={i} className="bg-slate-900/60 rounded-lg p-2.5 flex items-start gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${f.confidence === 'high' ? 'bg-positive' : f.confidence === 'medium' ? 'bg-warning' : 'bg-slate-500'}`} />
                    <div>
                      <p className="text-sm text-slate-200">{f.fact}</p>
                      <p className="text-xs text-slate-600 capitalize">{f.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Predictions pending approval */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white flex items-center gap-2"><Lightbulb className="w-5 h-5 text-warning" /> Predicted Tasks <span className="text-xs text-slate-500 font-normal">({pending.length} pending)</span></h2>
          <button onClick={predict} disabled={predicting} className="btn-ghost text-xs"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
        </div>
        <p className="text-xs text-slate-500 mb-4">The AI predicts what needs doing. Nothing happens until you approve it. If you deny with a reason, the AI learns.</p>

        {pending.length === 0 ? (
          <EmptyState icon={Lightbulb} title="No pending predictions" description="Click 'Predict tasks' to let the AI scan your business and suggest actions. It waits for your approval before doing anything." />
        ) : (
          <div className="space-y-3">
            {pending.map((p) => (
              <div key={p.id} className={`card p-4 border ${priorityColor[p.priority] || priorityColor.medium}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">{typeIcon[p.prediction_type] || '✨'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white">{p.title}</h3>
                        <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${priorityBadge[p.priority]}`}>{p.priority}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-surface-2 text-slate-400 capitalize">{p.prediction_type}</span>
                      </div>
                      {p.description && <p className="text-sm text-slate-300 mt-1">{p.description}</p>}
                      {p.rationale && <p className="text-xs text-slate-500 mt-1.5 italic">Why: {p.rationale}</p>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3 justify-end">
                  <button onClick={() => setShowCorrect(p)} className="btn-ghost text-xs text-negative hover:text-negative">Deny & teach</button>
                  <button onClick={() => decide(p, 'dismissed')} className="btn-ghost text-xs">Dismiss</button>
                  <button onClick={() => decide(p, 'denied')} className="btn-secondary text-xs"><XCircle className="w-3.5 h-3.5" /> Deny</button>
                  <button onClick={() => decide(p, 'approved')} className="btn-primary text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Approve</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent decisions */}
      {decided.length > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold text-white mb-3 text-sm">Recent decisions</h3>
          <div className="space-y-2">
            {decided.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{typeIcon[p.prediction_type]}</span>
                  <span className="text-slate-300 truncate">{p.title}</span>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded capitalize flex-shrink-0 ml-2 ${
                  p.status === 'approved' ? 'bg-positive/15 text-positive' :
                  p.status === 'denied' ? 'bg-negative/15 text-negative' :
                  'bg-slate-700 text-slate-400'
                }`}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning log */}
      {corrections.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-white mb-1 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-accent" /> What the AI has learned from you</h3>
          <p className="text-xs text-slate-500 mb-3">These corrections shape future predictions and summaries.</p>
          <div className="space-y-2">
            {corrections.map((c) => (
              <div key={c.id} className="bg-slate-900/60 rounded-lg p-2.5 text-sm">
                {c.context && <p className="text-xs text-slate-500 mb-0.5">{c.context}</p>}
                <p className="text-slate-200">{c.correction}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deny-with-reason modal */}
      {showCorrect && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCorrect(null)}>
          <div className="card p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">Teach the AI</h3>
              <button onClick={() => setShowCorrect(null)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-slate-400 mb-2">You're denying: <span className="text-white">{showCorrect.title}</span></p>
            <p className="text-sm text-slate-400 mb-3">Tell the AI what it should have done or considered instead. It'll apply this to future predictions.</p>
            <textarea value={correctionText} onChange={(e) => setCorrectionText(e.target.value)} rows={4} className="input-field resize-none" placeholder="e.g. Don't suggest reordering on weekends — supplier is closed. Or: This customer prefers email, not SMS." />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => decide(showCorrect, 'denied')} className="btn-secondary text-sm">Deny without teaching</button>
              <button onClick={saveCorrection} disabled={!correctionText.trim()} className="btn-primary text-sm">Deny & teach AI <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
