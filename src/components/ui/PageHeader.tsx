import { ReactNode } from 'react'

export default function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-xl bg-brand-600/20 border border-brand-700/50 flex items-center justify-center text-brand-400">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>
      </div>
      {action}
    </div>
  )
}
