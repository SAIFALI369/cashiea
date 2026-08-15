import { supabase } from './supabase'

// ════════════════════════════════════════════════════════════════
// OFFLINE MUTATION QUEUE — intent-based, replays with a FRESH session
// on reconnect (so expired tokens never strand a queued change).
// v1: INSERTS (creates). The shop's daily writes — sales, invoices,
// products, customers, expenses — are overwhelmingly inserts.
// ════════════════════════════════════════════════════════════════

export interface QueuedMutation {
  id: string
  table: string
  type: 'insert'
  payload: Record<string, any>
  ts: number
  attempts?: number
}

const KEY = 'cashiea_offline_queue'

type Listener = () => void
const listeners = new Set<Listener>()
function emit() { listeners.forEach((l) => l()) }

export function subscribe(cb: Listener): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function read(): QueuedMutation[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function writeAll(q: QueuedMutation[]) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); emit() } catch { /* ignore quota */ }
}

export function getPending(): QueuedMutation[] { return read() }

export function enqueueMutation(m: Omit<QueuedMutation, 'id' | 'ts'>): QueuedMutation {
  const entry: QueuedMutation = { ...m, id: uuid(), ts: Date.now() }
  writeAll([...read(), entry])
  return entry
}

function removeMutation(id: string) {
  writeAll(read().filter((m) => m.id !== id))
}

function uuid(): string {
  try { return crypto.randomUUID() } catch { return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2) }
}

export function isNetworkErr(e: any): boolean {
  const m = String(e?.message || e?.code || e || '').toLowerCase()
  return m.includes('failed to fetch') || m.includes('network') || m.includes('offline') ||
    m.includes('err_internet') || m.includes('load failed') || m.includes('timeout')
}

/**
 * Drain the queue — replay each mutation with a live session. Hard errors
 * (validation / RLS) are dropped (they'll never succeed); transient network
 * errors keep the item for the next attempt. Returns synced / failed counts.
 */
export async function drainQueue(): Promise<{ synced: number; failed: number }> {
  const pending = read()
  if (!pending.length) return { synced: 0, failed: 0 }
  if (!navigator.onLine) return { synced: 0, failed: pending.length }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { synced: 0, failed: pending.length }

  let synced = 0
  let failed = 0
  for (const m of pending) {
    try {
      if (m.type === 'insert') {
        const { error } = await supabase.from(m.table).insert(m.payload)
        if (error) throw error
      }
      removeMutation(m.id)
      synced++
    } catch (e) {
      failed++
      if (isNetworkErr(e)) {
        const tries = (m.attempts || 0) + 1
        if (tries < 12) writeAll(read().map((x) => (x.id === m.id ? { ...x, attempts: tries } : x)))
        else removeMutation(m.id) // give up after many tries
      } else {
        removeMutation(m.id) // hard error — won't ever succeed
      }
    }
  }
  return { synced, failed }
}
