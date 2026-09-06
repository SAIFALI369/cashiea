import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import { nextDocNumber } from '../lib/docnum'
import {
  DEFAULT_COVER_DAYS, DEFAULT_LEAD_DAYS,
  buildReorderSuggestions, draftPoItems,
  type ReorderSuggestion, type ReorderUrgency,
} from '../lib/autoReorder'
import type { Product, PurchaseOrder, Supplier, Transaction } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import {
  AlertTriangle, Check, Loader2, Package, RefreshCw, Truck, Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'

const URGENCY: Record<ReorderUrgency, { label: string; cls: string }> = {
  out: { label: 'Out', cls: 'bg-negative/15 text-negative' },
  critical: { label: 'Critical', cls: 'bg-negative/15 text-negative' },
  low: { label: 'Low', cls: 'bg-warning/15 text-warning' },
  watch: { label: 'Watch', cls: 'bg-secondary-soft text-secondary-strong' },
}

export default function AutoReorder() {
  const { ownerId } = useAuth()
  const { isOwner } = useCan()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [lead, setLead] = useState(DEFAULT_LEAD_DAYS)
  const [cover, setCover] = useState(DEFAULT_COVER_DAYS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [supplierId, setSupplierId] = useState('')
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<PurchaseOrder[]>([])

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    const from = new Date(Date.now() - 30 * 86400000).toISOString()
    ;(async () => {
      const [p, t, s, po] = await Promise.all([
        supabase.from('products').select('id,name,sku,stock_quantity,low_stock_threshold,cost,price,active').eq('user_id', ownerId).limit(2000),
        supabase.from('transactions').select('items,created_at,status').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', from).limit(1000),
        supabase.from('suppliers').select('id,name').eq('user_id', ownerId).order('name').limit(200),
        supabase.from('purchase_orders').select('*').eq('user_id', ownerId).eq('status', 'draft').order('created_at', { ascending: false }).limit(20),
      ])
      if (cancelled) return
      setProducts((p.data as Product[]) || [])
      setTxns((t.data as Transaction[]) || [])
      setSuppliers((s.data as Supplier[]) || [])
      setDrafts((po.data as PurchaseOrder[]) || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const suggestions = useMemo(
    () => buildReorderSuggestions(products, txns, { leadTimeDays: lead, coverDays: cover }),
    [products, txns, lead, cover],
  )

  useEffect(() => {
    setSelected(new Set(suggestions.filter((s) => s.urgency === 'out' || s.urgency === 'critical').map((s) => s.productId)))
  }, [suggestions])

  const picked = suggestions.filter((s) => selected.has(s.productId))
  const estimated = picked.reduce((s, x) => s + x.estimatedCost, 0)

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const createDraft = async () => {
    if (!isOwner) return toast.error('Only the owner can create a purchase order')
    if (!ownerId || picked.length === 0) return
    setSaving(true)
    try {
      const items = draftPoItems(picked)
      const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0)
      const { data, error } = await supabase.from('purchase_orders').insert({
        user_id: ownerId,
        supplier_id: supplierId || null,
        po_number: nextDocNumber('PO'),
        items,
        subtotal,
        tax_amount: 0,
        total: subtotal,
        status: 'draft',
        notes: `Auto-suggested · ${lead}d lead · ${cover}d cover · ${picked.length} SKUs`,
      }).select().single()
      if (error) throw error
      setDrafts((d) => [data as PurchaseOrder, ...d])
      toast.success(`Draft PO ${data.po_number} ready — review it under Suppliers`)
      setSelected(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the draft')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Auto-reorder"
        subtitle="Sized from the last 30 days of sales — you approve before anything is sent."
        icon={<RefreshCw className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={[
        { label: 'Need action', value: String(suggestions.length), icon: Package, tone: suggestions.length ? 'warning' : 'positive' },
        { label: 'Out of stock', value: String(suggestions.filter((s) => s.urgency === 'out').length), icon: AlertTriangle, tone: suggestions.some((s) => s.urgency === 'out') ? 'negative' : 'default' },
        { label: 'Selected cost', value: formatINR(estimated, 0), icon: Wallet, tone: 'accent' },
        { label: 'Draft POs', value: String(drafts.length), icon: Truck, tone: 'secondary' },
      ]} />

      <div className="card p-4 mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-3">How we size the order</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="label">Supplier lead time (days)</span>
            <input type="number" min={0} max={60} value={lead} onChange={(e) => setLead(Math.max(0, Number(e.target.value) || 0))} className="input-field" />
          </label>
          <label className="block">
            <span className="label">Days of cover to keep on the shelf</span>
            <input type="number" min={0} max={90} value={cover} onChange={(e) => setCover(Math.max(0, Number(e.target.value) || 0))} className="input-field" />
          </label>
        </div>
        <p className="text-[11px] text-fg-subtle mt-3 leading-relaxed">
          Suggested qty = (lead + cover) × daily sales − current stock. Items with no recent sales fall back to your own low-stock alert — we don’t invent demand.
        </p>
      </div>

      {suggestions.length === 0 ? (
        <EmptyState icon={Check} title="Stock looks healthy" description="Nothing is below its alert level or running out inside the cover window. Come back after a few busy days." />
      ) : (
        <>
          <div className="space-y-2 mb-5">
            {suggestions.map((s: ReorderSuggestion) => (
              <label key={s.productId} className="card card-hover p-4 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(s.productId)}
                  onChange={() => toggle(s.productId)}
                  className="mt-1 w-4 h-4 accent-[rgb(var(--accent-strong))]"
                  aria-label={`Select ${s.name}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-fg truncate">{s.name}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${URGENCY[s.urgency].cls}`}>{URGENCY[s.urgency].label}</span>
                    {s.sku && <span className="text-[11px] text-fg-subtle">{s.sku}</span>}
                  </div>
                  <p className="text-xs text-fg-muted mt-1">{s.reason}</p>
                  <p className="text-[11px] text-fg-subtle mt-1 tabular-nums">
                    Stock {s.stock} · alert at {s.threshold} · {s.dailyVelocity}/day
                    {s.daysOfCover != null ? ` · ${s.daysOfCover}d cover` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-fg tabular-nums">+{s.suggestedQty}</p>
                  <p className="text-[11px] text-fg-subtle">{s.estimatedCost > 0 ? formatINR(s.estimatedCost, 0) : 'no cost'}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="card p-4 sticky bottom-20 lg:bottom-24 z-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-field sm:max-w-xs" aria-label="Supplier">
                <option value="">No supplier (draft only)</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button
                onClick={createDraft}
                disabled={saving || picked.length === 0 || !isOwner}
                className="btn-primary text-sm sm:ml-auto"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Draft PO · {picked.length} item{picked.length === 1 ? '' : 's'} · {formatINR(estimated, 0)}
              </button>
            </div>
            {!isOwner && <p className="text-[11px] text-fg-subtle mt-2">Only the owner can create the purchase order.</p>}
          </div>
        </>
      )}
    </div>
  )
}
