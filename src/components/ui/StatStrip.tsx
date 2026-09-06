import type { LucideIcon } from 'lucide-react'

export interface StatTile {
  label: string
  value: string
  icon?: LucideIcon
  tone?: 'default' | 'accent' | 'positive' | 'warning' | 'negative' | 'secondary'
  hint?: string
}

const TONE_ICON: Record<NonNullable<StatTile['tone']>, string> = {
  default: 'bg-surface-2 text-fg-muted',
  accent: 'bg-accent-soft text-accent-strong',
  positive: 'bg-positive/10 text-positive',
  warning: 'bg-warning/10 text-warning',
  negative: 'bg-negative/10 text-negative',
  secondary: 'bg-secondary-soft text-secondary-strong',
}

const TONE_VALUE: Record<NonNullable<StatTile['tone']>, string> = {
  default: 'text-fg',
  accent: 'text-accent-strong',
  positive: 'text-positive',
  warning: 'text-warning',
  negative: 'text-negative',
  secondary: 'text-secondary-strong',
}

/**
 * StatStrip — the standard KPI row for list pages.
 * Phone: horizontally swipeable snap tiles (no layout squeeze).
 * Desktop: an even, calm grid. Numbers are tabular so columns align.
 */
export function StatStrip({ stats, className = '' }: { stats: StatTile[]; className?: string }) {
  return (
    <div
      className={`flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory mb-4
                  sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-4 ${className}`}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="card p-3.5 min-w-[152px] sm:min-w-0 snap-start flex items-center gap-3"
        >
          {s.icon && (
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${TONE_ICON[s.tone || 'default']}`}>
              <s.icon className="w-[18px] h-[18px]" strokeWidth={2} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-fg-subtle truncate">{s.label}</p>
            <p className={`text-lg font-bold tabular-nums leading-tight ${TONE_VALUE[s.tone || 'default']}`}>{s.value}</p>
            {s.hint && <p className="text-[10px] text-fg-subtle truncate">{s.hint}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
