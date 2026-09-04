import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import { formatINR } from '../lib/format'
import type { Customer, Transaction } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Users, Plus, Loader2, Trash2, Search, Mail, Phone, ShoppingBag, X, Clock, Send, TrendingUp, Award, UserPlus, MessageCircle, ChevronRight, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const empty = { name: '', email: '', phone: '', address: '', company: '', notes: '', tags: '', credit_limit: 0 }

type Segment = 'all' | 'vip' | 'regular' | 'new' | 'dormant'

function segmentOf(c: Customer): Exclude<Segment, 'all'> {
  const spent = Number(c.total_spent || 0)
  const orders = Number(c.total_orders || 0)
  if (!orders) return 'new'
  if (spent >= 50000 || orders >= 20) return 'vip'
  const last = c.last_purchase_at ? new Date(c.last_purchase_at).getTime() : 0
  if (last && Date.now() - last > 90 * 86400000) return 'dormant'
  return 'regular'
}

export default function Customers() {
  const { ownerId } = useAuth()
  const { can } = useCan()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<Segment>('all')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Transaction[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null)

  useEffect(() => {
    if (ownerId) void loadCustomers()
    else { setCustomers([]); setLoading(false) }
  }, [ownerId])

  const loadCustomers = async () => {
    if (!ownerId) return
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setCustomers((data as Customer[]) || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!can('customers:manage')) return toast.error('Your role cannot manage customers')
    if (!ownerId) return toast.error('Your shop is still loading — please try again')
    if (!form.name.trim()) return toast.error('Customer name is required')
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    const { data, error } = await offlineInsert('customers', {
      user_id: ownerId,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      company: form.company || null,
      notes: form.notes || null,
      tags,
      credit_limit: Number(form.credit_limit) || 0,
    })
    if (error) return toast.error(error.message)
    setCustomers((data as Customer[]) ? [data as Customer, ...customers] : customers)
    toast.success(`${form.name} added`)
    setForm(empty); setShowForm(false)
  }

  const handleDelete = async (c: Customer) => {
    if (!can('customers:manage')) return toast.error('Your role cannot manage customers')
    if (!ownerId) return
    setConfirmDelete(null)
    const { error } = await supabase.from('customers').delete().eq('id', c.id).eq('user_id', ownerId)
    if (!error) { setCustomers(customers.filter((x) => x.id !== c.id)); toast.success('Customer removed') }
  }

  const openDetail = async (c: Customer) => {
    if (!ownerId) return
    setSelected(c)
    setLoadingOrders(true)
    const { data } = await supabase.from('transactions')
      .select('*').eq('user_id', ownerId).eq('customer_id', c.id)
      .order('created_at', { ascending: false }).limit(10)
    setOrders((data as Transaction[]) || [])
    setLoadingOrders(false)
  }

  const filtered = useMemo(() => {
    let list = customers
    if (segment !== 'all') list = list.filter((c) => segmentOf(c) === segment)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q) || c.email?.toLowerCase().includes(q))
    }
    return list
  }, [customers, search, segment])

  const counts = useMemo(() => {
    const by: Record<string, number> = { all: customers.length, vip: 0, regular: 0, new: 0, dormant: 0 }
    customers.forEach((c) => { by[segmentOf(c)]++ })
    return by
  }, [customers])

  const totalValue = customers.reduce((s, c) => s + Number(c.total_spent || 0), 0)

  const SEGMENTS: { key: Segment; label: string; icon: typeof Users }[] = [
    { key: 'all', label: 'All', icon: Users },
    { key: 'vip', label: 'VIP', icon: Award },
    { key: 'regular', label: 'Regular', icon: TrendingUp },
    { key: 'new', label: 'New', icon: UserPlus },
    { key: 'dormant', label: 'Dormant', icon: Clock },
  ]

  const segColor: Record<string, string> = {
    vip: 'bg-accent-soft text-accent',
    regular: 'bg-positive/10 text-positive',
    new: 'bg-info/10 text-info',
    dormant: 'bg-warning/10 text-warning',
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Customers"
        icon={<Users className="w-5 h-5" />}
        action={can('customers:manage') ? <button onClick={() => { setForm(empty); setShowForm(true) }} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Add customer</button> : <span className="text-xs text-fg-subtle">Read-only access</span>}
      />

      {/* Stats strip */}
      {!loading && customers.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">Total Customers</p>
            <p className="text-xl font-bold text-fg tabular-nums mt-0.5">{customers.length}</p>
          </div>
          <div className="card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">Lifetime Value</p>
            <p className="text-xl font-bold text-accent tabular-nums mt-0.5">{formatINR(totalValue, 0)}</p>
          </div>
          <div className="card p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">VIP Customers</p>
            <p className="text-xl font-bold text-fg tabular-nums mt-0.5">{counts.vip}</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 rounded-control border border-line bg-paper px-3 shadow-soft focus-within:border-accent/50 transition-colors">
          <Search className="w-4 h-4 text-fg-subtle flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="flex-1 bg-transparent py-2.5 text-sm text-fg placeholder:text-fg-subtle outline-none min-w-0"
          />
          {search && <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg"><X className="w-4 h-4" /></button>}
        </div>
      </div>

      {/* Segment filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto scroll-area pb-1">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              segment === s.key
                ? 'bg-accent text-accent-fg shadow-soft'
                : 'bg-surface-2 text-fg-muted hover:text-fg'
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
            {counts[s.key] > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${segment === s.key ? 'bg-accent-fg/20' : 'bg-line/50'}`}>{counts[s.key]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-fg-subtle" /></div>
      ) : customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" description="Add your regulars here — track their orders, spending, and preferences. Meraj uses this to suggest follow-ups and win-backs." />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-fg-subtle" />
          </div>
          <p className="text-base font-semibold text-fg">No {segment} customers found</p>
          <p className="text-sm text-fg-muted mt-1">
            {segment === 'dormant' ? "Great — all your customers are active!" : "Try a different filter or search term."}
          </p>
          <button onClick={() => { setSegment('all'); setSearch('') }} className="btn-secondary text-xs h-9 px-4 mt-4">
            View all customers
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const seg = segmentOf(c)
            return (
              <button
                key={c.id}
                onClick={() => openDetail(c)}
                className="card p-4 text-left hover:border-accent/40 hover:shadow-float active:scale-[0.98] transition-all"
              >
                {/* Header: name + segment badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-fg truncate">{c.name}</p>
                    {c.company && <p className="text-xs text-fg-subtle truncate mt-0.5">{c.company}</p>}
                  </div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0 ${segColor[seg]}`}>
                    {seg}
                  </span>
                </div>

                {/* Stats: spent + orders */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-control bg-surface-2 px-2.5 py-2">
                    <p className="text-[9px] font-bold uppercase text-fg-subtle">Spent</p>
                    <p className="text-sm font-bold text-fg tabular-nums leading-tight truncate">{formatINR(Number(c.total_spent || 0), 0)}</p>
                  </div>
                  <div className="rounded-control bg-surface-2 px-2.5 py-2">
                    <p className="text-[9px] font-bold uppercase text-fg-subtle">Orders</p>
                    <p className="text-sm font-bold text-fg tabular-nums leading-tight">{c.total_orders || 0}</p>
                  </div>
                </div>
                {Number(c.credit_limit) > 0 && (
                  <div className="rounded-control bg-surface-2 px-2.5 py-2">
                    <p className="text-[9px] font-bold uppercase text-fg-subtle">Credit Limit</p>
                    <p className="text-sm font-bold text-warning tabular-nums leading-tight">{formatINR(Number(c.credit_limit), 0)}</p>
                  </div>
                )}

                {/* Contact info */}
                <div className="flex items-center gap-3 text-xs text-fg-muted">
                  {c.phone && (
                    <span className="flex items-center gap-1 min-w-0">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{c.phone}</span>
                    </span>
                  )}
                  {c.email && (
                    <span className="flex items-center gap-1 min-w-0">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </span>
                  )}
                </div>

                {/* Last purchase */}
                {c.last_purchase_at && (
                  <div className="flex items-center gap-1 text-[10px] text-fg-subtle mt-2">
                    <Clock className="w-3 h-3" />
                    <span>Last: {new Date(c.last_purchase_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                  </div>
                )}

                {/* Chevron */}
                <ChevronRight className="w-4 h-4 text-fg-subtle absolute right-3 top-1/2 -translate-y-1/2" />
              </button>
            )
          })}
        </div>
      )}

      {/* Add customer form */}
      {can('customers:manage') && showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-md rounded-t-2xl sm:rounded-card p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-fg">Add customer</h3>
              <button onClick={() => setShowForm(false)} className="text-fg-muted hover:text-fg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Ramesh Kumar" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="9876543210" inputMode="tel" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="ramesh@gmail.com" inputMode="email" />
                </div>
              </div>
              <div>
                <label className="label">Company / Shop</label>
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input-field" placeholder="Kumar Enterprises" />
              </div>
              <div>
                <label className="label">Tags (comma separated)</label>
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="input-field" placeholder="wholesale, trusted" />
              </div>
              <button onClick={handleSave} className="btn-primary w-full h-11 text-sm font-semibold">
                <Plus className="w-4 h-4" /> Add customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-md rounded-t-2xl sm:rounded-card p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-fg truncate">{selected.name}</h3>
                {selected.company && <p className="text-sm text-fg-muted">{selected.company}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-fg-muted hover:text-fg flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-control bg-surface-2 px-3 py-2.5 text-center">
                <p className="text-[9px] font-bold uppercase text-fg-subtle">Spent</p>
                <p className="text-base font-bold text-fg tabular-nums">{formatINR(Number(selected.total_spent || 0), 0)}</p>
              </div>
              <div className="rounded-control bg-surface-2 px-3 py-2.5 text-center">
                <p className="text-[9px] font-bold uppercase text-fg-subtle">Orders</p>
                <p className="text-base font-bold text-fg tabular-nums">{selected.total_orders || 0}</p>
              </div>
              <div className="rounded-control bg-surface-2 px-3 py-2.5 text-center">
                <p className="text-[9px] font-bold uppercase text-fg-subtle">Avg Order</p>
                <p className="text-base font-bold text-fg tabular-nums">{formatINR(Number(selected.total_orders || 0) > 0 ? Number(selected.total_spent || 0) / Number(selected.total_orders) : 0, 0)}</p>
              </div>
            </div>
            {Number(selected.credit_limit) > 0 && (
              <div className="rounded-control bg-surface-2 px-3 py-2.5 text-center">
                <p className="text-[9px] font-bold uppercase text-fg-subtle">Credit Limit</p>
                <p className="text-base font-bold text-warning tabular-nums">{formatINR(Number(selected.credit_limit), 0)}</p>
              </div>
            )}

            {/* Contact */}
            <div className="space-y-2 mb-4">
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="flex items-center gap-3 p-2.5 rounded-control bg-surface-2 text-sm text-fg hover:bg-surface-3 transition-colors">
                  <Phone className="w-4 h-4 text-accent" /> {selected.phone}
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`} className="flex items-center gap-3 p-2.5 rounded-control bg-surface-2 text-sm text-fg hover:bg-surface-3 transition-colors">
                  <Mail className="w-4 h-4 text-accent" /> {selected.email}
                </a>
              )}
              {selected.notes && (
                <div className="p-2.5 rounded-control bg-surface-2 text-sm text-fg-muted">
                  <Sparkles className="w-4 h-4 text-accent inline mr-2" />{selected.notes}
                </div>
              )}
            </div>

            {/* Recent orders */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-fg-subtle mb-2">Recent orders</p>
              {loadingOrders ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-fg-subtle" /></div>
              ) : orders.length === 0 ? (
                <p className="text-sm text-fg-muted text-center py-4">No orders yet</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2.5 rounded-control bg-surface-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-fg truncate">{(t.items || []).map((i: any) => i.name).join(', ') || 'Order'}</p>
                        <p className="text-[10px] text-fg-subtle">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <p className="text-sm font-bold text-fg tabular-nums flex-shrink-0">{formatINR(Number(t.total))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-line">
              {can('customers:manage') && <button
                onClick={() => { setConfirmDelete(selected); setSelected(null) }}
                className="btn-secondary text-sm h-10 text-negative hover:border-negative/40"
              >
                <Trash2 className="w-4 h-4" /> Remove
              </button>}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove customer?"
        message={`"${confirmDelete?.name}" will be permanently removed along with their purchase history.`}
        confirmLabel="Remove"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
