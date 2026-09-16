import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase, edgeFunctionUrl } from '../lib/supabase'
import { offlineInsert } from '../lib/mutations'
import type { Expense } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import { exportToCSV } from '../lib/export'
import { Wallet, Plus, Loader2, Trash2, TrendingDown, TrendingUp, Download, Camera, Bus, BriefcaseBusiness, Zap, ShoppingBag } from 'lucide-react'
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
  const [swipedId, setSwipedId] = useState<string | null>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)
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
    const amount = Number(form.amount)
    if (!Number.isFinite(amount) || amount <= 0) return toast.error('Enter a valid amount greater than ₹0')
    const { data, error } = await offlineInsert('expenses', {
      user_id: ownerId, type: form.type, category: form.category, description: form.description,
      amount: Math.round(amount * 100) / 100, payment_method: form.payment_method, date: form.date, notes: form.notes || null,
    })
    if (error) { toast.error(error.message); return }
    setEntries([data as Expense, ...entries])
    setForm({ ...form, description: '', amount: '' })
    setShowForm(false)
    try { window.dispatchEvent(new CustomEvent('cashiea:voice-event', { detail: { kind: 'expense' } })) } catch { /* voice */ }
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
    <div className="accounts-page animate-fade-in">
      <PageHeader title="Accounts" subtitle="Track expenses, income, cash flow & profit" icon={<Wallet className="w-5 h-5" />} action={<div className="flex gap-2">{isOwner && <><input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={scanReceipt} /><button onClick={() => scanRef.current?.click()} disabled={scanning} className="btn-secondary border-0 bg-[#F3F4F6] text-[#111827] text-xs">{scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />} Scan</button></>}<button onClick={() => exportToCSV('accounts', entries as unknown as Record<string, unknown>[])} className="btn-secondary border-0 bg-[#F3F4F6] text-[#111827] text-xs"><Download className="w-3.5 h-3.5" /> Export</button>{isOwner && <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Add Entry'}</button>}</div>} />

      {/* Cashflow — one focused financial picture */}
      <section className="card mb-6 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-fg-subtle">Cashflow</p>
            <p className={`mt-2 text-3xl font-extrabold tracking-tight ${monthIncome - monthExpenses >= 0 ? 'text-emerald-600' : 'text-fg'}`}>
              {monthIncome - monthExpenses < 0 ? '−' : ''}₹{Math.abs(monthIncome - monthExpenses).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </p>
            <p className="mt-1 text-sm font-medium text-fg-muted">Net this month</p>
          </div>
          <Wallet className="h-5 w-5 text-accent" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div><p className="text-xs text-fg-subtle">Income</p><p className="mt-1 text-lg font-bold text-emerald-600">₹{monthIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
          <div className="border-l border-line pl-4"><p className="text-xs text-fg-subtle">Expenses</p><p className="mt-1 text-lg font-bold text-fg">₹{monthExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
        </div>
        <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-red-100" aria-label="Income versus expenses">
          <span className="bg-emerald-500" style={{ width: `${monthIncome + monthExpenses > 0 ? Math.min(100, (monthIncome / (monthIncome + monthExpenses)) * 100) : 0}%` }} />
        </div>
      </section>

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
        <div className="card flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
          <Wallet className="h-10 w-10 text-fg-subtle" />
          <p className="mt-4 text-base font-bold text-fg">No entries yet</p>
          <p className="mt-1 text-sm text-fg-muted">Record expenses and income to track your cashflow.</p>
        </div>
      ) : (
        <section>
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold text-fg-subtle">Transactions</p><h2 className="mt-1 text-lg font-bold text-fg">Clean Log</h2></div><span className="text-xs text-fg-subtle">{entries.length} entries</span></div>
          <div className="space-y-4">
            {entries.slice(0, 50).map((e) => {
              const CategoryIcon = e.category === 'Transport' ? Bus : e.category === 'Salaries' ? BriefcaseBusiness : e.category === 'Utilities' ? Zap : ShoppingBag
              const categoryTone = e.category === 'Transport' ? 'bg-blue-100 text-blue-600' : e.category === 'Salaries' ? 'bg-purple-100 text-purple-600' : e.category === 'Utilities' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
              return (
                <div key={e.id} className="relative overflow-hidden rounded-2xl" onTouchStart={(event) => setTouchStart(event.touches[0].clientX)} onTouchEnd={(event) => { if (touchStart !== null && touchStart - event.changedTouches[0].clientX > 48) setSwipedId(e.id); else if (touchStart !== null && event.changedTouches[0].clientX - touchStart > 48) setSwipedId(null); setTouchStart(null) }}>
                  {isOwner && <div className="absolute inset-y-0 right-0 flex w-20 items-stretch"><button onClick={() => del(e.id)} className="flex flex-1 flex-col items-center justify-center gap-1 bg-red-600 text-xs font-semibold text-white"><Trash2 className="h-4 w-4" />Delete</button></div>}
                  <div className={`card relative flex items-center justify-between gap-3 p-5 transition-transform duration-200 ${swipedId === e.id ? '-translate-x-20' : ''}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${categoryTone}`}><CategoryIcon className="h-5 w-5" /></div>
                      <div className="min-w-0"><p className="truncate text-sm font-bold text-fg">{e.description}</p><p className="mt-1 truncate text-xs text-fg-subtle">{e.category} · {e.date}</p></div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3"><span className={`font-bold tabular-nums ${e.type === 'income' ? 'text-emerald-600' : 'text-[#F87171]'}`}>{e.type === 'income' ? '+' : '−'}₹{Number(e.amount).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
