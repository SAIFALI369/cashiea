import { renderMd } from '../lib/markdown'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/ai'
import type { Summary } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { ScrollText, Sparkles, Loader2, Trash2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

const summaryTypes = [
  { value: 'brief', label: 'Brief', desc: '2-3 sentences', icon: '⚡' },
  { value: 'bullets', label: 'Key Points', desc: 'Bullet points', icon: '📋' },
  { value: 'detailed', label: 'Detailed', desc: 'Full paragraphs', icon: '📄' },
  { value: 'executive', label: 'Executive', desc: 'For leadership', icon: '👔' },
]

export default function Summaries() {
  const { profile, ownerId } = useAuth()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sourceText, setSourceText] = useState('')
  const [summaryType, setSummaryType] = useState('brief')

  useEffect(() => {
    loadSummaries()
  }, [])

  const loadSummaries = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('summaries')
      .select('*')
      .order('created_at', { ascending: false })
    setSummaries((data as Summary[]) || [])
    setLoading(false)
  }

  const handleSummarize = async () => {
    if (!sourceText.trim()) {
      toast.error('Enter text to summarize')
      return
    }
    setGenerating(true)
    try {
      const typeLabel = summaryTypes.find((t) => t.value === summaryType)?.label || 'brief'
      const promptText = `Summarize the following text as a "${typeLabel}" summary:\n\n${sourceText}`

      const { result, provider } = await callAI({
        task_type: 'summary',
        prompt: promptText,
        provider: profile?.ai_provider,
      })

      const wordCount = result.split(/\s+/).length

      const { data, error } = await supabase
        .from('summaries')
        .insert({
          user_id: ownerId,
          source_text: sourceText,
          summary_type: summaryType,
          generated_summary: result,
          provider,
          word_count: wordCount,
        })
        .select()
        .single()

      if (error) throw error

      setSummaries([data as Summary, ...summaries])
      setSourceText('')
      toast.success('Summary ready! 📝')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Summarization failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('summaries').delete().eq('id', id)
    if (!error) {
      setSummaries(summaries.filter((s) => s.id !== id))
      toast.success('Summary deleted')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Summaries"
        subtitle="Summarize documents, emails, and meetings instantly"
        icon={<ScrollText className="w-5 h-5" />}
      />

      {/* Summarizer */}
      <div className="card p-4 mb-6">
        <label className="label flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" /> Text to summarize
        </label>
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={6}
          className="input-field resize-none"
          placeholder="Paste any long text — a meeting transcript, email thread, article, document..."
        />

        <label className="label mt-4">Summary style</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {summaryTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSummaryType(type.value)}
              className={`p-3 rounded-xl border text-center transition-all ${
                summaryType === type.value
                  ? 'border-accent-strong bg-accent-strong/15 text-white'
                  : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              <div className="text-xl mb-1">{type.icon}</div>
              <div className="text-sm font-semibold">{type.label}</div>
              <div className="text-xs opacity-70">{type.desc}</div>
            </button>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={handleSummarize} disabled={generating} className="btn-primary text-sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Summarizing...' : 'Summarize'}
          </button>
        </div>
      </div>

      {/* History */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : summaries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No summaries yet"
          description="Paste any text above and choose a style. AI will condense it into clear, readable summaries."
        />
      ) : (
        <div className="space-y-4">
          {summaries.map((summary) => (
            <div key={summary.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 capitalize">
                    {summaryTypes.find((t) => t.value === summary.summary_type)?.icon} {summary.summary_type}
                  </span>
                  {summary.word_count && (
                    <span className="text-xs text-slate-500">{summary.word_count} words</span>
                  )}
                  <span className="text-xs text-slate-500">
                    · {new Date(summary.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleCopy(summary.generated_summary || '')}
                    className="btn-ghost text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button
                    onClick={() => handleDelete(summary.id)}
                    className="btn-ghost text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {summary.generated_summary && (
                <div
                  className="prose-content"
                  dangerouslySetInnerHTML={{ __html: renderMd(summary.generated_summary) }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
