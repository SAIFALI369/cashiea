import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase, AI_FUNCTION_URL } from '../lib/supabase'
import type { FailedJob } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import {
  AlertOctagon, RefreshCw, Loader2, ChevronDown, ChevronUp,
  Wrench, Clock, CheckCircle2, XCircle, ArrowRight, X,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Root-cause routing: each failure type → the page that fixes it ──
interface RootCause {
  title: string
  explanation: string
  fixLabel: string
  fixRoute: string // where the "Fix this" button goes
  fixable: boolean
}

function diagnose(job: FailedJob): RootCause {
  const err = (job.error || '').toLowerCase()
  const type = job.job_type

  // WhatsApp / message delivery failures
  if (err.includes('whatsapp') || err.includes('wa api') || type === 'daily_report' || type === 'reminder') {
    if (err.includes('not configured') || err.includes('whatsapp_token') || err.includes('phone_number_id')) {
      return {
        title: 'WhatsApp Cloud API not connected',
        explanation: 'Your daily reports and reminders can\u2019t be delivered because the WhatsApp Business API isn\u2019t set up yet. Connect it once in Integrations and every report will deliver automatically.',
        fixLabel: 'Connect WhatsApp',
        fixRoute: '/app/integrations',
        fixable: true,
      }
    }
    if (err.includes('invalid') || err.includes('number') || err.includes('recipient')) {
      return {
        title: 'Invalid WhatsApp number',
        explanation: 'The WhatsApp number on file is missing or invalid. Reports need a real, WhatsApp-active number with country code (e.g. +91 98765 43210).',
        fixLabel: 'Update my number',
        fixRoute: '/app/settings',
        fixable: true,
      }
    }
    if (err.includes('template') || err.includes('24h') || err.includes('window')) {
      return {
        title: 'WhatsApp 24-hour window closed',
        explanation: 'WhatsApp only lets businesses send template messages outside the 24-hour customer-reply window. This usually resolves itself, or you need an approved message template.',
        fixLabel: 'Read how it works',
        fixRoute: '/app/support',
        fixable: false,
      }
    }
    // Generic WhatsApp send error
    return {
      title: 'WhatsApp delivery failed',
      explanation: 'The report was generated successfully but couldn\u2019t be delivered via WhatsApp. Most often this is a token, number, or template issue.',
      fixLabel: 'Check WhatsApp setup',
      fixRoute: '/app/integrations',
      fixable: true,
    }
  }

  // AI / provider failures
  if (err.includes('openai') || err.includes('anthropic') || err.includes('gemini') || err.includes('ai_gateway') || err.includes('api key') || err.includes('usage limit')) {
    if (err.includes('usage limit') || err.includes('quota') || err.includes('rate')) {
      return {
        title: 'AI usage limit hit',
        explanation: 'Your plan\u2019s monthly AI action limit was reached, so this job couldn\u2019t run. Upgrade your plan to resume automation.',
        fixLabel: 'Upgrade plan',
        fixRoute: '/app/subscription',
        fixable: true,
      }
    }
    return {
      title: 'AI provider error',
      explanation: 'The AI provider returned an error (wrong key, billing issue, or service down). Check your provider setup in Settings, or switch providers.',
      fixLabel: 'Check AI provider',
      fixRoute: '/app/settings',
      fixable: true,
    }
  }

  // Google / integration failures
  if (err.includes('google') || err.includes('oauth') || err.includes('token') || err.includes('gmail')) {
    return {
      title: 'Google connection expired',
      explanation: 'The Google integration\u2019s access token expired or was revoked. Reconnect Gmail/Sheets in Integrations to resume syncing.',
      fixLabel: 'Reconnect Google',
      fixRoute: '/app/integrations',
      fixable: true,
    }
  }

  // Default / unknown
  return {
    title: 'Unexpected error',
    explanation: job.error || 'No error details were captured. Contact support if this keeps happening.',
    fixLabel: 'Contact support',
    fixRoute: '/app/support',
    fixable: false,
  }
}

// Map job_type → which edge function retries it
const RETRY_FUNCTION: Record<string, string> = {
  daily_report: 'daily-reports',
  reminder: 'invoice-reminders',
  brain: 'business-brain',
  google_sync: 'google-fetch',
}

const typeIcon: Record<string, string> = {
  daily_report: '\u{1F4CA}',
  reminder: '\u{1F514}',
  brain: '\u{1F9E0}',
  google_sync: '\u{1F50C}',
  invoice: '\u{1F9FE}',
  campaign: '\u{1F4E7}',
}

export default function FailedJobs() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<FailedJob[]>([])
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { loadJobs() }, [])

  const loadJobs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('failed_jobs')
      .select('*')
      .eq('user_id', profile!.id)
      .order('created_at', { ascending: false })
      .limit(100)
    setJobs((data as FailedJob[]) || [])
    setLoading(false)
  }

  const retry = async (job: FailedJob) => {
    setRetrying((prev) => new Set(prev).add(job.id))
    try {
      const fn = RETRY_FUNCTION[job.job_type]
      if (!fn) {
        toast.error('This job type can\u2019t be auto-retried. Fix the cause and it\u2019ll resolve.')
        return
      }
      const base = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${base}/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session!.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ user_id: profile!.id, retry: true, payload: job.payload }),
      })
      const result = await res.json().catch(() => ({ error: 'No response' }))
      if (!res.ok) throw new Error(result?.error || `Retry failed (HTTP ${res.status})`)

      // Mark as retried locally + in DB
      await supabase.from('failed_jobs').update({
        status: 'retried',
        retry_count: job.retry_count + 1,
        last_attempted_at: new Date().toISOString(),
      }).eq('id', job.id)
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: 'retried', retry_count: j.retry_count + 1 } : j))
      toast.success('Retry triggered — check back in a minute')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed — fix the cause first')
    } finally {
      setRetrying((prev) => { const n = new Set(prev); n.delete(job.id); return n })
    }
  }

  const dismiss = async (id: string) => {
    await supabase.from('failed_jobs').update({ status: 'dead' }).eq('id', id)
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status: 'dead' } : j))
    toast.success('Dismissed')
  }

  const pending = jobs.filter((j) => j.status === 'pending')
  const resolved = jobs.filter((j) => j.status !== 'pending').slice(0, 10)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Failed Jobs"
        subtitle="When something doesn\u2019t deliver, it shows up here \u2014 never silent"
        icon={<AlertOctagon className="w-5 h-5" />}
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card p-4"><p className="text-2xl font-bold text-red-400">{pending.length}</p><p className="text-xs text-slate-400">Need attention</p></div>
        <div className="card p-4"><p className="text-2xl font-bold text-amber-400">{jobs.filter((j) => j.status === 'retried').length}</p><p className="text-xs text-slate-400">Retried</p></div>
        <div className="card p-4"><p className="text-2xl font-bold text-slate-500">{jobs.filter((j) => j.status === 'dead').length}</p><p className="text-xs text-slate-400">Dismissed</p></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : pending.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="All clear"
          description="No failed jobs. Everything\u2019s delivering as it should. Failed sends (WhatsApp, emails, AI tasks) will appear here with a one-tap fix."
        />
      ) : (
        <div className="space-y-3">
          {pending.map((job) => {
            const cause = diagnose(job)
            const isOpen = expanded === job.id
            const isRetrying = retrying.has(job.id)
            return (
              <div key={job.id} className="card overflow-hidden">
                {/* Row (always visible) — tap to expand root cause */}
                <button
                  onClick={() => setExpanded(isOpen ? null : job.id)}
                  className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-800/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-600/20 flex items-center justify-center flex-shrink-0 text-lg">
                    {typeIcon[job.job_type] || '\u26A0\uFE0F'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white text-sm">{cause.title}</h3>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 capitalize">{job.job_type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> {new Date(job.created_at).toLocaleString()}
                    </p>
                  </div>
                  {/* Retry icon — right side, always visible */}
                  <button
                    onClick={(e) => { e.stopPropagation(); retry(job) }}
                    disabled={isRetrying}
                    className="btn-secondary text-xs whitespace-nowrap"
                    title="Retry this job"
                  >
                    {isRetrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline ml-1">Retry</span>
                  </button>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {/* Expanded: root cause + fix button */}
                {isOpen && (
                  <div className="border-t border-slate-800 p-4 bg-slate-900/40 animate-fade-in">
                    <div className="flex items-start gap-3 mb-3">
                      <Wrench className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">Root cause</p>
                        <p className="text-sm text-slate-200 leading-relaxed">{cause.explanation}</p>
                      </div>
                    </div>

                    {/* Raw error for debugging */}
                    <details className="mb-3">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-300">Technical details</summary>
                      <pre className="text-xs text-slate-400 mt-2 bg-slate-950 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap break-all">{job.error}</pre>
                    </details>

                    {/* Fix this button → routes to the page that solves it */}
                    {cause.fixable && (
                      <button
                        onClick={() => navigate(cause.fixRoute)}
                        className="btn-primary text-sm w-full sm:w-auto"
                      >
                        <Wrench className="w-4 h-4" /> {cause.fixLabel} <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => dismiss(job.id)}
                      className="btn-ghost text-xs text-slate-500 ml-0 sm:ml-2 mt-2 sm:mt-0"
                    >
                      <X className="w-3.5 h-3.5" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Resolved history */}
      {resolved.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">Recently resolved</h2>
          <div className="card divide-y divide-slate-800">
            {resolved.map((job) => (
              <div key={job.id} className="p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex-shrink-0">{typeIcon[job.job_type]}</span>
                  <span className="text-slate-400 truncate">{diagnose(job).title}</span>
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded capitalize flex-shrink-0 ml-2 ${
                  job.status === 'retried' ? 'bg-green-500/15 text-green-400' : 'bg-slate-700 text-slate-500'
                }`}>
                  {job.status === 'retried' ? <CheckCircle2 className="w-3 h-3 inline mr-0.5" /> : <XCircle className="w-3 h-3 inline mr-0.5" />}
                  {job.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
