import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import { ymd } from '../lib/smartReminders'
import { buildSupplierScorecards, type SupplierGrade } from '../lib/supplierScorecard'
import type { PurchaseOrder, Supplier } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import { ArrowRight, ClipboardCheck, Loader2, Truck } from 'lucide-react'

const GRADE_CLS: Record<SupplierGrade, string> = {
  A: 'bg-positive/15 text-positive',
  B: 'bg-secondary-soft text-secondary-strong',
  C: 'bg-negative/15 text-negative',
  '—': 'bg-surface-2 text-fg-subtle',
}

export default function Scorecard() {
  const { ownerId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [pos, setPos] = useState<PurchaseOrder[]>([])

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      const [s, p] = await Promise.all([
        supabase.from('suppliers').select('id,name,outstanding').eq('user_id', ownerId).limit(500),
        supabase.from('purchase_orders').select('id,supplier_id,total,status,expected_date,created_at,items').eq('user_id', ownerId).limit(1000),
      ])
      if (cancelled) return
      setSuppliers((s.data as Supplier[]) || [])
      setPos((p.data as PurchaseOrder[]) || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const cards = useMemo(() => buildSupplierScorecards(suppliers, pos, ymd(new Date())), [suppliers, pos])
  const late = cards.reduce((n, c) => n + c.lateOpenCount, 0)
  const volume = cards.reduce((n, c) => n + c.volume, 0)

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Supplier scorecard"
        subtitle="Volume, outstanding and open POs past the expected date. We do not invent an on-time % — purchase orders have no received timestamp."
        icon={<ClipboardCheck className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={[
        { label: 'Suppliers', value: String(cards.length), icon: Truck, tone: 'default' },
        { label: 'Received volume', value: formatINR(volume, 0), icon: ClipboardCheck, tone: 'accent' },
        { label: 'Late open POs', value: String(late), icon: ClipboardCheck, tone: late ? 'negative' : 'positive' },
        { label: 'Grade A', value: String(cards.filter((c) => c.grade === 'A').length), icon: Truck, tone: 'secondary' },
      ]} />

      {cards.length === 0 ? (
        <EmptyState icon={Truck} title="No suppliers yet" description="Add vendors under Suppliers — the scorecard fills itself from purchase orders." />
      ) : (
        <div className="space-y-3">
          {cards.map((c) => (
            <div key={c.supplierId} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-fg truncate">{c.name}</p>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${GRADE_CLS[c.grade]}`}>{c.grade}</span>
                  </div>
                  <p className="text-xs text-fg-muted mt-1">{c.gradeWhy}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-fg flex-shrink-0">{formatINR(c.volume, 0)}</p>
              </div>
              <p className="text-[11px] text-fg-subtle mt-2 tabular-nums">
                {c.poCount} PO{c.poCount === 1 ? '' : 's'} · {c.receivedCount} received · {c.openCount} open
                {c.lateOpenCount ? ` · ${c.lateOpenCount} late` : ''}
                {c.outstanding > 0 ? ` · outstanding ${formatINR(c.outstanding, 0)}` : ''}
              </p>
              {c.cheaperWins[0] && (
                <p className="text-[11px] text-positive mt-2">
                  Cheaper on {c.cheaperWins[0].item} than {c.cheaperWins[0].rivalName} ({formatINR(c.cheaperWins[0].ourPrice, 0)} vs {formatINR(c.cheaperWins[0].rivalPrice, 0)})
                </p>
              )}
              {c.dearerLosses[0] && (
                <p className="text-[11px] text-warning mt-1">
                  Dearer on {c.dearerLosses[0].item} than {c.dearerLosses[0].rivalName} ({formatINR(c.dearerLosses[0].ourPrice, 0)} vs {formatINR(c.dearerLosses[0].rivalPrice, 0)})
                </p>
              )}
            </div>
          ))}
          <Link to="/app/suppliers" className="btn-ghost text-xs inline-flex">
            Open suppliers <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
