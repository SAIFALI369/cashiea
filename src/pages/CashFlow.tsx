import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import { FitAmount } from '../components/FitAmount'
import { projectCashFlow, type CashProjection } from '../lib/cashFlow'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Landmark, Loader2, Wallet } from 'lucide-react'

const PERIODS = [
  { key: 30 as const, label: '30 days' },
  { key: 60 as const, label: '60 days' },
  { key: 90 as const, label: '90 days' },
]

export default function CashFlow() {
  const { ownerId } = useAuth()
  const [days, setDays] = useState<30 | 60 | 90>(30)
  const [openingStr, setOpeningStr] = useState('')
  const [loading, setLoading] = useState(true)
  const [raw, setRaw] = useState<{
    invoices: any[]
    khata: any[]
    suppliers: any[]
    expenses: any[]
  } | null>(null)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    ;(async () => {
      const [inv, kh, sup, exp] = await Promise.all([
        supabase.from('invoices').select('id,invoice_number,client_name,total,due_date,status')
          .eq('user_id', ownerId).in('status', ['sent', 'viewed', 'partial', 'overdue']).limit(500),
        supabase.from('khata_entries').select('amount,status').eq('user_id', ownerId).eq('status', 'pending').limit(1000),
        supabase.from('suppliers').select('name,outstanding').eq('user_id', ownerId).limit(500),
        supabase.from('expenses').select('amount,type,category,date').eq('user_id', ownerId).gte('date', from).limit(1000),
      ])
      if (cancelled) return
      setRaw({
        invoices: inv.data || [],
        khata: kh.data || [],
        suppliers: sup.data || [],
        expenses: exp.data || [],
      })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const opening = openingStr.trim() === '' ? undefined : Number(openingStr)
  const proj: CashProjection | null = useMemo(() => {
    if (!raw) return null
    return projectCashFlow({
      invoices: raw.invoices,
      khata: raw.khata,
      suppliers: raw.suppliers,
      expenses: raw.expenses,
      days,
      opening: Number.isFinite(opening as number) ? opening : undefined,
    })
  }, [raw, days, opening])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  if (!proj) {
    return <EmptyState icon={Wallet} title="No cash-flow data yet" description="Unpaid invoices, supplier dues and expenses will project forward automatically." />
  }

  const maxBar = Math.max(1, ...proj.daily.map((d) => Math.max(d.inflow, d.outflow)))
  const quiet = proj.expectedIn === 0 && proj.expectedOut === 0

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cash flow"
        subtitle="What is contractually due in vs already-owed out. Khata is shown separately — it is collectable, not certain."
        icon={<Landmark className="w-5 h-5" />}
        visible
      />

      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex gap-2">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setDays(p.key)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${days === p.key ? 'bg-secondary-soft text-secondary-strong' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          Opening cash (optional)
          <input
            type="number"
            min={0}
            value={openingStr}
            onChange={(e) => setOpeningStr(e.target.value)}
            placeholder="₹"
            className="input-field w-32 py-1.5 text-sm"
          />
        </label>
      </div>

      {quiet ? (
        <EmptyState icon={Wallet} title="Nothing scheduled in this window" description="Add due dates on invoices and outstanding amounts on suppliers — the projection builds itself from real data." />
      ) : (
        <>
          <StatStrip stats={[
            { label: 'Expected in', value: formatINR(proj.expectedIn, 0), icon: ArrowDownRight, tone: 'positive', hint: 'Unpaid invoices by due date' },
            { label: 'Expected out', value: formatINR(proj.expectedOut, 0), icon: ArrowUpRight, tone: 'warning', hint: 'Supplier dues + avg expenses' },
            { label: proj.hasOpening ? 'Projected end' : 'Net change', value: formatINR(proj.hasOpening ? proj.daily[proj.daily.length - 1]?.cumulative || 0 : proj.net, 0), icon: Wallet, tone: (proj.hasOpening ? (proj.daily[proj.daily.length - 1]?.cumulative || 0) : proj.net) >= 0 ? 'positive' : 'negative' },
            { label: 'Khata (not counted)', value: formatINR(proj.khataCollectable, 0), icon: Landmark, tone: 'secondary', hint: 'Collectable, not certain' },
          ]} />

          {proj.warning && (
            <div className="card p-4 mb-5 border-warning/40 bg-warning/5 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-sm text-fg">{proj.warning}</p>
            </div>
          )}

          <div className="card p-5 mb-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-1">
              {proj.hasOpening ? 'Projected balance' : 'Net change'} · {days} days
            </p>
            <FitAmount
              value={formatINR(Math.abs(proj.hasOpening ? (proj.daily[proj.daily.length - 1]?.cumulative || 0) : proj.net), 0)}
              base="text-3xl"
              minTier="text-xl"
              className={`font-extrabold ${(proj.hasOpening ? (proj.daily[proj.daily.length - 1]?.cumulative || 0) : proj.net) >= 0 ? 'text-positive' : 'text-negative'}`}
            />

            <div className="flex items-center gap-4 mt-4 mb-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted"><span className="w-2.5 h-2.5 rounded-[3px] bg-positive" /> In</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted"><span className="w-2.5 h-2.5 rounded-[3px] bg-fg/20" /> Out</span>
            </div>
            <div className="flex items-end gap-px h-28 overflow-x-auto">
              {proj.daily.map((d) => (
                <div key={d.date} className="flex-1 min-w-[6px] h-full flex items-end justify-center gap-px" title={`${d.date}: in ${formatINR(d.inflow, 0)} · out ${formatINR(d.outflow, 0)}`}>
                  <div className="w-[45%] rounded-t-[3px] bg-positive/80" style={{ height: `${Math.max(2, Math.round((d.inflow / maxBar) * 100))}%` }} />
                  <div className="w-[45%] rounded-t-[3px] bg-fg/20" style={{ height: `${Math.max(2, Math.round((d.outflow / maxBar) * 100))}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-fg-subtle mt-1">
              <span>Today</span>
              <span>+{days}d</span>
            </div>
          </div>

          <p className="text-[11px] text-fg-subtle leading-relaxed max-w-2xl">
            Invoices without a due date are placed 14 days out. Supplier outstanding is assumed due in 7 days. Forward expenses use the last-30-day daily average of operating costs (stock purchases excluded, same as Profit). This is a projection, not a bank balance.
          </p>
        </>
      )}
    </div>
  )
}
