import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { callAI, parseAIJson } from '../lib/ai'
import type { DataEntry } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Database, Sparkles, Loader2, Trash2, Copy, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { exportToCSV, exportToJSON } from '../lib/export'

export default function DataEntryPage() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<DataEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sourceText, setSourceText] = useState('')
  const [category, setCategory] = useState('general')

  useEffect(() => {
    loadEntries()
  }, [])

  const loadEntries = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('data_entries')
      .select('*')
      .order('created_at', { ascending: false })
    setEntries((data as DataEntry[]) || [])
    setLoading(false)
  }

  const handleExtract = async () => {
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
          user_id: profile!.id,
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

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('data_entries').delete().eq('id', id)
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

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Data Entry"
        subtitle="Extract structured data from any text automatically"
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

      {/* Extractor */}
      <div className="card p-6 mb-6">
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
        <label className="label flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-400" /> Paste unstructured text
        </label>
        <textarea
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
          rows={5}
          className="input-field resize-none"
          placeholder={`Paste messy data, emails, notes, etc...\n\nExample:\nJohn Smith, email john@smithco.com, phone 555-0100. He ordered 3 widgets at $25 each on March 15. Ship to 123 Main St, Anytown.`}
        />
        <div className="flex justify-end mt-4">
          <button onClick={handleExtract} disabled={generating} className="btn-primary text-sm">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Extracting...' : 'Extract Data'}
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No data extracted yet"
          description="Paste any messy text above — emails, notes, order details — and AI will extract it into clean structured data."
        />
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 capitalize">
                    {entry.category}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleCopy(entry.extracted_data)}
                    className="btn-ghost text-xs"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="btn-ghost text-xs text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Extracted fields */}
              <div className="grid sm:grid-cols-2 gap-2.5">
                {Object.entries(entry.extracted_data).slice(0, 8).map(([key, val]) => {
                  const valueStr = renderValue(val)
                  const isJson = valueStr.startsWith('{') || valueStr.startsWith('[')
                  return (
                    <div key={key} className="bg-slate-900/60 rounded-lg p-3">
                      <p className="text-xs font-semibold text-brand-400 capitalize mb-1">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <p className={`text-sm text-slate-300 ${isJson ? 'font-mono text-xs break-all' : 'break-words'}`}>
                        {valueStr.length > 200 ? valueStr.slice(0, 200) + '...' : valueStr}
                      </p>
                    </div>
                  )
                })}
              </div>

              {Object.keys(entry.extracted_data).length > 8 && (
                <p className="text-xs text-slate-500 mt-2">
                  + {Object.keys(entry.extracted_data).length - 8} more fields
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
