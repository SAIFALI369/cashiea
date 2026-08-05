import { useOnlineStatus } from '../lib/useOnlineStatus'

/**
 * SyncIndicator — a subtle, persistent trust signal.
 * Functional, not decorative: reflects real connectivity. When offline it
 * announces that actions are queued (the offline-queue surfaces them on reconnect).
 */
export function SyncIndicator({ className = '' }: { className?: string }) {
  const online = useOnlineStatus()
  const color = online ? 'rgb(var(--positive))' : 'rgb(var(--warning))'
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold ${className}`}
      style={{ background: `${color}1a`, color }}
      title={online ? 'Connected — changes sync live' : 'Offline — actions are queued and will sync when reconnected'}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${online ? '' : 'animate-pulse'}`}
        style={{ background: color }}
      />
      {online ? 'Synced' : 'Offline'}
    </span>
  )
}
