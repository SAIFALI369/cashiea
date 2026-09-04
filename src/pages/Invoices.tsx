import { ConfirmDialog } from '../components/ConfirmDialog'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { validateGstin } from '../lib/validation'
import { offlineInsert } from '../lib/mutations'
import { callAI, parseAIJson } from '../lib/ai'
import {
  buildUpiLink, buildInvoiceMessage,
  buildWhatsappLink, buildSmsLink, copyToClipboard, type UPIParams,
} from '../lib/payments'
import { generateInvoicePdf } from '../lib/invoice-pdf'
import type { Invoice, InvoiceItem } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import { MoreMenu } from '../components/MoreMenu'
import { FitAmount } from '../components/FitAmount'
import { UpiQr } from '../components/UpiQr'
import { RecurringModal } from '../components/invoices/RecurringModal'
import EmptyState from '../components/ui/EmptyState'
import { Avatar } from '../components/Avatar'
import { FileText, Sparkles, Loader2, Trash2, Plus, Smartphone, MessageCircle, Send, QrCode, Check, Clock, Copy, Zap, X, Download, FileDown, Pencil, CheckCircle2, CheckSquare, Square, Repeat, Share2 } from 'lucide-react'
import toast from 'react-hot-toast'

const statusColor: Record<string, string> = {
  paid: 'bg-positive/15 text-positive',
  partial: 'bg-warning/15 text-warning',
  viewed: 'bg-info/15 text-info',
  sent: 'bg-info/15 text-info',
  overdue: 'bg-negative/15 text-negative',
  draft: 'bg-surface-3 text-fg-muted',
}

export default function Invoices() {
  const { profile, ownerId } = useAuth()
  const { isOwner } = useCan()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [shareInv, setShareInv] = useState<Invoice | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'overdue'>('all')
  const [showRecurring, setShowRecurring] = useState(false)
  const [recurringSeed, setRecurringSeed] = useState<Invoice | null>(null)
  const PAGE_SIZE = 30
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  // Wait for the profile to resolve (direct page loads race auth restore).
  useEffect(() => { if (ownerId) loadInvoices() }, [ownerId])

  const loadInvoices = async () => {
    setLoading(true)
    const { data } = await supabase.from('invoices').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setInvoices((data as Invoice[]) || [])
    setLoading(false)
  }

  // ── Generate invoice via AI ────────────────────────────────────
  const handleGenerate = async () => {
    if (!isOwner) return toast.error('Only the business owner can create invoices right now')
    if (!prompt.trim()) return toast.error('Describe the invoice first')
    setGenerating(true)
    try {
      const { result } = await callAI({ task_type: 'invoice', prompt, provider: profile?.ai_provider })
      const parsed = parseAIJson<{
        invoice_number: string; client_name: string; client_email?: string
        client_phone?: string; client_address?: string; client_gstin?: string
        items: InvoiceItem[]
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
          payeeName: profile?.company_name || profile?.full_name || 'My Shop',
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
        client_gstin: (parsed.client_gstin || '').toUpperCase() || null,
        items, subtotal, tax_rate: taxRate, tax_amount: taxAmount, total,
        status: 'draft', due_date: parsed.due_date || null,
        notes: parsed.notes || null, payment_link: paymentLink,
      })

      if (error) throw error
      setInvoices([data as Invoice, ...invoices])
      setPrompt(''); setShowForm(false)
      toast.success('Invoice generated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally { setGenerating(false) }
  }

  // ── Quick invoice (mobile-optimized 30-second flow) ────────────
  const [showQuick, setShowQuick] = useState(false)
  const [quick, setQuick] = useState({ name: '', phone: '', gstin: '', item: '', qty: '1', price: '' })
  const handleQuickCreate = async () => {
    if (!isOwner) return toast.error('Only the business owner can create invoices right now')
    if (!quick.name || !quick.item || !quick.price) return toast.error('Fill name, item, and price')
    if (quick.gstin.trim() && !validateGstin(quick.gstin).valid) return toast.error('Enter a valid 15-character GSTIN')
    setGenerating(true)
    const qty = Number(quick.qty) || 1
    const price = Number(quick.price)
    const total = qty * price
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
    const { data, error } = await offlineInsert('invoices', {
      user_id: ownerId,
      invoice_number: invoiceNumber,
      client_name: quick.name, client_phone: quick.phone || null,
      client_gstin: quick.gstin.trim().toUpperCase() || null,
      items: [{ description: quick.item, quantity: qty, unit_price: price }],
      subtotal: total, tax_rate: 0, tax_amount: 0, total,
      status: 'sent',
    })
    setGenerating(false)
    if (error) return toast.error(error.message)
    setInvoices([data as Invoice, ...invoices])
    setQuick({ name: '', phone: '', gstin: '', item: '', qty: '1', price: '' })
    setShowQuick(false)
    toast.success('Invoice created — share it now')
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
    if (!isOwner) return toast.error('Only the business owner can record invoice payments')
    const { error } = await supabase.from('invoices').update({
      status: 'paid', paid_at: new Date().toISOString(),
    }).eq('id', inv.id).eq('user_id', ownerId)
    if (!error) {
      setInvoices(invoices.map((i) => i.id === inv.id ? { ...i, status: 'paid', paid_at: new Date().toISOString() } : i))
    }
  }

  // ── Selection: visible checkboxes + tap on card; Shift+click for
  //    ranges still works on desktop. Card actions never select. ──
  const toggleSelected = (invId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(invId)) next.delete(invId)
      else next.add(invId)
      return next
    })
    setLastClickedId(invId)
  }

  const handleCardClick = (e: React.MouseEvent, invId: string) => {
    if (e.shiftKey && lastClickedId) {
      const ids = filteredInvoices.map((i) => i.id)
      const start = ids.indexOf(lastClickedId)
      const end = ids.indexOf(invId)
      if (start !== -1 && end !== -1) {
        const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          range.forEach((id) => next.add(id))
          return next
        })
      }
    } else {
      toggleSelected(invId)
    }
  }

  const clearSelection = () => { setSelectedIds(new Set()); setLastClickedId(null) }

  const selectAllVisible = () => {
    setSelectedIds(new Set(filteredInvoices.slice(0, visibleCount).map((i) => i.id)))
  }

  const bulkMarkPaid = async () => {
    if (!isOwner) return toast.error('Only the business owner can record invoice payments')
    const targets = invoices.filter((i) => selectedIds.has(i.id) && i.status !== 'paid')
    for (const inv of targets) await markPaid(inv)
    toast.success(`${targets.length} invoice${targets.length !== 1 ? 's' : ''} marked paid`)
    clearSelection()
  }

  const handleDelete = async (id: string) => {
    if (!isOwner) return toast.error('Only the business owner can delete invoices')
    setConfirmDelete(null)
    const { error } = await supabase.from('invoices').delete().eq('id', id).eq('user_id', ownerId)
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
    else copyToClipboard(msg).then((ok) => ok ? toast.success('Copied') : toast.error('Copy failed'))
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

  // Per-card ⋮ menu — replaces swipe actions on touch screens.
  const cardMenu = (inv: Invoice) => [
    ...(isOwner && inv.status !== 'paid' && inv.status !== 'draft'
      ? [{ label: 'Mark paid', icon: <CheckCircle2 className="w-4 h-4" />, onClick: () => markPaid(inv) }]
      : []),
    { label: 'Download PDF', icon: <FileDown className="w-4 h-4" />, onClick: () => downloadPdf(inv) },
    { label: 'Pay / Share', icon: <Share2 className="w-4 h-4" />, onClick: () => setShareInv(inv) },
    ...(isOwner ? [
      { label: 'Make recurring', icon: <Repeat className="w-4 h-4" />, onClick: () => { setRecurringSeed(inv); setShowRecurring(true) } },
      { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, danger: true, onClick: () => setConfirmDelete(inv.id) },
    ] : []),
  ]

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
        action={isOwner ? (
          <div className="flex gap-2">
            <button onClick={() => { setRecurringSeed(null); setShowRecurring(true) }} className="btn-secondary text-sm"><Repeat className="w-4 h-4" /> Recurring</button>
            <button onClick={() => setShowQuick(!showQuick)} className="btn-secondary text-sm"><Zap className="w-4 h-4" /> Quick</button>
            <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'AI Invoice'}</button>
          </div>
        ) : <span className="text-xs text-fg-subtle">Owner-only changes</span>}
      />

      {/* Unpaid summary */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-5"><p className="text-xl font-bold text-warning">₹{unpaidTotal.toFixed(0)}</p><p className="text-xs text-fg-muted">Unpaid</p></div>
          <div className="card p-5"><p className="text-xl font-bold text-fg">{unpaid.length}</p><p className="text-xs text-fg-muted">Unpaid invoices</p></div>
          <div className="card p-5"><p className="text-xl font-bold text-negative">{overdueCount}</p><p className="text-xs text-fg-muted">Overdue</p></div>
        </div>
      )}

      {/* AI invoice form */}
      {isOwner && showForm && (
        <div className="card p-4 mb-6 animate-slide-up">
          <label className="label flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Describe your invoice</label>
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
      {isOwner && showQuick && (
        <div className="card p-4 mb-6 animate-slide-up">
          <h3 className="font-semibold text-fg mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-warning" /> Quick Invoice — 30 seconds</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={quick.name} onChange={(e) => setQuick({ ...quick, name: e.target.value })} className="input-field col-span-2" placeholder="Customer name *" />
            <input value={quick.phone} onChange={(e) => setQuick({ ...quick, phone: e.target.value })} className="input-field" placeholder="Phone (for WhatsApp)" />
            <input value={quick.gstin} onChange={(e) => setQuick({ ...quick, gstin: e.target.value })} className="input-field font-mono uppercase" placeholder="Buyer GSTIN (B2B, optional)" inputMode="numeric" aria-label="Buyer GSTIN" />
            <input value={quick.item} onChange={(e) => setQuick({ ...quick, item: e.target.value })} className="input-field" placeholder="Item / service *" />
            <input type="number" value={quick.qty} onChange={(e) => setQuick({ ...quick, qty: e.target.value })} className="input-field w-24" placeholder="Qty" />
            <input type="number" value={quick.price} onChange={(e) => setQuick({ ...quick, price: e.target.value })} className="input-field" placeholder="Price ₹ *" />
          </div>
          <div className="flex justify-between items-center mt-3">
            <span className="text-sm text-fg-muted">Total: <span className="text-fg font-bold text-lg">₹{((Number(quick.qty) || 1) * (Number(quick.price) || 0)).toFixed(0)}</span></span>
            <button onClick={handleQuickCreate} disabled={generating} className="btn-primary text-sm">
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Create & Share
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : invoices.length === 0 ? (
        <EmptyState icon={FileText} title="No invoices yet" description="Use Quick Invoice (30 sec on phone), or describe one with AI. Share via WhatsApp and collect via UPI." />
      ) : (
        <>
          {/* Filter tabs + selection controls */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex gap-2 overflow-x-auto scroll-area flex-1">
              {([['all', 'All'], ['unpaid', 'Unpaid'], ['paid', 'Paid'], ['overdue', 'Overdue']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setStatusFilter(key)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === key ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>{label}</button>
              ))}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={selectedIds.size > 0 ? clearSelection : selectAllVisible}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${selectedIds.size > 0 ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}
                aria-label={selectedIds.size > 0 ? 'Clear selection' : 'Select all visible invoices'}
              >
                {selectedIds.size > 0 ? <X className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                {selectedIds.size > 0 ? 'Clear' : 'Select all'}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-fg-subtle" />
                </div>
                <p className="text-base font-semibold text-fg">No {statusFilter} invoices</p>
                <p className="text-sm text-fg-muted mt-1 max-w-xs">
                  {statusFilter === 'overdue' ? 'Nothing overdue — all your bills are collected or current.' : statusFilter === 'unpaid' ? 'All invoices are paid. Create a new one from the POS counter.' : 'Switch filters or create your first invoice.'}
                </p>
                <button onClick={() => setStatusFilter('all')} className="btn-secondary text-xs h-9 px-4 mt-4">
                  View all invoices
                </button>
              </div>
            ) : filteredInvoices.slice(0, visibleCount).map((inv) => (
              <div
                key={inv.id}
                className={`card p-4 cursor-pointer transition-colors ${selectedIds.has(inv.id) ? 'border-accent bg-accent-soft/30' : ''}`}
                onClick={(e) => handleCardClick(e, inv.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2.5">
                    {/* Always-visible selection checkbox — 44px target */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelected(inv.id) }}
                      className={`w-11 h-11 -ml-2 -mt-2 flex items-center justify-center flex-shrink-0 rounded-xl ${selectedIds.has(inv.id) ? 'text-accent' : 'text-fg-subtle hover:text-fg'}`}
                      aria-label={selectedIds.has(inv.id) ? `Unselect ${inv.invoice_number}` : `Select ${inv.invoice_number}`}
                      aria-pressed={selectedIds.has(inv.id)}
                    >
                      {selectedIds.has(inv.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <Avatar name={inv.client_name} size={32} className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-fg">{inv.invoice_number}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[inv.status]}`}>{inv.status}</span>
                        {inv.recurring_id && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-soft text-accent-strong flex items-center gap-1"><Repeat className="w-3 h-3" /> recurring</span>}
                        {inv.reminder_count > 0 && <span className="text-xs text-fg-subtle">({inv.reminder_count} reminders)</span>}
                      </div>
                      <p className="text-fg-muted text-sm mt-0.5">{inv.client_name}{inv.client_phone && ` · ${inv.client_phone}`}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-1">
                    <div className="text-right max-w-40">
                      <FitAmount value={`₹${inv.total.toFixed(2)}`} base="text-xl" minTier="text-sm" className="font-bold text-fg" />
                      {inv.due_date && <p className="text-xs text-fg-subtle">Due {inv.due_date}</p>}
                    </div>
                    {/* ⋮ menu — replaces swipe actions */}
                    <MoreMenu items={cardMenu(inv)} label={`Actions for ${inv.invoice_number}`} />
                  </div>
                </div>

                {/* Items */}
                <div className="mt-3 border-t border-line pt-3 space-y-1">
                  {inv.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-fg-muted">{it.description} <span className="text-fg-subtle">× {it.quantity}</span></span>
                      <span className="text-fg-muted">₹{(it.quantity * it.unit_price).toFixed(0)}</span>
                    </div>
                  ))}
                </div>

                {/* Quick actions — menu (⋮) holds the full set */}
                <div className="flex gap-2 overflow-x-auto scroll-area pb-1 mt-3 pt-3 border-t border-line [&>button]:flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setShareInv(inv)} className="btn-ghost text-xs h-11"><QrCode className="w-3.5 h-3.5" /> Pay / Share</button>
                  <button onClick={() => downloadPdf(inv)} disabled={downloadingPdf === inv.id} className="btn-ghost text-xs h-11">
                    {downloadingPdf === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} PDF
                  </button>
                  <button onClick={() => share('whatsapp', inv)} className="btn-ghost text-xs h-11 text-positive"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</button>
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
              <h3 className="font-bold text-fg">{shareInv.invoice_number} · ₹{shareInv.total.toFixed(0)}</h3>
              <button onClick={() => setShareInv(null)} className="w-11 h-11 -mr-2 -mt-2 rounded-xl flex items-center justify-center text-fg-subtle hover:text-fg"><X className="w-5 h-5" /></button>
            </div>

            {upiLink(shareInv) ? (
              <>
                {/* UPI QR — loading, error and fallback states handled inside */}
                <div className="flex justify-center mb-4">
                  <UpiQr
                    upiId={merchantUpi}
                    payeeName={merchantName}
                    amount={shareInv.total}
                    reference={shareInv.invoice_number}
                    note={`Invoice ${shareInv.invoice_number}`}
                  />
                </div>
                <a href={upiLink(shareInv)!} className="btn-primary w-full mb-2"><Smartphone className="w-4 h-4" /> Open UPI app to pay</a>
              </>
            ) : (
              <div className="p-3 rounded-xl bg-warning/10 border border-warning/30 text-xs text-fg mb-4">
                Set your UPI ID in Settings to generate payment links and QR codes for instant collection.
              </div>
            )}

            {/* Share channels */}
            <p className="text-xs text-fg-subtle mb-2 mt-2">Send this invoice</p>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => share('whatsapp', shareInv)} className="p-3 rounded-xl bg-positive/10 text-positive hover:bg-positive/20 flex flex-col items-center gap-1"><MessageCircle className="w-5 h-5" /><span className="text-xs">WhatsApp</span></button>
              <button onClick={() => share('sms', shareInv)} className="p-3 rounded-xl bg-info/10 text-info hover:bg-info/20 flex flex-col items-center gap-1"><MessageCircle className="w-5 h-5" /><span className="text-xs">SMS</span></button>
              <button onClick={() => share('copy', shareInv)} className="p-3 rounded-xl bg-surface-3/50 text-fg-muted hover:bg-surface-3 flex flex-col items-center gap-1"><Copy className="w-5 h-5" /><span className="text-xs">Copy</span></button>
              <button onClick={() => downloadPdf(shareInv)} disabled={downloadingPdf === shareInv.id} className="p-3 rounded-xl bg-negative/10 text-negative hover:bg-negative/20 flex flex-col items-center gap-1">
                {downloadingPdf === shareInv.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileDown className="w-5 h-5" />}
                <span className="text-xs">PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recurring invoices manager */}
      <RecurringModal
        open={isOwner && showRecurring}
        ownerId={ownerId || ''}
        seed={recurringSeed}
        onDone={() => loadInvoices()}
        onClose={() => { setShowRecurring(false); setRecurringSeed(null) }}
      />

      {/* Bulk action bar — Select all / Clear / bulk actions */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 lg:bottom-8 inset-x-4 lg:left-72 lg:right-8 z-30"
        >
          <div className="card p-3 flex items-center gap-3 shadow-float">
            <span className="text-sm font-bold text-fg whitespace-nowrap">{selectedIds.size} selected</span>
            <div className="flex-1" />
            {isOwner && <button onClick={bulkMarkPaid} className="btn-primary text-xs h-11 px-4">
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Paid
            </button>}
            <button onClick={selectAllVisible} className="btn-secondary text-xs h-11 px-4">
              <CheckSquare className="w-3.5 h-3.5" /> Select all
            </button>
            <button onClick={clearSelection} className="btn-secondary text-xs h-11 px-4">
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        </motion.div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete invoice?"
        message="This invoice will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />

      {visibleCount < filteredInvoices.length && (
        <button
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          className="btn-secondary w-full text-sm h-11 mt-4"
        >
          Show {Math.min(PAGE_SIZE, filteredInvoices.length - visibleCount)} more ({visibleCount} of {filteredInvoices.length})
        </button>
      )}
    </div>
  )
}
