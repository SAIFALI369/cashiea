import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { useOnlineStatus } from '../lib/useOnlineStatus'

/**
 * OfflineBanner — honest, functional connectivity signal.
 * Shown only when really offline: tells the owner they're seeing saved data
 * and that cloud features (AI, voice, live sync) need a connection.
 */
export function OfflineBanner({ className = '' }: { className?: string }) {
  const online = useOnlineStatus()
  useEffect(() => {
    if (!online) toast.error('No internet connection. Changes will sync when you’re back.', { id: 'cashiea-offline', duration: 5000 })
    else toast.dismiss('cashiea-offline')
  }, [online])
  return null
}

export default OfflineBanner
