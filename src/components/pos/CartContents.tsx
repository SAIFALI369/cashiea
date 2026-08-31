import { useRef } from 'react'
import {
  Loader2, Minus, MoreVertical, Pause, Plus, Receipt, ShoppingCart, UserCircle, X,
} from 'lucide-react'
import { formatINR } from '../../lib/format'
import { useHoldRepeat } from '../../lib/useHoldRepeat'
import type { SaleTotals, TenderLine } from '../../lib/pos'
import { effectiveRate, tenderStatus } from '../../lib/pos'
import type { CartLine } from '../../lib/pos'
import type { Customer, PaymentMethod } from '../../lib/types'
import { QueueBadge } from '../QueueBadge'
import { SplitPayment } from './SplitPayment'
import { FitAmount } from '../FitAmount'

// ─── Stepper with press-and-hold acceleration ────────────────────

function StepperBtn({ onStep, label, children }: { onStep: (step: number) => void; label: string; children: React.ReactNode }) {
  const repeated = useRef(false)
  const hold = useHoldRepeat((step) => { repeated.current = true; onStep(step) })
  return (
    <button
      {...hold}
      onClick={() => { if (repeated.current) { repeated.current = false } else onStep(1) }}
      className="w-11 h-11 rounded-lg bg-surface-2 hover:bg-surface-3 flex items-center justify-center active:scale-95 transition-transform select-none"
      aria-label={label}
    >
      {children}
    </button>
  )
}

/** The quantity value — hold it (or click it) to open the numpad. */
function QtyValue({ value, onNumpad }: { value: number; onNumpad: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  return (
    <button
      onPointerDown={() => { timer.current = setTimeout(onNumpad, 480) }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { clear(); onNumpad() }}
      className="min-w-8 px-1 h-11 text-center text-sm font-bold text-fg rounded-lg hover:bg-surface-2 select-none tabular-nums"
      title="Tap to enter quantity"
      aria-label={`Quantity ${value} — tap to enter a quantity`}
    >
      {value}
    </button>
  )
}

// ─── Cart contents (shared by desktop card and mobile sheet) ─────

export function CartContents({
  variant, cart, sale, selectedCustomer, onPickCustomer, onClearCustomer,
  onChangeQty, onOpenLineOptions, onNumpad,
  onHold, onClearCart, onCheckout, processing, checkoutReady, checkoutHint,
  paymentMethod, setPaymentMethod, splitMode, setSplitMode, tenders, setTenders,
  cartDiscountMode, setCartDiscountMode, cartDiscountValue, setCartDiscountValue,
  discountReason, setDiscountReason, defaultTaxRate, setDefaultTaxRate,
  upiId, payeeName, receiptRef, hasProductGst,
}: {
  variant: 'desktop' | 'sheet'
  cart: CartLine[]
  sale: SaleTotals
  selectedCustomer: Customer | null
  onPickCustomer: () => void
  onClearCustomer: () => void
  onChangeQty: (key: string, delta: number) => void
  onOpenLineOptions: (key: string) => void
  onNumpad: (key: string) => void
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
  const tender = tenderStatus(sale.total, tenders)
  const anyInclusive = cart.some((l) => l.price_includes_tax && effectiveRate(l, defaultTaxRate) > 0)
  const sheet = variant === 'sheet'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-line">
        <h2 className="font-bold text-fg flex items-center gap-2">
          <Receipt className="w-5 h-5 text-accent" /> Current Sale
          {itemCount > 0 && <span className="text-xs font-semibold text-fg-subtle tabular-nums">{itemCount} items</span>}
        </h2>
        <div className="flex items-center gap-1.5">
          {cart.length > 0 && (
            <>
              <button onClick={onHold} className="text-xs font-semibold text-fg-muted hover:text-fg px-2.5 py-1.5 rounded-lg hover:bg-surface-2 flex items-center gap-1" aria-label="Hold cart and start a new sale">
                <Pause className="w-3.5 h-3.5" /> Hold
              </button>
              <button onClick={onClearCart} className="text-xs font-semibold text-negative hover:text-negative px-2.5 py-1.5 rounded-lg hover:bg-negative/10">Clear</button>
            </>
          )}
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto scroll-area px-4 py-3 space-y-3 ${sheet ? '' : 'max-h-[70vh]'}`}>
        {/* Customer */}
        <button
          onClick={onPickCustomer}
          className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-surface/60 border border-line hover:border-line-2 transition-colors text-left"
        >
          <UserCircle className="w-5 h-5 text-accent flex-shrink-0" />
          {selectedCustomer ? (
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg truncate">{selectedCustomer.name}</p>
              <p className="text-xs text-fg-subtle">{selectedCustomer.total_orders} prior orders · {formatINR(selectedCustomer.total_spent, 0)} spent</p>
            </div>
          ) : (
            <span className="text-sm text-fg-subtle flex-1">Walk-in customer (optional)</span>
          )}
          {selectedCustomer && (
            <X className="w-4 h-4 text-fg-subtle hover:text-fg" onClick={(e) => { e.stopPropagation(); onClearCustomer() }} aria-label="Detach customer" />
          )}
        </button>

        {/* Lines */}
        {cart.length === 0 ? (
          <p className="text-sm text-fg-subtle text-center py-8">Tap products to add them to the sale</p>
        ) : (
          <div className="space-y-2">
            {cart.map((line) => {
              const result = sale.lines.find((r) => r.key === line.key)
              const rate = effectiveRate(line, defaultTaxRate)
              return (
                <div key={line.key} className="flex items-center gap-1.5 bg-surface/60 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">
                      {line.name}
                      {line.unit ? <span className="text-fg-subtle font-normal"> ({line.unit})</span> : null}
                    </p>
                    <p className="text-xs text-fg-subtle truncate">
                      {formatINR(line.unit_price)} ea
                      {rate > 0 && <> · GST {rate}%{line.price_includes_tax ? ' incl.' : ''}</>}
                      {!!line.line_discount && <> · −{formatINR(line.line_discount)}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <StepperBtn onStep={(s) => onChangeQty(line.key, -s)} label={`Decrease ${line.name} quantity`}><Minus className="w-4 h-4" /></StepperBtn>
                    <QtyValue value={line.quantity} onNumpad={() => onNumpad(line.key)} />
                    <StepperBtn onStep={(s) => onChangeQty(line.key, s)} label={`Increase ${line.name} quantity`}><Plus className="w-4 h-4" /></StepperBtn>
                  </div>
                  <span className="text-sm font-semibold text-fg text-right min-w-16 max-w-24">
                    <FitAmount value={formatINR(result ? result.total : line.quantity * line.unit_price)} base="text-sm" minTier="text-xs" className="font-semibold text-fg" />
                  </span>
                  <button onClick={() => onOpenLineOptions(line.key)} className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2" aria-label={`Options for ${line.name}`} title="GST, discounts, quantity">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Totals + discounts */}
        {cart.length > 0 && (
          <div className="space-y-1.5 text-sm border-t border-line pt-3">
            <div className="flex justify-between text-fg-muted">
              <span>Subtotal{anyInclusive ? ' (pre-tax)' : ''}</span>
              <span className="tabular-nums">{formatINR(sale.subtotal)}</span>
            </div>

            {/* Cart discount — flat or percent, with optional reason */}
            <div className="flex justify-between items-center text-fg-muted gap-2">
              <span className="flex-shrink-0">Discount</span>
              <div className="flex items-center gap-1">
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
                  className="w-20 px-2 py-1 bg-surface border border-line rounded-lg text-right text-fg text-sm tabular-nums"
                  placeholder="0"
                  aria-label="Cart discount"
                />
                {sale.discountTotal > 0 && <span className="text-xs text-fg-subtle tabular-nums">−{formatINR(sale.discountTotal)}</span>}
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

            {/* Sale-level tax — default rate for lines without a product GST rate */}
            <div className="flex justify-between items-center text-fg-muted">
              <span>Tax %{hasProductGst && <span className="text-[10px] text-fg-subtle">(per-item GST applied)</span>}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={defaultTaxRate || ''}
                onChange={(e) => setDefaultTaxRate(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-20 px-2 py-1 bg-surface border border-line rounded-lg text-right text-fg text-sm tabular-nums"
                placeholder="0"
                aria-label="Default tax rate percent"
              />
            </div>
            {sale.taxTotal > 0 && (
              <div className="flex justify-between text-fg-muted">
                <span>GST amount{anyInclusive ? ' (partly included)' : ''}</span>
                <span className="tabular-nums">{formatINR(sale.taxTotal)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pinned block: payment + big total + CTA */}
      {cart.length > 0 && (
        <div className="border-t border-line px-4 pt-3 pb-4 space-y-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          {/* Payment method */}
          {!splitMode ? (
            <div className="grid grid-cols-5 gap-1.5">
              {(['cash', 'card', 'upi', 'wallet', 'other'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${paymentMethod === m ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : null}

          <button
            onClick={() => setSplitMode(!splitMode)}
            className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${splitMode ? 'bg-accent-soft text-accent-strong border border-accent' : 'text-fg-muted hover:text-fg border border-line'}`}
            aria-pressed={splitMode}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
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

          {/* Large total — always visible above the CTA */}
          <div className="flex items-end justify-between pt-1">
            <div className="text-xs text-fg-muted flex flex-col gap-0.5">
              <span>Total</span>
              <QueueBadge />
            </div>
            <FitAmount value={formatINR(sale.total)} base="text-2xl" className="font-extrabold text-fg leading-none" />
          </div>

          <button
            onClick={onCheckout}
            disabled={processing || !checkoutReady}
            title={checkoutReady ? undefined : checkoutHint}
            className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Charge <FitAmount value={formatINR(sale.total)} base="text-base" minTier="text-xs" className="font-semibold" /></>}
          </button>
          {!checkoutReady && <p className="text-xs text-warning text-center">{checkoutHint}</p>}
        </div>
      )}
    </div>
  )
}
