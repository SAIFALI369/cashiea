import { useState, useEffect } from 'react'
import { useOnlineStatus } from '../lib/useOnlineStatus'

/**
 * LiveClock — a real-time clock for the upper bar (replaces the "Synced" pill).
 * Shows the current time (Asia/Kolkata), updating every second. Keeps a small
 * amber dot when offline so connectivity status is never hidden.
 */
export function LiveClock({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())
  const online = useOnlineStatus()
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
  const day = now.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold tabular-nums ${online ? 'text-fg-muted' : 'text-warning'} ${className}`}
      title={online ? 'Live • connected' : 'Offline — actions are queued and will sync on reconnect'}
    >
      {!online && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'rgb(var(--warning))' }} />}
      <span className="text-fg-muted">{day}</span>
      <span className="text-fg">{time}</span>
    </span>
  )
}

export default LiveClock
