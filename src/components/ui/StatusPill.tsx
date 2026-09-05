import type { ReactNode } from 'react'
import clsx from 'clsx'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'offline'

/**
 * A consistent, readable state indicator for financial and sync workflows.
 *
 * Tones map onto the shared semantic tokens (positive / warning / negative /
 * info) that already exist in both the light and dark themes. 'offline'
 * intentionally shares the warning palette — losing connection is a
 * recoverable caution state, not an error.
 */
const tones: Record<StatusTone, string> = {
  success: 'bg-positive/10 text-positive',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-negative/10 text-negative',
  info: 'bg-info/10 text-info',
  offline: 'bg-warning/10 text-warning',
}

export function StatusPill({ tone, children, icon }: { tone: StatusTone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none', tones[tone])}>
      {icon}
      {children}
    </span>
  )
}
