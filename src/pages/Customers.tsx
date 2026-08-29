import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import type { Customer, Transaction } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Users, Plus, Loader2, Trash2, Search, Mail, Phone, ShoppingBag, X, Clock, Send } from 'lucide-react'
import toast from 'react-hot-toast'

const empty = { name: '', email: '', phone: '', address: '', company: '', notes: '', tags: '' }

export default function Customers() {
  const { profile, ownerId } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('all')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Transaction[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)

  useEffect(() => { loadCustomers() }, [])

  const loadCustomers = async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setCustomers((data as Customer[]) || [])
    setLoading(false)
  }

  const handleSave = async () => {
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
    })
    if (error) { toast.error(error.message); return }
    setCustomers([data as Customer, ...customers])
    setForm(empty)
    setShowForm(false)
    toast.success('Customer added')
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (!error) { setCustomers(customers.filter((c) => c.id !== id)); setSelected(null); toast.success('Deleted') }
  }

  const openDetail = async (c: Customer) => {
    setSelected(c)
    setLoadingOrders(true)
    const { data } = await supabase.from('transactions').select('*').eq('user_id', ownerId).eq('customer_id', c.id).order('created_at', { ascending: false }).limit(20)
    setOrders((data as Transaction[]) || [])
    setLoadingOrders(false)
  }

  const isDormant = (c: Customer) => {
    if (!c.last_purchase_at) return c.total_orders === 0
    const days = (Date.now() - new Date(c.last_purchase_at).getTime()) / 86400000
    return days > 60
  }
  const isVip = (c: Customer) => c.total_spent >= 500
  const isNew = (c: Customer) => c.total_orders === 0

  const filtered = customers.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
    if (!matchSearch) return false
    if (segment === 'all') return true
    if (segment === 'vip') return isVip(c)
    if (segment === 'dormant') return isDormant(c)
    if (segment === 'new') return isNew(c)
    return true
  })

  const segments = [
    { value: 'all', label: 'All', count: customers.length },
    { value: 'vip', label: '⭐ VIP (₹500+)', count: customers.filter(isVip).length },
    { value: 'dormant', label: '💤 Dormant (60d+)', count: customers.filter(isDormant).length },
    { value: 'new', label: '🆕 No orders', count: customers.filter(isNew).length },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Customers"
        subtitle="Client details, purchase history & segments for retargeting"
        icon={<Users className="w-5 h-5" />}
        action={<button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Add Customer'}</button>}
      />

      {/* Segments */}
      <div className="flex flex-wrap gap-2 mb-4">
        {segments.map((s) => (
          <button key={s.value} onClick={() => setSegment(s.value)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${segment === s.value ? 'border-brand-600 bg-brand-600/20 text-brand-300' : 'border-line text-fg-muted hover:text-fg'}`}>
            {s.label} <span className="opacity-60">({s.count})</span>
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card p-4 mb-6 animate-slide-up">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Jane Doe" /></div>
            <div><label className="label">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field" placeholder="jane@email.com" /></div>
            <div><label className="label">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-field" placeholder="+1 555 0100" /></div>
            <div><label className="label">Company</label><input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input-field" placeholder="Acme Inc (optional)" /></div>
            <div><label className="label">Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" placeholder="123 Main St" /></div>
            <div><label className="label">Tags (comma separated)</label><input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="input-field" placeholder="wholesale, vip" /></div>
            <div className="sm:col-span-2"><label className="label">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input-field resize-none" placeholder="Preferences, VIP notes..." /></div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => { setShowForm(false); setForm(empty) }} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSave} className="btn-primary text-sm">Save Customer</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : customers.length === 0 ? (
        <EmptyState icon={Users} title="No customers yet" description="Add customers manually or they're created automatically at checkout. Then segment them for targeted retargeting." />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-11" placeholder="Search customers..." />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {filtered.map((c) => (
              <button key={c.id} onClick={() => openDetail(c)} className="card p-4 text-left hover:border-brand-600 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-fg font-bold flex-shrink-0">{c.name.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-fg truncate">{c.name}</h3>
                      <p className="text-xs text-fg-subtle truncate">{c.email || c.phone || 'No contact'}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {isVip(c) && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">VIP</span>}
                    {isDormant(c) && c.total_orders > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">💤</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-fg-muted">
                  <span className="text-brand-400 font-semibold">${c.total_spent.toFixed(0)} spent</span>
                  <span>{c.total_orders} orders</span>
                  {c.last_purchase_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(c.last_purchase_at).toLocaleDateString()}</span>}
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Customer detail drawer */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-line">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-fg font-bold text-lg">{selected.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <h2 className="text-xl font-bold text-fg">{selected.name}</h2>
                    {selected.company && <p className="text-sm text-fg-muted">{selected.company}</p>}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-fg-subtle hover:text-fg"><X className="w-5 h-5" /></button>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-surface/60 rounded-lg p-2.5 text-center"><p className="text-lg font-bold text-brand-400">${selected.total_spent.toFixed(0)}</p><p className="text-xs text-fg-subtle">Lifetime</p></div>
                <div className="bg-surface/60 rounded-lg p-2.5 text-center"><p className="text-lg font-bold text-fg">{selected.total_orders}</p><p className="text-xs text-fg-subtle">Orders</p></div>
                <div className="bg-surface/60 rounded-lg p-2.5 text-center"><p className="text-lg font-bold text-amber-400">{selected.loyalty_points}</p><p className="text-xs text-fg-subtle">Points</p></div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 text-sm">
                {selected.email && <a href={`mailto:${selected.email}`} className="flex items-center gap-1.5 text-fg-muted hover:text-brand-400"><Mail className="w-4 h-4" /> {selected.email}</a>}
                {selected.phone && <span className="flex items-center gap-1.5 text-fg-muted"><Phone className="w-4 h-4" /> {selected.phone}</span>}
              </div>
              {selected.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">{selected.tags.map((t) => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-brand-600/15 text-brand-300">{t}</span>)}</div>
              )}
              {selected.notes && <p className="text-sm text-fg-muted mt-3 bg-surface/60 rounded-lg p-3">{selected.notes}</p>}
            </div>

            {/* Retarget CTA */}
            <div className="p-4 border-b border-line">
              <Link to="/app/email-assistant" onClick={() => setSelected(null)} className="btn-primary w-full text-sm">
                <Send className="w-4 h-4" /> Retarget this customer
              </Link>
            </div>

            {/* Purchase history */}
            <div className="p-4">
              <h3 className="font-semibold text-fg mb-3 flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-brand-400" /> Purchase History</h3>
              {loadingOrders ? (
                <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
              ) : orders.length === 0 ? (
                <p className="text-sm text-fg-subtle">No purchases yet.</p>
              ) : (
                <div className="space-y-2">
                  {orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between bg-surface/60 rounded-lg p-3">
                      <div>
                        <p className="text-sm font-medium text-fg">{o.receipt_number}</p>
                        <p className="text-xs text-fg-subtle">{new Date(o.created_at).toLocaleString()} · {o.items?.length || 0} items</p>
                      </div>
                      <span className="font-semibold text-brand-400">${o.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => handleDelete(selected.id)} className="btn-ghost text-xs text-red-400 hover:text-red-300 mt-4"><Trash2 className="w-3.5 h-3.5" /> Delete customer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
