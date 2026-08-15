import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { requestAction } from '../lib/approvals'
import { supabase } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import type { Product } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Package, Plus, Loader2, Trash2, AlertTriangle, Search } from 'lucide-react'
import toast from 'react-hot-toast'

const empty = { name: '', description: '', sku: '', category: 'general', price: '', cost: '', stock_quantity: '', low_stock_threshold: '5' }

export default function Products() {
  const { profile, ownerId } = useAuth()
  const { isOwner } = useCan()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProducts() }, [])

  const loadProducts = async () => {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').eq('user_id', ownerId).order('created_at', { ascending: false })
    setProducts((data as Product[]) || [])
    setLoading(false)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Product name is required')
    setSaving(true)
    try {
      const prod = {
        name: form.name, description: form.description || null, sku: form.sku || null,
        category: form.category || 'general', price: Number(form.price) || 0, cost: Number(form.cost) || 0,
        stock_quantity: Number(form.stock_quantity) || 0, low_stock_threshold: Number(form.low_stock_threshold) || 5,
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

  const filtered = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || '').toLowerCase().includes(search.toLowerCase())
  )
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
            <div><label className="label">Stock quantity</label><input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} className="input-field" placeholder="100" /></div>
            <div><label className="label">Low-stock alert at</label><input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className="input-field" placeholder="5" /></div>
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
          <div className="space-y-2">
            {filtered.map((p) => {
              const low = p.stock_quantity <= p.low_stock_threshold
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
                    </div>
                    <p className="text-sm text-accent mt-0.5">₹{p.price.toFixed(2)} <span className="text-fg-subtle">· {margin}% margin</span></p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {low && <span className="flex items-center gap-1 text-xs text-warning mr-1"><AlertTriangle className="w-3.5 h-3.5" /></span>}
                    <button onClick={() => restock(p, -1)} className="w-7 h-7 rounded-control bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-fg-muted">−</button>
                    <span className={`w-12 text-center text-sm font-semibold ${low ? 'text-warning' : 'text-fg'}`}>{p.stock_quantity}</span>
                    <button onClick={() => restock(p, 1)} className="w-7 h-7 rounded-control bg-surface-2 hover:bg-surface-3 flex items-center justify-center text-fg-muted">+</button>
                  </div>
                  <button onClick={() => handleDelete(p)} className="text-fg-subtle hover:text-negative ml-2"><Trash2 className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
