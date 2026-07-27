// ════════════════════════════════════════════════════════════════
// App Catalog — modular registry of connectable apps.
// Add a new app here and it appears on the Connect Apps page
// automatically. Each entry defines its auth flow, permissions,
// and icon. No hardcoding in the page component.
// ════════════════════════════════════════════════════════════════

export type PermissionMode = 'read_only' | 'read_write' | 'full_access'
export type AuthType = 'oauth2' | 'api_key' | 'manual'
export type AppCategory = 'spreadsheets' | 'email' | 'payments' | 'crm' | 'ecommerce' | 'accounting' | 'storage'

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

// ─── Gmail (reuses the same Google OAuth client as Sheets) ───────
export const GMAIL: AppCatalogEntry = {
  slug: 'gmail',
  name: 'Gmail',
  category: 'email',
  description: 'Let Meraj read your recent emails so it can answer questions, draft replies, and surface customer & supplier messages.',
  authType: 'oauth2',
  enabled: true,
  oauthScopes: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ],
  iconBg: '#ea4335',
  iconText: '#ffffff',
  iconLetter: 'G',
  permissions: [
    {
      mode: 'read_only',
      label: 'Read Only',
      description: 'Meraj can read your recent email subjects and snippets to help answer questions. It cannot send, delete, or modify any email.',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      allows: ['Read recent email subjects & snippets', 'Summarize your inbox', 'Draft replies (you send them yourself)'],
      blocks: ['Send or delete emails', 'Modify labels or folders', 'Access other Google services'],
    },
  ],
}

// ─── Google Drive (file-picker model — drive.file, no verification) ──
export const GOOGLE_DRIVE: AppCatalogEntry = {
  slug: 'google-drive',
  name: 'Google Drive',
  category: 'storage',
  description: 'Pick specific files from your Google Drive for Meraj to read as context. You choose exactly what Cashiea can see — it never browses the rest of your Drive.',
  authType: 'oauth2',
  enabled: true,
  oauthScopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
  ],
  iconBg: '#1a73e8',
  iconText: '#ffffff',
  iconLetter: 'D',
  permissions: [
    {
      mode: 'read_only',
      label: 'Selected Files (Read Only)',
      description: 'Cashiea can read only the files you pick with the Google file picker. It cannot see anything else, and cannot edit or delete any file.',
      scopes: ['https://www.googleapis.com/auth/drive.file'],
      allows: ['Read content of files you pick', 'See names of picked files'],
      blocks: ['Browse all of your Drive', 'Edit or delete files', 'Access other Google services'],
    },
  ],
}

// ─── The full catalog (add new apps here) ───────────────────────
export const APP_CATALOG: AppCatalogEntry[] = [
  GOOGLE_SHEETS,
  GMAIL,
  GOOGLE_DRIVE,
  // Future apps — added once their auth/data plan is decided:
  // { slug: 'excel', name: 'Excel / OneDrive', ... },  // needs Microsoft Azure app
]

export function getAppBySlug(slug: string): AppCatalogEntry | undefined {
  return APP_CATALOG.find((app) => app.slug === slug)
}

export function getPermissionOption(app: AppCatalogEntry, mode: PermissionMode): PermissionOption | undefined {
  return app.permissions.find((p) => p.mode === mode)
}

/** Map a catalog slug to the OAuth provider key the google-oauth function expects. */
export function oauthProviderForSlug(slug: string): string {
  if (slug === 'gmail') return 'gmail'
  if (slug === 'google-drive') return 'google_drive'
  return 'google_sheets'
}
