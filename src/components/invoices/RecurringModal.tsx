import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Loader2, Pause, Play, Plus, Repeat, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatINR } from '../../lib/format'
import type { Invoice, RecurringInvoice } from '../../lib/types'
import { ConfirmDialog } from '../ConfirmDialog'
import toast from 'react-hot-toast'

/**
 * RecurringModal — weekly / monthly / yearly billing profiles.
 * The backend job (generate_recurring_invoices, daily 06:30 IST)
 * creates the invoices automatically; this UI creates, pauses,
 * resumes and deletes the profiles. Pre-fill from any existing
 * invoice with `seed`.
 */
export function RecurringModal({
  open, ownerId, seed, onDone, onClose,
}: {
  open: boolean
  ownerId: string
  /** Optional invoice to pre-fill the form from ("Make recurring"). */
  seed: Invoice | null
  onDone: () => void
  onClose: () => void
}) {
  const [list, setList] = useState<RecurringInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<RecurringInvoice | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    client_name: '', client_phone: '',
    items: [{ description: '', qty: '1', price: '' }] as { description: string; qty: string; price: string }[],
    tax_rate: '0', frequency: 'monthly' as 'weekly' | 'monthly' | 'yearly',
    start_date: today, end_date: '',
  })

  const reload = async () => {
    if (!ownerId) return
    setLoading(true)
    const { data } = await supabase
      .from('recurring_invoices')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(100)
    setList((data as RecurringInvoice[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    if (!open) return
    reload()
    if (seed) {
      setForm({
        client_name: seed.client_name || '',
        client_phone: seed.client_phone || '',
        items: (seed.items || []).map((it) => ({ description: it.description || '', qty: String(it.quantity || 1), price: String(it.unit_price || '') })),
        tax_rate: String(seed.tax_rate || 0),
        frequency: 'monthly',
        start_date: today,
        end_date: '',
      })
      setShowForm(true)
    }
  }, [open, ownerId])

  const formTotal = useMemo(() => {
    const sub = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    return Math.round(sub * (1 + (Number(form.tax_rate) || 0) / 100) * 100) / 100
  }, [form])

  if (!open) return null

  const save = async () => {
    if (!form.client_name.trim()) return toast.error('Customer name is required')
    const items = form.items
      .filter((it) => it.description.trim())
      .map((it) => ({ description: it.description.trim(), quantity: Number(it.qty) || 1, unit_price: Number(it.price) || 0 }))
    if (!items.length) return toast.error('Add at least one item')

    setSaving(true)
    try {
      const { error } = await supabase.from('recurring_invoices').insert({
        user_id: ownerId,
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim() || null,
        items,
        tax_rate: Number(form.tax_rate) || 0,
        frequency: form.frequency,
        start_date: form.start_date,
        end_date: form.end_date || null,
        next_invoice_date: form.start_date,
        status: 'active',
      })
      if (error) throw error
      toast.success(`Recurring invoice saved — first invoice on ${new Date(form.start_date).toLocaleDateString('en-IN')}`)
      setShowForm(false)
      setForm({ client_name: '', client_phone: '', items: [{ description: '', qty: '1', price: '' }], tax_rate: '0', frequency: 'monthly', start_date: today, end_date: '' })
      reload()
      onDone()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (r: RecurringInvoice, status: 'active' | 'paused') => {
    try {
      const { error } = await supabase.from('recurring_invoices').update({ status, updated_at: new Date().toISOString() }).eq('id', r.id).eq('user_id', ownerId)
      if (error) throw error
      setList(list.map((x) => (x.id === r.id ? { ...x, status } : x)))
      toast.success(status === 'paused' ? 'Paused — no new invoices until resumed' : 'Resumed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update')
    }
  }

  const remove = async (r: RecurringInvoice) => {
    setConfirmDelete(null)
    try {
      const { error } = await supabase.from('recurring_invoices').delete().eq('id', r.id).eq('user_id', ownerId)
      if (error) throw error
      setList(list.filter((x) => x.id !== r.id))
      toast.success('Recurring invoice deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not delete')
    }
  }

  const statusChip = (s: string) =>
    s === 'active' ? 'bg-positive/15 text-positive' : s === 'paused' ? 'bg-warning/15 text-warning' : 'bg-surface-2 text-fg-subtle'

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label="Recurring invoices">
        <div className="card w-full sm:max-w-lg rounded-b-none sm:rounded-card max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-line flex-shrink-0">
            <h3 className="font-bold text-fg flex items-center gap-2"><Repeat className="w-5 h-5 text-accent" /> Recurring invoices</h3>
            <div className="flex items-center gap-2">
              {!showForm && (
                <button onClick={() => setShowForm(true)} className="btn-primary text-xs py-2 px-3"><Plus className="w-3.5 h-3.5" /> New</button>
              )}
              <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scroll-area p-4 space-y-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            {/* Create form */}
            {showForm && (
              <div className="rounded-xl border border-line bg-surface/60 p-3 space-y-3">
                <p className="text-xs font-semibold text-fg-muted">New recurring profile{seed ? ' — from ' + seed.invoice_number : ''}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="input-field col-span-2" placeholder="Customer name *" aria-label="Customer name" />
                  <input value={form.client_phone} onChange={(e) => setForm({ ...form, client_phone: e.target.value })} className="input-field col-span-2" placeholder="Phone (optional)" inputMode="tel" aria-label="Customer phone" />
                </div>

                {form.items.map((it, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={it.description}
                      onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })}
                      className="input-field flex-1" placeholder="Item / service" aria-label="Item description"
                    />
                    <input
                      type="number" min={1} value={it.qty}
                      onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) })}
                      className="input-field w-20" placeholder="Qty" aria-label="Quantity"
                    />
                    <input
                      type="number" min={0} step="0.01" value={it.price}
                      onChange={(e) => setForm({ ...form, items: form.items.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })}
                      className="input-field w-28" placeholder="Price ₹" aria-label="Unit price"
                    />
                    <button
                      onClick={() => setForm({ ...form, items: form.items.filter((_, j) => j !== i) })}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-fg-subtle hover:text-negative flex-shrink-0" aria-label="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button onClick={() => setForm({ ...form, items: [...form.items, { description: '', qty: '1', price: '' }] })} className="text-xs font-semibold text-accent hover:underline">+ Add item</button>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label text-xs">GST %</label>
                    <input type="number" min={0} max={28} value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} className="input-field" aria-label="GST rate" />
                  </div>
                  <div>
                    <label className="label text-xs">Repeats</label>
                    <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as typeof form.frequency })} className="input-field" aria-label="Frequency">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">First invoice</label>
                    <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input-field" aria-label="First invoice date" />
                  </div>
                </div>
                <div>
                  <label className="label text-xs">End date (optional)</label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input-field" aria-label="End date" />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-sm text-fg-muted">Each invoice: <span className="font-bold text-fg">{formatINR(formTotal)}</span></p>
                  <div className="flex gap-2">
                    <button onClick={() => setShowForm(false)} className="btn-ghost py-2 text-xs">Cancel</button>
                    <button onClick={save} disabled={saving} className="btn-primary py-2 text-xs flex items-center gap-1.5">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat className="w-3.5 h-3.5" />} Save recurring
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* List */}
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
            ) : list.length === 0 && !showForm ? (
              <div className="text-center py-10 px-4">
                <Repeat className="w-8 h-8 text-fg-subtle mx-auto mb-3" />
                <p className="text-sm font-semibold text-fg">No recurring invoices</p>
                <p className="text-xs text-fg-subtle mt-1">Bill rent, retainers or subscriptions automatically — weekly, monthly or yearly.</p>
              </div>
            ) : (
              list.map((r) => {
                const sub = (r.items || []).reduce((s, it) => s + (it.quantity || 0) * (it.unit_price || 0), 0)
                const total = Math.round(sub * (1 + (r.tax_rate || 0) / 100) * 100) / 100
                return (
                  <div key={r.id} className="rounded-xl border border-line bg-surface/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-fg truncate">{r.client_name}</p>
                        <p className="text-xs text-fg-subtle mt-0.5 flex items-center gap-1 flex-wrap">
                          <CalendarClock className="w-3 h-3" />
                          {r.frequency} · next {new Date(r.next_invoice_date).toLocaleDateString('en-IN')}
                          {r.end_date && <> · until {new Date(r.end_date).toLocaleDateString('en-IN')}</>}
                          {r.last_generated_at && <> · last {new Date(r.last_generated_at).toLocaleDateString('en-IN')}</>}
                        </p>
                        <p className="text-xs text-fg-muted mt-0.5">
                          {(r.items || []).length} item{(r.items || []).length !== 1 ? 's' : ''} · {formatINR(total)} per invoice
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${statusChip(r.status)}`}>{r.status}</span>
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      {r.status === 'active' ? (
                        <button onClick={() => setStatus(r, 'paused')} className="btn-ghost text-xs py-2 px-3 flex items-center gap-1.5"><Pause className="w-3.5 h-3.5" /> Pause</button>
                      ) : r.status === 'paused' ? (
                        <button onClick={() => setStatus(r, 'active')} className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> Resume</button>
                      ) : null}
                      <button onClick={() => setConfirmDelete(r)} className="px-3 py-2 rounded-xl border border-line text-negative hover:bg-negative/10 text-xs font-semibold flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                )
              })
            )}

            <p className="text-[11px] text-fg-subtle text-center pt-1">
              Invoices generate automatically every morning. Duplicates are impossible — one invoice per period, guaranteed by the database.
            </p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete recurring invoice?"
        message={`"${confirmDelete?.client_name}" will stop generating invoices. Already-created invoices stay.`}
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}
