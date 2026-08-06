import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../context/AuthContext'
import type { Role } from './permissions'

// ════════════════════════════════════════════════════════════════
// Owner approval workflow — resolver + config.
//
// Owner actions apply INSTANTLY. For manager/accountant, money + add/remove
// actions create a pending change_request the owner Approves/Denies.
// The owner's permission_config (edited in the Permission Chamber) controls,
// per role + per money capability, whether an action is:
//   'direct'   → allowed without approval (owner trusts them)
//   'approved' → needs owner approval (default for money)
//   'denied'   → not allowed at all
// ════════════════════════════════════════════════════════════════

export type AccessMode = 'direct' | 'approved' | 'denied'

// The money / sensitive capabilities the owner can tune. (Non-money minor edits
// are always direct; per the agreed scope these are the approval-gated ones.)
export type MoneyCapability = 'products:manage' | 'sales:create' | 'billing:manage' | 'expenses:manage'

export const MONEY_CAPABILITIES: { key: MoneyCapability; label: string; desc: string }[] = [
  { key: 'products:manage', label: 'Products & stock', desc: 'Add / edit / remove items' },
  { key: 'sales:create', label: 'New sale (POS)', desc: 'Ring up sales & checkout' },
  { key: 'billing:manage', label: 'Invoices & payments', desc: 'Bills, payments, quotations' },
  { key: 'expenses:manage', label: 'Expenses', desc: 'Money in / out, accounts' },
]

export type TunableRole = 'manager' | 'accountant'
export const TUNABLE_ROLES: { key: TunableRole; label: string }[] = [
  { key: 'manager', label: 'Manager' },
  { key: 'accountant', label: 'Accountant' },
]

// Default: manager & accountant need approval for every money/add-remove action.
export const DEFAULT_CONFIG: Record<TunableRole, Record<MoneyCapability, AccessMode>> = {
  manager: { 'products:manage': 'approved', 'sales:create': 'approved', 'billing:manage': 'approved', 'expenses:manage': 'approved' },
  accountant: { 'products:manage': 'approved', 'sales:create': 'approved', 'billing:manage': 'approved', 'expenses:manage': 'approved' },
}

export type PermissionConfig = Partial<Record<TunableRole, Partial<Record<MoneyCapability, AccessMode>>>>

/** Resolve how a (role, money-capability) action should be handled. */
export function resolveMode(
  role: Role | string | null | undefined,
  cap: MoneyCapability,
  config: PermissionConfig | null | undefined
): AccessMode {
  if (!role || role === 'owner') return 'direct'
  if (role !== 'manager' && role !== 'accountant') return 'denied' // staff/unknown: no money access
  const r = role
  return config?.[r]?.[cap] || DEFAULT_CONFIG[r][cap] || 'approved'
}

/** Hook for the OWNER to read/edit their permission_config. */
export function usePermissionConfig() {
  const { profile } = useAuth()
  const [config, setConfig] = useState<PermissionConfig>(
    (profile?.permission_config as PermissionConfig) || {}
  )
  const [saving, setSaving] = useState(false)

  const save = async (next: PermissionConfig) => {
    setConfig(next)
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({ permission_config: next }).eq('id', profile!.id)
      if (error) throw error
    } catch {
      /* best-effort; local state already reflects intent */
    } finally {
      setSaving(false)
    }
  }

  return { config, save, saving }
}

// ── Change requests (the approval queue) ──────────────────────────
export interface ChangeRequest {
  id: string
  owner_user_id: string
  requester_id: string | null
  requester_name: string | null
  requester_role: string | null
  capability: string
  action_type: string
  target: string | null
  payload: Record<string, unknown>
  summary: string
  money_related: boolean
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  decided_at: string | null
}

/** Owner side: pending approvals addressed to me (polls every 15s). */
export function usePendingApprovals() {
  const { profile } = useAuth()
  const [items, setItems] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase
      .from('change_requests').select('*')
      .eq('owner_user_id', profile.id).eq('status', 'pending')
      .order('created_at', { ascending: false })
    setItems((data as ChangeRequest[]) || [])
    setLoading(false)
  }, [profile])
  useEffect(() => {
    load()
    const i = setInterval(load, 15000)
    return () => clearInterval(i)
  }, [load])
  return { items, loading, reload: load, count: items.length }
}

/** Owner side: replay an approved change (supports product actions). Runs as the owner. */
export async function executeChangeRequest(cr: ChangeRequest): Promise<void> {
  let err: string | null = null
  if (cr.action_type === 'product.add') {
    const p = cr.payload as Record<string, unknown>
    const { error } = await supabase.from('products').insert({ ...p, user_id: cr.owner_user_id })
    if (error) err = error.message
  } else if (cr.action_type === 'product.delete') {
    const { error } = await supabase.from('products').delete().eq('id', String(cr.payload.id))
    if (error) err = error.message
  } else if (cr.action_type === 'product.restock') {
    const { error } = await supabase.from('products').update({ stock_quantity: Number(cr.payload.stock_quantity) }).eq('id', String(cr.payload.id))
    if (error) err = error.message
  } else {
    err = `Unsupported action: ${cr.action_type}`
  }
  if (err) throw new Error(err)
  await supabase.from('change_requests').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', cr.id)
}

/** Owner side: deny = delete the request everywhere. */
export async function denyChangeRequest(id: string): Promise<void> {
  await supabase.from('change_requests').delete().eq('id', id)
}

export interface RequestActionResult { queued?: boolean; applied?: boolean; denied?: boolean; message?: string }

/**
 * Manager/accountant side: request an action. Goes through the `request-action`
 * edge function, which resolves the owner + the owner's permission_config and
 * either applies directly (if trusted), queues for approval, or denies.
 */
export async function requestAction(args: {
  capability: MoneyCapability
  action_type: string
  target?: string
  payload: Record<string, unknown>
  summary: string
  money_related: boolean
}): Promise<RequestActionResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')
  const res = await fetch(`${base}/request-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify(args),
  })
  const data = await res.json().catch(() => ({ error: 'Invalid response' }))
  if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`)
  return data as RequestActionResult
}
