import { LucideIcon } from 'lucide-react'
import clsx from 'clsx'

/**
 * Apple-style empty state.
 * Centered icon in a soft tinted square, big title, muted subtitle.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  tone = 'ink',
}: {
  icon: LucideIcon
  title: string
  description: string
  tone?: 'ink' | 'blue' | 'orange' | 'green'
}) {
  const toneStyles: Record<string, string> = {
    ink:   'bg-ink-100 text-ink-700',
    blue:  'bg-apple-50 text-apple-600',
    orange:'bg-[#fff4e5] text-[#ff9500]',
    green: 'bg-[#e8f8ee] text-[#00863a]',
  }
  return (
    <div className="card p-12 sm:p-16 text-center animate-fade-in">
      <div className={clsx('w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5', toneStyles[tone])}>
        <Icon className="w-8 h-8" strokeWidth={1.75} />
      </div>
      <h3 className="text-2xl font-semibold tracking-tight text-ink-800 mb-2">{title}</h3>
      <p className="text-[15px] text-ink-600 max-w-sm mx-auto leading-relaxed">{description}</p>
    </div>
  )
}
