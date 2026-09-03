import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase, edgeFunctionUrl } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import type { Expense } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { exportToCSV } from '../lib/export'
import { Wallet, Plus, Loader2, Trash2, TrendingDown, TrendingUp, Download, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

const categories = ['Rent', 'Salaries', 'Inventory', 'Utilities', 'Marketing', 'Transport', 'Maintenance', 'Sales', 'Other']

export default function Accounts() {
  const { ownerId } = useAuth()
  const { isOwner } = useCan()
  const [entries, setEntries] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'expense', category: 'Inventory', description: '', amount: '', payment_method: 'cash', date: new Date().toISOString().split('T')[0], notes: '' })
  const [scanning, setScanning] = useState(false)
  const scanRef = useRef<HTMLInputElement>(null)

  const scanReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file || !file.type.startsWith('image/')) { toast.error('Please choose an image.'); return }
    setScanning(true)
    try {
      const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file) })
      const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl })
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas'); canvas.width = img.width * scale; canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('You must be logged in to scan a receipt')
      const r = await fetch(edgeFunctionUrl('scan-receipt'), { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }, body: JSON.stringify({ image: { data: imageData, mimeType: 'image/jpeg' } }) })
      const result = await r.json(); if (!r.ok) throw new Error(result?.error || 'Scan failed')
      const d = result.extracted
      const catMap: Record<string, string> = { utilities: 'Utilities', rent: 'Rent', supplies: 'Inventory', transport: 'Transport', food: 'Other', salary: 'Salaries', maintenance: 'Maintenance', marketing: 'Marketing', tax: 'Other', other: 'Other' }
      setForm({ type: 'expense', category: catMap[d.category] || 'Other', description: d.vendor || 'Scanned receipt', amount: String(d.amount || ''), payment_method: d.payment_method || 'cash', date: d.date || new Date().toISOString().split('T')[0], notes: d.tax_amount ? `GST: ₹${d.tax_amount}` : '' })
      setShowForm(true); toast.success('Receipt scanned — review and save')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Scan failed') }
    finally { setScanning(false) }
  }

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    setLoading(true)
    supabase.from('expenses').select('*').eq('user_id', ownerId).order('date', { ascending: false })
      .then(({ data }) => { if (!cancelled) { setEntries((data as Expense[]) || []); setLoading(false) } })
    return () => { cancelled = true }
  }, [ownerId])

  const save = async () => {
    if (!isOwner) { toast.error('Only the business owner can record accounts entries'); return }
    if (!ownerId) { toast.error('Your shop is still loading — please try again'); return }
    if (!form.description.trim()) return toast.error('Description required')
    if (!form.amount) return toast.error('Amount required')
    const { data, error } = await offlineInsert('expenses', {
      user_id: ownerId, type: form.type, category: form.category, description: form.description,
      amount: Number(form.amount), payment_method: form.payment_method, date: form.date, notes: form.notes || null,
    })
    if (error) { toast.error(error.message); return }
    setEntries([data as Expense, ...entries])
    setForm({ ...form, description: '', amount: '' })
    setShowForm(false)
    toast.success('Entry added')
  }

  const del = async (id: string) => {
    if (!isOwner) { toast.error('Only the business owner can delete accounts entries'); return }
    if (!ownerId) return
    const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', ownerId)
    if (!error) { setEntries(entries.filter((e) => e.id !== id)); toast.success('Deleted') }
  }

  // Aggregations
  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

  const todayExpenses = entries.filter((e) => e.type === 'expense' && e.date === today).reduce((s, e) => s + Number(e.amount), 0)
  const todayIncome = entries.filter((e) => e.type === 'income' && e.date === today).reduce((s, e) => s + Number(e.amount), 0)
  const monthExpenses = entries.filter((e) => e.type === 'expense' && e.date >= monthStart).reduce((s, e) => s + Number(e.amount), 0)
  const monthIncome = entries.filter((e) => e.type === 'income' && e.date >= monthStart).reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="animate-fade-in">
      <PageHeader title="Accounts" subtitle="Track expenses, income, cash flow & profit" icon={<Wallet className="w-5 h-5" />} action={<div className="flex gap-2">{isOwner && <><input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={scanReceipt} /><button onClick={() => scanRef.current?.click()} disabled={scanning} className="btn-secondary text-xs">{scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />} Scan</button></>}<button onClick={() => exportToCSV('accounts', entries as unknown as Record<string, unknown>[])} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> Export</button>{isOwner && <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Add Entry'}</button>}</div>} />

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-positive" /><span className="text-xs text-fg-muted">Today's Income</span></div><p className="text-xl font-bold text-positive">₹{todayIncome.toFixed(0)}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-negative" /><span className="text-xs text-fg-muted">Today's Expenses</span></div><p className="text-xl font-bold text-negative">₹{todayExpenses.toFixed(0)}</p></div>
        <div className="card p-4"><span className="text-xs text-fg-muted block mb-1">Month Income</span><p className="text-xl font-bold text-positive">₹{monthIncome.toFixed(0)}</p></div>
        <div className="card p-4"><span className="text-xs text-fg-muted block mb-1">Month Expenses</span><p className="text-xl font-bold text-negative">₹{monthExpenses.toFixed(0)}</p><p className="text-xs text-fg-subtle mt-0.5">Net: ₹{(monthIncome - monthExpenses).toFixed(0)}</p></div>
      </div>

      {isOwner && showForm && (
        <div className="card p-4 mb-6 animate-slide-up">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setForm({ ...form, type: 'expense' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${form.type === 'expense' ? 'bg-negative/20 text-negative border border-red-600/40' : 'bg-surface-2 text-fg-muted'}`}>💸 Expense</button>
            <button onClick={() => setForm({ ...form, type: 'income' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${form.type === 'income' ? 'bg-positive/20 text-positive border border-green-600/40' : 'bg-surface-2 text-fg-muted'}`}>💰 Income</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">{categories.map((c) => <option key={c} value={c} className="bg-surface">{c}</option>)}</select></div>
            <div><label className="label">Amount (₹) *</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" placeholder="5000" /></div>
            <div className="sm:col-span-2"><label className="label">Description *</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Shop rent" /></div>
            <div><label className="label">Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" /></div>
            <div><label className="label">Payment method</label><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="input-field"><option value="cash" className="bg-surface">Cash</option><option value="bank" className="bg-surface">Bank</option><option value="upi" className="bg-surface">UPI</option><option value="card" className="bg-surface">Card</option></select></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button><button onClick={save} className="btn-primary text-sm">Save Entry</button></div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Wallet} title="No entries yet" description="Record expenses and income to track cash flow, profit, and spending by category." />
      ) : (
        <div className="card divide-y divide-line">
          {entries.slice(0, 50).map((e) => (
            <div key={e.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${e.type === 'income' ? 'bg-positive/15' : 'bg-negative/15'}`}>{e.type === 'income' ? <TrendingUp className="w-4 h-4 text-positive" /> : <TrendingDown className="w-4 h-4 text-negative" />}</div>
                <div className="min-w-0"><p className="text-sm text-fg truncate">{e.description}</p><p className="text-xs text-fg-subtle">{e.category} · {e.date} · {e.payment_method}</p></div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0"><span className={`font-semibold ${e.type === 'income' ? 'text-positive' : 'text-negative'}`}>{e.type === 'income' ? '+' : '−'}₹{Number(e.amount).toFixed(0)}</span>{isOwner && <button onClick={() => del(e.id)} className="text-fg-subtle hover:text-negative"><Trash2 className="w-3.5 h-3.5" /></button>}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
