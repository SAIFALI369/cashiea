import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import { suggestPrices, type PriceSuggestion } from '../lib/dynamicPricing'
import type { Product, Transaction } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import { ArrowDown, ArrowUp, Check, Loader2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Pricing() {
  const { ownerId } = useAuth()
  const { isOwner } = useCan()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [txns, setTxns] = useState<Transaction[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [applied, setApplied] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    const from = new Date(Date.now() - 30 * 86400000).toISOString()
    ;(async () => {
      const [p, t] = await Promise.all([
        supabase.from('products').select('id,name,sku,price,cost,stock_quantity,low_stock_threshold,active').eq('user_id', ownerId).limit(2000),
        supabase.from('transactions').select('items,created_at,status').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', from).limit(1000),
      ])
      if (cancelled) return
      setProducts((p.data as Product[]) || [])
      setTxns((t.data as Transaction[]) || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const suggestions = useMemo(() => suggestPrices(products, txns), [products, txns])
  const pending = suggestions.filter((s) => !applied.has(s.productId))
  const raises = pending.filter((s) => s.action === 'raise').length
  const cuts = pending.filter((s) => s.action === 'cut').length

  const apply = async (s: PriceSuggestion) => {
    if (!isOwner) return toast.error('Only the owner can change a selling price')
    if (!ownerId) return
    setBusy(s.productId)
    try {
      const { error } = await supabase.from('products').update({ price: s.suggested }).eq('id', s.productId).eq('user_id', ownerId)
      if (error) throw error
      setProducts((list) => list.map((p) => p.id === s.productId ? { ...p, price: s.suggested } : p))
      setApplied((prev) => new Set(prev).add(s.productId))
      toast.success(`${s.name} → ${formatINR(s.suggested, 0)}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the price')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Price suggestions"
        subtitle="From the last 30 days of sales. Nothing is written until you tap Apply — and a cut never goes below cost."
        icon={<Tag className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={[
        { label: 'Suggestions', value: String(pending.length), icon: Tag, tone: pending.length ? 'warning' : 'positive' },
        { label: 'Raise', value: String(raises), icon: ArrowUp, tone: raises ? 'accent' : 'default' },
        { label: 'Markdown', value: String(cuts), icon: ArrowDown, tone: cuts ? 'warning' : 'default' },
        { label: 'Applied', value: String(applied.size), icon: Check, tone: 'secondary' },
      ]} />

      {pending.length === 0 ? (
        <EmptyState
          icon={Check}
          title="No price moves right now"
          description="A raise needs recent sales, thin cover and a known cost. A markdown needs overstock sitting above cost. Quiet SKUs without a cost are left alone."
        />
      ) : (
        <div className="space-y-2">
          {pending.map((s) => (
            <div key={s.productId} className="card p-4 flex items-start gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.action === 'raise' ? 'bg-positive/15 text-positive' : 'bg-warning/15 text-warning'}`}>
                {s.action === 'raise' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-fg truncate">{s.name}</p>
                  {s.sku && <span className="text-[11px] text-fg-subtle">{s.sku}</span>}
                </div>
                <p className="text-xs text-fg-muted mt-1 leading-relaxed">{s.reason}</p>
                <p className="text-[11px] text-fg-subtle mt-1 tabular-nums">
                  {formatINR(s.current, 0)} → {formatINR(s.suggested, 0)} · cost {formatINR(s.cost, 0)}
                  {s.daysOfCover != null ? ` · ${s.daysOfCover}d cover` : ''}
                </p>
              </div>
              <button
                onClick={() => apply(s)}
                disabled={busy === s.productId || !isOwner}
                className="btn-secondary text-xs flex-shrink-0"
              >
                {busy === s.productId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Apply {s.deltaPct > 0 ? '+' : ''}{s.deltaPct}%
              </button>
            </div>
          ))}
          {!isOwner && <p className="text-[11px] text-fg-subtle">Only the owner can apply a new selling price.</p>}
        </div>
      )}
    </div>
  )
}
