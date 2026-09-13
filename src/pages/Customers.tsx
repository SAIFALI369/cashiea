import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import { formatINR } from '../lib/format'
import { enrichCustomers, winbackText, type Customer360 } from '../lib/customer360'
import type { Customer, Transaction } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import HeaderAction from '../components/ui/HeaderAction'
import EmptyState from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Users, Plus, Loader2, Trash2, Search, Mail, Phone, X, ArrowUpRight, Sparkles } from 'lucide-react'
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
  const { ownerId, profile } = useAuth()
  const { can } = useCan()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<Segment>('all')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<Transaction[]>([])
  const [detail360, setDetail360] = useState<Customer360 | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null)
  const [applyingCredit, setApplyingCredit] = useState(false)

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
    try { window.dispatchEvent(new CustomEvent('cashiea:voice-event', { detail: { kind: 'customer' } })) } catch { /* voice */ }
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
    setDetail360(null)
    setLoadingOrders(true)
    const { data } = await supabase.from('transactions')
      .select('id,customer_id,created_at,total,status,payment_method,items')
      .eq('user_id', ownerId).eq('customer_id', c.id)
      .order('created_at', { ascending: false }).limit(80)
    const rows = (data as Transaction[]) || []
    setOrders(rows)
    setDetail360(enrichCustomers(customers, rows).get(c.id) || null)
    setLoadingOrders(false)
  }

  const list360 = useMemo(() => enrichCustomers(customers, []), [customers])

  const applySuggestedCredit = async () => {
    if (!ownerId || !selected || !detail360?.suggestedCredit) return
    if (!can('customers:manage')) return toast.error('Your role cannot manage customers')
    setApplyingCredit(true)
    const { error } = await supabase.from('customers')
      .update({ credit_limit: detail360.suggestedCredit })
      .eq('id', selected.id).eq('user_id', ownerId)
    setApplyingCredit(false)
    if (error) return toast.error(error.message)
    const next = { ...selected, credit_limit: detail360.suggestedCredit }
    setSelected(next)
    setCustomers((prev) => prev.map((x) => x.id === next.id ? next : x))
    toast.success(`Credit limit set to ${formatINR(detail360.suggestedCredit, 0)}`)
  }

  const copyWinback = async () => {
    if (!selected) return
    const shop = profile?.company_name || profile?.full_name || 'our shop'
    const text = winbackText(selected.name, shop, detail360?.topItems[0]?.name)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Win-back message copied')
    } catch {
      toast.error('Could not copy')
    }
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

  // ── Two DIFFERENT facts, deliberately not conflated ──
  //
  // growthPct: how much the customer BASE grew in the last 30 days. This is
  //   real growth (new signups ÷ the base that existed before them), so it is
  //   the only figure that earns a green ↗ arrow.
  // activeShare: the share of lifetime value held by customers who bought
  //   recently. That is a composition stat, NOT growth — showing it with an
  //   up-arrow would claim revenue rose when nothing of the sort was measured.
  const { growthPct, activeShare } = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000
    const added = customers.filter((c) => c.created_at && new Date(c.created_at).getTime() >= cutoff).length
    const before = customers.length - added
    const recentValue = customers.reduce((s, c) => {
      const last = c.last_purchase_at ? new Date(c.last_purchase_at).getTime() : 0
      return last >= cutoff ? s + Number(c.total_spent || 0) : s
    }, 0)
    return {
      growthPct: added > 0 && before > 0 ? Math.round((added / before) * 100) : null,
      activeShare: totalValue > 0 && recentValue > 0 ? Math.round((recentValue / totalValue) * 100) : null,
    }
  }, [customers, totalValue])

  const SEGMENTS: { key: Segment; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'vip', label: 'VIP' },
    { key: 'regular', label: 'Regular' },
    { key: 'new', label: 'New' },
    { key: 'dormant', label: 'Dormant' },
  ]

  // Segment pill next to the name — small, subtle, never a floating corner tag.
  const segColor: Record<string, string> = {
    vip: 'bg-gold/15 text-gold',
    regular: 'bg-positive/10 text-positive',
    new: 'bg-info/10 text-info',
    dormant: 'bg-warning/10 text-warning',
  }
  // A thin coloured ring around the avatar carries the same signal quietly.
  const segRing: Record<string, string> = {
    vip: 'ring-2 ring-gold/60',
    regular: 'ring-1 ring-line-2',
    new: 'ring-2 ring-positive/50',
    dormant: 'ring-2 ring-warning/40',
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* The page name is the large bold title in the app header; the only
          action is a compact + in the top-right corner. */}
      <PageHeader title="Customers" subtitle="Your customer book" />
      {can('customers:manage') && (
        <HeaderAction>
          <button
            onClick={() => { setForm(empty); setShowForm(true) }}
            aria-label="Add customer"
            title="Add customer"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-accent text-white text-sm font-semibold shadow-soft hover:bg-accent-strong active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Add
          </button>
        </HeaderAction>
      )}

      {/* ── ONE elegant summary card, full width. Primary stats never scroll. ── */}
      {!loading && customers.length > 0 && (
        <section className="card p-5 sm:p-6 animate-rise-in">
          <div className="flex flex-wrap items-start gap-x-10 gap-y-5">
            <div>
              <p className="text-sm text-fg-subtle">Total customers</p>
              {/* The ↗ belongs here: this is the number that actually grew. */}
              <div className="flex items-baseline gap-2 mt-1">
                <p className="text-3xl font-bold text-fg tabular-nums leading-none">{customers.length}</p>
                {growthPct != null && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-positive">
                    <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />{growthPct}%
                  </span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-fg-subtle">Lifetime value</p>
              <p className="text-3xl font-bold text-fg tabular-nums leading-none mt-1">{formatINR(totalValue, 0)}</p>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm text-fg-subtle">Avg per customer</p>
              <p className="text-3xl font-bold text-fg tabular-nums mt-1 leading-none">
                {formatINR(customers.length ? totalValue / customers.length : 0, 0)}
              </p>
            </div>
          </div>
          {(growthPct != null || activeShare != null) && (
            <p className="text-xs text-fg-subtle mt-4">
              {growthPct != null && `${growthPct}% more customers than 30 days ago`}
              {growthPct != null && activeShare != null && ' · '}
              {activeShare != null && `${activeShare}% of lifetime value from customers active this month`}
            </p>
          )}
        </section>
      )}

      {/* ── Search (soft gray, borderless) + text-tab filters ── */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-fg-subtle pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email"
            aria-label="Search customers"
            className="w-full h-12 pl-11 pr-4 rounded-full bg-surface-2 border-0 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          {SEGMENTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className={`chip whitespace-nowrap ${segment === s.key ? 'chip-active' : ''}`}
            >
              {s.label}
              {counts[s.key] > 0 && (
                <span className={`tabular-nums ${segment === s.key ? 'opacity-70' : 'text-fg-subtle'}`}>{counts[s.key]}</span>
              )}
            </button>
          ))}
          <span className="ml-auto hidden sm:inline text-xs text-fg-subtle tabular-nums whitespace-nowrap pl-3">
            {filtered.length} of {customers.length}
          </span>
        </div>
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
        /* ── CLEAN LIST ──
           Avatar + ringed segment · name with an inline pill · contact on
           ONE dotted line · metrics as plain text. No beige boxes, no
           floating corner tags. On desktop the rows tile into columns. */
        <div className="bg-surface rounded-card shadow-card overflow-hidden divide-y divide-line lg:bg-transparent lg:shadow-none lg:rounded-none lg:overflow-visible lg:divide-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
          {filtered.map((c) => {
            const seg = segmentOf(c)
            const initials = (c.name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
            const c360 = list360.get(c.id)
            const contact = [c.phone, c.email].filter(Boolean) as string[]
            return (
              <button
                key={c.id}
                onClick={() => openDetail(c)}
                className="w-full text-left px-4 py-4 sm:px-5 flex items-start gap-3.5 transition-[background-color,transform] duration-150 ease-butter hover:bg-surface-2/60 active:scale-[0.98] lg:card lg:card-hover lg:p-5 lg:hover:bg-surface"
              >
                <span
                  className={`w-11 h-11 rounded-full bg-surface-2 text-fg text-sm font-bold flex items-center justify-center flex-shrink-0 ${segRing[seg]}`}
                >
                  {initials}
                </span>

                <div className="min-w-0 flex-1">
                  {/* Line 1 — name + inline segment pill */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[15px] font-semibold text-fg truncate">{c.name}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md flex-shrink-0 ${segColor[seg]}`}>
                      {seg}
                    </span>
                  </div>

                  {/* Line 2 — phone • email, one line, truncated cleanly */}
                  {contact.length > 0 && (
                    <p className="text-xs text-fg-subtle truncate mt-0.5">
                      {contact.map((item, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-1 text-fg-subtle/60" aria-hidden="true">•</span>}
                          {item}
                        </span>
                      ))}
                    </p>
                  )}

                  {/* Line 3 — metrics as plain text; the number that matters is bold */}
                  <p className="text-xs text-fg-subtle mt-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    <span className="text-fg-subtle">Spent </span>
                    <span className="font-bold text-fg tabular-nums">{formatINR(Number(c.total_spent || 0), 0)}</span>
                    <span className="mx-1.5 text-line-2">|</span>
                    <span className="text-fg-subtle">Orders </span>
                    <span className="font-bold text-fg tabular-nums">{c.total_orders || 0}</span>
                    {c.last_purchase_at && (
                      <>
                        <span className="mx-1.5 text-line-2">|</span>
                        <span className="text-fg-subtle">Last </span>
                        <span className="font-bold text-fg">
                          {new Date(c.last_purchase_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </>
                    )}
                  </p>

                  {Number(c.credit_limit) > 0 && (
                    <p className="text-[12px] text-fg-subtle mt-1">
                      Credit limit <span className="font-semibold text-warning tabular-nums">{formatINR(Number(c.credit_limit), 0)}</span>
                    </p>
                  )}
                  {c360?.churnRisk === 'high' && (
                    <p className="text-[12px] font-medium text-warning mt-1">At risk — quiet longer than usual</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Add customer form */}
      {can('customers:manage') && showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="card w-full max-w-md rounded-t-3xl sm:rounded-card p-6 max-h-[85vh] overflow-y-auto animate-sheet-in" onClick={(e) => e.stopPropagation()}>
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
          <div className="card w-full max-w-md rounded-t-3xl sm:rounded-card p-6 max-h-[85vh] overflow-y-auto animate-sheet-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-fg truncate">{selected.name}</h3>
                {selected.company && <p className="text-sm text-fg-muted">{selected.company}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="text-fg-muted hover:text-fg flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            {/* Stats — plain text, no boxes. Let the numbers speak. */}
            <div className="flex flex-wrap gap-x-8 gap-y-4 mb-5">
              <div>
                <p className="text-xs text-fg-subtle">Spent</p>
                <p className="text-xl font-bold text-fg tabular-nums mt-0.5">{formatINR(Number(selected.total_spent || 0), 0)}</p>
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Orders</p>
                <p className="text-xl font-bold text-fg tabular-nums mt-0.5">{selected.total_orders || 0}</p>
              </div>
              <div>
                <p className="text-xs text-fg-subtle">Avg order</p>
                <p className="text-xl font-bold text-fg tabular-nums mt-0.5">{formatINR(Number(selected.total_orders || 0) > 0 ? Number(selected.total_spent || 0) / Number(selected.total_orders) : 0, 0)}</p>
              </div>
              {Number(selected.credit_limit) > 0 && (
                <div>
                  <p className="text-xs text-fg-subtle">Credit limit</p>
                  <p className="text-xl font-bold text-warning tabular-nums mt-0.5">{formatINR(Number(selected.credit_limit), 0)}</p>
                </div>
              )}
            </div>

            {detail360 && (
              <div className="rounded-control bg-surface-2 p-4 mb-5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle mb-1">Customer 360</p>
                <p className="text-xs text-fg leading-relaxed">{detail360.insight}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-secondary-soft text-secondary-strong">{detail360.tier}</span>
                  {detail360.cadenceDays != null && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface text-fg-muted">Every {detail360.cadenceDays}d</span>
                  )}
                  {detail360.preferredPay && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface text-fg-muted capitalize">{detail360.preferredPay}</span>
                  )}
                  {detail360.topItems.map((it) => (
                    <span key={it.name} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface text-fg-muted">{it.name}</span>
                  ))}
                </div>
                {detail360.suggestedCredit != null && Number(selected.credit_limit || 0) !== detail360.suggestedCredit && can('customers:manage') && (
                  <button
                    onClick={applySuggestedCredit}
                    disabled={applyingCredit}
                    className="btn-secondary text-xs h-8 mt-3"
                  >
                    {applyingCredit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Set credit limit to {formatINR(detail360.suggestedCredit, 0)}
                  </button>
                )}
                {detail360.churnRisk === 'high' && (
                  <button onClick={copyWinback} className="btn-ghost text-xs h-8 mt-2">
                    Copy win-back message
                  </button>
                )}
              </div>
            )}

            {/* Contact — quiet rows, no boxes */}
            <div className="mb-5">
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="flex items-center gap-3 py-2.5 text-sm text-fg hover:text-accent-strong transition-colors">
                  <Phone className="w-4 h-4 text-fg-subtle" /> {selected.phone}
                </a>
              )}
              {selected.email && (
                <a href={`mailto:${selected.email}`} className="flex items-center gap-3 py-2.5 text-sm text-fg hover:text-accent-strong transition-colors">
                  <Mail className="w-4 h-4 text-fg-subtle" /> {selected.email}
                </a>
              )}
              {selected.notes && (
                <p className="flex items-start gap-3 py-2.5 text-sm text-fg-muted">
                  <Sparkles className="w-4 h-4 text-fg-subtle mt-0.5 flex-shrink-0" />{selected.notes}
                </p>
              )}
            </div>

            {/* Recent orders */}
            <div>
              <p className="text-sm font-semibold text-fg mb-1">Recent orders</p>
              {loadingOrders ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-fg-subtle" /></div>
              ) : orders.length === 0 ? (
                <p className="text-sm text-fg-subtle py-3">No orders yet</p>
              ) : (
                <div className="divide-y divide-line">
                  {orders.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-fg truncate">{(t.items || []).map((i: any) => i.name).join(', ') || 'Order'}</p>
                        <p className="text-xs text-fg-subtle mt-0.5">{new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                      </div>
                      <p className="text-sm font-semibold text-fg tabular-nums flex-shrink-0">{formatINR(Number(t.total))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-5 pt-5 border-t border-line">
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
