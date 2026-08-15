import { supabase } from './supabase'
import { enqueueMutation, isNetworkErr } from './offlineQueue'

// ════════════════════════════════════════════════════════════════
// offlineInsert — drop-in offline-aware replacement for
//   supabase.from(table).insert(row).select().single()
//
// • Online  → real insert, returns the created row.
// • Offline (or network drop mid-request) → queues the mutation and returns
//   the row optimistically (with a client-generated id) so the UI shows it
//   immediately. The queue drains on reconnect (see offlineQueue.drainQueue).
//
// Returns { data, error, queued }.
// ════════════════════════════════════════════════════════════════

function uuid(): string {
  try { return crypto.randomUUID() } catch { return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2) }
}

export async function offlineInsert(table: string, row: Record<string, any>): Promise<{ data: any; error: any; queued: boolean }> {
  const id = row.id || uuid()
  const payload = { ...row, id }

  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.from(table).insert(payload).select().single()
      if (error) {
        if (isNetworkErr(error)) {
          enqueueMutation({ table, type: 'insert', payload })
          return { data: payload, error: null, queued: true }
        }
        return { data: null, error, queued: false }
      }
      return { data, error: null, queued: false }
    } catch (e) {
      if (isNetworkErr(e)) {
        enqueueMutation({ table, type: 'insert', payload })
        return { data: payload, error: null, queued: true }
      }
      return { data: null, error: e as Error, queued: false }
    }
  }

  // Offline → queue + optimistic
  enqueueMutation({ table, type: 'insert', payload })
  return { data: payload, error: null, queued: true }
}
