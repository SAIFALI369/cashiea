import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVertical } from 'lucide-react'

/**
 * MoreMenu — the "⋮" per-card actions menu (replaces swipe actions
 * on touch screens and right-click context menus on mobile).
 * Big touch target, closes on outside tap or Escape.
 */
export interface MoreMenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  onClick: () => void
}

export function MoreMenu({
  items, label = 'More actions',
}: {
  items: MoreMenuItem[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-11 h-11 rounded-xl flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2 active:scale-95 transition-all"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 min-w-44 card p-1.5 shadow-float bg-surface"
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                item.danger ? 'text-negative hover:bg-negative/10' : 'text-fg hover:bg-surface-2'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
