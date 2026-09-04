import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { callAI, parseAIJson } from '../lib/ai'
import type { DataEntry } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Database, Sparkles, Loader2, Trash2, Copy, Download, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportToCSV, exportToJSON } from '../lib/export'

type Mode = 'single' | 'batch'

export default function DataEntryPage() {
  const { profile, ownerId } = useAuth()
  const { can } = useCan()
  const [entries, setEntries] = useState<DataEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Single mode
  const [sourceText, setSourceText] = useState('')
  const [category, setCategory] = useState('general')

  // Batch mode — many records separated by a delimiter
  const [mode, setMode] = useState<Mode>('single')
  const [batchText, setBatchText] = useState('')
  const [delimiter, setDelimiter] = useState('blank-line')
  const [progress, setProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    if (ownerId) loadEntries()
    else { setEntries([]); setLoading(false) }
  }, [ownerId])

  const loadEntries = async () => {
    if (!ownerId) return
    setLoading(true)
    const { data } = await supabase.from('data_entries').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setEntries((data as DataEntry[]) || [])
    setLoading(false)
  }

  const handleExtract = async () => {
    if (!can('ai:use')) return toast.error('Your role cannot use AI features')
    if (!ownerId) return toast.error('Your shop is still loading — please try again')
    if (!sourceText.trim()) {
      toast.error('Enter text to extract data from')
      return
    }
    setGenerating(true)
    try {
      const { result, provider } = await callAI({
        task_type: 'extract',
        prompt: `Category: ${category}\n\nExtract structured data from this text:\n\n${sourceText}`,
        provider: profile?.ai_provider,
      })

      const parsed = parseAIJson<Record<string, unknown>>(result)

      const { data, error } = await supabase
        .from('data_entries')
        .insert({
          user_id: ownerId,
          source_text: sourceText,
          extracted_data: parsed || { raw: result },
          category,
          provider,
        })
        .select()
        .single()

      if (error) throw error

      setEntries([data as DataEntry, ...entries])
      setSourceText('')
      toast.success('Data extracted! ✅')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setGenerating(false)
    }
  }

  // Split batch text into individual records based on delimiter
  const splitBatch = (text: string): string[] => {
    const cleaned = text.trim()
    if (!cleaned) return []
    switch (delimiter) {
      case 'blank-line':
        return cleaned.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
      case 'newline':
        return cleaned.split(/\n/).map((s) => s.trim()).filter(Boolean)
      case 'comma':
        return cleaned.split(/,(?=\s)/).map((s) => s.trim()).filter(Boolean)
      case 'pipe':
        return cleaned.split('|').map((s) => s.trim()).filter(Boolean)
      default:
        return [cleaned]
    }
  }

  const handleBatchExtract = async () => {
    if (!can('ai:use')) return toast.error('Your role cannot use AI features')
    if (!ownerId) return toast.error('Your shop is still loading — please try again')
    const records = splitBatch(batchText)
    if (records.length === 0) {
      toast.error('Add some records to process')
      return
    }

    setGenerating(true)
    setProgress({ done: 0, total: records.length })
    const created: DataEntry[] = []
    let failures = 0

    // Process in sequence with per-item error isolation (a bad record doesn't
    // abort the whole batch). Failures are counted, not thrown.
    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      try {
        const { result, provider } = await callAI({
          task_type: 'extract',
          prompt: `Category: ${category}\n\nExtract structured data from this text:\n\n${record}`,
          provider: profile?.ai_provider,
        })
        const parsed = parseAIJson<Record<string, unknown>>(result)
        const { data, error } = await supabase
          .from('data_entries')
          .insert({
            user_id: ownerId,
            source_text: record,
            extracted_data: parsed || { raw: result },
            category,
            provider,
          })
          .select()
          .single()
        if (!error && data) created.push(data as DataEntry)
        else failures++
      } catch {
        failures++
      }
      setProgress({ done: i + 1, total: records.length })
    }

    if (created.length > 0) setEntries([...created, ...entries])
    setBatchText('')
    setGenerating(false)

    if (failures === 0) toast.success(`Extracted ${created.length} records! ✅`)
    else toast(`${created.length} extracted, ${failures} failed (usage limit or error)`, { icon: '⚠️' })
  }

  const handleDelete = async (id: string) => {
    if (!can('ai:use') || !ownerId) return
    const { error } = await supabase.from('data_entries').delete().eq('id', id).eq('user_id', ownerId)
    if (!error) {
      setEntries(entries.filter((e) => e.id !== id))
      toast.success('Entry deleted')
    }
  }

  const handleCopy = (data: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast.success('Copied JSON')
  }

  const renderValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—'
    if (Array.isArray(val)) return val.join(', ')
    if (typeof val === 'object') return JSON.stringify(val, null, 2)
    return String(val)
  }

  const batchPreview = splitBatch(batchText)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Data Entry"
        subtitle="Extract structured data from text — one record or hundreds at once"
        icon={<Database className="w-5 h-5" />}
        action={
          entries.length > 0 ? (
            <div className="flex gap-2">
              <button onClick={() => exportToJSON('data-entries', entries)} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> JSON</button>
              <button onClick={() => exportToCSV('data-entries', entries.map((e) => ({ ...e.extracted_data, category: e.category, created: e.created_at })))} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> CSV</button>
            </div>
          ) : undefined
        }
      />

      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('single')} className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-all ${mode === 'single' ? 'border-accent-strong bg-accent-strong/15 text-white' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
          <Database className="w-4 h-4 inline mr-1.5" /> Single Record
        </button>
        <button onClick={() => setMode('batch')} className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-all ${mode === 'batch' ? 'border-accent-strong bg-accent-strong/15 text-white' : 'border-slate-700 text-slate-400 hover:text-white'}`}>
          <Layers className="w-4 h-4 inline mr-1.5" /> Batch (200+ at once)
        </button>
      </div>

      {/* Extractor */}
      <div className="card p-4 mb-6">
        <div className="mb-4">
          <label className="label">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
            <option value="general" className="bg-slate-900">General</option>
            <option value="contacts" className="bg-slate-900">Contacts</option>
            <option value="products" className="bg-slate-900">Products</option>
            <option value="transactions" className="bg-slate-900">Transactions</option>
            <option value="tasks" className="bg-slate-900">Tasks</option>
          </select>
        </div>

        {mode === 'single' ? (
          <>
            <label className="label flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Paste unstructured text</label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              rows={5}
              className="input-field resize-none"
              placeholder={`Paste messy data, an email, or notes...\n\nExample:\nJohn Smith, john@smithco.com, 555-0100. Ordered 3 widgets at ₹25 each on March 15. Ship to 123 Main St.`}
            />
            <div className="flex justify-end mt-4">
              <button onClick={handleExtract} disabled={generating} className="btn-primary text-sm">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Extracting...' : 'Extract Data'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <label className="label mb-0">Split records by:</label>
              <select value={delimiter} onChange={(e) => setDelimiter(e.target.value)} className="input-field py-1.5 px-3 text-sm w-auto">
                <option value="blank-line" className="bg-slate-900">Blank line between records</option>
                <option value="newline" className="bg-slate-900">Each line = 1 record</option>
                <option value="comma" className="bg-slate-900">Comma separated</option>
                <option value="pipe" className="bg-slate-900">Pipe ( | ) separated</option>
              </select>
              <span className="text-xs text-slate-500 ml-auto">{batchPreview.length} records detected</span>
            </div>
            <label className="label flex items-center gap-2"><Layers className="w-4 h-4 text-accent" /> Paste many records (e.g. 200 emails/day)</label>
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              rows={8}
              className="input-field resize-none font-mono text-sm"
              placeholder={`Paste all your records at once, separated by blank lines.\n\nExample (blank-line delimiter):\nJohn Smith, john@smithco.com, ordered 3 widgets @ ₹25\n\nJane Doe, jane@acme.io, ordered 1 pro plan @ ₹49\n\n...`}
            />
            {generating && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>Processing batch...</span>
                  <span>{progress.done} / {progress.total}</span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-slate-500">Each record uses 1 AI action. {batchPreview.length} needed.</p>
              <button onClick={handleBatchExtract} disabled={generating || batchPreview.length === 0} className="btn-primary text-sm">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {generating ? `Processing ${progress.done}/${progress.total}` : `Process ${batchPreview.length} records`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Database} title="No data extracted yet" description="Paste a single record, or switch to Batch mode to process 200+ emails at once. AI extracts clean structured data from each." />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-amber-300 capitalize">{entry.category}</span>
                  <span className="text-xs text-slate-500">{new Date(entry.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleCopy(entry.extracted_data)} className="btn-ghost text-xs"><Copy className="w-3.5 h-3.5" /> Copy</button>
                  <button onClick={() => handleDelete(entry.id)} className="btn-ghost text-xs text-negative hover:text-negative"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {Object.entries(entry.extracted_data).slice(0, 8).map(([key, val]) => {
                  const valueStr = renderValue(val)
                  const isJson = valueStr.startsWith('{') || valueStr.startsWith('[')
                  return (
                    <div key={key} className="bg-slate-900/60 rounded-lg p-3">
                      <p className="text-xs font-semibold text-accent capitalize mb-1">{key.replace(/_/g, ' ')}</p>
                      <p className={`text-sm text-slate-300 ${isJson ? 'font-mono text-xs break-all' : 'break-words'}`}>{valueStr.length > 200 ? valueStr.slice(0, 200) + '...' : valueStr}</p>
                    </div>
                  )
                })}
              </div>
              {Object.keys(entry.extracted_data).length > 8 && (
                <p className="text-xs text-slate-500 mt-2">+ {Object.keys(entry.extracted_data).length - 8} more fields</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
