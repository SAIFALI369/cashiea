import type { ReactNode } from 'react'
import clsx from 'clsx'

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'ai' | 'offline' | 'pending'

const tones: Record<StatusTone, string> = {
  success: 'bg-positive/10 text-positive',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-negative/10 text-negative',
  info: 'bg-info/10 text-info',
  ai: 'bg-ai/10 text-ai',
  offline: 'bg-offline/10 text-offline',
  pending: 'bg-pending/10 text-pending',
}

/** A consistent, readable state indicator for financial and sync workflows. */
export function StatusPill({ tone, children, icon }: { tone: StatusTone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none', tones[tone])}>
      {icon}
      {children}
    </span>
  )
}
