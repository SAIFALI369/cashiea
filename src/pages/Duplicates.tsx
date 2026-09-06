import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import {
  findCustomerDuplicates, findProductDuplicates, findRepeatInvoices, findStaleProducts,
  pickKeeper, missingContactFields,
  type DuplicatePair, type StaleProduct,
} from '../lib/duplicates'
import type { Customer, Product } from '../lib/types'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Copy, Loader2, Package, Receipt, Sparkles, Users } from 'lucide-react'
import toast from 'react-hot-toast'

type Tab = 'customers' | 'products' | 'invoices' | 'stale'

export default function Duplicates() {
  const { ownerId } = useAuth()
  const { can, isOwner } = useCan()
  const [tab, setTab] = useState<Tab>('customers')
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [invoices, setInvoices] = useState<{ id: string; invoice_number: string; client_name: string | null; total: number; created_at: string; status: string | null }[]>([])
  const [sales, setSales] = useState<{ created_at: string; status?: string | null; items?: { product_id?: string | null }[] | null }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ pair: DuplicatePair; keeper: Customer; extra: Customer; patch: Record<string, string> } | null>(null)

  const load = async () => {
    if (!ownerId) return
    setLoading(true)
    const since = new Date(Date.now() - 400 * 86400000).toISOString()
    const [c, p, inv, tx] = await Promise.all([
      supabase.from('customers').select('*').eq('user_id', ownerId).limit(2000),
      supabase.from('products').select('id,name,sku,stock_quantity,active,created_at').eq('user_id', ownerId).limit(2000),
      supabase.from('invoices').select('id,invoice_number,client_name,total,created_at,status').eq('user_id', ownerId).neq('status', 'draft').limit(2000),
      supabase.from('transactions').select('created_at,status,items').eq('user_id', ownerId).gte('created_at', since).limit(2000),
    ])
    setCustomers((c.data as Customer[]) || [])
    setProducts((p.data as Product[]) || [])
    setInvoices((inv.data as typeof invoices) || [])
    setSales((tx.data as typeof sales) || [])
    setLoading(false)
  }

  useEffect(() => { if (ownerId) void load() }, [ownerId])

  const customerPairs = useMemo(() => findCustomerDuplicates(customers), [customers])
  const productPairs = useMemo(() => findProductDuplicates(products), [products])
  const invoicePairs = useMemo(() => findRepeatInvoices(invoices), [invoices])
  const stale = useMemo(() => findStaleProducts(products, sales), [products, sales])

  const byId = useMemo(() => {
    const m = new Map<string, Customer>()
    customers.forEach((c) => m.set(c.id, c))
    return m
  }, [customers])

  const invById = useMemo(() => {
    const m = new Map<string, (typeof invoices)[number]>()
    invoices.forEach((i) => m.set(i.id, i))
    return m
  }, [invoices])

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

  const pairs = tab === 'customers' ? customerPairs : tab === 'products' ? productPairs : tab === 'invoices' ? invoicePairs : []

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Data hygiene"
        subtitle="Same phone, same SKU, a near-identical name, or the same customer billed twice in a day. Products and bills are flagged only."
        icon={<Copy className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={[
        { label: 'Customer pairs', value: String(customerPairs.length), icon: Users, tone: customerPairs.length ? 'warning' : 'positive' },
        { label: 'Product pairs', value: String(productPairs.length), icon: Package, tone: productPairs.length ? 'warning' : 'positive' },
        { label: 'Repeat bills', value: String(invoicePairs.length), icon: Receipt, tone: invoicePairs.length ? 'warning' : 'positive' },
        { label: 'Stale stock', value: String(stale.length), icon: Package, tone: stale.length ? 'warning' : 'secondary' },
      ]} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {([
          ['customers', `Customers (${customerPairs.length})`],
          ['products', `Products (${productPairs.length})`],
          ['invoices', `Bills (${invoicePairs.length})`],
          ['stale', `Stale (${stale.length})`],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`p-2.5 rounded-xl border text-sm font-medium ${tab === k ? 'border-secondary/40 bg-secondary-soft/60 text-secondary-strong' : 'border-line text-fg-muted hover:text-fg'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'stale' ? (
        <StaleList rows={stale} />
      ) : pairs.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={tab === 'customers' ? 'No duplicate customers' : tab === 'products' ? 'No duplicate products' : 'No repeat bills'}
          description={
            tab === 'customers'
              ? 'Phone, email and near-identical names are clean.'
              : tab === 'products'
                ? 'SKU clashes and near-identical names are clean. We never auto-merge stock.'
                : 'No two live invoices share the same customer, amount and day.'
          }
        />
      ) : (
        <div className="space-y-3">
          {pairs.map((pair) => {
            const aCust = tab === 'customers' ? byId.get(pair.aId) : undefined
            const bCust = tab === 'customers' ? byId.get(pair.bId) : undefined
            const aProd = tab === 'products' ? products.find((p) => p.id === pair.aId) : undefined
            const bProd = tab === 'products' ? products.find((p) => p.id === pair.bId) : undefined
            const aInv = tab === 'invoices' ? invById.get(pair.aId) : undefined
            const bInv = tab === 'invoices' ? invById.get(pair.bId) : undefined
            return (
              <div key={`${pair.aId}-${pair.bId}-${pair.reason}`} className="card p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">{pair.detail}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <DupCard
                    label={pair.aLabel}
                    customer={aCust}
                    sku={aProd?.sku}
                    invoice={aInv}
                  />
                  <DupCard
                    label={pair.bLabel}
                    customer={bCust}
                    sku={bProd?.sku}
                    invoice={bInv}
                  />
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
                {tab === 'invoices' && (
                  <p className="text-[11px] text-fg-subtle mt-3">Flagged only — we never void a bill from here.</p>
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

function DupCard({
  label, customer, sku, invoice,
}: {
  label: string
  customer?: Customer
  sku?: string | null
  invoice?: { client_name: string | null; total: number; created_at: string }
}) {
  return (
    <div className="rounded-control bg-surface-2 p-3 min-w-0">
      <p className="text-sm font-semibold text-fg truncate">{label}</p>
      {customer && (
        <p className="text-[11px] text-fg-muted mt-1 tabular-nums">
          {customer.phone || 'no phone'} · {customer.total_orders || 0} orders · {formatINR(Number(customer.total_spent) || 0, 0)}
        </p>
      )}
      {sku != null && <p className="text-[11px] text-fg-muted mt-1 font-mono">{sku || 'no SKU'}</p>}
      {invoice && (
        <p className="text-[11px] text-fg-muted mt-1 tabular-nums">
          {invoice.client_name || 'no name'} · {formatINR(Number(invoice.total) || 0, 0)} · {new Date(invoice.created_at).toLocaleDateString('en-IN')}
        </p>
      )}
    </div>
  )
}

function StaleList({ rows }: { rows: StaleProduct[] }) {
  if (rows.length === 0) {
    return <EmptyState icon={Sparkles} title="No stale stock" description="Every item on the shelf has a completed sale in the last 90 days — or it is too new to judge." />
  }
  return (
    <div className="space-y-2">
      {rows.map((p) => (
        <div key={p.id} className="card p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-fg truncate">{p.name}</p>
            <p className="text-[11px] text-fg-muted mt-0.5">
              {p.sku || 'no SKU'} · {p.daysSinceSale == null ? 'no completed sale on record' : `last sold ${p.daysSinceSale} days ago`}
            </p>
          </div>
          <p className="text-sm font-bold tabular-nums text-fg flex-shrink-0">{p.stock}</p>
        </div>
      ))}
      <p className="text-[11px] text-fg-subtle">Flagged only — a markdown lives under Price suggestions, and we never auto-write stock.</p>
    </div>
  )
}
