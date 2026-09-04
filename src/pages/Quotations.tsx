import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import type { Quotation, Customer } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { FileSignature, Plus, Loader2, Trash2, X, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface QuoteItem { description: string; quantity: string; unit_price: string }

export default function Quotations() {
  const { profile, ownerId } = useAuth()
  const { isOwner } = useCan()
  const navigate = useNavigate()
  const [quotes, setQuotes] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ customer_id: string; customer_name: string; customer_email: string; tax_rate: string; valid_until: string; notes: string; items: QuoteItem[] }>({ customer_id: '', customer_name: '', customer_email: '', tax_rate: '', valid_until: '', notes: '', items: [{ description: '', quantity: '', unit_price: '' }] })

  useEffect(() => {
    if (ownerId) loadData()
    else { setQuotes([]); setCustomers([]); setLoading(false) }
  }, [ownerId])

  const loadData = async () => {
    if (!ownerId) return
    setLoading(true)
    const [q, c] = await Promise.all([
      supabase.from('quotations').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('user_id', ownerId).order('name'),
    ])
    setQuotes((q.data as Quotation[]) || [])
    setCustomers((c.data as Customer[]) || [])
    setLoading(false)
  }

  const updateItem = (i: number, field: keyof QuoteItem, val: string) => {
    const items = [...form.items]; items[i] = { ...items[i], [field]: val }; setForm({ ...form, items })
  }
  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', quantity: '', unit_price: '' }] })
  const removeItem = (i: number) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) })

  const subtotal = form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  const taxAmount = (subtotal * (Number(form.tax_rate) || 0)) / 100
  const total = subtotal + taxAmount

  const selectCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id)
    setForm({ ...form, customer_id: id, customer_name: c?.name || '', customer_email: c?.email || '' })
  }

  const create = async () => {
    if (!isOwner) return toast.error('Only the business owner can create quotations')
    const validItems = form.items.filter((it) => it.description.trim() && it.quantity)
    if (!form.customer_name.trim()) return toast.error('Customer name required')
    if (validItems.length === 0) return toast.error('Add at least one item')
    const quoteNumber = `QT-${Date.now().toString().slice(-7)}`
    const { data, error } = await supabase.from('quotations').insert({
      user_id: ownerId, customer_id: form.customer_id || null, quote_number: quoteNumber,
      customer_name: form.customer_name, customer_email: form.customer_email || null,
      items: validItems.map((it) => ({ description: it.description, quantity: Number(it.quantity), unit_price: Number(it.unit_price) || 0 })),
      subtotal, tax_rate: Number(form.tax_rate) || 0, tax_amount: taxAmount, total,
      status: 'sent', valid_until: form.valid_until || null, notes: form.notes || null,
    }).select().single()
    if (error) { toast.error(error.message); return }
    setQuotes([data as Quotation, ...quotes])
    setForm({ customer_id: '', customer_name: '', customer_email: '', tax_rate: '', valid_until: '', notes: '', items: [{ description: '', quantity: '', unit_price: '' }] })
    setShowForm(false)
    toast.success('Quotation created')
  }

  const convertToInvoice = async (q: Quotation) => {
    if (!isOwner) return toast.error('Only the business owner can convert quotations')
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`
    const { error } = await supabase.from('invoices').insert({
      user_id: ownerId,
      invoice_number: invoiceNumber,
      client_name: q.customer_name,
      client_email: q.customer_email,
      items: q.items.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price })),
      subtotal: q.subtotal, tax_rate: q.tax_rate, tax_amount: q.tax_amount, total: q.total,
      status: 'sent', notes: `Converted from ${q.quote_number}`,
    })
    if (error) { toast.error(error.message); return }
    await supabase.from('quotations').update({ status: 'converted' }).eq('id', q.id)
    setQuotes(quotes.map((x) => x.id === q.id ? { ...x, status: 'converted' } : x))
    toast.success('Converted to invoice!')
    navigate('/app/invoices')
  }

  const del = async (id: string) => {
    if (!isOwner) return toast.error('Only the business owner can delete quotations')
    const { error } = await supabase.from('quotations').delete().eq('id', id)
    if (!error) { setQuotes(quotes.filter((q) => q.id !== id)); toast.success('Deleted') }
  }

  const statusColor: Record<string, string> = { sent: 'bg-info/15 text-info', accepted: 'bg-positive/15 text-positive', converted: 'bg-purple-500/15 text-purple-400', rejected: 'bg-negative/15 text-negative', draft: 'bg-surface-3 text-fg-muted', expired: 'bg-surface-3 text-fg-muted' }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Quotations" subtitle="Create price quotes and convert them to invoices" icon={<FileSignature className="w-5 h-5" />} action={isOwner ? <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'New Quote'}</button> : <span className="text-xs text-fg-subtle">Owner-only changes</span>} />

      {isOwner && showForm && (
        <div className="card p-4 mb-6 animate-slide-up">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div><label className="label">Customer</label><select value={form.customer_id} onChange={(e) => selectCustomer(e.target.value)} className="input-field"><option value="">Walk-in / type name</option>{customers.map((c) => <option key={c.id} value={c.id} className="bg-surface">{c.name}</option>)}</select></div>
            <div><label className="label">Or customer name</label><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="input-field" placeholder="Customer name" /></div>
            <div><label className="label">Tax %</label><input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className="input-field" placeholder="18" /></div>
            <div><label className="label">Valid until</label><input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} className="input-field" /></div>
          </div>
          <label className="label">Items</label>
          {form.items.map((it, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="input-field flex-1" placeholder="Item / service" />
              <input type="number" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} className="input-field w-20" placeholder="Qty" />
              <input type="number" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} className="input-field w-28" placeholder="Price" />
              {form.items.length > 1 && <button onClick={() => removeItem(i)} className="text-negative px-2"><X className="w-4 h-4" /></button>}
            </div>
          ))}
          <button onClick={addItem} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> Add item</button>
          <div className="space-y-1 mt-3 border-t border-line pt-3 text-sm">
            <div className="flex justify-between text-fg-muted"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-fg-muted"><span>Tax</span><span>₹{taxAmount.toFixed(2)}</span></div>
            <div className="flex justify-between text-lg font-bold text-fg"><span>Total</span><span>₹{total.toFixed(2)}</span></div>
          </div>
          <div className="flex justify-end gap-3 mt-3"><button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button><button onClick={create} className="btn-primary text-sm">Create Quotation</button></div>
        </div>
      )}

      {!showForm && quotes.length > 0 && quotes.length <= 3 && (
        <p className="text-xs text-fg-muted bg-accent-soft/40 border border-accent/20 rounded-control px-3 py-2 mb-4">
          💡 Quotes convert to invoices in one tap once a customer confirms.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : quotes.length === 0 ? (
        <EmptyState icon={FileSignature} title="No quotations yet" description="Create a price quote for a customer, then convert it to an invoice with one click." />
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <div key={q.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><span className="font-mono text-sm text-fg">{q.quote_number}</span><span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[q.status]}`}>{q.status}</span></div>
                <p className="text-xs text-fg-subtle mt-0.5">{q.customer_name} · {q.items?.length || 0} items · {new Date(q.created_at).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-semibold text-fg">{formatINR(Number(q.total), 0)}</span>
                {isOwner && (q.status === 'sent' || q.status === 'accepted') && <button onClick={() => convertToInvoice(q)} className="btn-primary text-xs whitespace-nowrap">Convert <ArrowRight className="w-3 h-3" /></button>}
                {isOwner && <button onClick={() => del(q.id)} className="text-fg-subtle hover:text-negative"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
