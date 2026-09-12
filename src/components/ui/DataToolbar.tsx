import { ReactNode } from 'react'
import { Search } from 'lucide-react'

/**
 * DataToolbar — the standard work row for every list page:
 * search (grows) · filter chips · trailing meta or actions.
 *
 * Phone: the search fills the row, chips scroll horizontally beneath it.
 * Desktop: one calm row — search left, chips centre, meta right.
 */
export function DataToolbar({
  search,
  onSearch,
  placeholder = 'Search…',
  children,
  trailing,
  className = '',
}: {
  search?: string
  onSearch?: (v: string) => void
  placeholder?: string
  /** Filter chips (use .chip / .chip-active). */
  children?: ReactNode
  /** Right-aligned meta (item count) or actions. */
  trailing?: ReactNode
  className?: string
}) {
  const hasSearch = search !== undefined && !!onSearch
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 mb-6 ${className}`}>
      {hasSearch && (
        <div className="relative flex-1 min-w-0 sm:max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-fg-subtle pointer-events-none" />
          <input
            value={search}
            onChange={(e) => onSearch!(e.target.value)}
            placeholder={placeholder}
            /* Soft light-gray fill, no border. The ring appears on focus only. */
            className="w-full h-12 pl-11 pr-4 rounded-full bg-surface-2 border-0 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
            aria-label={placeholder}
          />
        </div>
      )}
      {children && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
          {children}
        </div>
      )}
      {trailing && <div className="sm:ml-auto flex items-center gap-2 shrink-0">{trailing}</div>}
    </div>
  )
}
