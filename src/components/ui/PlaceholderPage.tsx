import type { LucideIcon } from 'lucide-react'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PageHeader from './PageHeader'

/** Premium "reserved" page for new sections that don't have functionality yet.
 *  Animated accent sheen sweeps the card once; the CTA takes you back
 *  to today's workspace so the journey never dead-ends. */
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
      <div className="card sheen p-6 sm:p-16 text-center relative overflow-hidden">
        {/* Ambient corner glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-accent/8 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute -inset-3 rounded-full bg-accent/10 blur-xl" aria-hidden="true" />
            <div className="relative w-20 h-20 rounded-3xl bg-accent-soft text-accent-strong inline-flex items-center justify-center">
              <Icon className="w-10 h-10" strokeWidth={1.5} />
            </div>
          </div>
          <h2 className="text-xl font-bold text-fg">{title}</h2>
          <p className="text-sm text-fg-muted mt-2.5 max-w-sm mx-auto leading-relaxed">
            {subtitle || 'This section is reserved and reachable. Detailed functionality will be added here soon.'}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/app" className="btn-primary px-5 py-2.5">
              Back to today <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/app/assistant" className="btn-ghost px-4 py-2.5">
              <Sparkles className="w-4 h-4" /> Ask Meraj instead
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
