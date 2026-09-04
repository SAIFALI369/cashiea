import { supabase } from './supabase'
import { enqueueMutation, enqueueRpc, isNetworkErr } from './offlineQueue'

// ════════════════════════════════════════════════════════════════
// OFFLINE-AWARE MUTATIONS
//
// Inserts and selected RPCs are queued as authenticated intent. We never queue
// an unauthenticated write and every queued item records the originating
// business/user so a later account in the same browser cannot replay it.
// ════════════════════════════════════════════════════════════════

function uuid(): string {
  try { return crypto.randomUUID() } catch { return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2) }
}

const OWNER_CACHE_PREFIX = 'cashiea_owner_id:'

/**
 * Resolve the business from the authenticated profile, never from a caller's
 * arbitrary user_id. AuthContext caches this mapping after it has loaded the
 * profile; if a member has no verified mapping yet, an offline write is
 * refused rather than queued under a guessed tenant.
 */
async function queueOwner(payload: Record<string, any>): Promise<{ ownerId: string; actorId: string } | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null

  const actorId = session.user.id
  let cachedOwner = ''
  try { cachedOwner = localStorage.getItem(`${OWNER_CACHE_PREFIX}${actorId}`) || '' } catch { /* private mode */ }
  const requested = String(payload.user_id || payload.owner_user_id || payload.p_user_id || payload.userId || '')
  const ownerId = cachedOwner || (requested === actorId ? actorId : '')

  // Do not accept a foreign tenant id merely because it appeared in a row/RPC.
  // Owners can fall back to their own id; linked users must have the profile
  // mapping populated by AuthContext before they can queue while offline.
  if (!ownerId || (requested && requested !== ownerId)) return null
  return { ownerId, actorId }
}

function bindOwner(payload: Record<string, any>, ownerId: string): Record<string, any> {
  const bound = { ...payload }
  if (Object.prototype.hasOwnProperty.call(bound, 'user_id')) bound.user_id = ownerId
  if (Object.prototype.hasOwnProperty.call(bound, 'owner_user_id')) bound.owner_user_id = ownerId
  if (Object.prototype.hasOwnProperty.call(bound, 'p_user_id')) bound.p_user_id = ownerId
  if (Object.prototype.hasOwnProperty.call(bound, 'userId')) bound.userId = ownerId
  return bound
}

async function queueInsert(table: string, payload: Record<string, any>) {
  const identity = await queueOwner(payload)
  if (!identity) return null
  const boundPayload = bindOwner(payload, identity.ownerId)
  return enqueueMutation({
    table,
    type: 'insert',
    payload: boundPayload,
    owner_user_id: identity.ownerId,
    actor_user_id: identity.actorId,
  })
}

export async function offlineInsert(table: string, row: Record<string, any>): Promise<{ data: any; error: any; queued: boolean }> {
  const identity = await queueOwner(row)
  if (!identity) return { data: null, error: new Error('The write is not bound to your authenticated business.'), queued: false }
  const payload = { ...bindOwner(row, identity.ownerId), id: row.id || uuid() }

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const { data, error } = await supabase.from(table).insert(payload).select().single()
      if (error) {
        if (isNetworkErr(error)) {
          const queued = await queueInsert(table, payload)
          if (queued) return { data: payload, error: null, queued: true }
        }
        return { data: null, error, queued: false }
      }
      return { data, error: null, queued: false }
    } catch (error) {
      if (isNetworkErr(error)) {
        const queued = await queueInsert(table, payload)
        if (queued) return { data: payload, error: null, queued: true }
      }
      return { data: null, error, queued: false }
    }
  }

  const queued = await queueInsert(table, payload)
  if (!queued) return { data: null, error: new Error('Could not save the offline change. Free storage space and try again.'), queued: false }
  return { data: payload, error: null, queued: true }
}

export interface OfflineRpcResult<T = any> {
  data: T | null
  error: any
  queued: boolean
}

/**
 * Offline-aware RPC wrapper. The RPC must be written to be idempotent because
 * a request can time out after the server commits and then be replayed.
 */
export async function offlineRpc<T = any>(
  functionName: string,
  args: Record<string, any>,
  optimisticData: T | null = null,
): Promise<OfflineRpcResult<T>> {
  const identity = await queueOwner(args)
  if (!identity) return { data: null, error: new Error('The write is not bound to your authenticated business.'), queued: false }
  const boundArgs = bindOwner(args, identity.ownerId)

  const tryQueue = async () => {
    const queued = enqueueRpc(functionName, boundArgs, identity.ownerId, identity.actorId)
    if (!queued) {
      return { data: null, error: new Error('Could not save the offline change. Free storage space and try again.'), queued: false } as OfflineRpcResult<T>
    }
    return { data: optimisticData, error: null, queued: true } as OfflineRpcResult<T>
  }

  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const { data, error } = await supabase.rpc(functionName, boundArgs)
      if (error) {
        if (isNetworkErr(error)) return tryQueue()
        return { data: null, error, queued: false }
      }
      return { data: data as T, error: null, queued: false }
    } catch (error) {
      if (isNetworkErr(error)) return tryQueue()
      return { data: null, error, queued: false }
    }
  }

  return tryQueue()
}
