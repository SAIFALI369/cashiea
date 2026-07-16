import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/ai'
import type { Report } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { BarChart3, Sparkles, Loader2, Trash2, Plus, ChevronDown, Copy } from 'lucide-react'
import toast from 'react-hot-toast'

const reportTypes = [
  { value: 'financial', label: '📊 Financial' },
  { value: 'sales', label: '📈 Sales' },
  { value: 'operations', label: '⚙️ Operations' },
  { value: 'custom', label: '✨ Custom' },
]

export default function Reports() {
  const { profile } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [reportType, setReportType] = useState('financial')
  const [inputData, setInputData] = useState('')

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
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
      const promptText = `Create a ${reportType} report titled "${title || 'Untitled Report'}" based on the following data:\n\n${inputData}`

      const { result, provider } = await callAI({
        task_type: 'report',
        prompt: promptText,
        provider: profile?.ai_provider,
      })

      const { data, error } = await supabase
        .from('reports')
        .insert({
          user_id: profile!.id,
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

  // Simple markdown to HTML
  const renderMarkdown = (md: string) => {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
      .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, (match) => `<ul>${match}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hlup])(.+)$/gm, '<p>$1</p>')
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Generate business reports from your data with AI"
        icon={<BarChart3 className="w-5 h-5" />}
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> {showForm ? 'Close' : 'New Report'}
          </button>
        }
      />

      {showForm && (
        <div className="card p-6 mb-6 animate-slide-up">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Report Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                placeholder="Q1 2026 Financial Summary"
              />
            </div>
            <div>
              <label className="label">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="input-field"
              >
                {reportTypes.map((t) => (
                  <option key={t.value} value={t.value} className="bg-slate-900">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="label flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" /> Input data / notes
          </label>
          <textarea
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            rows={6}
            className="input-field resize-none font-mono text-sm"
            placeholder={`Paste your raw data here...\n\nExample:\nRevenue: $125,000\nExpenses: $87,000\nNew customers: 340\nChurn rate: 4.2%\nTop product: Pro Plan`}
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
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No reports yet"
          description="Paste your business data and let AI generate professional reports with insights and recommendations."
        />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="card overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
              >
                <div>
                  <h3 className="font-semibold text-white">{report.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-600/15 text-brand-300 capitalize">
                      {report.report_type}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-slate-500 transition-transform ${
                    expandedId === report.id ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedId === report.id && report.generated_content && (
                <div className="border-t border-slate-800">
                  <div className="flex justify-end gap-2 p-3">
                    <button
                      onClick={() => handleCopy(report.generated_content!)}
                      className="btn-ghost text-xs"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </button>
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="btn-ghost text-xs text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                  <div
                    className="prose-content px-5 pb-5 max-h-[500px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(report.generated_content) }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
