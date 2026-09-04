import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { drainQueue, getPending } from '../lib/offlineQueue'
import { useAuth } from '../context/AuthContext'

/**
 * SyncManager — invisible. Drains only the active business's queue on app
 * load, reconnect, focus, and every 30 seconds. A second account in the same
 * browser never sees or replays the first account's pending writes.
 */
export function SyncManager() {
  const { ownerId } = useAuth()

  useEffect(() => {
    if (!ownerId) return
    let syncing = false
    const run = async () => {
      if (syncing || !getPending(ownerId).length) return
      syncing = true
      try {
        const { synced, deadLettered } = await drainQueue()
        if (synced > 0) toast.success(`${synced} change${synced > 1 ? 's' : ''} synced 🔄`)
        if (deadLettered > 0) toast.error(`${deadLettered} offline change${deadLettered > 1 ? 's' : ''} need attention`)
      } finally {
        syncing = false
      }
    }
    void run()
    window.addEventListener('online', run)
    window.addEventListener('focus', run)
    const interval = setInterval(run, 30000)
    return () => {
      window.removeEventListener('online', run)
      window.removeEventListener('focus', run)
      clearInterval(interval)
    }
  }, [ownerId])
  return null
}

export default SyncManager
