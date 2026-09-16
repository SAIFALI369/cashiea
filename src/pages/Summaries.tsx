import { renderMd } from '../lib/markdown'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
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
  const { can } = useCan()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sourceText, setSourceText] = useState('')
  const [summaryType, setSummaryType] = useState('brief')

  useEffect(() => {
    if (ownerId) loadSummaries()
    else { setSummaries([]); setLoading(false) }
  }, [ownerId])

  const loadSummaries = async () => {
    if (!ownerId) return
    setLoading(true)
    const { data } = await supabase
      .from('summaries')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
    setSummaries((data as Summary[]) || [])
    setLoading(false)
  }

  const handleSummarize = async () => {
    if (!can('ai:use')) return toast.error('Your role cannot use AI features')
    if (!ownerId) return toast.error('Your shop is still loading — please try again')
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
    if (!can('ai:use') || !ownerId) return
    const { error } = await supabase.from('summaries').delete().eq('id', id).eq('user_id', ownerId)
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
    <div className="summaries-page animate-fade-in">
      <PageHeader
        title="Summaries"
        subtitle="Summarize documents, emails, and meetings instantly"
        icon={<ScrollText className="w-5 h-5" />}
      />

      {/* Summarizer */}
      <div className="summary-layout">
      <div className="summary-form card p-5">
        <label className="label flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" /> Text to summarize
        </label>
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={6}
          className="input-field min-h-[120px] resize-none"
          placeholder="Paste any long text — a meeting transcript, email thread, article, document..."
        />

        <label className="label mt-4">Summary style</label>
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {summaryTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSummaryType(type.value)}
              className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${summaryType === type.value ? 'bg-accent text-white' : 'bg-surface-2 text-fg-subtle'}`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div>
          <button onClick={handleSummarize} disabled={generating} className="btn-primary min-h-[52px] w-full rounded-full text-sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Summarizing...' : 'Summarize'}
          </button>
        </div>
      </div>
      <div className="summary-output card min-h-[320px] p-6"><h2 className="mb-4 text-base font-bold text-fg">Generated summary</h2>{summaries[0]?.generated_summary ? <div className="prose-content" dangerouslySetInnerHTML={{ __html: renderMd(summaries[0].generated_summary) }} /> : <div className="flex min-h-[240px] items-center justify-center text-center text-sm text-fg-subtle">Paste text above and choose a style to get started.</div>}</div>
      </div>

      {/* History */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
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
                    {summary.summary_type}
                  </span>
                  {summary.word_count && (
                    <span className="text-xs text-fg-subtle">{summary.word_count} words</span>
                  )}
                  <span className="text-xs text-fg-subtle">
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
                    className="btn-ghost text-xs text-negative hover:text-negative"
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
