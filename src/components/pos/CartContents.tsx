import { useEffect, useRef, useState } from 'react'
import {
  Banknote, CreditCard, Loader2, Pause, Smartphone, Split, UserCircle, Wallet, X,
} from 'lucide-react'
import { formatINR } from '../../lib/format'
import type { SaleTotals, TenderLine } from '../../lib/pos'
import { effectiveRate } from '../../lib/pos'
import type { CartLine } from '../../lib/pos'
import type { Customer, PaymentMethod } from '../../lib/types'
import { QueueBadge } from '../QueueBadge'
import { SplitPayment } from './SplitPayment'
import { UpiQr } from '../UpiQr'
import { FitAmount } from '../FitAmount'
import { CartLineRow } from './CartLineRow'

/** Chunky, unmissable payment buttons — icon over label. */
const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
]

export function CartContents({
  cart, sale, selectedCustomer, customerInsight, onPickCustomer, onClearCustomer,
  onChangeQty, onOpenLineOptions, onNumpad, onRemoveLine,
  onHold, onClearCart, onCheckout, processing, checkoutReady, checkoutHint,
  paymentMethod, setPaymentMethod, splitMode, setSplitMode, tenders, setTenders,
  cartDiscountMode, setCartDiscountMode, cartDiscountValue, setCartDiscountValue,
  discountReason, setDiscountReason, defaultTaxRate, setDefaultTaxRate,
  upiId, payeeName, receiptRef, hasProductGst,
}: {
  cart: CartLine[]
  sale: SaleTotals
  selectedCustomer: Customer | null
  customerInsight?: string | null
  onPickCustomer: () => void
  onClearCustomer: () => void
  onChangeQty: (key: string, delta: number) => void
  onOpenLineOptions: (key: string) => void
  onNumpad: (key: string) => void
  onRemoveLine: (key: string) => void
  onHold: () => void
  onClearCart: () => void
  onCheckout: () => void
  processing: boolean
  checkoutReady: boolean
  checkoutHint: string
  paymentMethod: PaymentMethod
  setPaymentMethod: (m: PaymentMethod) => void
  splitMode: boolean
  setSplitMode: (v: boolean) => void
  tenders: TenderLine[]
  setTenders: (t: TenderLine[]) => void
  cartDiscountMode: 'flat' | 'pct'
  setCartDiscountMode: (m: 'flat' | 'pct') => void
  cartDiscountValue: number
  setCartDiscountValue: (v: number) => void
  discountReason: string
  setDiscountReason: (v: string) => void
  defaultTaxRate: number
  setDefaultTaxRate: (v: number) => void
  upiId: string | null
  payeeName: string
  receiptRef: string
  hasProductGst: boolean
}) {
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0)
  const anyInclusive = cart.some((l) => l.price_includes_tax && effectiveRate(l, defaultTaxRate) > 0)

  // A total that just moved because of a discount flashes green once,
  // so the cashier sees the money change rather than having to re-read.
  const [flash, setFlash] = useState(false)
  const prevDiscount = useRef(sale.discountTotal)
  useEffect(() => {
    if (sale.discountTotal !== prevDiscount.current) {
      prevDiscount.current = sale.discountTotal
      if (sale.discountTotal > 0) {
        setFlash(true)
        const t = setTimeout(() => setFlash(false), 700)
        return () => clearTimeout(t)
      }
    }
  }, [sale.discountTotal])

  const preDiscount = sale.subtotal + sale.taxTotal

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header — no divider line, just spacing */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2 flex-shrink-0">
        <h2 className="text-lg font-bold text-fg">
          Current sale
          {itemCount > 0 && <span className="ml-2 text-sm font-medium text-fg-subtle tabular-nums">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>}
        </h2>
        {cart.length > 0 && (
          <div className="flex items-center gap-1">
            <button onClick={onHold} className="text-xs font-semibold text-fg-muted hover:text-fg px-2.5 py-1.5 rounded-lg hover:bg-surface-2 flex items-center gap-1" aria-label="Hold cart and start a new sale">
              <Pause className="w-3.5 h-3.5" /> Hold
            </button>
            <button onClick={onClearCart} className="text-xs font-semibold text-negative px-2.5 py-1.5 rounded-lg hover:bg-negative/10">Clear</button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scroll-area px-5 py-2 space-y-4">
        {/* Customer — borderless, soft fill */}
        <button
          onClick={onPickCustomer}
          className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-surface-2 text-left active:scale-[0.99] transition-transform"
        >
          <UserCircle className="w-5 h-5 text-fg-subtle flex-shrink-0" />
          {selectedCustomer ? (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg truncate">{selectedCustomer.name}</p>
              <p className="text-xs text-fg-subtle">{selectedCustomer.total_orders} prior orders · {formatINR(selectedCustomer.total_spent, 0)} spent</p>
              {customerInsight && <p className="text-[11px] text-accent mt-0.5 leading-snug">{customerInsight}</p>}
            </div>
          ) : (
            <span className="text-sm text-fg-subtle flex-1">Walk-in customer (optional)</span>
          )}
          {selectedCustomer && (
            <X className="w-4 h-4 text-fg-subtle hover:text-fg" onClick={(e) => { e.stopPropagation(); onClearCustomer() }} aria-label="Detach customer" />
          )}
        </button>

        {/* Line items — generous spacing, swipe left to delete */}
        {cart.length === 0 ? (
          <p className="text-sm text-fg-subtle text-center py-8">Tap products to add them to the sale</p>
        ) : (
          <div className="space-y-2">
            {cart.map((line) => (
              <CartLineRow
                key={line.key}
                line={line}
                sale={sale}
                defaultTaxRate={defaultTaxRate}
                onChangeQty={onChangeQty}
                onNumpad={onNumpad}
                onOpenLineOptions={onOpenLineOptions}
                onRemove={onRemoveLine}
              />
            ))}
            <p className="text-[11px] text-fg-subtle text-center pt-1">Swipe an item left to remove it</p>
          </div>
        )}

        {/* The math — minimal, right-aligned, no boxes */}
        {cart.length > 0 && (
          <div className="space-y-2 text-sm pt-1">
            <div className="flex justify-between text-fg-muted">
              <span>Subtotal{anyInclusive ? ' (pre-tax)' : ''}</span>
              <span className="tabular-nums">{formatINR(sale.subtotal)}</span>
            </div>

            <div className="flex justify-between items-center text-fg-muted gap-2">
              <span className="flex-shrink-0">Discount</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCartDiscountMode(cartDiscountMode === 'flat' ? 'pct' : 'flat')}
                  className="w-8 h-8 rounded-lg bg-surface-2 text-xs font-bold text-fg-muted hover:text-fg"
                  aria-label={cartDiscountMode === 'flat' ? 'Switch to percentage discount' : 'Switch to flat rupee discount'}
                  title={cartDiscountMode === 'flat' ? 'Flat ₹ — tap for %' : 'Percentage — tap for flat ₹'}
                >
                  {cartDiscountMode === 'flat' ? '₹' : '%'}
                </button>
                <input
                  type="number"
                  min={0}
                  step={cartDiscountMode === 'flat' ? '0.01' : '1'}
                  value={cartDiscountValue || ''}
                  onChange={(e) => setCartDiscountValue(Math.max(0, Number(e.target.value)))}
                  className="w-20 px-2.5 py-1.5 bg-surface-2 rounded-lg text-right text-fg text-sm tabular-nums border-0 focus:ring-2 focus:ring-accent/40 focus:outline-none"
                  placeholder="0"
                  aria-label="Cart discount"
                />
              </div>
            </div>
            {(cartDiscountValue > 0 || discountReason) && (
              <input
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className="input-field py-1.5 text-xs"
                placeholder="Discount reason (shows in Reports)"
                aria-label="Discount reason"
              />
            )}

            <div className="flex justify-between items-center text-fg-muted">
              <span>Tax %{hasProductGst && <span className="text-[10px] text-fg-subtle ml-1">(per-item GST applied)</span>}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={defaultTaxRate || ''}
                onChange={(e) => setDefaultTaxRate(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-20 px-2.5 py-1.5 bg-surface-2 rounded-lg text-right text-fg text-sm tabular-nums border-0 focus:ring-2 focus:ring-accent/40 focus:outline-none"
                placeholder="0"
                aria-label="Default tax rate percent"
              />
            </div>
            {sale.taxTotal > 0 && (
              <div className="flex justify-between text-fg-muted">
                <span>Tax (GST){anyInclusive ? ' (partly included)' : ''}</span>
                <span className="tabular-nums">{formatINR(sale.taxTotal)}</span>
              </div>
            )}

            {/* Total — 24px, bold. Struck-through original when discounted. */}
            <div className="flex justify-between items-baseline pt-2">
              <span className="text-sm font-semibold text-fg">Total</span>
              <span className="flex items-baseline gap-2">
                {sale.discountTotal > 0 && (
                  <span className="text-sm text-fg-subtle line-through tabular-nums">{formatINR(preDiscount)}</span>
                )}
                <FitAmount
                  value={formatINR(sale.total)}
                  base="text-2xl"
                  minTier="text-lg"
                  className={`font-bold text-fg leading-none ${flash ? 'pos-total-flash' : ''}`}
                />
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Pinned: payment choice + charge */}
      {cart.length > 0 && (
        <div className="px-5 pt-3 pb-4 space-y-3 flex-shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          {!splitMode && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {METHODS.map((m) => {
                  const Icon = m.icon
                  const active = paymentMethod === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      aria-pressed={active}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all active:scale-[0.97] ${
                        active ? 'bg-accent text-white shadow-sm' : 'bg-surface-2 text-fg-muted hover:text-fg'
                      }`}
                    >
                      <Icon className="w-5 h-5" strokeWidth={2} />
                      <span className="text-xs font-semibold">{m.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* UPI: show the QR immediately — no reference typing. */}
              {paymentMethod === 'upi' && (
                upiId ? (
                  <div className="flex flex-col items-center gap-2 py-3 rounded-xl bg-surface-2">
                    <p className="text-xs font-semibold text-fg-muted">Customer scans to pay {formatINR(sale.total)}</p>
                    <UpiQr upiId={upiId} payeeName={payeeName} amount={sale.total} reference={receiptRef} size={168} />
                  </div>
                ) : (
                  <p className="text-xs text-warning text-center py-2">
                    Add your UPI ID in Settings to show a scannable QR here.
                  </p>
                )
              )}
            </>
          )}

          <button
            onClick={() => setSplitMode(!splitMode)}
            className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${splitMode ? 'bg-accent-soft text-accent-strong' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}
            aria-pressed={splitMode}
          >
            <Split className="w-3.5 h-3.5" />
            {splitMode ? 'Using split payment' : 'Split payment'}
          </button>

          {splitMode && (
            <SplitPayment
              total={sale.total}
              tenders={tenders}
              onChange={setTenders}
              upiId={upiId}
              payeeName={payeeName}
              receiptRef={receiptRef}
            />
          )}

          <QueueBadge />

          {/* The climax: full-width pill, vibrant green */}
          <button
            onClick={onCheckout}
            disabled={processing || !checkoutReady}
            title={checkoutReady ? undefined : checkoutHint}
            className="w-full py-4 rounded-2xl bg-accent text-white text-base font-bold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {processing
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <>Charge <FitAmount value={formatINR(sale.total)} base="text-base" minTier="text-sm" className="font-bold" /></>}
          </button>
          {!checkoutReady && <p className="text-xs text-warning text-center">{checkoutHint}</p>}
        </div>
      )}
    </div>
  )
}
