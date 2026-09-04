import type { Capability } from './permissions'

/**
 * Capabilities required to open sensitive application routes.
 * This is a UX/route guard only; database policies and edge functions remain
 * the trust boundary. Keeping the map in one place prevents a direct URL from
 * exposing a screen that the sidebar hides for the same role.
 */
const ROUTE_CAPABILITIES: Array<{ prefix: string; capability: Capability }> = [
  { prefix: '/app/pos', capability: 'sales:create' },
  { prefix: '/app/products', capability: 'inventory:view' },
  { prefix: '/app/customers', capability: 'customers:manage' },
  { prefix: '/app/suppliers', capability: 'inventory:view' },
  { prefix: '/app/invoices', capability: 'billing:view' },
  { prefix: '/app/quotations', capability: 'billing:view' },
  { prefix: '/app/khata', capability: 'billing:view' },
  { prefix: '/app/accounts', capability: 'expenses:view' },
  { prefix: '/app/reports', capability: 'reports:view' },
  { prefix: '/app/profit-dashboard', capability: 'reports:view' },
  { prefix: '/app/gst-export', capability: 'reports:view' },
  { prefix: '/app/bank-import', capability: 'settings:manage' },
  { prefix: '/app/team', capability: 'team:manage' },
  { prefix: '/app/assistant', capability: 'ai:use' },
  { prefix: '/app/brain', capability: 'ai:use' },
  { prefix: '/app/data-entry', capability: 'ai:use' },
  { prefix: '/app/summaries', capability: 'ai:use' },
  { prefix: '/app/suggestions', capability: 'ai:use' },
  { prefix: '/app/campaigns', capability: 'campaigns:manage' },
  { prefix: '/app/email-assistant', capability: 'campaigns:manage' },
  { prefix: '/app/connect-apps', capability: 'settings:manage' },
  { prefix: '/app/integrations', capability: 'settings:manage' },
  { prefix: '/app/api-keys', capability: 'settings:manage' },
  { prefix: '/app/subscription', capability: 'settings:manage' },
  { prefix: '/app/settings', capability: 'settings:manage' },
  { prefix: '/app/compliance', capability: 'settings:manage' },
  { prefix: '/app/failed-jobs', capability: 'settings:manage' },
  { prefix: '/app/notifications', capability: 'settings:manage' },
  { prefix: '/app/permissions', capability: 'settings:manage' },
]

export function requiredCapability(pathname: string): Capability | null {
  // Longest prefixes win if a future route nests under another sensitive area.
  const match = [...ROUTE_CAPABILITIES]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))
  return match?.capability || null
}
