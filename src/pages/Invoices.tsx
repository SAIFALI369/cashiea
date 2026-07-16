import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { callAI, parseAIJson } from '../lib/ai'
import type { Invoice, InvoiceItem } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { FileText, Sparkles, Loader2, Trash2, Download, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Invoices() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })
    setInvoices((data as Invoice[]) || [])
    setLoading(false)
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Describe the invoice first')
      return
    }
    setGenerating(true)
    try {
      const { result } = await callAI({
        task_type: 'invoice',
        prompt,
        provider: profile?.ai_provider,
      })

      const parsed = parseAIJson<{
        invoice_number: string
        client_name: string
        client_email?: string
        client_address?: string
        items: InvoiceItem[]
        tax_rate?: number
        due_date?: string
        notes?: string
      }>(result)

      if (!parsed) throw new Error('Could not parse invoice. Try again.')

      // Calculate totals
      const items = parsed.items || []
      const subtotal = items.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
        0
      )
      const taxRate = parsed.tax_rate || 0
      const taxAmount = (subtotal * taxRate) / 100
      const total = subtotal + taxAmount

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          user_id: profile!.id,
          invoice_number: parsed.invoice_number || `INV-${Date.now()}`,
          client_name: parsed.client_name || 'Client',
          client_email: parsed.client_email || null,
          client_address: parsed.client_address || null,
          items,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          status: 'draft',
          due_date: parsed.due_date || null,
          notes: parsed.notes || null,
        })
        .select()
        .single()

      if (error) throw error

      setInvoices([data as Invoice, ...invoices])
      setPrompt('')
      setShowForm(false)
      toast.success('Invoice generated! ✅')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (!error) {
      setInvoices(invoices.filter((inv) => inv.id !== id))
      toast.success('Invoice deleted')
    }
  }

  const handleDownload = (inv: Invoice) => {
    const content = `INVOICE ${inv.invoice_number}
${'='.repeat(40)}

To: ${inv.client_name}
${inv.client_email ? `Email: ${inv.client_email}` : ''}
${inv.client_address ? `Address: ${inv.client_address}` : ''}
${inv.due_date ? `Due Date: ${inv.due_date}` : ''}

${'─'.repeat(40)}

${inv.items.map((item) => `${item.description}  x${item.quantity}  $${item.unit_price.toFixed(2)}`).join('\n')}

${'─'.repeat(40)}

Subtotal:     $${inv.subtotal.toFixed(2)}
Tax (${inv.tax_rate}%):   $${inv.tax_amount.toFixed(2)}
${'─'.repeat(40)}
TOTAL:        $${inv.total.toFixed(2)}

${inv.notes ? `\nNotes: ${inv.notes}` : ''}
`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.invoice_number}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Invoices"
        subtitle="Generate professional invoices with AI"
        icon={<FileText className="w-5 h-5" />}
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> {showForm ? 'Close' : 'New Invoice'}
          </button>
        }
      />

      {/* AI Generation form */}
      {showForm && (
        <div className="card p-6 mb-6 animate-slide-up">
          <label className="label flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-400" /> Describe your invoice
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="input-field resize-none"
            placeholder="e.g. Invoice for Acme Corp for web design services — 10 hours at $100/hr, logo design $500, and 5 hours maintenance at $75/hr. Tax 8%. Due in 14 days. Their email is billing@acme.com."
          />
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Generate Invoice'}
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Click 'New Invoice' and describe what you want to bill. AI will create a complete invoice instantly."
        />
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => (
            <div key={inv.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1">
                    <h3 className="font-bold text-white text-lg">{inv.invoice_number}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      inv.status === 'paid' ? 'bg-green-500/15 text-green-400' :
                      inv.status === 'sent' ? 'bg-blue-500/15 text-blue-400' :
                      inv.status === 'overdue' ? 'bg-red-500/15 text-red-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>
                      {inv.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{inv.client_name}</p>
                  {inv.client_email && <p className="text-slate-500 text-xs">{inv.client_email}</p>}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">${inv.total.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">incl. ${inv.tax_amount.toFixed(2)} tax</p>
                </div>
              </div>

              {/* Items */}
              <div className="mt-4 border-t border-slate-800 pt-4">
                <div className="space-y-1.5">
                  {inv.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300">
                        {item.description} <span className="text-slate-500">× {item.quantity}</span>
                      </span>
                      <span className="text-slate-400">${(item.quantity * item.unit_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t border-slate-800">
                <button onClick={() => handleDownload(inv)} className="btn-ghost text-xs">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button onClick={() => handleDelete(inv.id)} className="btn-ghost text-xs text-red-400 hover:text-red-300 ml-auto">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
