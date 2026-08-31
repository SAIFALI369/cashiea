import { ReactNode } from 'react'

/**
 * PageHeader — the page's action row.
 *
 * The page NAME lives in the app header bar (mobile) and the sidebar
 * (desktop), so pages no longer repeat it as a big first line — they
 * start directly with their content. The title is kept as a
 * screen-reader-only h1 for context/accessibility, and `action`
 * renders as a slim right-aligned row at the top of the page.
 *
 * Pages with no action render nothing at all — pure content.
 */
export default function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title?: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <>
      {/* Context for screen readers and document structure — never visible. */}
      {title && <h1 className="sr-only">{title}</h1>}
      {subtitle && <p className="sr-only">{subtitle}</p>}
      {icon && <span className="hidden">{icon}</span>}

      {action && (
        <div className="flex items-center justify-end gap-2 mb-4">
          {action}
        </div>
      )}
    </>
  )
}
