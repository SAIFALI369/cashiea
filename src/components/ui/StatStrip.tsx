import type { LucideIcon } from 'lucide-react'

export interface StatTile {
  label: string
  value: string
  icon?: LucideIcon
  tone?: 'default' | 'accent' | 'positive' | 'warning' | 'negative' | 'secondary'
  hint?: string
}

const TONE_ICON: Record<NonNullable<StatTile['tone']>, string> = {
  default: 'text-fg-subtle',
  accent: 'text-accent-strong',
  positive: 'text-positive',
  warning: 'text-warning',
  negative: 'text-negative',
  secondary: 'text-secondary-strong',
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
 *
 * Primary stats NEVER scroll horizontally: truncated headline numbers
 * ("LIFETIME VA… ₹4,25,…") are the fastest way to look cheap. Instead
 * this is ONE elegant card spanning the full width, with the figures
 * laid out inside it — two columns on a phone, a calm row on desktop.
 * Sentence-case labels in medium gray, bold dark numbers, no boxes.
 */
export function StatStrip({ stats, className = '' }: { stats: StatTile[]; className?: string }) {
  if (!stats.length) return null
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:flex sm:flex-wrap sm:gap-x-10 sm:gap-y-5">
        {stats.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className="flex items-center gap-1.5">
              {s.icon && (
                <s.icon
                  className={`w-4 h-4 flex-shrink-0 ${TONE_ICON[s.tone || 'default']}`}
                  strokeWidth={2}
                />
              )}
              <p className="text-sm text-fg-subtle truncate">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold tabular-nums leading-none mt-1.5 ${TONE_VALUE[s.tone || 'default']}`}>
              {s.value}
            </p>
            {s.hint && <p className="text-xs text-fg-subtle truncate mt-1">{s.hint}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
