// ════════════════════════════════════════════════════════════════
// Held carts — park a sale mid-shift, resume it exactly as it was.
//
// Backed by the held_carts table (schema v24) so parked sales survive
// a refresh or a device change. Inserts go through offlineInsert so
// holding works even when the connection drops; deletes and updates
// are online-only and say so when offline.
// ════════════════════════════════════════════════════════════════

import { supabase } from './supabase'
import { offlineInsert } from './mutations'
import type { HeldCart } from './types'

/** Snapshot of everything needed to restore a sale exactly. */
export interface HeldCartSnapshot {
  lines: Record<string, unknown>[]
  customer: { id: string; name: string } | null
  note: string
  cartDiscount: number
  discountReason: string
  defaultTaxRate: number
}

export async function listHeldCarts(ownerId: string): Promise<HeldCart[]> {
  const { data, error } = await supabase
    .from('held_carts')
    .select('*')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data as HeldCart[]) || []
}

export async function holdCart(
  ownerId: string,
  label: string,
  snapshot: HeldCartSnapshot,
  total: number,
  actorId = ownerId,
): Promise<{ queued: boolean; row: HeldCart }> {
  const { data, error, queued } = await offlineInsert('held_carts', {
    user_id: ownerId,
    created_by: actorId || ownerId,
    label: label || null,
    cart: snapshot,
    total,
  })
  if (error) throw error
  return { queued, row: data as HeldCart }
}

export async function deleteHeldCart(id: string, ownerId: string): Promise<void> {
  const { error } = await supabase
    .from('held_carts')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId)
  if (error) throw error
}
