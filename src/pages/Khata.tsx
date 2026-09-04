import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { FitAmount } from '../components/FitAmount'
import { BookOpen, Plus, Loader2, Trash2, Search, Phone, X, Send, TrendingUp, TrendingDown, UserPlus, ChevronRight, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Khata — Digital Udhaar Book (beats Khatabook/OkCredit)
 *
 * Features:
 * - Track credit (udhaar) given to customers
 * - One-tap "payment received" to settle
 * - WhatsApp reminder with AI-drafted message
 * - Customer khata summary with total outstanding
 * - Quick add: name + amount in 2 taps
 * - Real-time outstanding vs collected tracking
 */

interface KhataEntry {
  id: string
  customer_name: string
  customer_phone: string | null
  amount: number
  note: string | null
  status: 'pending' | 'settled'
  created_at: string
  settled_at: string | null
}

const emptyForm = { customer_name: '', customer_phone: '', amount: '', note: '' }

export default function Khata() {
  const { ownerId } = useAuth()
  const { isOwner } = useCan()
  const [entries, setEntries] = useState<KhataEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('pending')
  const [confirmSettle, setConfirmSettle] = useState<KhataEntry | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<KhataEntry | null>(null)

  useEffect(() => {
    if (!ownerId) { setEntries([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    supabase.from('khata_entries').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(200)
      .then(({ data }) => { if (!cancelled) { setEntries((data as KhataEntry[]) || []); setLoading(false) } })
    return () => { cancelled = true }
  }, [ownerId])

  const add = async () => {
    if (!isOwner) { toast.error('Only the business owner can change khata entries'); return }
    if (!ownerId) { toast.error('Your shop is still loading — please try again'); return }
    if (!form.customer_name.trim() || !form.amount) return toast.error('Name and amount required')
    const { data, error } = await supabase
      .from('khata_entries')
      .insert({
        user_id: ownerId,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        amount: Number(form.amount),
        note: form.note || null,
        status: 'pending',
      })
      .select()
      .single()
    if (error) return toast.error(error.message)
    setEntries([data as KhataEntry, ...entries])
    toast.success(`₹${form.amount} udhaar noted for ${form.customer_name}`)
    setForm(emptyForm); setShowForm(false)
  }

  const settle = async (entry: KhataEntry) => {
    if (!isOwner) { toast.error('Only the business owner can settle khata entries'); return }
    if (!ownerId) return
    setConfirmSettle(null)
    // Optimistic update
    setEntries(entries.map((e) => e.id === entry.id ? { ...e, status: 'settled', settled_at: new Date().toISOString() } : e))
    toast.success(`₹${entry.amount} received from ${entry.customer_name}`)
    const { error } = await supabase
      .from('khata_entries')
      .update({ status: 'settled', settled_at: new Date().toISOString() })
      .eq('id', entry.id)
      .eq('user_id', ownerId)
    if (error) {
      // Rollback
      setEntries(entries)
      toast.error('Could not save — try again')
    }
  }

  const remove = async (entry: KhataEntry) => {
    if (!isOwner) { toast.error('Only the business owner can delete khata entries'); return }
    if (!ownerId) return
    setConfirmDelete(null)
    setEntries(entries.filter((e) => e.id !== entry.id))
    const { error } = await supabase.from('khata_entries').delete().eq('id', entry.id).eq('user_id', ownerId)
    if (error) { setEntries(entries); toast.error('Could not delete') }
    else toast.success('Entry removed')
  }

  const sendReminder = (entry: KhataEntry) => {
    const msg = `Namaste ${entry.customer_name}, this is a friendly reminder — ₹${entry.amount} is pending on your khata. Please pay at your convenience. Thank you! 🙏`
    if (entry.customer_phone) {
      const waLink = `https://wa.me/91${entry.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
      window.open(waLink, '_blank')
    } else {
      navigator.clipboard?.writeText(msg)
      toast.success('Message copied — paste it in WhatsApp')
    }
  }

  // Group by customer for summary
  const customerSummary = useMemo(() => {
    const byCustomer = new Map<string, { name: string; phone: string | null; pending: number; total: number; entries: KhataEntry[] }>()
    for (const e of entries) {
      const key = e.customer_name.toLowerCase()
      if (!byCustomer.has(key)) {
        byCustomer.set(key, { name: e.customer_name, phone: e.customer_phone, pending: 0, total: 0, entries: [] })
      }
      const c = byCustomer.get(key)!
      c.total += e.amount
      if (e.status === 'pending') c.pending += e.amount
      c.entries.push(e)
    }
    return Array.from(byCustomer.values()).sort((a, b) => b.pending - a.pending)
  }, [entries])

  const totalPending = entries.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0)
  const totalCollected = entries.filter((e) => e.status === 'settled').reduce((s, e) => s + e.amount, 0)

  const filtered = useMemo(() => {
    let list = entries
    if (filter !== 'all') list = list.filter((e) => e.status === filter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((e) => e.customer_name?.toLowerCase().includes(q) || e.note?.toLowerCase().includes(q))
    }
    return list
  }, [entries, search, filter])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Khata"
        subtitle="Digital udhaar book — track credit, collect payments"
        icon={<BookOpen className="w-5 h-5" />}
        action={isOwner ? (
          <button onClick={() => { setForm(emptyForm); setShowForm(true) }} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Add udhaar
          </button>
        ) : <span className="text-xs text-fg-subtle">Owner-only changes</span>}
      />

      {/* Stats strip */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">Outstanding</p>
            <FitAmount value={formatINR(totalPending, 0)} base="text-xl" minTier="text-sm" className="font-bold text-negative" />
          </div>
          <div className="card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">Collected</p>
            <FitAmount value={formatINR(totalCollected, 0)} base="text-xl" minTier="text-sm" className="font-bold text-positive" />
          </div>
          <div className="card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">Customers</p>
            <p className="text-xl font-bold text-fg tabular-nums">{customerSummary.length}</p>
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 rounded-control border border-line bg-paper px-3 shadow-soft focus-within:border-accent/50 transition-colors">
          <Search className="w-4 h-4 text-fg-subtle flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer or note…"
            className="flex-1 bg-transparent py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none min-w-0"
          />
          {search && <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto scroll-area pb-1">
        {([['pending', 'Pending', AlertCircle], ['settled', 'Collected', CheckCircle2], ['all', 'All', BookOpen]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === key ? 'bg-accent text-accent-fg shadow-soft' : 'bg-surface-2 text-fg-muted hover:text-fg'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-fg-subtle" /></div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No udhaar entries yet"
          description="Track credit you give to customers. When they pay, one tap settles it. Send WhatsApp reminders with AI-drafted messages."
        />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-fg-subtle" />
          </div>
          <p className="text-base font-semibold text-fg">No {filter} entries</p>
          <p className="text-sm text-fg-muted mt-1">
            {filter === 'pending' ? "All udhaar collected! Nothing outstanding." : "Switch filters to see other entries."}
          </p>
          <button onClick={() => setFilter('all')} className="btn-secondary text-xs h-9 px-4 mt-4">View all</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <div
              key={e.id}
              className={`card p-4 flex items-start justify-between gap-3 ${e.status === 'settled' ? 'opacity-60' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-fg truncate">{e.customer_name}</p>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    e.status === 'pending' ? 'bg-warning/10 text-warning' : 'bg-positive/10 text-positive'
                  }`}>
                    {e.status === 'pending' ? 'Pending' : 'Collected'}
                  </span>
                </div>
                {e.note && <p className="text-xs text-fg-muted truncate mt-0.5">{e.note}</p>}
                <div className="flex items-center gap-2 text-[10px] text-fg-subtle mt-1.5">
                  <span>{new Date(e.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  {e.customer_phone && <><span>·</span><span>{e.customer_phone}</span></>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-lg font-bold tabular-nums number-fit ${e.status === 'pending' ? 'text-negative' : 'text-positive'}`}>
                  {formatINR(e.amount, 0)}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  {e.status === 'pending' && (
                    <>
                      {isOwner && <button
                        onClick={() => setConfirmSettle(e)}
                        className="text-xs font-bold text-positive bg-positive/10 rounded-control px-2.5 h-7 hover:bg-positive/20 transition-colors"
                      >
                        Received
                      </button>}
                      <button
                        onClick={() => sendReminder(e)}
                        className="text-xs font-bold text-accent bg-accent-soft rounded-control px-2.5 h-7 hover:bg-accent-soft/70 transition-colors"
                        aria-label="Send WhatsApp reminder"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {isOwner && <button
                    onClick={() => setConfirmDelete(e)}
                    className="text-xs text-fg-subtle hover:text-negative transition-colors p-1"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer summary section */}
      {!loading && customerSummary.length > 1 && filter === 'all' && (
        <div className="mt-8">
          <h3 className="text-sm font-bold text-fg mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> Customer Summary
          </h3>
          <div className="space-y-2">
            {customerSummary.slice(0, 10).map((c) => (
              <div key={c.name} className="card p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg truncate">{c.name}</p>
                  <p className="text-xs text-fg-subtle">{c.entries.length} entries</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {c.pending > 0 ? (
                    <p className="text-sm font-bold text-negative tabular-nums">{formatINR(c.pending, 0)} pending</p>
                  ) : (
                    <p className="text-sm font-bold text-positive tabular-nums">All clear</p>
                  )}
                  <p className="text-[10px] text-fg-subtle">{formatINR(c.total, 0)} total</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add udhaar form */}
      {isOwner && showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-md rounded-t-2xl sm:rounded-card p-5" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-fg">Add udhaar entry</h3>
              <button onClick={() => setShowForm(false)} className="text-fg-muted hover:text-fg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Customer name *</label>
                <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className="input-field" placeholder="Ramesh" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Amount (₹) *</label>
                  <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" placeholder="500" inputMode="numeric" />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className="input-field" placeholder="98765…" inputMode="tel" />
                </div>
              </div>
              <div>
                <label className="label">Note</label>
                <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input-field" placeholder="2 kg sugar, 1 kg rice" />
              </div>
              <button onClick={add} className="btn-primary w-full h-11 text-sm font-semibold">
                <Plus className="w-4 h-4" /> Add to khata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle confirmation */}
      <ConfirmDialog
        open={!!confirmSettle}
        title="Payment received?"
        message={`₹${confirmSettle?.amount} from ${confirmSettle?.customer_name} will be marked as collected.`}
        confirmLabel="Yes, received"
        danger={false}
        onConfirm={() => confirmSettle && settle(confirmSettle)}
        onClose={() => setConfirmSettle(null)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete entry?"
        message={`₹${confirmDelete?.amount} for ${confirmDelete?.customer_name} will be permanently removed.`}
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
