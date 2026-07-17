import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Expense } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { exportToCSV } from '../lib/export'
import { Wallet, Plus, Loader2, Trash2, TrendingDown, TrendingUp, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const categories = ['Rent', 'Salaries', 'Inventory', 'Utilities', 'Marketing', 'Transport', 'Maintenance', 'Sales', 'Other']

export default function Accounts() {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'expense', category: 'Inventory', description: '', amount: '', payment_method: 'cash', date: new Date().toISOString().split('T')[0], notes: '' })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').eq('user_id', profile!.id).order('date', { ascending: false })
    setEntries((data as Expense[]) || [])
    setLoading(false)
  }

  const save = async () => {
    if (!form.description.trim()) return toast.error('Description required')
    if (!form.amount) return toast.error('Amount required')
    const { data, error } = await supabase.from('expenses').insert({
      user_id: profile!.id, type: form.type, category: form.category, description: form.description,
      amount: Number(form.amount), payment_method: form.payment_method, date: form.date, notes: form.notes || null,
    }).select().single()
    if (error) { toast.error(error.message); return }
    setEntries([data as Expense, ...entries])
    setForm({ ...form, description: '', amount: '' })
    setShowForm(false)
    toast.success('Entry added')
  }

  const del = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
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
      <PageHeader title="Accounts" subtitle="Track expenses, income, cash flow & profit" icon={<Wallet className="w-5 h-5" />} action={<div className="flex gap-2"><button onClick={() => exportToCSV('accounts', entries as unknown as Record<string, unknown>[])} className="btn-secondary text-xs"><Download className="w-3.5 h-3.5" /> Export</button><button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> {showForm ? 'Close' : 'Add Entry'}</button></div>} />

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card p-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-xs text-slate-400">Today's Income</span></div><p className="text-2xl font-bold text-green-400">₹{todayIncome.toFixed(0)}</p></div>
        <div className="card p-4"><div className="flex items-center gap-2 mb-1"><TrendingDown className="w-4 h-4 text-red-400" /><span className="text-xs text-slate-400">Today's Expenses</span></div><p className="text-2xl font-bold text-red-400">₹{todayExpenses.toFixed(0)}</p></div>
        <div className="card p-4"><span className="text-xs text-slate-400 block mb-1">Month Income</span><p className="text-2xl font-bold text-green-400">₹{monthIncome.toFixed(0)}</p></div>
        <div className="card p-4"><span className="text-xs text-slate-400 block mb-1">Month Expenses</span><p className="text-2xl font-bold text-red-400">₹{monthExpenses.toFixed(0)}</p><p className="text-xs text-slate-500 mt-0.5">Net: ₹{(monthIncome - monthExpenses).toFixed(0)}</p></div>
      </div>

      {showForm && (
        <div className="card p-6 mb-6 animate-slide-up">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setForm({ ...form, type: 'expense' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${form.type === 'expense' ? 'bg-red-500/20 text-red-400 border border-red-600/40' : 'bg-slate-800 text-slate-400'}`}>💸 Expense</button>
            <button onClick={() => setForm({ ...form, type: 'income' })} className={`flex-1 py-2 rounded-xl text-sm font-medium ${form.type === 'income' ? 'bg-green-500/20 text-green-400 border border-green-600/40' : 'bg-slate-800 text-slate-400'}`}>💰 Income</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-field">{categories.map((c) => <option key={c} value={c} className="bg-slate-900">{c}</option>)}</select></div>
            <div><label className="label">Amount (₹) *</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field" placeholder="5000" /></div>
            <div className="sm:col-span-2"><label className="label">Description *</label><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Shop rent" /></div>
            <div><label className="label">Date</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" /></div>
            <div><label className="label">Payment method</label><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="input-field"><option value="cash" className="bg-slate-900">Cash</option><option value="bank" className="bg-slate-900">Bank</option><option value="upi" className="bg-slate-900">UPI</option><option value="card" className="bg-slate-900">Card</option></select></div>
          </div>
          <div className="flex justify-end gap-3 mt-4"><button onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button><button onClick={save} className="btn-primary text-sm">Save Entry</button></div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Wallet} title="No entries yet" description="Record expenses and income to track cash flow, profit, and spending by category." />
      ) : (
        <div className="card divide-y divide-slate-800">
          {entries.slice(0, 50).map((e) => (
            <div key={e.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${e.type === 'income' ? 'bg-green-500/15' : 'bg-red-500/15'}`}>{e.type === 'income' ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}</div>
                <div className="min-w-0"><p className="text-sm text-white truncate">{e.description}</p><p className="text-xs text-slate-500">{e.category} · {e.date} · {e.payment_method}</p></div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0"><span className={`font-semibold ${e.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>{e.type === 'income' ? '+' : '−'}₹{Number(e.amount).toFixed(0)}</span><button onClick={() => del(e.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
