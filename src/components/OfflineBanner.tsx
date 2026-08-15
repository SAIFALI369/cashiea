import { useOnlineStatus } from '../lib/useOnlineStatus'

/**
 * OfflineBanner — honest, functional connectivity signal.
 * Shown only when really offline: tells the owner they're seeing saved data
 * and that cloud features (AI, voice, live sync) need a connection.
 */
export function OfflineBanner({ className = '' }: { className?: string }) {
  const online = useOnlineStatus()
  if (online) return null
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 px-4 py-1.5 text-[11px] font-semibold text-warning bg-warning/10 border-b border-warning/20 ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
      You're offline — showing saved data. AI, voice &amp; sync need an internet connection.
    </div>
  )
}

export default OfflineBanner
