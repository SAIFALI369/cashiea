import { useDebounce } from '../lib/useDebounce'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { requestAction } from '../lib/approvals'
import { supabase } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import { formatINR } from '../lib/format'
import type { Product } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Package, Plus, Loader2, Trash2, AlertTriangle, Search, MapPin, ChevronDown, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ProductUnit } from '../lib/types'

interface ExtraUnitRow { unit: string; price: string; factor: string }

const empty = { name: '', description: '', sku: '', category: 'general', price: '', cost: '', stock_quantity: '', low_stock_threshold: '5', hsn_code: '', gst_rate: '0', unitBase: '', extraUnits: [] as ExtraUnitRow[] }

export default function Products() {
  const { profile, ownerId } = useAuth()
  const { isOwner } = useCan()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null)
  const [form, setForm] = useState(empty)
  const [search, setSearch] = useState('')
  const PAGE_SIZE = 50
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const debouncedSearch = useDebounce(search, 250)
  const [saving, setSaving] = useState(false)
  const [popular, setPopular] = useState<Product[]>([])
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all')

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    setLoading(true)
    const since = new Date(Date.now() - 30 * 86400000).toISOString()
    const [prodRes, txRes, invRes] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('transactions').select('items').eq('user_id', ownerId).gte('created_at', since).limit(300),
      supabase.from('invoices').select('items').eq('user_id', ownerId).gte('created_at', since).limit(300),
    ])
    const list = (prodRes.data as Product[]) || []
    setProducts(list)
    // Popularity = line-item appearances across invoices + sales (last 30 days)
    const txCount: Record<string, number> = {}
    const nameCount: Record<string, number> = {}
    ;((txRes.data as any[]) || []).forEach((t) => (t.items || []).forEach((it: any) => {
      if (it.product_id) txCount[it.product_id] = (txCount[it.product_id] || 0) + 1
      if (it.name) nameCount[String(it.name).toLowerCase()] = (nameCount[String(it.name).toLowerCase()] || 0) + 1
    }))
    ;((invRes.data as any[]) || []).forEach((inv) => (inv.items || []).forEach((it: any) => {
      if (it.description) nameCount[String(it.description).toLowerCase()] = (nameCount[String(it.description).toLowerCase()] || 0) + 1
    }))
    setPopular(
      list
        .map((p) => ({ p, score: (txCount[p.id] || 0) + (nameCount[p.name.toLowerCase()] || 0) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((x) => x.p),
    )
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Product name is required')
    setSaving(true)
    try {
      // Multi-unit pricing: the base unit mirrors the main price; extra
      // units (500g, dozen …) each carry their own price and consume a
      // fraction of base stock.
      const extraUnits: ProductUnit[] = form.extraUnits
        .filter((u) => u.unit.trim())
        .map((u) => ({ unit: u.unit.trim(), price: Number(u.price) || 0, factor: Math.max(0.001, Number(u.factor) || 1) }))
      const units: ProductUnit[] | null =
        extraUnits.length > 0 || form.unitBase.trim()
          ? [{ unit: form.unitBase.trim() || 'piece', price: Number(form.price) || 0, factor: 1 }, ...extraUnits]
          : null

      const prod = {
        name: form.name, description: form.description || null, sku: form.sku || null,
        category: form.category || 'general', price: Number(form.price) || 0, cost: Number(form.cost) || 0, hsn_code: form.hsn_code || null, gst_rate: Number(form.gst_rate) || 0,
        stock_quantity: Number(form.stock_quantity) || 0, low_stock_threshold: Number(form.low_stock_threshold) || 5,
        units,
      }
      if (isOwner) {
        const { data, error } = await offlineInsert('products', { user_id: ownerId, ...prod })
        if (error) throw error
        setProducts([data as Product, ...products])
        toast.success('Product added')
      } else {
        await requestAction({ capability: 'products:manage', action_type: 'product.add', target: 'products', payload: prod, summary: `Add product "${prod.name}" — price ${prod.price}, ${prod.stock_quantity} in stock`, money_related: false })
        toast.success('Sent to the owner for approval')
      }
      setForm(empty); setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (p: Product) => {
    setConfirmDelete(null) // close dialog first
    try {
      if (isOwner) {
        const { error } = await supabase.from('products').delete().eq('id', p.id)
        if (error) throw error
        setProducts(products.filter((x) => x.id !== p.id)); toast.success('Deleted')
      } else {
        await requestAction({ capability: 'products:manage', action_type: 'product.delete', target: 'products', payload: { id: p.id }, summary: `Delete product "${p.name}"`, money_related: false })
        toast.success('Sent for approval to delete')
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const restock = async (p: Product, delta: number) => {
    const newQty = Math.max(0, p.stock_quantity + delta)
    try {
      if (isOwner) {
        const { error } = await supabase.from('products').update({ stock_quantity: newQty }).eq('id', p.id)
        if (error) throw error
        setProducts(products.map((x) => x.id === p.id ? { ...x, stock_quantity: newQty } : x))
      } else {
        await requestAction({ capability: 'products:manage', action_type: 'product.restock', target: 'products', payload: { id: p.id, stock_quantity: newQty }, summary: `Set "${p.name}" stock to ${newQty}`, money_related: false })
        toast.success('Sent for approval')
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  const filtered = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || (p.sku || '').toLowerCase().includes(debouncedSearch.toLowerCase())
    if (!matchSearch) return false
    if (stockFilter === 'low') return p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0
    if (stockFilter === 'out') return p.stock_quantity === 0
    return true
  })
  const lowStockCount = products.filter((p) => p.stock_quantity <= p.low_stock_threshold).length
  const inventoryValue = products.reduce((s, p) => s + p.cost * p.stock_quantity, 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Products & Inventory"
        subtitle="Manage what you sell — catalog, pricing, and stock levels"
        icon={<Package className="w-5 h-5" />}
        action={<button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Add Product'}</button>}
      />

      {!isOwner && (
        <div className="card p-3 mb-5 flex items-center gap-2 text-xs text-fg-muted" style={{ background: 'rgb(var(--warning) / 0.1)' }}>
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
          Your product changes are sent to the owner for approval before they take effect.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4"><p className="text-xl font-bold text-fg">{products.length}</p><p className="text-xs text-fg-subtle">Products</p></div>
        <div className="card p-4"><p className="text-xl font-bold text-warning">{lowStockCount}</p><p className="text-xs text-fg-subtle">Low stock</p></div>
        <div className="card p-4"><p className="text-xl font-bold text-fg">₹{inventoryValue.toFixed(0)}</p><p className="text-xs text-fg-subtle">Inventory value</p></div>
      </div>

      {showForm && (
        <div className="card p-4 mb-6 animate-slide-up">
          <h2 className="font-semibold text-fg mb-4">New Product</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Wireless Mouse" /></div>
            <div><label className="label">SKU</label><input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="input-field" placeholder="WM-001" /></div>
            <div><label className="label">Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field" placeholder="Electronics" /></div>
            <div><label className="label">Description</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Optional" /></div>
            <div><label className="label">Price (₹) *</label><input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input-field" placeholder="299" /></div>
            <div><label className="label">Cost (₹)</label><input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} className="input-field" placeholder="125" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">HSN Code</label>
                <input value={form.hsn_code} onChange={(e) => setForm({ ...form, hsn_code: e.target.value })} className="input-field" placeholder="e.g. 3004" inputMode="numeric" />
              </div>
              <div>
                <label className="label">GST Rate</label>
                <select value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} className="input-field">
                  <option value="0">0% (Exempt)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
            </div>
            <div><label className="label">Stock quantity</label><input type="number" step="0.01" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} className="input-field" placeholder="100" /></div>
            <div><label className="label">Low-stock alert at</label><input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="input-field" placeholder="5" /></div>

            {/* Multi-unit pricing — optional, kirana-style */}
            <div className="sm:col-span-2 border-t border-line pt-4">
              <label className="label">Pricing units (optional)</label>
              <p className="text-xs text-fg-subtle mb-2 -mt-1">Sell one SKU per piece, per kg, per dozen — with its own price. Stock is tracked in the base unit.</p>
              <input
                value={form.unitBase}
                onChange={(e) => setForm({ ...form, unitBase: e.target.value })}
                className="input-field mb-2"
                placeholder="Base unit name — e.g. kg, piece, litre (optional)"
                aria-label="Base unit name"
              />
              {form.extraUnits.map((u, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    value={u.unit}
                    onChange={(e) => setForm({ ...form, extraUnits: form.extraUnits.map((x, j) => j === i ? { ...x, unit: e.target.value } : x) })}
                    className="input-field flex-1"
                    placeholder="Unit — e.g. 500g, dozen"
                    aria-label="Unit name"
                  />
                  <input
                    type="number" min={0} step="0.01"
                    value={u.price}
                    onChange={(e) => setForm({ ...form, extraUnits: form.extraUnits.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })}
                    className="input-field w-24"
                    placeholder="Price"
                    aria-label="Unit price"
                  />
                  <input
                    type="number" min={0.001} step="0.001"
                    value={u.factor}
                    onChange={(e) => setForm({ ...form, extraUnits: form.extraUnits.map((x, j) => j === i ? { ...x, factor: e.target.value } : x) })}
                    className="input-field w-28"
                    placeholder="Base qty"
                    aria-label="Base units consumed per unit"
                    title="How much base stock one unit uses — 500g on a kg product is 0.5"
                  />
                  <button
                    onClick={() => setForm({ ...form, extraUnits: form.extraUnits.filter((_, j) => j !== i) })}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-fg-subtle hover:text-negative flex-shrink-0"
                    aria-label="Remove unit"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setForm({ ...form, extraUnits: [...form.extraUnits, { unit: '', price: '', factor: '1' }] })}
                className="text-xs font-semibold text-accent hover:underline"
              >
                + Add unit
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => { setShowForm(false); setForm(empty) }} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Product'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : products.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" description="Add your products here — name, price, and stock. Then ring them up at the POS counter." />
      ) : (
        <>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-fg-subtle" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-11" placeholder="Search products..." />
          </div>

          {/* Stock filters + location affordance */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex gap-2 overflow-x-auto scroll-area flex-1">
              {([['all', 'All'], ['low', 'Low stock'], ['out', 'Out of stock']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setStockFilter(k)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${stockFilter === k ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>{label}</button>
              ))}
            </div>
            <button type="button" title="Multi-location support coming soon" className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-surface-2 text-fg-muted border border-line">
              <MapPin className="w-3.5 h-3.5" /> All locations <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {popular.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-[11px] font-bold tracking-[0.12em] uppercase text-fg-subtle">Popular products</h2>
                <button onClick={() => setSearch('')} className="text-xs font-semibold text-accent hover:underline">View all</button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-area">
                {popular.slice(0, visibleCount).map((p) => (
                  <button key={p.id} onClick={() => setSearch(p.name)} className="card p-3 flex-shrink-0 w-36 text-left active:scale-[0.98] transition-transform">
                    <div className="w-9 h-9 rounded-control bg-accent-soft text-accent flex items-center justify-center mb-2"><Package className="w-5 h-5" /></div>
                    <p className="text-sm font-semibold text-fg truncate">{p.name}</p>
                    <p className="text-xs text-accent">{formatINR(p.price)}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {filtered.map((p) => {
              const status = p.stock_quantity === 0 ? 'out' : p.stock_quantity <= p.low_stock_threshold ? 'low' : 'in'
              const statusLabel = status === 'out' ? 'Out of stock' : status === 'low' ? 'Low stock' : 'In stock'
              const statusCls = status === 'out' ? 'bg-negative/15 text-negative' : status === 'low' ? 'bg-warning/15 text-warning' : 'bg-positive/15 text-positive'
              const margin = p.price > 0 ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : '—'
              return (
                <div key={p.id} className="card p-4 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-control bg-surface-2 flex items-center justify-center flex-shrink-0">
                    <Package className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-fg">{p.name}</h3>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-2 text-fg-subtle capitalize">{p.category}</span>
                      {p.sku && <span className="text-xs text-fg-subtle">{p.sku}</span>}
                      {p.units && p.units.length > 1 && <span className="text-xs px-1.5 py-0.5 rounded bg-accent-soft text-accent-strong">{p.units.length} units</span>}
                    </div>
                    <p className="text-sm text-accent mt-0.5">₹{p.price.toFixed(2)} <span className="text-fg-subtle">· {margin}% margin</span>{p.units?.[0]?.unit ? <span className="text-fg-subtle"> · per {p.units[0].unit}</span> : null}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${statusCls}`}>{statusLabel}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => restock(p, -1)} className="w-7 h-7 rounded-control bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-fg-muted">−</button>
                      <span className="w-16 text-center text-sm font-semibold text-fg">{p.stock_quantity}<span className="text-[10px] font-normal text-fg-subtle ml-0.5">{p.units?.[0]?.unit || 'pcs'}</span></span>
                      <button onClick={() => restock(p, 1)} className="w-7 h-7 rounded-control bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-fg-muted">+</button>
                    </div>
                  </div>
                  <button onClick={() => setConfirmDelete(p)} className="text-fg-subtle hover:text-negative ml-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete product?"
        message={`"${confirmDelete?.name}" will be permanently removed from your stock.`}
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />

      {/* Load more */}
      {visibleCount < filtered.length && (
        <button
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          className="btn-secondary w-full text-sm h-11"
        >
          Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more ({visibleCount} of {filtered.length})
        </button>
      )}
    </div>
  )
}
