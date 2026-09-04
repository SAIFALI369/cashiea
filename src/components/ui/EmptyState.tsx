import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

/**
 * EmptyState — premium, quiet. A gradient-ringed medallion, one clear
 * line of copy, and (optionally) the single next action the owner
 * should take. Nothing is a dead end.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="card p-12 text-center animate-fade-in">
      <div className="relative w-20 h-20 mx-auto mb-5">
        {/* Soft accent halo */}
        <div className="absolute -inset-3 rounded-full bg-accent/10 blur-xl" aria-hidden="true" />
        <div className="relative w-20 h-20 rounded-2xl bg-surface-2 border border-line flex items-center justify-center shadow-soft">
          <Icon className="w-9 h-9 text-fg-subtle" strokeWidth={1.5} />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-fg mb-1.5">{title}</h3>
      <p className="text-sm text-fg-muted max-w-sm mx-auto leading-relaxed">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}
