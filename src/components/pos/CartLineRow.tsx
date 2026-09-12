import { useRef } from 'react'
import { Minus, MoreVertical, Plus, Trash2 } from 'lucide-react'
import { formatINR } from '../../lib/format'
import { useHoldRepeat } from '../../lib/useHoldRepeat'
import { useSwipeAction } from '../../lib/useSwipeAction'
import { effectiveRate, type CartLine, type SaleTotals } from '../../lib/pos'
import { FitAmount } from '../FitAmount'

/** Stepper with press-and-hold acceleration. */
function StepperBtn({ onStep, label, children }: { onStep: (step: number) => void; label: string; children: React.ReactNode }) {
  const repeated = useRef(false)
  const hold = useHoldRepeat((step) => { repeated.current = true; onStep(step) })
  return (
    <button
      {...hold}
      onClick={() => { if (repeated.current) { repeated.current = false } else onStep(1) }}
      className="w-9 h-9 rounded-full bg-surface-2 text-fg-muted hover:text-fg flex items-center justify-center active:scale-95 transition-transform select-none flex-shrink-0"
      aria-label={label}
    >
      {children}
    </button>
  )
}

/** The quantity value — tap (or hold) to open the numpad. */
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
      className="min-w-7 px-0.5 h-9 text-center text-sm font-bold text-fg select-none tabular-nums"
      aria-label={`Quantity ${value} — tap to enter a quantity`}
    >
      {value}
    </button>
  )
}

/**
 * CartLineRow — one item in the tray.
 *
 * Quantity controls sit directly on the row (no menu to open), and the
 * row can be swiped left to delete, revealing a red trash panel that
 * arms once the swipe passes the commit distance. No divider lines —
 * generous vertical spacing separates the items instead.
 */
export function CartLineRow({
  line, sale, defaultTaxRate, onChangeQty, onNumpad, onOpenLineOptions, onRemove,
}: {
  line: CartLine
  sale: SaleTotals
  defaultTaxRate: number
  onChangeQty: (key: string, delta: number) => void
  onNumpad: (key: string) => void
  onOpenLineOptions: (key: string) => void
  onRemove: (key: string) => void
}) {
  const result = sale.lines.find((r) => r.key === line.key)
  const rate = effectiveRate(line, defaultTaxRate)
  const swipe = useSwipeAction(() => onRemove(line.key))

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete panel revealed under the row */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-end pr-5 transition-colors ${swipe.armed ? 'bg-negative' : 'bg-negative/60'}`}
        style={{ width: Math.max(0, -swipe.dx) }}
        aria-hidden="true"
      >
        <Trash2 className={`w-5 h-5 text-white transition-transform ${swipe.armed ? 'scale-110' : 'scale-90'}`} />
      </div>

      <div
        {...swipe.handlers}
        className="relative flex items-center gap-2 bg-surface py-2"
        style={{
          transform: `translateX(${swipe.dx}px)`,
          transition: swipe.dragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          touchAction: 'pan-y',
        }}
      >
        {/* Quantity first — it is what changes most often */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <StepperBtn onStep={(s) => onChangeQty(line.key, -s)} label={`Decrease ${line.name} quantity`}>
            <Minus className="w-4 h-4" />
          </StepperBtn>
          <QtyValue value={line.quantity} onNumpad={() => onNumpad(line.key)} />
          <StepperBtn onStep={(s) => onChangeQty(line.key, s)} label={`Increase ${line.name} quantity`}>
            <Plus className="w-4 h-4" />
          </StepperBtn>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-fg truncate">
            {line.name}
            {line.unit ? <span className="text-fg-subtle font-normal"> ({line.unit})</span> : null}
          </p>
          <p className="text-xs text-fg-subtle truncate">
            {formatINR(line.unit_price)} ea
            {rate > 0 && <> · GST {rate}%{line.price_includes_tax ? ' incl.' : ''}</>}
            {!!line.line_discount && <> · −{formatINR(line.line_discount)}</>}
          </p>
        </div>

        <span className="text-right min-w-16 max-w-24">
          <FitAmount
            value={formatINR(result ? result.total : line.quantity * line.unit_price)}
            base="text-sm"
            minTier="text-xs"
            className="font-bold text-fg"
          />
        </span>

        <button
          onClick={() => onOpenLineOptions(line.key)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2 flex-shrink-0"
          aria-label={`Options for ${line.name}`}
          title="GST, discounts, quantity"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
