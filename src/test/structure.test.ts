/**
 * Structural integrity tests.
 *
 * These exist specifically so that "feature X is missing" claims can be
 * settled objectively with `npm test`. They verify:
 *  - every page component file exists on disk
 *  - every page is imported and routed in App.tsx
 *  - the sidebar links to every page
 *  - all edge functions exist
 *  - all SQL schema files exist
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const read = (p: string) => readFileSync(join(ROOT, p), 'utf-8')

const EXPECTED_PAGES = [
  'Dashboard',
  'AIBrain',
  'Integrations',
  'AIAssistant',
  'POS',
  'Products',
  'Customers',
  'Quotations',
  'Suppliers',
  'Accounts',
  'Invoices',
  'Reports',
  'DataEntry',
  'Summaries',
  'EmailAssistant',
  'Campaigns',
  'CampaignBuilder',
  'ActivityLogs',
  'ApiKeys',
  'Compliance',
  'CaseStudy',
  'Subscription',
  'Settings',
  'Support',
  'Privacy',
  'Terms',
  'Team',
  'Landing',
]

const EXPECTED_EDGE_FUNCTIONS = [
  'ai-automation',
  'ai-assistant',
  'business-brain',
  'google-oauth',
  'google-fetch',
  'daily-brain',
  'campaign-send',
  'track',
  'api-generate-invoice',
  'api-draft-email',
  'create-checkout',
  'stripe-webhook',
  'support-email',
  'invoice-reminders',
  'quickbooks-oauth',
]

const EXPECTED_SQL = ['schema.sql', 'schema-additions.sql', 'schema-v3.sql', 'schema-v4.sql', 'schema-v5.sql', 'schema-v6.sql', 'schema-v7.sql', 'schema-v8.sql', 'schema-v9.sql']

describe('page files exist', () => {
  for (const page of EXPECTED_PAGES) {
    it(`src/pages/${page}.tsx exists`, () => {
      expect(existsSync(join(ROOT, 'src', 'pages', `${page}.tsx`))).toBe(true)
    })
  }
})

describe('App.tsx routes every page', () => {
  const app = read('src/App.tsx')

  it('imports Dashboard', () => expect(app).toMatch(/import Dashboard/))
  it('imports POS', () => expect(app).toMatch(/import POS/))
  it('imports Products', () => expect(app).toMatch(/import Products/))
  it('imports Customers', () => expect(app).toMatch(/import Customers/))
  it('imports Suppliers', () => expect(app).toMatch(/import Suppliers/))
  it('imports Quotations', () => expect(app).toMatch(/import Quotations/))
  it('imports Accounts', () => expect(app).toMatch(/import Accounts/))
  it('imports AIAssistant', () => expect(app).toMatch(/import AIAssistant/))
  it('imports AIBrain', () => expect(app).toMatch(/import AIBrain/))
  it('imports Integrations', () => expect(app).toMatch(/import Integrations/))
  it('imports Invoices', () => expect(app).toMatch(/import Invoices/))
  it('imports Reports', () => expect(app).toMatch(/import Reports/))
  it('imports DataEntryPage', () => expect(app).toMatch(/import DataEntryPage/))
  it('imports Summaries', () => expect(app).toMatch(/import Summaries/))
  it('imports EmailAssistant', () => expect(app).toMatch(/import EmailAssistant/))
  it('imports Campaigns', () => expect(app).toMatch(/import Campaigns/))
  it('imports CampaignBuilder', () => expect(app).toMatch(/import CampaignBuilder/))
  it('imports ActivityLogs', () => expect(app).toMatch(/import ActivityLogs/))
  it('imports ApiKeys', () => expect(app).toMatch(/import ApiKeys/))
  it('imports Compliance', () => expect(app).toMatch(/import Compliance/))
  it('imports CaseStudy', () => expect(app).toMatch(/import CaseStudy/))
  it('imports Subscription', () => expect(app).toMatch(/import Subscription/))
  it('imports SettingsPage', () => expect(app).toMatch(/import SettingsPage/))
  it('imports Support', () => expect(app).toMatch(/import Support/))
  it('imports Team', () => expect(app).toMatch(/import Team/))
  it('imports Privacy', () => expect(app).toMatch(/import Privacy/))
  it('imports Terms', () => expect(app).toMatch(/import Terms/))
  it('imports Landing', () => expect(app).toMatch(/import Landing/))

  it('has a route element for campaigns/new', () => expect(app).toMatch(/path="campaigns\/new"/))
  it('has a route element for pos', () => expect(app).toMatch(/path="pos"/))
  it('has a route element for products', () => expect(app).toMatch(/path="products"/))
  it('has a route element for customers', () => expect(app).toMatch(/path="customers"/))
  it('has a route element for suppliers', () => expect(app).toMatch(/path="suppliers"/))
  it('has a route element for quotations', () => expect(app).toMatch(/path="quotations"/))
  it('has a route element for accounts', () => expect(app).toMatch(/path="accounts"/))
  it('has a route element for assistant', () => expect(app).toMatch(/path="assistant"/))
  it('has a route element for activity', () => expect(app).toMatch(/path="activity"/))
  it('has a route element for api-keys', () => expect(app).toMatch(/path="api-keys"/))
  it('has a route element for compliance', () => expect(app).toMatch(/path="compliance"/))
  it('has a public case-study route', () => expect(app).toMatch(/path="\/case-study"/))
  it('has a public privacy route', () => expect(app).toMatch(/path="\/privacy"/))
  it('has a public terms route', () => expect(app).toMatch(/path="\/terms"/))
  it('has an app support route', () => expect(app).toMatch(/path="support"/))
  it('has a team route', () => expect(app).toMatch(/path="team"/))
  it('has a brain route', () => expect(app).toMatch(/path="brain"/))
  it('has an integrations route', () => expect(app).toMatch(/path="integrations"/))
})

describe('Sidebar links to every app page', () => {
  const sidebar = read('src/components/Sidebar.tsx')

  const routes = [
    '/app/brain',
    '/app/integrations',
    '/app/assistant',
    '/app/pos',
    '/app/products',
    '/app/customers',
    '/app/quotations',
    '/app/suppliers',
    '/app/accounts',
    '/app/invoices',
    '/app/reports',
    '/app/data-entry',
    '/app/summaries',
    '/app/email-assistant',
    '/app/campaigns',
    '/app/activity',
    '/app/api-keys',
    '/app/compliance',
    '/app/subscription',
    '/app/settings',
    '/app/support',
    '/app/team',
  ]
  for (const route of routes) {
    it(`links to ${route}`, () => {
      expect(sidebar).toContain(`'${route}'`)
    })
  }
})

describe('edge functions exist', () => {
  const fns = readdirSync(join(ROOT, 'supabase', 'functions'))
  for (const fn of EXPECTED_EDGE_FUNCTIONS) {
    it(`supabase/functions/${fn}/ exists`, () => {
      expect(fns).toContain(fn)
      expect(existsSync(join(ROOT, 'supabase', 'functions', fn, 'index.ts'))).toBe(true)
    })
  }

  it('shared retry helper exists', () => {
    expect(existsSync(join(ROOT, 'supabase', 'functions', '_shared', 'retry.ts'))).toBe(true)
  })
})

describe('SQL schema files exist', () => {
  for (const sql of EXPECTED_SQL) {
    it(`supabase/${sql} exists`, () => {
      expect(existsSync(join(ROOT, 'supabase', sql))).toBe(true)
    })
  }
})

describe('core lib modules exist', () => {
  it('export.ts exists', () => {
    expect(existsSync(join(ROOT, 'src', 'lib', 'export.ts'))).toBe(true)
  })
  it('ai/index.ts exists', () => {
    expect(existsSync(join(ROOT, 'src', 'lib', 'ai', 'index.ts'))).toBe(true)
  })
  it('supabase.ts exists', () => {
    expect(existsSync(join(ROOT, 'src', 'lib', 'supabase.ts'))).toBe(true)
  })
})

describe('export.ts is actually imported by pages', () => {
  it('DataEntry imports export', () => expect(read('src/pages/DataEntry.tsx')).toMatch(/lib\/export/))
  it('Campaigns imports export', () => expect(read('src/pages/Campaigns.tsx')).toMatch(/lib\/export/))
  it('ActivityLogs imports export', () => expect(read('src/pages/ActivityLogs.tsx')).toMatch(/lib\/export/))
})
