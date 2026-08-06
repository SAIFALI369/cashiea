import { useState } from 'react'
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
