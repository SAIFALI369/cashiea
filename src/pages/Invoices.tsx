import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import { callAI, parseAIJson } from '../lib/ai'
import {
  buildUpiLink, buildUpiQrUrl, buildInvoiceMessage,
  buildWhatsappLink, buildSmsLink, copyToClipboard, type UPIParams,
} from '../lib/payments'
import { generateInvoicePdf } from '../lib/invoice-pdf'
import type { Invoice, InvoiceItem } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Avatar } from '../components/Avatar'
import { FileText, Sparkles, Loader2, Trash2, Plus, Smartphone, MessageCircle, Send, QrCode, Check, Clock, Copy, Zap, X, Download, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'

const statusColor: Record<string, string> = {
  paid: 'bg-green-500/15 text-green-400',
  partial: 'bg-amber-500/15 text-amber-400',
  viewed: 'bg-blue-500/15 text-blue-400',
  sent: 'bg-blue-500/15 text-blue-400',
  overdue: 'bg-red-500/15 text-red-400',
  draft: 'bg-slate-700 text-slate-400',
}

export default function Invoices() {
  const { profile, ownerId } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [shareInv, setShareInv] = useState<Invoice | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'overdue'>('all')

  useEffect(() => { loadInvoices() }, [])

  const loadInvoices = async () => {
    setLoading(true)
    const { data } = await supabase.from('invoices').select('*').order('created_at', { ascending: false })
    setInvoices((data as Invoice[]) || [])
    setLoading(false)
  }

  // ── Generate invoice via AI ────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error('Describe the invoice first')
    setGenerating(true)
    try {
      const { result } = await callAI({ task_type: 'invoice', prompt, provider: profile?.ai_provider })
      const parsed = parseAIJson<{
        invoice_number: string; client_name: string; client_email?: string
        client_phone?: string; client_address?: string; items: InvoiceItem[]
        tax_rate?: number; due_date?: string; notes?: string
      }>(result)
      if (!parsed) throw new Error('Could not parse invoice. Try again.')

      const items = parsed.items || []
      const subtotal = items.reduce((s, it) => s + (it.quantity || 0) * (it.unit_price || 0), 0)
      const taxRate = parsed.tax_rate || 0
      const taxAmount = (subtotal * taxRate) / 100
      const total = subtotal + taxAmount
      const invoiceNumber = parsed.invoice_number || `INV-${Date.now()}`

      // Build UPI payment link if merchant has a UPI ID set
      let paymentLink: string | null = null
      if (profile?.upi_id) {
        paymentLink = buildUpiLink({
          payeeVpa: profile.upi_id,
          payeeName: profile.company_name || profile.full_name || 'My Shop',
          amount: total,
          reference: invoiceNumber,
          note: `Invoice ${invoiceNumber}`,
        })
      }

      const { data, error } = await offlineInsert('invoices', {
        user_id: ownerId,
        invoice_number: invoiceNumber,
        client_name: parsed.client_name || 'Customer',
        client_email: parsed.client_email || null,
        client_phone: parsed.client_phone || null,
        client_address: parsed.client_address || null,
        items, subtotal, tax_rate: taxRate, tax_amount: taxAmount, total,
        status: 'draft', due_date: parsed.due_date || null,
        notes: parsed.notes || null, payment_link: paymentLink,
      })

      if (error) throw error
      setInvoices([data as Invoice, ...invoices])
      setPrompt(''); setShowForm(false)
      toast.success('Invoice generated! ✅')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally { setGenerating(false) }
  }

  // ── Quick invoice (mobile-optimized 30-second flow) ────────────
  const [showQuick, setShowQuick] = useState(false)
  const [quick, setQuick] = useState({ name: '', phone: '', item: '', qty: '1', price: '' })
  const handleQuickCreate = async () => {
    if (!quick.name || !quick.item || !quick.price) return toast.error('Fill name, item, and price')
    setGenerating(true)
    const qty = Number(quick.qty) || 1
    const price = Number(quick.price)
    const total = qty * price
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
    const { data, error } = await offlineInsert('invoices', {
      user_id: ownerId,
      invoice_number: invoiceNumber,
      client_name: quick.name, client_phone: quick.phone || null,
      items: [{ description: quick.item, quantity: qty, unit_price: price }],
      subtotal: total, tax_rate: 0, tax_amount: 0, total,
      status: 'sent',
    })
    setGenerating(false)
    if (error) return toast.error(error.message)
    setInvoices([data as Invoice, ...invoices])
    setQuick({ name: '', phone: '', item: '', qty: '1', price: '' })
    setShowQuick(false)
    toast.success('Invoice created — share it now!')
    setShareInv(data as Invoice)
  }

  // ── UPI payment link (uses merchant UPI ID) ────────────────────
  const merchantUpi = profile?.upi_id || ''
  const merchantName = profile?.company_name || profile?.full_name || 'My Shop'
  const upiParams = (inv: Invoice): UPIParams | null => merchantUpi ? {
    payeeVpa: merchantUpi, payeeName: merchantName,
    amount: inv.total, reference: inv.invoice_number, note: `Invoice ${inv.invoice_number}`,
  } : null
  const upiLink = (inv: Invoice) => upiParams(inv) ? buildUpiLink(upiParams(inv)!) : null

  // ── Mark as paid ───────────────────────────────────────────────
  const markPaid = async (inv: Invoice) => {
    const { error } = await supabase.from('invoices').update({
      status: 'paid', paid_at: new Date().toISOString(),
    }).eq('id', inv.id)
    if (!error) {
      setInvoices(invoices.map((i) => i.id === inv.id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i))
      toast.success('Marked as paid ✅')
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (!error) { setInvoices(invoices.filter((i) => i.id !== id)); toast.success('Deleted') }
  }

  const share = (channel: 'whatsapp' | 'sms' | 'copy', inv: Invoice) => {
    const link = upiLink(inv)
    const msg = buildInvoiceMessage({
      invoiceNumber: inv.invoice_number, clientName: inv.client_name, amount: inv.total,
      payeeName: merchantName, paymentLink: link || undefined, dueDate: inv.due_date || undefined,
    })
    if (channel === 'whatsapp') window.open(buildWhatsappLink(inv.client_phone || undefined, msg), '_blank')
    else if (channel === 'sms') window.location.href = buildSmsLink(inv.client_phone || undefined, msg)
    else copyToClipboard(msg).then((ok) => ok ? toast.success('Copied!') : toast.error('Copy failed'))
  }

  // Download a professional PDF invoice (generated in-browser via jsPDF)
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
  const downloadPdf = async (inv: Invoice) => {
    setDownloadingPdf(inv.id)
    try {
      await generateInvoicePdf(inv, profile)
      toast.success('PDF downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'PDF generation failed')
    } finally {
      setDownloadingPdf(null)
    }
  }

  // Stats
  const unpaid = invoices.filter((i) => i.status !== 'paid' && i.status !== 'draft')
  const unpaidTotal = unpaid.reduce((s, i) => s + Number(i.total), 0)
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'paid') return inv.status === 'paid'
    if (statusFilter === 'overdue') return inv.status === 'overdue'
    return inv.status !== 'paid' && inv.status !== 'draft' // unpaid
  })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Invoices"
        subtitle="Create, send via WhatsApp, and collect via UPI"
        icon={<FileText className="w-5 h-5" />}
        action={
          <div className="flex gap-2">
            <button onClick={() => setShowQuick(!showQuick)} className="btn-secondary text-sm"><Zap className="w-4 h-4" /> Quick</button>
            <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'AI Invoice'}</button>
          </div>
        }
      />

      {/* Unpaid summary */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-5"><p className="text-xl font-bold text-amber-400">₹{unpaidTotal.toFixed(0)}</p><p className="text-xs text-slate-400">Unpaid</p></div>
          <div className="card p-5"><p className="text-xl font-bold text-white">{unpaid.length}</p><p className="text-xs text-slate-400">Unpaid invoices</p></div>
          <div className="card p-5"><p className="text-xl font-bold text-red-400">{overdueCount}</p><p className="text-xs text-slate-400">Overdue</p></div>
        </div>
      )}

      {/* AI invoice form */}
      {showForm && (
        <div className="card p-4 mb-6 animate-slide-up">
          <label className="label flex items-center gap-2"><Sparkles className="w-4 h-4 text-brand-400" /> Describe your invoice</label>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} className="input-field resize-none"
            placeholder="e.g. Invoice for Ramesh: 5 bags cement ₹400 each, 10 bricks ₹8 each. Tax 18%. Due 7 days. Phone 9876543210" />
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleGenerate} disabled={generating} className="btn-primary text-sm">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      )}

      {/* Quick invoice (mobile-first) */}
      {showQuick && (
        <div className="card p-4 mb-6 animate-slide-up border-brand-700/40">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Quick Invoice — 30 seconds</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} className="input-field col-span-2" placeholder="Customer name *" />
            <input value={quick.phone} onChange={(e) => setQuick({ ...quick, phone: e.target.value })} className="input-field" placeholder="Phone (for WhatsApp)" />
            <input value={quick.item} onChange={(e) => setQuick({ ...quick, item: e.target.value })} className="input-field" placeholder="Item / service *" />
            <input type="number" value={quick.qty} onChange={(e) => setQuick({ ...quick, qty: e.target.value })} className="input-field w-24" placeholder="Qty" />
            <input type="number" value={quick.price} onChange={(e) => setQuick({ ...quick, price: e.target.value })} className="input-field" placeholder="Price ₹ *" />
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-sm text-slate-400">Total: <span className="text-white font-bold text-lg">₹{((Number(quick.qty) || 1) * (Number(quick.price) || 0)).toFixed(0)}</span></span>
            <button onClick={handleQuickCreate} disabled={generating} className="btn-primary text-sm">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create & Share
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Use Quick Invoice (30 sec on phone), or describe one with AI. Share via WhatsApp and collect via UPI." />
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 mb-5 overflow-x-auto scroll-area">
            {([['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid'], ['overdue', 'Overdue']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setStatusFilter(key)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === key ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>{label}</button>
            ))}
          </div>
          <div className="space-y-3">
            {filteredInvoices.length === 0 ? (
              <p className="text-sm text-fg-muted text-center py-10">No {statusFilter} invoices.</p>
            ) : filteredInvoices.map((inv) => (
              <div key={inv.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2.5">
                    <Avatar name={inv.client_name} size={32} className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white">{inv.invoice_number}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[inv.status]}`}>{inv.status}</span>
                        {inv.reminder_count > 0 && <span className="text-xs text-slate-500">({inv.reminder_count} reminders)</span>}
                      </div>
                      <p className="text-slate-400 text-sm mt-0.5">{inv.client_name}{inv.client_phone && ` · ${inv.client_phone}`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">₹{inv.total.toFixed(2)}</p>
                    {inv.due_date && <p className="text-xs text-slate-500">Due {inv.due_date}</p>}
                  </div>
                </div>

                {/* Items */}
                <div className="mt-3 border-t border-slate-800 pt-3 space-y-1">
                  {inv.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-300">{it.description} <span className="text-slate-500">× {it.quantity}</span></span>
                      <span className="text-slate-400">₹{(it.quantity * it.unit_price).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

              {/* Actions */}
              <div className="flex gap-2 overflow-x-auto scroll-area pb-1 mt-3 pt-3 border-t border-slate-800 [&>button]:flex-shrink-0">
                <button onClick={() => setShareInv(inv)} className="btn-ghost text-xs"><QrCode className="w-3.5 h-3.5" /> Pay / Share</button>
                <button onClick={() => downloadPdf(inv)} disabled={downloadingPdf === inv.id} className="btn-ghost text-xs">
                  {downloadingPdf === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF
                </button>
                <button onClick={() => share('whatsapp', inv)} className="btn-ghost text-xs text-green-400"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</button>
                {inv.status !== 'paid' && inv.status !== 'draft' && (
                  <button onClick={() => markPaid(inv)} className="btn-ghost text-xs text-green-400"><Check className="w-3.5 h-3.5" /> Mark paid</button>
                )}
                <button onClick={() => handleDelete(inv.id)} className="btn-ghost text-xs text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Share / Pay modal */}
      {shareInv && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShareInv(null)}>
          <div className="card w-full max-w-sm rounded-t-2xl sm:rounded-xl p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white">{shareInv.invoice_number} · ₹{shareInv.total.toFixed(0)}</h3>
              <button onClick={() => setShareInv(null)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {upiLink(shareInv) ? (
              <>
                {/* UPI QR */}
                <div className="text-center mb-4">
                  <img src={buildUpiQrUrl(upiParams(shareInv)!!)} alt="UPI QR" className="w-48 h-48 mx-auto rounded-xl bg-white p-2" />
                  <p className="text-xs text-slate-400 mt-2">Scan with any UPI app to pay ₹{shareInv.total}</p>
                </div>
                <a href={upiLink(shareInv)!} className="btn-primary w-full mb-2"><Smartphone className="w-4 h-4" /> Open UPI app to pay</a>
              </>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-600/30 text-xs text-amber-200 mb-4">
                Set your UPI ID in Settings to generate payment links & QR codes for instant collection.
              </div>
            )}

            {/* Share channels */}
            <p className="text-xs text-slate-500 mb-2 mt-2">Send this invoice</p>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => share('whatsapp', shareInv)} className="p-3 rounded-xl bg-green-500/10 text-green-400 hover:bg-green-500/20 flex flex-col items-center gap-1"><MessageCircle className="w-5 h-5" /><span className="text-xs">WhatsApp</span></button>
              <button onClick={() => share('sms', shareInv)} className="p-3 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 flex flex-col items-center gap-1"><MessageCircle className="w-5 h-5" /><span className="text-xs">SMS</span></button>
              <button onClick={() => share('copy', shareInv)} className="p-3 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 flex flex-col items-center gap-1"><Copy className="w-5 h-5" /><span className="text-xs">Copy</span></button>
              <button onClick={() => downloadPdf(shareInv)} disabled={downloadingPdf === shareInv.id} className="p-3 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 flex flex-col items-center gap-1">
                {downloadingPdf === shareInv.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                <span className="text-xs">PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
