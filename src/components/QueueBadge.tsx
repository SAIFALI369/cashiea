import { useEffect, useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { getDeadLetters, getPending, subscribe } from '../lib/offlineQueue'
import { useAuth } from '../context/AuthContext'

/** Shows active offline writes for the current business. */
export function QueueBadge({ className = '' }: { className?: string }) {
  const { ownerId } = useAuth()
  const [counts, setCounts] = useState({ pending: 0, failed: 0 })

  useEffect(() => {
    const update = () => setCounts({
      pending: getPending(ownerId).length,
      failed: getDeadLetters(ownerId).length,
    })
    update()
    return subscribe(update)
  }, [ownerId])

  const total = counts.pending + counts.failed
  if (!total) return null
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold text-warning bg-warning/10 border border-warning/20 ${className}`}
      title={`${counts.pending} change${counts.pending !== 1 ? 's' : ''} waiting to sync${counts.failed ? ` · ${counts.failed} failed change${counts.failed !== 1 ? 's' : ''} need attention` : ''}`}
    >
      <CloudUpload className="w-3 h-3 animate-pulse" />
      {total} pending
    </span>
  )
}

export default QueueBadge
