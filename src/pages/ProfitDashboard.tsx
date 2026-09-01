import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import { FitAmount } from '../components/FitAmount'
import EmptyState from '../components/ui/EmptyState'
import { TrendingUp, TrendingDown, Loader2, Landmark, BookOpen, Truck, Wallet, FileSpreadsheet, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadXlsx } from '../lib/xlsx'

/**
 * ProfitDashboard — where the shop actually stands.
 *
 * Honest math (the PR draft subtracted GST as "COGS" — GST is a
 * liability, not a cost):
 *   • Sales revenue  — completed POS transactions in the period
 *   • Invoice revenue — invoices paid in the period
 *   • COGS (estimated) — sold items × the product's cost price,
 *     matched by product_id where the product still exists
 *   • Gross profit   = sales + invoices − COGS
 *   • Expenses       — recorded expenses in the period
 *   • Net profit     = gross − expenses
 * Plus the credit picture: supplier dues and customer udhaar (khata).
 */
const PERIODS = [
  { key: 7, label: '7 days' },
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
] as const

export default function ProfitDashboard() {
  const { ownerId } = useAuth()
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<{
    salesRevenue: number
    invoiceRevenue: number
    cogs: number
    cogsCoverage: number
    expenses: number
    supplierDues: number
    khataPending: number
    salesRows: (string | number)[][]
  } | null>(null)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    setLoading(true)

    const from = new Date(Date.now() - days * 86400000).toISOString()

    const load = async () => {
      const [txRes, invRes, expRes, supRes, khataRes, prodRes] = await Promise.all([
        supabase.from('transactions').select('receipt_number,created_at,items,total,status')
          .eq('user_id', ownerId).eq('status', 'completed').gte('created_at', from)
          .order('created_at', { ascending: false }).limit(1000),
        supabase.from('invoices').select('invoice_number,client_name,total,paid_at,created_at')
          .eq('user_id', ownerId).eq('status', 'paid').gte('paid_at', from).limit(1000),
        supabase.from('expenses').select('date,category,description,amount,type')
          .eq('user_id', ownerId).eq('type', 'expense').gte('date', from.slice(0, 10)).limit(1000),
        supabase.from('suppliers').select('outstanding').eq('user_id', ownerId).limit(500),
        supabase.from('khata_entries').select('amount,status').eq('user_id', ownerId).eq('status', 'pending').limit(1000),
        supabase.from('products').select('id,cost').eq('user_id', ownerId).limit(2000),
      ])
      if (cancelled) return

      const txns = (txRes.data as any[]) || []
      const invoices = (invRes.data as any[]) || []
      const expenses = (expRes.data as any[]) || []
      const suppliers = (supRes.data as any[]) || []
      const khata = (khataRes.data as any[]) || []
      const products = (prodRes.data as any[]) || []

      const costById = new Map(products.map((p) => [p.id, Number(p.cost) || 0]))

      let cogs = 0
      let cogsLines = 0
      let totalLines = 0
      for (const t of txns) {
        for (const it of t.items || []) {
          totalLines++
          const cost = costById.get(it.product_id)
          if (cost != null && cost > 0) {
            cogs += (Number(it.quantity) || 0) * cost
            cogsLines++
          }
        }
      }

      const salesRevenue = txns.reduce((s, t) => s + Number(t.total || 0), 0)
      const invoiceRevenue = invoices.reduce((s, i) => s + Number(i.total || 0), 0)
      const expenseTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)

      setData({
        salesRevenue,
        invoiceRevenue,
        cogs: Math.round(cogs * 100) / 100,
        cogsCoverage: totalLines ? Math.round((cogsLines / totalLines) * 100) : 0,
        expenses: expenseTotal,
        supplierDues: suppliers.reduce((s, x) => s + Number(x.outstanding || 0), 0),
        khataPending: khata.reduce((s, k) => s + Number(k.amount || 0), 0),
        salesRows: [
          ['Date', 'Receipt', 'Items', 'Revenue', 'Status'],
          ...txns.map((t) => [
            new Date(t.created_at).toLocaleDateString('en-IN'),
            t.receipt_number || '',
            (t.items || []).reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0),
            Number(t.total) || 0,
            'completed',
          ]),
        ],
      })
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [ownerId, days])

  const figures = useMemo(() => {
    if (!data) return null
    const revenue = data.salesRevenue + data.invoiceRevenue
    const gross = revenue - data.cogs
    const net = gross - data.expenses
    return { revenue, gross, net }
  }, [data])

  const exportExcel = () => {
    if (!data || !figures) return
    downloadXlsx(`cashiea-profit-${days}d`, [
      {
        name: 'Summary',
        rows: [
          ['Metric', 'Amount (₹)'],
          ['Sales revenue (POS)', data.salesRevenue],
          ['Invoice revenue (paid)', data.invoiceRevenue],
          ['COGS (estimated)', data.cogs],
          ['Gross profit', figures.gross],
          ['Expenses', data.expenses],
          ['Net profit', figures.net],
          ['Supplier dues', data.supplierDues],
          ['Customer udhaar (khata pending)', data.khataPending],
        ],
      },
      { name: 'Sales', rows: data.salesRows },
    ])
    toast.success('Excel downloaded')
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  if (!data || (data.salesRevenue === 0 && data.invoiceRevenue === 0 && data.expenses === 0)) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No numbers yet for this period"
        description="Record sales at the counter, mark invoices paid, or add expenses — the profit picture builds itself from your real data."
      />
    )
  }

  const cards = [
    { label: 'Sales (POS)', value: data.salesRevenue, icon: Wallet, tone: 'text-fg' },
    { label: 'Invoices paid', value: data.invoiceRevenue, icon: Landmark, tone: 'text-fg' },
    { label: 'COGS (estimated)', value: -data.cogs, icon: Truck, tone: 'text-fg-muted', hint: `${data.cogsCoverage}% of lines had cost data` },
    { label: 'Gross profit', value: figures!.gross, icon: figures!.gross >= 0 ? TrendingUp : TrendingDown, tone: figures!.gross >= 0 ? 'text-positive' : 'text-negative' },
    { label: 'Expenses', value: -data.expenses, icon: Wallet, tone: 'text-fg-muted' },
    { label: 'Net profit', value: figures!.net, icon: figures!.net >= 0 ? TrendingUp : TrendingDown, tone: figures!.net >= 0 ? 'text-positive' : 'text-negative' },
    { label: 'Supplier dues', value: data.supplierDues, icon: Truck, tone: data.supplierDues > 0 ? 'text-warning' : 'text-fg-muted' },
    { label: 'Customer udhaar', value: data.khataPending, icon: BookOpen, tone: data.khataPending > 0 ? 'text-warning' : 'text-fg-muted' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Period switch + export */}
      <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setDays(p.key)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${days === p.key ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={exportExcel} className="btn-secondary text-xs"><FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel</button>
      </div>

      {/* Profit hero */}
      <div className="card p-6 mb-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-1">Net profit · last {days} days</p>
        <p className={figures!.net >= 0 ? 'text-positive' : 'text-negative'}>
          <FitAmount value={formatINR(Math.abs(figures!.net), 0)} base="text-4xl" minTier="text-xl" className="font-extrabold" />
        </p>
        <p className="text-xs text-fg-subtle mt-1">
          {figures!.net >= 0 ? 'In profit' : 'In loss'} · revenue {formatINR(figures!.revenue, 0)} · COGS {formatINR(data.cogs, 0)} · expenses {formatINR(data.expenses, 0)}
        </p>
      </div>

      {/* Breakdown grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <c.icon className="w-4 h-4 text-fg-subtle" strokeWidth={1.75} />
              <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle">{c.label}</p>
            </div>
            <FitAmount value={formatINR(Math.abs(c.value), 0)} base="text-xl" minTier="text-sm" className={`font-bold ${c.tone}`} />
            {c.hint && <p className="text-[10px] text-fg-subtle mt-1">{c.hint}</p>}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-fg-subtle mt-4 leading-relaxed max-w-2xl">
        COGS is estimated from each sold product's cost price ({data.cogsCoverage}% of sale lines had cost data). Lines without cost data are excluded from COGS, so gross profit may be optimistic — fill in product costs in Stock for a truer picture.
      </p>
    </div>
  )
}
