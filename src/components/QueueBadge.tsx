import { useEffect, useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { getPending, subscribe } from '../lib/offlineQueue'

/**
 * QueueBadge — shows the number of changes saved offline, waiting to sync.
 * Hidden when there's nothing pending. Pure status, driven by the real queue.
 */
export function QueueBadge({ className = '' }: { className?: string }) {
  const [n, setN] = useState(() => (typeof window !== 'undefined' ? getPending().length : 0))
  useEffect(() => subscribe(() => setN(getPending().length)), [])
  if (!n) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold text-warning bg-warning/10 border border-warning/20 ${className}`}
      title={`${n} change${n > 1 ? 's' : ''} saved offline — will sync automatically when reconnected`}
    >
      <CloudUpload className="w-3 h-3 animate-pulse" />
      {n} pending
    </span>
  )
}

export default QueueBadge
