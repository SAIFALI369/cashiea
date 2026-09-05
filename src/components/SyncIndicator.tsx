import { useOnlineStatus } from '../lib/useOnlineStatus'
import { StatusPill } from './ui/StatusPill'

/**
 * SyncIndicator — a subtle, persistent trust signal.
 * Functional, not decorative: reflects real connectivity. When offline it
 * announces that actions are queued (the offline-queue surfaces them on reconnect).
 */
export function SyncIndicator({ className = '' }: { className?: string }) {
  const online = useOnlineStatus()
  const color = online ? 'rgb(var(--positive))' : 'rgb(var(--warning))'
  return (
    <span title={online ? 'Connected — changes sync live' : 'Offline — actions are queued and will sync when reconnected'} className={className}>
      <StatusPill tone={online ? 'success' : 'offline'} icon={<span className={`w-1.5 h-1.5 rounded-full ${online ? '' : 'animate-pulse'}`} style={{ background: color }} />}>
        {online ? 'Synced' : 'Offline'}
      </StatusPill>
    </span>
  )
}
