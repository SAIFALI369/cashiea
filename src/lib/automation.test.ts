import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG, RULE_META, relTime, sparklinePath, toneForDaysLate,
  type AutomationType,
} from './automation'

describe('toneForDaysLate — the self-healing AR escalation ladder', () => {
  const cfg = DEFAULT_CONFIG.ar_escalation

  it('starts friendly before the firm threshold', () => {
    expect(toneForDaysLate(4, cfg)).toBe('friendly')
  })

  it('goes firm at the firm threshold', () => {
    expect(toneForDaysLate(cfg.firmDays, cfg)).toBe('firm')
  })

  it('goes final at the final threshold (split-payment offer)', () => {
    expect(toneForDaysLate(cfg.finalDays, cfg)).toBe('final')
    expect(toneForDaysLate(90, cfg)).toBe('final')
  })

  it('escalates habitual late-payers straight to firm', () => {
    expect(toneForDaysLate(4, cfg, true)).toBe('firm')
    // …but never past final
    expect(toneForDaysLate(cfg.finalDays, cfg, true)).toBe('final')
  })
})

describe('sparklinePath — micro-chart geometry', () => {
  it('draws one move then lines', () => {
    const p = sparklinePath([1, 2, 3, 2])
    expect(p.startsWith('M')).toBe(true)
    expect(p.match(/L/g)?.length).toBe(3)
  })

  it('higher values sit higher on screen (smaller svg y)', () => {
    const p = sparklinePath([1, 5])
    const yOfValue1 = Number(p.split(' ')[0].split(',')[1]) // "M0,24.4"
    const yOfValue5 = Number(p.split('L')[1].split(',')[1])  // "120,2"
    expect(yOfValue5).toBeLessThan(yOfValue1)
  })

  it('handles empty input without crashing', () => {
    expect(sparklinePath([])).toBe('')
  })
})

describe('RULE_META — every rule has metadata and guardrails', () => {
  it('covers all five autonomous departments', () => {
    expect(Object.keys(RULE_META).sort()).toEqual([
      'ar_escalation', 'cash_runway', 'churn_winback', 'expiry_guard', 'self_order',
    ])
  })

  it('guardrail keys match the default config (engine sync)', () => {
    for (const t of Object.keys(RULE_META) as AutomationType[]) {
      for (const g of RULE_META[t].guardrails) {
        expect(DEFAULT_CONFIG[t]).toHaveProperty(g.key)
      }
    }
  })

  it('defaults are safe (small auto-order, capped messages)', () => {
    expect(DEFAULT_CONFIG.self_order.maxOrderValue).toBeLessThanOrEqual(15000)
    expect(DEFAULT_CONFIG.churn_winback.maxPerDay).toBeLessThanOrEqual(3)
    expect(DEFAULT_CONFIG.ar_escalation.maxPerDay).toBeLessThanOrEqual(5)
  })
})

describe('relTime', () => {
  it('renders human moments', () => {
    expect(relTime(new Date().toISOString())).toBe('just now')
    expect(relTime(new Date(Date.now() - 5 * 60000).toISOString())).toBe('5m ago')
    expect(relTime(new Date(Date.now() - 3 * 3600000).toISOString())).toBe('3h ago')
    expect(relTime(new Date(Date.now() - 2 * 86400000).toISOString())).toBe('2d ago')
  })
})
