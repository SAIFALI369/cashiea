import { ReactNode } from 'react'

/**
 * Apple-style page header.
 * - Eyebrow (uppercase tracking-wide, small) — accepts an `icon`
 *   prop from older call-sites and renders it alongside the eyebrow.
 * - Big bold title (display-sm scale)
 * - Subtitle in muted ink
 * - Optional action on the right
 */
export default function PageHeader({
  eyebrow,
  title,
  subtitle,
  icon,
  action,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  /** Legacy prop — rendered next to the eyebrow, kept so existing
   *  pages that pass `icon={<LucideIcon />}` continue to compile. */
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
      <div className="max-w-2xl">
        {(eyebrow || icon) && (
          <div className="flex items-center gap-2 mb-2">
            {icon && <span className="text-apple-500 [&_svg]:w-4 [&_svg]:h-4">{icon}</span>}
            {eyebrow && <p className="section-eyebrow mb-0">{eyebrow}</p>}
          </div>
        )}
        <h1 className="text-[36px] sm:text-[44px] font-semibold tracking-tight text-ink-800 leading-[1.08]">
          {title}
        </h1>
        {subtitle && <p className="text-[17px] sm:text-lg text-ink-600 mt-3 leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
