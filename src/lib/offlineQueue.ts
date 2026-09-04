import { supabase } from './supabase'

// ════════════════════════════════════════════════════════════════
// OFFLINE MUTATION QUEUE — authenticated, user-isolated, replay-safe.
//
// The queue stores intent, not a stale access token. On reconnect every item
// is replayed with the current session and only against its originating
// business. Network failures remain queued; validation/RLS failures become a
// durable dead letter instead of silently disappearing.
// ════════════════════════════════════════════════════════════════

export type QueuedMutationType = 'insert' | 'rpc'

export interface QueuedMutation {
  id: string
  owner_user_id: string
  actor_user_id?: string
  table?: string
  type: QueuedMutationType
  payload?: Record<string, any>
  function_name?: string
  args?: Record<string, any>
  ts: number
  attempts?: number
  dead_letter?: boolean
  last_error?: string
}

type QueueInput = Omit<QueuedMutation, 'id' | 'ts'>
const KEY = 'cashiea_offline_queue'

type Listener = () => void
const listeners = new Set<Listener>()
function emit() { listeners.forEach((listener) => listener()) }

export function subscribe(cb: Listener): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function uuid(): string {
  try { return crypto.randomUUID() } catch { return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2) }
}

/** Normalize entries written by the old insert-only queue without making them
 * replayable for an unknown account. Unknown entries are retained as dead
 * letters so they can be inspected/cleared, never guessed at. */
function read(): QueuedMutation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(raw)) return []
    // Preserve malformed/legacy entries as dead letters. Dropping them here
    // made a storage failure look like a successful sync and gave the owner no
    // way to inspect or discard the orphaned intent.
    return raw.map((entry: any) => {
      const owner = entry.owner_user_id || entry.payload?.user_id || entry.args?.p_user_id || entry.args?.user_id
      return {
        ...entry,
        owner_user_id: String(owner || ''),
        dead_letter: entry.dead_letter === true || !owner,
        type: entry.type === 'rpc' ? 'rpc' : 'insert',
      } as QueuedMutation
    }).filter((entry: QueuedMutation) => entry.id)
  } catch { return [] }
}

function writeAll(queue: QueuedMutation[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue))
    emit()
    return true
  } catch {
    // A queue entry is not durable until localStorage confirms the write. The
    // mutation wrapper uses this boolean to avoid claiming an offline write was
    // saved when storage is full/blocked/private mode is unavailable.
    return false
  }
}

/** Active (not dead-lettered) entries for one verified business. Never return
 * the whole browser queue when the current account has no verified tenant. */
export function getPending(ownerId?: string | null): QueuedMutation[] {
  if (!ownerId) return []
  return read().filter((entry) => !entry.dead_letter && entry.owner_user_id === ownerId)
}

export function getDeadLetters(ownerId?: string | null): QueuedMutation[] {
  if (!ownerId) return []
  return read().filter((entry) => entry.dead_letter && entry.owner_user_id === ownerId)
}

export function enqueueMutation(mutation: QueueInput): QueuedMutation | null {
  const entry: QueuedMutation = { ...mutation, id: uuid(), ts: Date.now() }
  return writeAll([...read(), entry]) ? entry : null
}

export function enqueueRpc(
  functionName: string,
  args: Record<string, any>,
  ownerUserId: string,
  actorUserId?: string,
): QueuedMutation | null {
  return enqueueMutation({
    type: 'rpc',
    function_name: functionName,
    args,
    owner_user_id: ownerUserId,
    actor_user_id: actorUserId,
  })
}

function removeMutation(id: string) {
  writeAll(read().filter((mutation) => mutation.id !== id))
}

function updateMutation(id: string, patch: Partial<QueuedMutation>) {
  writeAll(read().map((mutation) => mutation.id === id ? { ...mutation, ...patch } : mutation))
}

export function isNetworkErr(error: any): boolean {
  const message = String(error?.message || error?.code || error || '').toLowerCase()
  const status = Number(error?.status || error?.statusCode || 0)
  return status === 408 || status === 429 || status >= 500 ||
    message.includes('failed to fetch') || message.includes('network') || message.includes('offline') ||
    message.includes('err_internet') || message.includes('load failed') || message.includes('timeout') ||
    message.includes('connection reset')
}

function isUniqueViolation(error: any): boolean {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || error || '').toLowerCase()
  return code === '23505' || message.includes('duplicate key') || message.includes('unique constraint')
}

/**
 * A unique violation is not, by itself, proof that an offline mutation was
 * committed. For example, a product insert can collide on SKU while its
 * client-generated id is still absent. Only acknowledge an insert when that
 * exact id is present in the originating business.
 */
async function isAppliedInsert(mutation: QueuedMutation, error: any): Promise<boolean> {
  if (!isUniqueViolation(error) || mutation.type !== 'insert' || !mutation.table || !mutation.payload?.id) return false
  const { data, error: lookupError } = await supabase
    .from(mutation.table)
    .select('id')
    .eq('id', mutation.payload.id)
    .eq('user_id', mutation.owner_user_id)
    .maybeSingle()
  if (lookupError) {
    // A transient lookup failure must remain retryable instead of turning a
    // real conflict into a dead letter or silently acknowledging it.
    if (isNetworkErr(lookupError)) throw lookupError
    return false
  }
  return String(data?.id || '') === String(mutation.payload.id)
}

/**
 * complete_sale is idempotent by its client-generated transaction id. It
 * already returns `{ duplicate: true }` on a replay, so the only error we may
 * acknowledge here is a unique conflict where that same transaction row is
 * demonstrably present for this business. Other RPCs are never guessed to be
 * idempotent.
 */
async function isAppliedSaleRpc(mutation: QueuedMutation, error: any): Promise<boolean> {
  if (!isUniqueViolation(error) || mutation.type !== 'rpc' || mutation.function_name !== 'complete_sale') return false
  const transactionId = mutation.args?.p_transaction_id
  if (!transactionId) return false
  const ownerId = mutation.owner_user_id
  const { data, error: lookupError } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', transactionId)
    .eq('user_id', ownerId)
    .maybeSingle()
  if (lookupError) {
    if (isNetworkErr(lookupError)) throw lookupError
    return false
  }
  return String(data?.id || '') === String(transactionId)
}

async function isAlreadyApplied(mutation: QueuedMutation, error: any): Promise<boolean> {
  return (await isAppliedInsert(mutation, error)) || (await isAppliedSaleRpc(mutation, error))
}

/**
 * Drain only the current user's business queue. A member's profile resolves
 * the owner's business id, preventing a second account in the same browser
 * from replaying the first account's data.
 */
export async function drainQueue(): Promise<{ synced: number; failed: number; deadLettered: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { synced: 0, failed: getPending().length, deadLettered: 0 }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { synced: 0, failed: getPending().length, deadLettered: 0 }

  let businessId: string | null = null
  try {
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role, business_owner_id')
      .eq('id', session.user.id)
      .maybeSingle()
    if (currentProfile?.role === 'owner' && !currentProfile.business_owner_id) businessId = session.user.id
    else if (currentProfile?.business_owner_id) businessId = currentProfile.business_owner_id
  } catch { /* no verified profile means no replay */ }

  const pending = getPending(businessId)
  let synced = 0
  let failed = 0
  let deadLettered = 0

  for (const mutation of pending) {
    // A queued mutation is attributed to the account that created it. Never
    // replay a cashier's sale or another user's write under a different JWT;
    // the original account must reconnect to sync it. Legacy entries without
    // an actor are dead-lettered rather than silently re-attributed.
    if (!mutation.actor_user_id) {
      updateMutation(mutation.id, {
        attempts: (mutation.attempts || 0) + 1,
        dead_letter: true,
        last_error: 'This offline change has no verified originating account; sign in as the original account or review it.',
      })
      failed += 1
      deadLettered += 1
      continue
    }
    if (mutation.actor_user_id !== session.user.id) {
      failed += 1
      continue
    }
    try {
      if (mutation.type === 'insert') {
        if (!mutation.table || !mutation.payload) throw new Error('Malformed queued insert')
        const { error } = await supabase.from(mutation.table).insert(mutation.payload)
        if (error && !(await isAlreadyApplied(mutation, error))) throw error
      } else {
        if (!mutation.function_name || !mutation.args) throw new Error('Malformed queued RPC')
        const { error } = await supabase.rpc(mutation.function_name, mutation.args)
        if (error && !(await isAlreadyApplied(mutation, error))) throw error
      }
      removeMutation(mutation.id)
      synced += 1
    } catch (error) {
      failed += 1
      const message = String(error instanceof Error ? error.message : error).slice(0, 500)
      if (isNetworkErr(error)) {
        updateMutation(mutation.id, { attempts: (mutation.attempts || 0) + 1, last_error: message })
      } else {
        updateMutation(mutation.id, {
          attempts: (mutation.attempts || 0) + 1,
          dead_letter: true,
          last_error: message,
        })
        deadLettered += 1
      }
    }
  }
  return { synced, failed, deadLettered }
}

/** Allow an owner to retry a failed item after fixing the cause. */
export function retryDeadLetter(id: string, ownerId: string): boolean {
  const queue = read()
  const found = queue.some((entry) => entry.id === id && entry.owner_user_id === ownerId && entry.dead_letter)
  if (!found) return false
  writeAll(queue.map((entry) => entry.id === id ? { ...entry, dead_letter: false, last_error: undefined } : entry))
  return true
}

export function discardDeadLetter(id: string, ownerId: string): boolean {
  const queue = read()
  const next = queue.filter((entry) => !(entry.id === id && entry.owner_user_id === ownerId && entry.dead_letter))
  if (next.length === queue.length) return false
  writeAll(next)
  return true
}
