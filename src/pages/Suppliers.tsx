import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Supplier, PurchaseOrder } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Truck, Plus, Loader2, Trash2, X, Package } from 'lucide-react'
import toast from 'react-hot-toast'

interface POFormItem { name: string; quantity: string; unit_price: string }

export default function Suppliers() {
  const { profile, ownerId } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'suppliers' | 'orders'>('suppliers')

  const [showSupplier, setShowSupplier] = useState(false)
  const [supForm, setSupForm] = useState({ name: '', contact_person: '', email: '', phone: '', address: '', gstin: '', notes: '' })

  const [showPO, setShowPO] = useState(false)
  const [poForm, setPoForm] = useState<{ supplier_id: string; items: POFormItem[]; expected_date: string; notes: string }>({ supplier_id: '', items: [{ name: '', quantity: '', unit_price: '' }], expected_date: '', notes: '' })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [s, p] = await Promise.all([
      supabase.from('suppliers').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }),
      supabase.from('purchase_orders').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }),
    ])
    setSuppliers((s.data as Supplier[]) || [])
    setPos((p.data as PurchaseOrder[]) || [])
    setLoading(false)
  }

  const saveSupplier = async () => {
    if (!supForm.name.trim()) return toast.error('Supplier name required')
    const { data, error } = await supabase.from('suppliers').insert({ user_id: ownerId, ...supForm }).select().single()
    if (error) { toast.error(error.message); return }
    setSuppliers([data as Supplier, ...suppliers])
    setSupForm({ name: '', contact_person: '', email: '', phone: '', address: '', gstin: '', notes: '' })
    setShowSupplier(false)
    toast.success('Supplier added')
  }

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (!error) { setSuppliers(suppliers.filter((s) => s.id !== id)); toast.success('Deleted') }
  }

  const updatePOItem = (i: number, field: keyof POFormItem, val: string) => {
    const items = [...poForm.items]; items[i] = { ...items[i], [field]: val }; setPoForm({ ...poForm, items })
  }
  const addPOItem = () => setPoForm({ ...poForm, items: [...poForm.items, { name: '', quantity: '', unit_price: '' }] })
  const removePOItem = (i: number) => setPoForm({ ...poForm, items: poForm.items.filter((_, idx) => idx !== i) })

  const poSubtotal = poForm.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  const poTotal = poSubtotal // tax omitted for PO simplicity

  const createPO = async () => {
    if (!poForm.supplier_id) return toast.error('Select a supplier')
    const validItems = poForm.items.filter((it) => it.name.trim() && it.quantity)
    if (validItems.length === 0) return toast.error('Add at least one item')
    const poNumber = `PO-${Date.now().toString().slice(-7)}`
    const { data, error } = await supabase.from('purchase_orders').insert({
      user_id: ownerId,
      supplier_id: poForm.supplier_id,
      po_number: poNumber,
      items: validItems.map((it) => ({ name: it.name, quantity: Number(it.quantity), unit_price: Number(it.unit_price) || 0 })),
      subtotal: poSubtotal, tax_amount: 0, total: poTotal,
      status: 'ordered', expected_date: poForm.expected_date || null, notes: poForm.notes || null,
    }).select().single()
    if (error) { toast.error(error.message); return }
    await supabase.rpc('recompute_supplier_outstanding', { supplier_uuid: poForm.supplier_id })
    setPos([data as PurchaseOrder, ...pos])
    setPoForm({ supplier_id: '', items: [{ name: '', quantity: '', unit_price: '' }], expected_date: '', notes: '' })
    setShowPO(false)
    await loadData()
    toast.success('Purchase order created')
  }

  const markReceived = async (po: PurchaseOrder) => {
    const { error } = await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', po.id)
    if (!error) { setPos(pos.map((p) => p.id === po.id ? { ...p, status: 'received' } : p)); toast.success('Marked received') }
  }

  const supplierName = (id: string | null) => suppliers.find((s) => s.id === id)?.name || 'Unknown'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Suppliers & Purchase Orders"
        subtitle="Manage vendors, create POs, and track outstanding payments"
        icon={<Truck className="w-5 h-5" />}
        action={tab === 'suppliers'
          ? <button onClick={() => setShowSupplier(!showSupplier)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showSupplier ? 'Close' : 'Add Supplier'}</button>
          : <button onClick={() => setShowPO(!showPO)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showPO ? 'Close' : 'New PO'}</button>}
      />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('suppliers')} className={`flex-1 p-2.5 rounded-xl border text-sm font-medium ${tab === 'suppliers' ? 'border-brand-600 bg-brand-600/15 text-fg' : 'border-line text-fg-muted'}`}>Suppliers ({suppliers.length})</button>
        <button onClick={() => setTab('orders')} className={`flex-1 p-2.5 rounded-xl border text-sm font-medium ${tab === 'orders' ? 'border-brand-600 bg-brand-600/15 text-fg' : 'border-line text-fg-muted'}`}>Purchase Orders ({pos.length})</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : tab === 'suppliers' ? (
        <>
          {showSupplier && (
            <div className="card p-4 mb-6 animate-slide-up">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className="label">Name *</label><input value={supForm.name} onChange={(e) => setSupForm({ ...supForm, name: e.target.value })} className="input-field" placeholder="ABC Distributors" /></div>
                <div><label className="label">Contact person</label><input value={supForm.contact_person} onChange={(e) => setSupForm({ ...supForm, contact_person: e.target.value })} className="input-field" /></div>
                <div><label className="label">Email</label><input value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} className="input-field" /></div>
                <div><label className="label">Phone</label><input value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} className="input-field" /></div>
                <div><label className="label">GSTIN</label><input value={supForm.gstin} onChange={(e) => setSupForm({ ...supForm, gstin: e.target.value })} className="input-field" placeholder="22AAAAA0000A1Z5" /></div>
                <div><label className="label">Address</label><input value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} className="input-field" /></div>
              </div>
              <div className="flex justify-end gap-3 mt-4"><button onClick={() => setShowSupplier(false)} className="btn-secondary text-sm">Cancel</button><button onClick={saveSupplier} className="btn-primary text-sm">Save</button></div>
            </div>
          )}
          {suppliers.length === 0 ? (
            <EmptyState icon={Truck} title="No suppliers yet" description="Add your vendors to create purchase orders and track outstanding payments." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {suppliers.map((s) => (
                <div key={s.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-surface-2 flex items-center justify-center flex-shrink-0"><Truck className="w-5 h-5 text-brand-400" /></div>
                      <div className="min-w-0"><h3 className="font-semibold text-fg truncate">{s.name}</h3>{s.contact_person && <p className="text-xs text-fg-subtle truncate">{s.contact_person}</p>}</div>
                    </div>
                    <button onClick={() => deleteSupplier(s.id)} className="text-fg-subtle hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-fg-muted">
                    {s.phone && <span>{s.phone}</span>}
                    {s.email && <span className="truncate">{s.email}</span>}
                    {s.gstin && <span className="font-mono">GST: {s.gstin}</span>}
                  </div>
                  {Number(s.outstanding) > 0 && <div className="mt-3 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 text-xs font-medium inline-block">Outstanding: ₹{Number(s.outstanding).toFixed(0)}</div>}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {showPO && (
            <div className="card p-4 mb-6 animate-slide-up">
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div><label className="label">Supplier *</label><select value={poForm.supplier_id} onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })} className="input-field"><option value="">Select...</option>{suppliers.map((s) => <option key={s.id} value={s.id} className="bg-surface">{s.name}</option>)}</select></div>
                <div><label className="label">Expected date</label><input type="date" value={poForm.expected_date} onChange={(e) => setPoForm({ ...poForm, expected_date: e.target.value })} className="input-field" /></div>
              </div>
              <label className="label">Items</label>
              {poForm.items.map((it, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={it.name} onChange={(e) => updatePOItem(i, 'name', e.target.value)} className="input-field flex-1" placeholder="Item name" />
                  <input type="number" value={it.quantity} onChange={(e) => updatePOItem(i, 'quantity', e.target.value)} className="input-field w-24" placeholder="Qty" />
                  <input type="number" value={it.unit_price} onChange={(e) => updatePOItem(i, 'unit_price', e.target.value)} className="input-field w-28" placeholder="Price" />
                  {poForm.items.length > 1 && <button onClick={() => removePOItem(i)} className="text-red-400 px-2"><X className="w-4 h-4" /></button>}
                </div>
              ))}
              <button onClick={addPOItem} className="btn-ghost text-xs"><Plus className="w-3.5 h-3.5" /> Add item</button>
              <div className="flex justify-between items-center mt-4 border-t border-line pt-3"><span className="text-sm text-fg-muted">Total</span><span className="text-xl font-bold text-fg">₹{poTotal.toFixed(2)}</span></div>
              <div className="flex justify-end gap-3 mt-3"><button onClick={() => setShowPO(false)} className="btn-secondary text-sm">Cancel</button><button onClick={createPO} className="btn-primary text-sm">Create PO</button></div>
            </div>
          )}
          {pos.length === 0 ? (
            <EmptyState icon={Package} title="No purchase orders yet" description="Create a PO to order stock from a supplier and track what's owed." />
          ) : (
            <div className="space-y-2">
              {pos.map((po) => (
                <div key={po.id} className="card p-4 flex items-center justify-between">
                  <div><div className="flex items-center gap-2"><span className="font-mono text-sm text-fg">{po.po_number}</span><span className={`text-xs px-2 py-0.5 rounded-full ${po.status === 'received' ? 'bg-green-500/15 text-green-400' : po.status === 'ordered' ? 'bg-blue-500/15 text-blue-400' : 'bg-surface-3 text-fg-muted'}`}>{po.status}</span></div><p className="text-xs text-fg-subtle mt-0.5">{supplierName(po.supplier_id)} · {po.items?.length || 0} items · {new Date(po.created_at).toLocaleDateString()}</p></div>
                  <div className="flex items-center gap-3"><span className="font-semibold text-fg">₹{Number(po.total).toFixed(0)}</span>{po.status === 'ordered' && <button onClick={() => markReceived(po)} className="btn-secondary text-xs">Mark received</button>}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
