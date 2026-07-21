// ════════════════════════════════════════════════════════════════
// App Catalog — modular registry of connectable apps.
// Add a new app here and it appears on the Connect Apps page
// automatically. Each entry defines its auth flow, permissions,
// and icon. No hardcoding in the page component.
// ════════════════════════════════════════════════════════════════

export type PermissionMode = 'read_only' | 'read_write' | 'full_access'
export type AuthType = 'oauth2' | 'api_key' | 'manual'
export type AppCategory = 'spreadsheets' | 'email' | 'payments' | 'crm' | 'ecommerce' | 'accounting'

export interface PermissionOption {
  mode: PermissionMode
  label: string
  description: string
  scopes: string[]
  allows: string[]
  blocks: string[]
}

export interface AppCatalogEntry {
  slug: string
  name: string
  category: AppCategory
  description: string
  authType: AuthType
  enabled: boolean
  permissions: PermissionOption[]
  oauthScopes: string[]
  iconBg: string
  iconText: string
  iconLetter: string
}

// ─── Google Sheets ──────────────────────────────────────────────
export const GOOGLE_SHEETS: AppCatalogEntry = {
  slug: 'google-sheets',
  name: 'Google Sheets',
  category: 'spreadsheets',
  description: 'Connect your Google Sheets to sync product lists, sales data, and inventory automatically.',
  authType: 'oauth2',
  enabled: true,
  oauthScopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ],
  iconBg: '#0f9d58',
  iconText: '#ffffff',
  iconLetter: 'S',
  permissions: [
    {
      mode: 'read_only',
      label: 'Read Only',
      description: 'Cashiea can view your spreadsheet data but cannot make any changes.',
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      allows: ['View spreadsheets', 'Read cell data', 'List sheet names'],
      blocks: ['Edit cells', 'Create sheets', 'Delete data'],
    },
    {
      mode: 'read_write',
      label: 'Read & Write',
      description: 'Cashiea can read and update existing data in your spreadsheets.',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      allows: ['Everything in Read Only', 'Update existing cells', 'Add rows to existing sheets'],
      blocks: ['Create new spreadsheets', 'Delete spreadsheets', 'Share with others'],
    },
    {
      mode: 'full_access',
      label: 'Full Access',
      description: 'Cashiea can read, write, create, and manage spreadsheet-related actions.',
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file'],
      allows: ['Everything in Read & Write', 'Create new spreadsheets', 'Manage formatting'],
      blocks: ['Access other Google services', 'Share your account'],
    },
  ],
}

// ─── The full catalog (add new apps here) ───────────────────────
export const APP_CATALOG: AppCatalogEntry[] = [
  GOOGLE_SHEETS,
  // Future apps — just add entries here:
  // { slug: 'gmail', name: 'Gmail', ... },
  // { slug: 'razorpay', name: 'Razorpay', ... },
]

export function getAppBySlug(slug: string): AppCatalogEntry | undefined {
  return APP_CATALOG.find((app) => app.slug === slug)
}

export function getPermissionOption(app: AppCatalogEntry, mode: PermissionMode): PermissionOption | undefined {
  return app.permissions.find((p) => p.mode === mode)
}
