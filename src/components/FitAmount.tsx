/**
 * FitAmount — money/number text that shrinks instead of wrapping or
 * overflowing. Big amounts (₹12,34,567.89) stay on one line by stepping
 * down font sizes as the string grows; everything uses tabular numerals.
 *
 *   <FitAmount value={total} className="font-extrabold text-fg" base="text-2xl" />
 *
 * Tiers default to a 2xl scale; pass `base` to start from another size
 * (the component derives the smaller steps from the Tailwind scale).
 */
const SCALE = ['text-5xl', 'text-4xl', 'text-3xl', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs']

export function FitAmount({
  value,
  base = 'text-2xl',
  className = '',
  minTier = 'text-xs',
}: {
  value: string | number
  base?: string
  className?: string
  /** Smallest size allowed before we give up and truncate. */
  minTier?: string
}) {
  const text = typeof value === 'number' ? String(value) : value
  const baseIdx = SCALE.indexOf(base)
  const minIdx = SCALE.indexOf(minTier)
  const effectiveMin = minIdx === -1 ? SCALE.length - 2 : minIdx
  const start = baseIdx === -1 ? SCALE.length - 4 : baseIdx

  // Each tier buys ~4 extra characters comfortably.
  const steps = Math.max(0, Math.ceil((text.length - 7) / 3))
  const idx = Math.min(effectiveMin, start + steps)
  const tier = idx >= 0 && idx < SCALE.length ? SCALE[idx] : minTier

  return (
    <span className={`${tier} ${className} tabular-nums whitespace-nowrap overflow-hidden text-ellipsis inline-block max-w-full`} title={text}>
      {text}
    </span>
  )
}
