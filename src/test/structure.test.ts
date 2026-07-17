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
  'Landing',
]

const EXPECTED_EDGE_FUNCTIONS = [
  'ai-automation',
  'campaign-send',
  'track',
  'api-generate-invoice',
  'api-draft-email',
  'create-checkout',
  'stripe-webhook',
]

const EXPECTED_SQL = ['schema.sql', 'schema-additions.sql', 'schema-v3.sql']

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
  it('imports Landing', () => expect(app).toMatch(/import Landing/))

  it('has a route element for campaigns/new', () => expect(app).toMatch(/path="campaigns\/new"/))
  it('has a route element for activity', () => expect(app).toMatch(/path="activity"/))
  it('has a route element for api-keys', () => expect(app).toMatch(/path="api-keys"/))
  it('has a route element for compliance', () => expect(app).toMatch(/path="compliance"/))
  it('has a public case-study route', () => expect(app).toMatch(/path="\/case-study"/))
})

describe('Sidebar links to every app page', () => {
  const sidebar = read('src/components/Sidebar.tsx')

  const routes = [
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
