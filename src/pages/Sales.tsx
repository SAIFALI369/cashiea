import { useEffect, useMemo, useState } from 'react'
import {
  Download, Loader2, MessageCircle, Receipt, RotateCcw, Search, Share2, X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import type { Transaction } from '../lib/types'
import {
  filterLedger, groupByDay, methodColor, rowTime, type LedgerFilter,
} from '../lib/salesLedger'
import { useSwipeAction } from '../lib/useSwipeAction'
import { downloadDigitalReceiptPdf } from '../lib/digital-receipt-pdf'
import { buildReceiptText, type ReceiptModel } from '../lib/pos'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import HeaderAction from '../components/ui/HeaderAction'
import { FitAmount } from '../components/FitAmount'
import toast from 'react-hot-toast'

const TABS: { id: LedgerFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'pending', label: 'Pending' },
]

/** Rebuild a printable receipt from a stored transaction. */
function toReceipt(t: Transaction, shopName: string, profileBits: Partial<ReceiptModel>): ReceiptModel {
  return {
    shopName,
    ...profileBits,
    receiptNumber: t.receipt_number,
    date: t.created_at,
    customerName: null,
    lines: (t.items || []).map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      unit: i.unit ?? null,
      amount: i.quantity * i.unit_price - (i.line_discount || 0),
    })),
    subtotal: t.subtotal,
    discountTotal: t.discount || 0,
    taxTotal: t.tax_amount || 0,
    total: t.total,
    tenders: [{ method: t.payment_method, amount: t.total }],
    change: 0,
    servedBy: t.served_by,
  }
}

export default function Sales() {
  const { profile, ownerId } = useAuth()
  const [sales, setSales] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [detail, setDetail] = useState<Transaction | null>(null)

  useEffect(() => {
    if (!ownerId) return
    let alive = true
    setLoading(true)
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) toast.error('Could not load sales')
        setSales((data as Transaction[]) || [])
        setLoading(false)
      })
    return () => { alive = false }
  }, [ownerId])

  const visible = useMemo(() => {
    const byTab = filterLedger(sales, filter)
    const q = query.trim().toLowerCase()
    if (!q) return byTab
    return byTab.filter((t) =>
      t.receipt_number?.toLowerCase().includes(q)
      || (t.items || []).some((i) => i.name?.toLowerCase().includes(q))
      || String(t.total).includes(q))
  }, [sales, filter, query])

  const groups = useMemo(() => groupByDay(visible), [visible])

  const shopName = profile?.company_name || profile?.full_name || 'My Business'
  const profileBits: Partial<ReceiptModel> = {
    address: profile?.business_address,
    phone: profile?.phone || profile?.whatsapp_number,
    gstin: profile?.gstin,
    upiId: profile?.upi_id,
  }

  const shareReceipt = async (t: Transaction) => {
    const text = buildReceiptText(toReceipt(t, shopName, profileBits))
    if (navigator.share) {
      try { await navigator.share({ title: `Receipt ${t.receipt_number}`, text }); return } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Receipt copied')
    } catch {
      toast.error('Could not share the receipt')
    }
  }

  return (
    <div className="animate-fade-in pb-24 lg:pb-0">
      <PageHeader title="Transactions" subtitle="Every sale rung up at the counter" />

      <HeaderAction>
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="icon-btn text-fg-muted hover:text-fg"
          aria-label="Search transactions"
        >
          <Search className="w-5 h-5" />
        </button>
      </HeaderAction>

      <header className="hidden lg:flex items-center justify-between gap-3 mb-6">
        <h2 className="text-[28px] leading-none font-bold tracking-tight text-fg">Transactions</h2>
        <button
          onClick={() => setSearchOpen((v) => !v)}
          className="icon-btn text-fg-muted hover:text-fg"
          aria-label="Search transactions"
        >
          <Search className="w-5 h-5" />
        </button>
      </header>

      {searchOpen && (
        <div className="mb-4 animate-fade-in">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by receipt number, item or amount..."
            className="w-full h-12 px-4 rounded-full bg-surface-2 text-sm text-fg placeholder:text-fg-subtle border-0 focus:ring-2 focus:ring-accent/40 focus:outline-none"
            aria-label="Search transactions"
          />
        </div>
      )}

      {/* Text tabs with an underline on the active one */}
      <div className="flex gap-6 mb-6 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            aria-pressed={filter === t.id}
            className={`relative pb-2 text-sm whitespace-nowrap transition-colors ${
              filter === t.id ? 'font-bold text-fg' : 'font-normal text-fg-subtle hover:text-fg-muted'
            }`}
          >
            {t.label}
            {filter === t.id && <span className="absolute bottom-0 inset-x-0 h-0.5 rounded-full bg-fg" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-fg-subtle" /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={query || filter !== 'all' ? 'Nothing matches' : 'No sales yet'}
          description={
            query || filter !== 'all'
              ? 'Try another search, or switch back to All.'
              : 'Sales you ring up at the counter will appear here as a running journal.'
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key}>
              {/* Sticky day header */}
              <h3 className="sticky top-0 z-10 py-2 bg-paper/90 backdrop-blur text-xs font-bold uppercase tracking-wide text-fg-subtle">
                {g.label}
              </h3>
              <div className="space-y-3 mt-1">
                {g.items.map((t) => (
                  <SaleRow
                    key={t.id}
                    txn={t}
                    onOpen={() => setDetail(t)}
                    onShare={() => shareReceipt(t)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {detail && (
        <ReceiptDetail
          txn={detail}
          shopName={shopName}
          profileBits={profileBits}
          onClose={() => setDetail(null)}
          onShare={() => shareReceipt(detail)}
        />
      )}
    </div>
  )
}

/** One transaction card — swipe left for quick actions. */
function SaleRow({ txn, onOpen, onShare }: { txn: Transaction; onOpen: () => void; onShare: () => void }) {
  const voided = txn.status === 'void' || txn.status === 'refunded'
  const swipe = useSwipeAction(onShare)
  const itemSummary = (txn.items || []).map((i) => i.name).filter(Boolean).slice(0, 2).join(', ')

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Revealed action */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-end pr-5 transition-colors ${swipe.armed ? 'bg-accent' : 'bg-accent/60'}`}
        style={{ width: Math.max(0, -swipe.dx) }}
        aria-hidden="true"
      >
        <Share2 className={`w-5 h-5 text-white transition-transform ${swipe.armed ? 'scale-110' : 'scale-90'}`} />
      </div>

      <button
        {...swipe.handlers}
        onClick={onOpen}
        className="relative w-full bg-surface rounded-2xl p-4 flex items-center gap-3 text-left shadow-card active:scale-[0.99]"
        style={{
          transform: `translateX(${swipe.dx}px)`,
          transition: swipe.dragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
        }}
        aria-label={`Receipt ${txn.receipt_number}, ${formatINR(txn.total)}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${methodColor(txn.payment_method)}`} aria-hidden="true" />

        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-fg truncate">
            {itemSummary || 'Walk-in customer'}
          </span>
          <span className="block text-xs text-fg-subtle truncate mt-0.5">
            {rowTime(txn.created_at)} · {txn.receipt_number}
            {voided && <span className="text-negative font-semibold"> · {txn.status}</span>}
          </span>
        </span>

        <span className="text-right flex-shrink-0">
          <FitAmount
            value={`${voided ? '−' : ''}${formatINR(txn.total)}`}
            base="text-base"
            minTier="text-sm"
            className={`font-bold ${voided ? 'text-negative' : 'text-accent'}`}
          />
          <span className="block text-[10px] uppercase tracking-wide text-fg-subtle mt-0.5">{txn.payment_method}</span>
        </span>
      </button>
    </div>
  )
}

/** In-app receipt view — the PDF's layout, live. */
function ReceiptDetail({
  txn, shopName, profileBits, onClose, onShare,
}: {
  txn: Transaction
  shopName: string
  profileBits: Partial<ReceiptModel>
  onClose: () => void
  onShare: () => void
}) {
  const receipt = toReceipt(txn, shopName, profileBits)
  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label={`Receipt ${txn.receipt_number}`}>
      <div
        className="pos-sheet bg-surface w-full sm:max-w-md rounded-t-[24px] sm:rounded-[24px] max-h-[92vh] overflow-y-auto scroll-area"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="pt-2.5 pb-1 flex justify-center"><span className="w-10 h-1 rounded-full bg-line-2" aria-hidden="true" /></div>

        <div className="flex items-start justify-between px-6 pt-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-fg truncate">{shopName}</h3>
            <p className="text-xs text-fg-subtle mt-0.5">{txn.receipt_number}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="px-6 text-xs text-fg-subtle mt-1">
          {new Date(txn.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
        </p>

        <div className="px-6 mt-5 space-y-3">
          {(txn.items || []).map((i, idx) => (
            <div key={`${i.product_id}-${idx}`} className="flex items-baseline gap-3">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-fg truncate">{i.name}</span>
                <span className="block text-xs text-fg-subtle">{i.quantity} × {formatINR(i.unit_price)}{i.unit ? ` / ${i.unit}` : ''}</span>
              </span>
              <span className="text-sm font-semibold text-fg tabular-nums">{formatINR(i.quantity * i.unit_price - (i.line_discount || 0))}</span>
            </div>
          ))}
        </div>

        <div className="px-6 mt-6 space-y-1.5 text-sm">
          <Row label="Subtotal" value={formatINR(txn.subtotal)} />
          {txn.discount > 0 && <Row label="Discount" value={`−${formatINR(txn.discount)}`} />}
          {txn.tax_amount > 0 && <Row label="Tax (GST)" value={formatINR(txn.tax_amount)} />}
          <div className="flex justify-between items-baseline pt-2">
            <span className="text-sm font-bold text-fg">Total</span>
            <span className="text-2xl font-bold text-fg tabular-nums">{formatINR(txn.total)}</span>
          </div>
          <p className="text-xs text-fg-subtle pt-1">Paid by {txn.payment_method}{txn.served_by ? ` · served by ${txn.served_by}` : ''}</p>
        </div>

        <div className="px-5 mt-6 grid grid-cols-2 gap-2.5">
          <button onClick={onShare} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-surface-2 text-sm font-semibold text-fg active:scale-[0.97] transition-transform">
            <MessageCircle className="w-4 h-4" /> Share
          </button>
          <button onClick={() => { void downloadDigitalReceiptPdf(receipt, null) }} className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-surface-2 text-sm font-semibold text-fg active:scale-[0.97] transition-transform">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>

        {(txn.status === 'void' || txn.status === 'refunded') && (
          <p className="mx-6 mt-4 flex items-center gap-2 text-xs text-negative">
            <RotateCcw className="w-3.5 h-3.5" />
            This sale was {txn.status}{txn.void_reason ? ` — ${txn.void_reason}` : ''}
          </p>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-fg-muted">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}
