import { useAuth } from '../context/AuthContext'

// ════════════════════════════════════════════════════════════════
// Role-based permissions — the single source of truth for who can do what.
// Owner = everything. Manager = non-money, non-inventory operations
// (products & money are owner-only, per the owner's spec). The matrix is
// centralized here so adjusting it updates every gated surface at once.
//
// NOTE: this enforces the UI layer (hides/disables actions). For full trust,
// the mutating edge functions should ALSO check the caller's profile.role —
// that backend enforcement is the secure follow-up.
// ════════════════════════════════════════════════════════════════

export type Role = 'owner' | 'manager' | 'accountant' | 'staff'

export type Capability =
  | 'products:manage'    // add / edit / remove products & stock
  | 'sales:create'       // POS new sale / checkout
  | 'billing:manage'     // invoices, payments, quotations
  | 'expenses:manage'    // expenses, accounts (money in/out)
  | 'customers:manage'   // add / edit customers & suppliers
  | 'campaigns:manage'   // campaigns, emails (non-money marketing)
  | 'team:manage'        // invite / manage staff
  | 'settings:manage'    // settings, API keys, subscription, integrations, compliance
  | 'ai:use'             // ask / task
  | 'everything'         // wildcard (owner)

const MATRIX: Record<Role, Capability[]> = {
  owner: ['everything'],
  // Manager: non-money, non-inventory. Can manage customers + marketing + AI.
  manager: ['customers:manage', 'campaigns:manage', 'ai:use'],
  // Accountant: handles money (bills/expenses) + AI; no products/settings/team.
  accountant: ['billing:manage', 'expenses:manage', 'ai:use'],
  // Staff: most limited — assist + AI only.
  staff: ['ai:use'],
}

export function can(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false
  const caps = MATRIX[(role as Role)] || MATRIX.staff
  return caps.includes('everything') || caps.includes(capability)
}

/** Convenience hook: `const { can, isOwner } = useCan()` */
export function useCan() {
  const { profile } = useAuth()
  const role = (profile?.role as Role) || 'staff'
  return {
    role,
    isOwner: role === 'owner',
    can: (capability: Capability) => can(role, capability),
  }
}
