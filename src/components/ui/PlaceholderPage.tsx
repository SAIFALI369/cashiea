import type { LucideIcon } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import PageHeader from './PageHeader'

/** Premium "reserved" page for new sections that don't have functionality yet. */
export default function PlaceholderPage({
  title,
  subtitle,
  icon: Icon = Sparkles,
}: {
  title: string
  subtitle?: string
  icon?: LucideIcon
}) {
  return (
    <div className="animate-fade-in">
      <PageHeader title={title} subtitle={subtitle} icon={<Icon className="w-5 h-5" />} />
      <div className="card p-6 sm:p-14 text-center">
        <div className="w-14 h-14 rounded-xl bg-accent-soft text-accent inline-flex items-center justify-center mb-5">
          <Icon className="w-7 h-7" strokeWidth={1.6} />
        </div>
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        <p className="text-sm text-fg-muted mt-2 max-w-sm mx-auto leading-relaxed">
          This section is reserved and reachable. Detailed functionality will be added here soon.
        </p>
      </div>
    </div>
  )
}
