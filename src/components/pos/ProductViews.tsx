import { useCallback, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import type { Product } from '../../lib/types'
import { formatINR } from '../../lib/format'
import { productVisual, productImageUrl } from '../../lib/productVisuals'

/**
 * ProductViews — the browsing surfaces for the New Sale grid.
 *
 * "Ghost cards": no borders and no fill. A product floats on the page
 * with only a soft shadow to lift it, so the eye lands on the product
 * name and the green price rather than on a wall of boxes.
 *
 * Adding is a single tap anywhere on the card. There is no detail page
 * in the way, and the card confirms the add itself — it pops to 1.05
 * and flashes green for a moment — so the cashier gets feedback at the
 * point of contact instead of hunting for a toast.
 */

export { productVisual }

/** Stock condition of a product — drives the dot / badge colour token. */
export function stockState(p: Pick<Product, 'stock_quantity' | 'low_stock_threshold'>): 'out' | 'low' | 'ok' {
  if ((p.stock_quantity ?? 0) <= 0) return 'out'
  if (p.stock_quantity <= p.low_stock_threshold) return 'low'
  return 'ok'
}

const DOT: Record<string, string> = { ok: 'bg-positive', low: 'bg-warning', out: 'bg-negative' }
const DOT_LABEL: Record<string, string> = { ok: 'In stock', low: 'Low stock', out: 'Out of stock' }

/**
 * The confirm-on-tap behaviour, shared by every add surface.
 * Returns a flag the card uses to paint itself mid-pop.
 */
function useAddPop(onAdd: () => void) {
  const [popped, setPopped] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fire = useCallback(() => {
    onAdd()
    setPopped(true)
    if (timer.current) clearTimeout(timer.current)
    // 320ms: long enough to register as confirmation, short enough that
    // a fast cashier tapping four items still sees each one land.
    timer.current = setTimeout(() => setPopped(false), 320)
  }, [onAdd])
  return { popped, fire }
}

/** Product glyph — colour-coded plate, or the photo if one ever exists. */
export function ProductGlyph({
  product, size = 'md',
}: {
  product: Pick<Product, 'name' | 'category'>
  size?: 'lg' | 'md' | 'sm'
}) {
  const { icon: Icon, tile, fg } = productVisual(product)
  const img = productImageUrl(product)
  const box = size === 'lg' ? 'w-14 h-14' : size === 'md' ? 'w-11 h-11' : 'w-9 h-9'
  const glyph = size === 'lg' ? 'w-7 h-7' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4'

  if (img) {
    return (
      <div className={`${box} rounded-xl overflow-hidden flex-shrink-0 bg-surface-2`}>
        <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
    )
  }
  return (
    <div className={`${box} rounded-xl ${tile} ${fg} flex items-center justify-center flex-shrink-0`} aria-hidden="true">
      <Icon className={glyph} strokeWidth={1.9} />
    </div>
  )
}

/**
 * Ghost card — borderless, shadow-lifted, one tap to add.
 * The floating + is a visual affordance; the whole card is the button,
 * so it is marked aria-hidden rather than nested as a second control.
 */
export function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const st = stockState(product)
  const { popped, fire } = useAddPop(() => onAdd(product))

  return (
    <button
      onClick={fire}
      disabled={st === 'out'}
      className={`pos-ghost-card group relative w-full p-3 rounded-xl text-left flex flex-col gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed ${popped ? 'pos-pop' : ''}`}
      aria-label={`Add ${product.name}, ${formatINR(product.price)}${st !== 'ok' ? `, ${DOT_LABEL[st]}` : ''}`}
    >
      <div className="flex items-start justify-between">
        <ProductGlyph product={product} size="md" />
        {st !== 'ok' && (
          <span className={`w-2 h-2 rounded-full mt-1.5 ${DOT[st]}`} title={DOT_LABEL[st]} aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg-muted leading-snug line-clamp-2 min-h-[2.5rem]">{product.name}</p>
        <p className="text-base font-bold text-accent leading-none mt-1">
          {formatINR(product.price)}
          {product.units && product.units.length > 1 && (
            <span className="text-[10px] font-medium text-fg-subtle ml-1">/{product.units[0].unit}</span>
          )}
        </p>
      </div>

      {/* Floating add affordance */}
      <span
        aria-hidden="true"
        className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center shadow-sm opacity-90 group-hover:opacity-100 transition-opacity"
      >
        <Plus className="w-4 h-4" strokeWidth={3} />
      </span>

      {/* Confirmation wash — purely decorative, never blocks the tap */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-xl bg-accent/10 transition-opacity duration-200 ${popped ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  )
}

/** List row — SKU, live stock and a direct add control. */
export function ProductRow({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const st = stockState(product)
  const { popped, fire } = useAddPop(() => onAdd(product))
  return (
    <div className={`pos-ghost-card relative flex items-center gap-3 p-3 rounded-xl ${popped ? 'pos-pop' : ''}`}>
      <ProductGlyph product={product} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-fg-muted truncate">{product.name}</p>
        <p className="text-xs text-fg-subtle truncate">
          {product.sku ? `SKU ${product.sku} · ` : ''}
          <span className={st === 'out' ? 'text-negative' : st === 'low' ? 'text-warning' : 'text-fg-subtle'}>
            {st === 'out' ? 'Out of stock' : st === 'low' ? `${product.stock_quantity} left` : `${product.stock_quantity} in stock`}
          </span>
        </p>
      </div>
      <p className="text-base font-bold text-accent whitespace-nowrap">{formatINR(product.price)}</p>
      <button
        onClick={fire}
        disabled={st === 'out'}
        className="w-11 h-11 rounded-xl bg-accent text-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
        aria-label={`Add ${product.name} to sale`}
      >
        <Plus className="w-5 h-5" strokeWidth={2.75} />
      </button>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-xl bg-accent/10 transition-opacity duration-200 ${popped ? 'opacity-100' : 'opacity-0'}`}
      />
    </div>
  )
}

/** Mini tile for the frequent-items row above the grid. */
export function FrequentTile({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const st = stockState(product)
  const { popped, fire } = useAddPop(() => onAdd(product))
  return (
    <button
      onClick={fire}
      disabled={st === 'out'}
      className={`pos-ghost-card relative w-28 flex-shrink-0 flex flex-col items-start gap-1.5 p-2.5 rounded-xl text-left disabled:opacity-40 disabled:cursor-not-allowed ${popped ? 'pos-pop' : ''}`}
      aria-label={`Add ${product.name}`}
    >
      <ProductGlyph product={product} size="sm" />
      <p className="text-xs font-semibold text-fg-muted leading-tight line-clamp-2 min-h-[2rem]">{product.name}</p>
      <p className="text-sm font-bold text-accent">{formatINR(product.price)}</p>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-xl bg-accent/10 transition-opacity duration-200 ${popped ? 'opacity-100' : 'opacity-0'}`}
      />
    </button>
  )
}

export { Package } from 'lucide-react'
