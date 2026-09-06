import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import {
  findCustomerDuplicates, findProductDuplicates, pickKeeper, missingContactFields,
  type DuplicatePair,
} from '../lib/duplicates'
import type { Customer, Product } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Copy, Loader2, Package, Sparkles, Users } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Duplicates() {
  const { ownerId } = useAuth()
  const { can, isOwner } = useCan()
  const [tab, setTab] = useState<'customers' | 'products'>('customers')
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ pair: DuplicatePair; keeper: Customer; extra: Customer; patch: Record<string, string> } | null>(null)

  const load = async () => {
    if (!ownerId) return
    setLoading(true)
    const [c, p] = await Promise.all([
      supabase.from('customers').select('*').eq('user_id', ownerId).limit(2000),
      supabase.from('products').select('id,name,sku').eq('user_id', ownerId).limit(2000),
    ])
    setCustomers((c.data as Customer[]) || [])
    setProducts((p.data as Product[]) || [])
    setLoading(false)
  }

  useEffect(() => { if (ownerId) void load() }, [ownerId])

  const customerPairs = useMemo(() => findCustomerDuplicates(customers), [customers])
  const productPairs = useMemo(() => findProductDuplicates(products), [products])

  const byId = useMemo(() => {
    const m = new Map<string, Customer>()
    customers.forEach((c) => m.set(c.id, c))
    return m
  }, [customers])

  const startMerge = (pair: DuplicatePair) => {
    const a = byId.get(pair.aId)
    const b = byId.get(pair.bId)
    if (!a || !b) return
    const { keeper, extra } = pickKeeper(a, b)
    const patch = missingContactFields(keeper, extra)
    setConfirm({ pair, keeper, extra, patch })
  }

  const applyMerge = async () => {
    if (!confirm || !ownerId) return
    if (!can('customers:manage')) return toast.error('Your role cannot merge customers')
    const { keeper, extra, patch } = confirm
    setConfirm(null)
    setBusy(keeper.id)
    try {
      if (Object.keys(patch).length) {
        const { error } = await supabase.from('customers').update(patch).eq('id', keeper.id).eq('user_id', ownerId)
        if (error) throw error
      }
      const extraOrders = Number(extra.total_orders) || 0
      if (extraOrders === 0 && isOwner) {
        const { error } = await supabase.from('customers').delete().eq('id', extra.id).eq('user_id', ownerId)
        if (error) throw error
        setCustomers((list) => list.filter((c) => c.id !== extra.id).map((c) => c.id === keeper.id ? { ...c, ...patch } as Customer : c))
        toast.success(`Merged into ${keeper.name} and removed the empty duplicate`)
      } else {
        setCustomers((list) => list.map((c) => c.id === keeper.id ? { ...c, ...patch } as Customer : c))
        toast.success(`Copied missing details onto ${keeper.name}. The other card was kept — it has ${extraOrders} order${extraOrders === 1 ? '' : 's'}.`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Merge failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  const pairs = tab === 'customers' ? customerPairs : productPairs

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Data hygiene"
        subtitle="Same phone, same SKU, or a near-identical name. Products are flagged only — stock is never merged."
        icon={<Copy className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={[
        { label: 'Customer pairs', value: String(customerPairs.length), icon: Users, tone: customerPairs.length ? 'warning' : 'positive' },
        { label: 'Product pairs', value: String(productPairs.length), icon: Package, tone: productPairs.length ? 'warning' : 'positive' },
        { label: 'Customers scanned', value: String(customers.length), icon: Users, tone: 'default' },
        { label: 'Products scanned', value: String(products.length), icon: Package, tone: 'secondary' },
      ]} />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('customers')} className={`flex-1 p-2.5 rounded-xl border text-sm font-medium ${tab === 'customers' ? 'border-secondary/40 bg-secondary-soft/60 text-secondary-strong' : 'border-line text-fg-muted hover:text-fg'}`}>
          Customers ({customerPairs.length})
        </button>
        <button onClick={() => setTab('products')} className={`flex-1 p-2.5 rounded-xl border text-sm font-medium ${tab === 'products' ? 'border-secondary/40 bg-secondary-soft/60 text-secondary-strong' : 'border-line text-fg-muted hover:text-fg'}`}>
          Products ({productPairs.length})
        </button>
      </div>

      {pairs.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={tab === 'customers' ? 'No duplicate customers' : 'No duplicate products'}
          description={tab === 'customers' ? 'Phone, email and near-identical names are clean.' : 'SKU clashes and near-identical names are clean. We never auto-merge stock.'}
        />
      ) : (
        <div className="space-y-3">
          {pairs.map((pair) => {
            const a = tab === 'customers' ? byId.get(pair.aId) : products.find((p) => p.id === pair.aId)
            const b = tab === 'customers' ? byId.get(pair.bId) : products.find((p) => p.id === pair.bId)
            return (
              <div key={`${pair.aId}-${pair.bId}-${pair.reason}`} className="card p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">{pair.detail}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <DupCard label={pair.aLabel} customer={tab === 'customers' ? a as Customer : undefined} sku={tab === 'products' ? (a as Product | undefined)?.sku : undefined} />
                  <DupCard label={pair.bLabel} customer={tab === 'customers' ? b as Customer : undefined} sku={tab === 'products' ? (b as Product | undefined)?.sku : undefined} />
                </div>
                {tab === 'customers' && can('customers:manage') && (
                  <button
                    onClick={() => startMerge(pair)}
                    disabled={busy === pair.aId || busy === pair.bId}
                    className="btn-secondary text-xs mt-3"
                  >
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                    Merge contact details
                  </button>
                )}
                {tab === 'products' && (
                  <p className="text-[11px] text-fg-subtle mt-3">Flagged only — restock through Stock so quantities stay honest.</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={`Keep “${confirm?.keeper.name}”?`}
        message={
          confirm
            ? (Number(confirm.extra.total_orders) > 0
              ? `We’ll copy missing phone/email/address onto ${confirm.keeper.name}. “${confirm.extra.name}” has ${confirm.extra.total_orders} orders so it stays — deleting it would orphan those sales.`
              : `We’ll copy missing details onto ${confirm.keeper.name} and remove the empty “${confirm.extra.name}” card.`)
            : ''
        }
        confirmLabel="Merge"
        onConfirm={applyMerge}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

function DupCard({ label, customer, sku }: { label: string; customer?: Customer; sku?: string | null }) {
  return (
    <div className="rounded-control bg-surface-2 p-3 min-w-0">
      <p className="text-sm font-semibold text-fg truncate">{label}</p>
      {customer && (
        <p className="text-[11px] text-fg-muted mt-1 tabular-nums">
          {customer.phone || 'no phone'} · {customer.total_orders || 0} orders · {formatINR(Number(customer.total_spent) || 0, 0)}
        </p>
      )}
      {sku != null && <p className="text-[11px] text-fg-muted mt-1 font-mono">{sku || 'no SKU'}</p>}
    </div>
  )
}
