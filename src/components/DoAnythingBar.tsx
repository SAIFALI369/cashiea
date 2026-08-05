import { Link } from 'react-router-dom'
import { Search, ArrowRight } from 'lucide-react'

/**
 * CommandBar (DoAnythingBar) — the app's main control surface / smart launcher.
 * Tapping opens Meraj, where the owner can ask anything or run a task.
 * Visually distinct from a normal field: bordered launcher card, accent tile,
 * helper line, affordance arrow.
 */
export default function DoAnythingBar() {
  return (
    <Link
      to="/app/assistant"
      className="card card-hover card-press group flex items-center gap-3.5 p-3.5 pl-4"
      aria-label="Open command center"
    >
      <span className="w-10 h-10 rounded-control bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 group-hover:bg-accent group-hover:text-accent-fg transition-colors">
        <Search className="w-5 h-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg leading-tight">Do anything</p>
        <p className="text-xs text-fg-subtle truncate">Ask Meraj or run a task — sales, stock, follow-ups</p>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-fg-subtle px-2 py-1 rounded-control border border-line">Ask · Task</span>
      <ArrowRight className="w-5 h-5 text-fg-subtle group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  )
}
