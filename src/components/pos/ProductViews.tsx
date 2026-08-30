import { Apple, Beef, Book, Coffee, Droplets, Footprints, Laptop, Package, PaintRoller, Pill, Shirt, Smartphone, SprayCan, Utensils, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Product } from '../../lib/types'
import { formatINR } from '../../lib/format'

/**
 * ProductViews — the two browsing modes for the New Sale grid.
 *
 * • Compact card: glyph, name (one line), prominent price, stock shown
 *   as a small dot — nothing else, so the grid stays dense.
 * • List row: full SKU, stock badge and a direct add stepper.
 *
 * Category glyphs map common kirana categories onto existing icons;
 * anything unknown falls back to the product's initial.
 */

const CATEGORY_ICONS: [RegExp, LucideIcon][] = [
  [/fruit|veg|grocer|kirana|food|grain|rice|atta|dal/i, Apple],
  [/dairy|milk|bread|bakery|egg/i, Coffee],
  [/meat|fish|chicken|egg/i, Beef],
  [/snack|drink|beverage|cold|beauty|cosmetic/i, SprayCan],
  [/medicine|pharma|health/i, Pill],
  [/cloth|fashion|apparel|garment/i, Shirt],
  [/shoe|footwear/i, Footprints],
  [/electronic|mobile|phone|gadget/i, Smartphone],
  [/computer|laptop|it|accessor/i, Laptop],
  [/hardware|tool|plumb|electric|wire/i, Wrench],
  [/paint|build|construct|cement|steel/i, PaintRoller],
  [/stationer|book|paper|office|school/i, Book],
  [/clean|wash|soap|detergent|home|kitchen/i, Droplets],
  [/restaurant|hotel|utensil|cater/i, Utensils],
]

export function categoryGlyph(category: string, name: string): { icon: LucideIcon | null; initial: string } {
  const hay = `${category} ${name}`
  for (const [re, Icon] of CATEGORY_ICONS) {
    if (re.test(hay)) return { icon: Icon, initial: name.charAt(0).toUpperCase() }
  }
  return { icon: null, initial: name.charAt(0).toUpperCase() }
}

export function ProductGlyph({ product, size = 'md' }: { product: Pick<Product, 'name' | 'category'>; size?: 'md' | 'sm' }) {
  const { icon: Icon, initial } = categoryGlyph(product.category || '', product.name || '')
  const box = size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
  return (
    <div className={`${box} rounded-xl bg-accent-soft border border-line text-accent-strong flex items-center justify-center flex-shrink-0`} aria-hidden="true">
      {Icon ? <Icon className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} strokeWidth={1.75} /> : <span className="text-sm font-extrabold">{initial}</span>}
    </div>
  )
}

/** Stock condition of a product — drives the dot / badge colour token. */
export function stockState(p: Pick<Product, 'stock_quantity' | 'low_stock_threshold'>): 'out' | 'low' | 'ok' {
  if ((p.stock_quantity ?? 0) <= 0) return 'out'
  if (p.stock_quantity <= p.low_stock_threshold) return 'low'
  return 'ok'
}

const DOT: Record<string, string> = {
  ok: 'bg-positive',
  low: 'bg-warning',
  out: 'bg-negative',
}
const DOT_LABEL: Record<string, string> = {
  ok: 'In stock',
  low: 'Low stock',
  out: 'Out of stock',
}

/** Compact grid card — image-or-glyph, one-line name, price, stock dot. */
export function ProductCard({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const st = stockState(product)
  return (
    <button
      onClick={() => onAdd(product)}
      disabled={st === 'out'}
      className="card p-3 flex flex-col gap-2 text-left hover:border-line-2 transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      aria-label={`${product.name}, ${formatINR(product.price)}${st !== 'ok' ? `, ${DOT_LABEL[st]}` : ''}`}
    >
      <div className="flex items-start justify-between">
        <ProductGlyph product={product} />
        <span className={`w-2 h-2 rounded-full mt-1.5 ${DOT[st]}`} title={DOT_LABEL[st]} aria-label={DOT_LABEL[st]} role="img" />
      </div>
      <p className="text-sm font-semibold text-fg leading-tight truncate">{product.name}</p>
      <p className="text-lg font-bold text-accent-strong leading-none mt-auto">
        {formatINR(product.price)}
        {product.units && product.units.length > 1 && (
          <span className="text-[10px] font-medium text-fg-subtle ml-1">/{product.units[0].unit}</span>
        )}
      </p>
    </button>
  )
}

/** List row — SKU, live stock badge and a direct add control. */
export function ProductRow({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const st = stockState(product)
  return (
    <div className="card p-3 flex items-center gap-3">
      <ProductGlyph product={product} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-fg truncate">{product.name}</p>
        <p className="text-xs text-fg-subtle truncate">
          {product.sku ? `SKU ${product.sku} · ` : ''}
          <span className={st === 'out' ? 'text-negative' : st === 'low' ? 'text-warning' : 'text-positive'}>
            {st === 'out' ? 'Out of stock' : st === 'low' ? `${product.stock_quantity} left` : `${product.stock_quantity} in stock`}
          </span>
        </p>
      </div>
      <p className="text-base font-bold text-accent-strong whitespace-nowrap">{formatINR(product.price)}</p>
      <button
        onClick={() => onAdd(product)}
        disabled={st === 'out'}
        className="w-11 h-11 rounded-xl bg-accent text-accent-fg flex items-center justify-center font-bold text-lg active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label={`Add ${product.name} to sale`}
      >
        +
      </button>
    </div>
  )
}

/** Mini tile for the frequent-items row above the grid. */
export function FrequentTile({ product, onAdd }: { product: Product; onAdd: (p: Product) => void }) {
  const st = stockState(product)
  return (
    <button
      onClick={() => onAdd(product)}
      disabled={st === 'out'}
      className="card p-2.5 w-28 flex-shrink-0 flex flex-col items-start gap-1.5 text-left active:scale-[0.97] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label={`Add ${product.name}`}
    >
      <ProductGlyph product={product} size="sm" />
      <p className="text-xs font-semibold text-fg leading-tight line-clamp-2 min-h-[2rem]">{product.name}</p>
      <p className="text-sm font-bold text-accent-strong">{formatINR(product.price)}</p>
    </button>
  )
}

export { Package }
