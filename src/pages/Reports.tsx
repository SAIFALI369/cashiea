import { renderMd } from '../lib/markdown'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/ai'
import type { Report } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { BarChart3, Sparkles, Loader2, Trash2, Plus, ChevronDown, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { REPORT_TEMPLATES, getReportTemplate } from '../lib/report-templates'
import { SalesTrend } from '../components/SalesTrend'

export default function Reports() {
  const { profile, ownerId } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [reportType, setReportType] = useState('financial')
  const [inputData, setInputData] = useState('')

  const activeType = getReportTemplate(reportType)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    const { data } = await supabase.from('reports').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setReports((data as Report[]) || [])
    setLoading(false)
  }

  const handleGenerate = async () => {
    if (!inputData.trim()) {
      toast.error('Enter some data for the report')
      return
    }
    setGenerating(true)
    try {
      // Pass report_type + title so the edge function frames a structured template
      const { result, provider } = await callAI({
        task_type: 'report',
        prompt: inputData, // edge function builds the structured prompt from report_type + title
        provider: profile?.ai_provider,
        extra: { report_type: reportType, title: title || `${reportType} Report` },
      })

      const { data, error } = await supabase
        .from('reports')
        .insert({
          user_id: ownerId,
          title: title || `${reportType} Report`,
          report_type: reportType,
          input_data: inputData,
          generated_content: result,
          provider,
        })
        .select()
        .single()

      if (error) throw error

      setReports([data as Report, ...reports])
      setTitle('')
      setInputData('')
      setShowForm(false)
      toast.success('Report generated! 📊')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('reports').delete().eq('id', id)
    if (!error) {
      setReports(reports.filter((r) => r.id !== id))
      toast.success('Report deleted')
    }
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Generate structured business reports from your data with AI"
        icon={<BarChart3 className="w-5 h-5" />}
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> {showForm ? 'Close' : 'New Report'}
          </button>
        }
      />

      <SalesTrend ownerId={ownerId} />

      {showForm && (
        <div className="card p-4 mb-6 animate-slide-up">
          {/* Type selector with guidance */}
          <label className="label">Report Type</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {REPORT_TEMPLATES.map((t) => (
              <button
                key={t.value}
                onClick={() => setReportType(t.value)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  reportType === t.value
                    ? 'border-brand-600 bg-brand-600/15'
                    : 'border-line bg-surface/50 hover:border-line'
                }`}
              >
                <div className="font-semibold text-fg text-sm">{t.label}</div>
                <div className="text-xs text-fg-muted mt-0.5">{t.hint}</div>
              </button>
            ))}
          </div>

          {/* Show the sections the AI will produce, so the user knows what to expect */}
          <div className="bg-surface/60 rounded-xl p-3 mb-4 border border-line">
            <p className="text-xs text-fg-subtle mb-1.5">Sections the AI will generate:</p>
            <div className="flex flex-wrap gap-1.5">
              {activeType.sections.map((s) => (
                <span key={s} className="text-xs px-2 py-0.5 rounded-md bg-surface-2 text-fg-muted">{s}</span>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="label">Report Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" placeholder="Q1 2026 Financial Summary" />
          </div>

          <label className="label flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" /> Input data / notes
          </label>
          <textarea
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            rows={6}
            className="input-field resize-none font-mono text-sm"
            placeholder={activeType.placeholder}
          />
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Analyzing...' : 'Generate Report'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : reports.length === 0 ? (
        <EmptyState icon={BarChart3} title="No reports yet" description="Pick a report type, paste your business data, and AI generates a structured report with sections, analysis, and recommendations." />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-surface-2/30 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-fg">{report.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/15 text-brand-300 capitalize">{report.report_type}</span>
                    <span className="text-xs text-fg-subtle">{new Date(report.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-fg-subtle transition-transform ${expandedId === report.id ? 'rotate-180' : ''}`} />
              </button>

              {expandedId === report.id && report.generated_content && (
                <div className="border-t border-line">
                  <div className="flex justify-end gap-2 p-3">
                    <button onClick={() => handleCopy(report.generated_content!)} className="btn-ghost text-xs"><Copy className="w-3.5 h-3.5" /> Copy</button>
                    <button onClick={() => handleDelete(report.id)} className="btn-ghost text-xs text-red-400 hover:text-red-300"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                  </div>
                  <div className="prose-content px-5 pb-5 max-h-[500px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderMd(report.generated_content) }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
