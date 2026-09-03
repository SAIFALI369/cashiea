import { renderMd } from '../lib/markdown'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { callAI } from '../lib/ai'
import type { Report } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { BarChart3, Sparkles, Loader2, Trash2, Plus, ChevronDown, Copy, FileDown, FileSpreadsheet, MessageCircle, Database, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { REPORT_TEMPLATES, getReportTemplate } from '../lib/report-templates'
import { SalesTrend } from '../components/SalesTrend'
import { gatherBusinessData, type BusinessDataSnapshot } from '../lib/report-data'
import { downloadReportPdf, reportToPlainText } from '../lib/report-pdf'
import { downloadXlsx } from '../lib/xlsx'
import { buildWhatsappLink } from '../lib/payments'

export default function Reports() {
  const { profile, ownerId } = useAuth()
  const { isOwner } = useCan()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [reportType, setReportType] = useState('financial')
  const [focus, setFocus] = useState('')
  const [data, setData] = useState<BusinessDataSnapshot | null>(null)
  const [dataLoading, setDataLoading] = useState(false)

  const activeType = getReportTemplate(reportType)

  useEffect(() => { if (ownerId) loadReports() }, [ownerId])

  // Auto-gather the business data whenever the form opens.
  useEffect(() => {
    if (!showForm || !ownerId) return
    setDataLoading(true)
    gatherBusinessData(ownerId, 30)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setDataLoading(false))
  }, [showForm, ownerId])

  const loadReports = async () => {
    setLoading(true)
    const { data } = await supabase.from('reports').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setReports((data as Report[]) || [])
    setLoading(false)
  }

  const handleGenerate = async () => {
    if (!isOwner) {
      toast.error('Only the business owner can generate reports')
      return
    }
    if (!data || !data.hasData) {
      toast.error('No business data found yet — record some sales first')
      return
    }
    setGenerating(true)
    try {
      // The prompt is the auto-gathered business data (+ optional focus),
      // never a hand-typed dump.
      const prompt = [data.summaryText, focus.trim() && `OWNER FOCUS: ${focus.trim()}`]
        .filter(Boolean)
        .join('\n\n')
      const { result, provider } = await callAI({
        task_type: 'report',
        prompt,
        provider: profile?.ai_provider,
        extra: { report_type: reportType, title: title || `${reportType} Report` },
      })

      const { data: saved, error } = await supabase
        .from('reports')
        .insert({
          user_id: ownerId,
          title: title || `${reportType} Report`,
          report_type: reportType,
          input_data: prompt,
          generated_content: result,
          provider,
        })
        .select()
        .single()

      if (error) throw error

      setReports([saved as Report, ...reports])
      setTitle('')
      setFocus('')
      setShowForm(false)
      toast.success('Report generated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!isOwner) {
      toast.error('Only the business owner can delete reports')
      return
    }
    const { error } = await supabase.from('reports').delete().eq('id', id).eq('user_id', ownerId)
    if (!error) {
      setReports(reports.filter((r) => r.id !== id))
      toast.success('Report deleted')
    }
  }

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('Copied to clipboard')
  }

  const handlePdf = (report: Report) => {
    try {
      downloadReportPdf(report, profile)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Could not build the PDF')
    }
  }

  const handleExcel = async () => {
    if (!ownerId) return
    toast.loading('Preparing Excel…', { id: 'xlsx' })
    try {
      const snap = await gatherBusinessData(ownerId, 30)
      const sheets = [
        { name: 'Sales (30 days)', rows: snap.salesRows },
        { name: 'Expenses (30 days)', rows: snap.expenseRows },
      ]
      downloadXlsx(`cashiea-${reportType}-data-${snap.to}`, sheets)
      toast.success('Excel downloaded', { id: 'xlsx' })
    } catch {
      toast.error('Could not build the Excel file', { id: 'xlsx' })
    }
  }

  const handleWhatsApp = (report: Report) => {
    const text = reportToPlainText(report)
    window.open(buildWhatsappLink(profile?.whatsapp_number || profile?.phone || undefined, text), '_blank')
  }

  const excelApplicable = (type: string) => type === 'sales' || type === 'financial'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        subtitle="Structured business reports from your real Cashiea data — no typing"
        icon={<BarChart3 className="w-5 h-5" />}
        action={isOwner ? (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> {showForm ? 'Close' : 'New Report'}
          </button>
        ) : <span className="text-xs text-fg-subtle">Owner-only changes</span>}
      />

      <SalesTrend ownerId={ownerId} />

      {isOwner && showForm && (
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
                    ? 'border-accent-strong bg-accent/15'
                    : 'border-line bg-surface/50 hover:border-line-2'
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

          {/* Auto-gathered data — replaces the raw-data textarea */}
          <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-3 mb-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-fg flex items-center gap-1.5">
                <Database className="w-4 h-4 text-accent-strong" />
                Your Cashiea data is included automatically
              </p>
              <button
                onClick={() => ownerId && gatherBusinessData(ownerId, 30).then(setData)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2"
                aria-label="Refresh data"
                title="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {dataLoading || !data ? (
              <p className="text-xs text-fg-muted mt-2 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading your last 30 days…</p>
            ) : data.hasData ? (
              <details className="mt-2">
                <summary className="text-xs font-semibold text-accent-strong cursor-pointer">Preview the data being analyzed</summary>
                <pre className="text-[11px] leading-relaxed text-fg-muted whitespace-pre-wrap mt-2 font-mono">{data.summaryText}</pre>
              </details>
            ) : (
              <p className="text-xs text-fg-muted mt-2">No data yet — record sales, expenses or invoices and come back.</p>
            )}
          </div>

          <div className="mb-4">
            <label className="label flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" /> Focus for this report (optional)
            </label>
            <input
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="input-field"
              placeholder="e.g. Why did margins drop? What should I stock more of?"
            />
            <p className="text-xs text-fg-subtle mt-1.5">One line is enough — everything else comes from your data.</p>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleGenerate} disabled={generating || !data?.hasData} className="btn-primary text-sm disabled:opacity-50">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Analyzing…' : 'Generate Report'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : reports.length === 0 ? (
        <EmptyState icon={BarChart3} title="No reports yet" description="Pick a report type — Cashiea fills it with your actual sales, expenses, invoices and stock. No data entry." />
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
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent-strong capitalize">{report.report_type}</span>
                    <span className="text-xs text-fg-subtle">{new Date(report.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-fg-subtle transition-transform ${expandedId === report.id ? 'rotate-180' : ''}`} />
              </button>

              {expandedId === report.id && report.generated_content && (
                <div className="border-t border-line">
                  <div className="flex flex-wrap justify-end gap-2 p-3">
                    <button onClick={() => handlePdf(report)} className="btn-ghost text-xs h-10"><FileDown className="w-3.5 h-3.5" /> PDF</button>
                    {excelApplicable(report.report_type) && (
                      <button onClick={handleExcel} className="btn-ghost text-xs h-10"><FileSpreadsheet className="w-3.5 h-3.5" /> Excel data</button>
                    )}
                    <button onClick={() => handleWhatsApp(report)} className="btn-ghost text-xs h-10 text-positive"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</button>
                    <button onClick={() => handleCopy(report.generated_content!)} className="btn-ghost text-xs h-10"><Copy className="w-3.5 h-3.5" /> Copy</button>
                    {isOwner && <button onClick={() => handleDelete(report.id)} className="btn-ghost text-xs h-10 text-negative"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
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
