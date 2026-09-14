import { describe, it, expect } from 'vitest'
import {
  MERAJ_DESKS, MERAJ_DESK_IDS, getMerajDesk, merajConfirmLabel, merajDeskCatalogText,
} from './merajDesks'

const EXPECTED_IDS = [
  'auto-reorder', 'pricing', 'cash-flow', 'reminders', 'duplicates',
  'snapshot', 'goals', 'scorecard', 'social', 'gst-export', 'tally-export', 'bank-import',
  'invoices', 'reports', 'customers', 'promotions', 'team',
] as const

describe('MERAJ_DESKS', () => {
  it('covers every automation desk with a unique id and /app/ href', () => {
    expect(MERAJ_DESK_IDS).toEqual([...new Set(MERAJ_DESK_IDS)])
    expect(MERAJ_DESK_IDS).toEqual(expect.arrayContaining([...EXPECTED_IDS]))
    expect(MERAJ_DESKS).toHaveLength(EXPECTED_IDS.length)
    for (const d of MERAJ_DESKS) {
      expect(d.href).toMatch(/^\/app\//)
      expect(d.prompt.length).toBeGreaterThan(20)
      expect(d.label).toBeTruthy()
      expect(d.desc).toBeTruthy()
      expect(d.icon).toBeTruthy()
    }
  })

  it('looks up a desk by id and lists them for prompts', () => {
    expect(getMerajDesk('auto-reorder')?.href).toBe('/app/auto-reorder')
    expect(getMerajDesk('missing')).toBeUndefined()
    const catalog = merajDeskCatalogText()
    expect(catalog).toContain('/app/pricing')
    expect(catalog).toContain('GST working')
  })

  it('write desks (PO / prices / invoice / deals) are flagged; inspect desks are not', () => {
    expect(getMerajDesk('auto-reorder')?.write).toBe(true)
    expect(getMerajDesk('pricing')?.write).toBe(true)
    expect(getMerajDesk('invoices')?.write).toBe(true)
    expect(getMerajDesk('promotions')?.write).toBe(true)
    expect(getMerajDesk('cash-flow')?.write).toBeFalsy()
    expect(getMerajDesk('social')?.write).toBeFalsy()
    expect(getMerajDesk('team')?.write).toBeFalsy()
  })
})

describe('merajConfirmLabel', () => {
  it('uses the owner-facing verb for every Meraj action', () => {
    expect(merajConfirmLabel('create_invoice')).toBe('Create it')
    expect(merajConfirmLabel('send_whatsapp')).toBe('Send it')
    expect(merajConfirmLabel('sync_stock_from_sheet')).toBe('Sync it')
    expect(merajConfirmLabel('export_to_sheet')).toBe('Export it')
    expect(merajConfirmLabel('open_desk')).toBe('Open it')
    expect(merajConfirmLabel('draft_purchase_order')).toBe('Draft the PO')
    expect(merajConfirmLabel('apply_price_changes')).toBe('Apply prices')
    expect(merajConfirmLabel('add_product')).toBe('Add it')
    expect(merajConfirmLabel('add_products')).toBe('Add it')
    expect(merajConfirmLabel('add_customer')).toBe('Add it')
    expect(merajConfirmLabel('redeem_loyalty_points')).toBe('Redeem points')
    expect(merajConfirmLabel('set_loyalty_program')).toBe('Save program')
    expect(merajConfirmLabel('create_promotion')).toBe('Create deal')
    expect(merajConfirmLabel('set_promotion_status')).toBe('Update deal')
    expect(merajConfirmLabel('set_commission')).toBe('Set commission')
    expect(merajConfirmLabel('send_cart_reminders')).toBe('Send nudges')
    expect(merajConfirmLabel('unknown')).toBe('Confirm')
    expect(merajConfirmLabel(undefined)).toBe('Confirm')
  })

  it('labels the shift clock by direction — in vs out', () => {
    expect(merajConfirmLabel('clock_shift', { action: 'in' })).toBe('Clock in')
    expect(merajConfirmLabel('clock_shift', { action: 'out' })).toBe('Clock out')
    expect(merajConfirmLabel('clock_shift')).toBe('Clock in')
  })
})
