import { ReactNode } from 'react'

/**
 * PageHeader — the page's action row / optional visible header.
 *
 * Default mode (no `visible`): the page NAME lives in the app header
 * bar (mobile) and the sidebar (desktop), so pages don't repeat it as
 * a big first line. The title is kept as a screen-reader-only h1 and
 * `action` renders as a slim right-aligned row at the top of the page.
 *
 * Visible mode: renders a premium in-page header — eyebrow, title,
 * subtitle and action row — for pages that benefit from announcing
 * their section (docs-style pages, support, compliance…). Still one
 * h1 per page, consistent spacing everywhere.
 */
export default function PageHeader({
  title,
  subtitle,
  icon,
  action,
  eyebrow,
  visible = false,
}: {
  title?: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
  eyebrow?: string
  /** Render a visible in-page header block (default: sr-only). */
  visible?: boolean
}) {
  if (visible) {
    return (
      <header className="mb-6 animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="section-title mb-2">{eyebrow}</p>}
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-fg">
              {icon && (
                <span className="w-9 h-9 rounded-xl bg-accent-soft text-accent-strong inline-flex items-center justify-center flex-shrink-0">
                  {icon}
                </span>
              )}
              <span className="truncate">{title}</span>
            </h1>
            {subtitle && <p className="text-sm text-fg-muted mt-1.5 max-w-2xl leading-relaxed">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      </header>
    )
  }

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
