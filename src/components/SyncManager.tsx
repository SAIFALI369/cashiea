import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { drainQueue, getPending } from '../lib/offlineQueue'

/**
 * SyncManager — invisible. Drains the offline mutation queue on app load,
 * on the browser going online, on window focus, and every 30s. Notifies the
 * owner when changes sync (or fail) after reconnect. Renders nothing.
 */
export function SyncManager() {
  useEffect(() => {
    let syncing = false
    const run = async () => {
      if (syncing) return
      const before = getPending().length
      if (!before) return
      syncing = true
      try {
        const { synced } = await drainQueue()
        if (synced > 0) toast.success(`${synced} change${synced > 1 ? 's' : ''} synced 🔄`)
      } finally {
        syncing = false
      }
    }
    run()
    window.addEventListener('online', run)
    window.addEventListener('focus', run)
    const interval = setInterval(run, 30000)
    return () => {
      window.removeEventListener('online', run)
      window.removeEventListener('focus', run)
      clearInterval(interval)
    }
  }, [])
  return null
}

export default SyncManager
