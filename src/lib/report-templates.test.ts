import { describe, it, expect } from 'vitest'
import { REPORT_TEMPLATES, getReportTemplate, frameReportPrompt } from './report-templates'

describe('REPORT_TEMPLATES', () => {
  it('has exactly 4 types', () => {
    expect(REPORT_TEMPLATES).toHaveLength(4)
    expect(REPORT_TEMPLATES.map((t) => t.value).sort()).toEqual([
      'custom',
      'financial',
      'operations',
      'sales',
    ])
  })

  it('every template has a non-empty label, hint, sections, placeholder', () => {
    for (const t of REPORT_TEMPLATES) {
      expect(t.label.length).toBeGreaterThan(0)
      expect(t.hint.length).toBeGreaterThan(0)
      expect(t.sections.length).toBeGreaterThanOrEqual(3)
      expect(t.placeholder.length).toBeGreaterThan(0)
    }
  })

  it('every template starts with an Executive Summary', () => {
    for (const t of REPORT_TEMPLATES) {
      expect(t.sections[0]).toBe('Executive Summary')
    }
  })

  it('financial differs from sales in its second section', () => {
    const fin = getReportTemplate('financial')
    const sales = getReportTemplate('sales')
    // Genuine structural difference, not just a word swap
    expect(fin.sections[1]).not.toBe(sales.sections[1])
    expect(fin.sections[1]).toBe('Revenue Analysis')
    expect(sales.sections[1]).toBe('Pipeline Overview')
  })

  it('operations differs from financial in its second section', () => {
    const fin = getReportTemplate('financial')
    const ops = getReportTemplate('operations')
    expect(fin.sections[1]).not.toBe(ops.sections[1])
    expect(ops.sections[1]).toBe('Throughput & Efficiency')
  })
})

describe('getReportTemplate', () => {
  it('returns the financial template for "financial"', () => {
    expect(getReportTemplate('financial').value).toBe('financial')
  })

  it('falls back to custom for an unknown type', () => {
    expect(getReportTemplate('nonexistent').value).toBe('custom')
  })
})

describe('frameReportPrompt', () => {
  it('produces a FINANCIAL prompt with revenue framing', () => {
    const prompt = frameReportPrompt('financial', 'Q1', 'rev: 100')
    expect(prompt).toContain('FINANCIAL REPORT')
    expect(prompt).toContain('Revenue Analysis')
    expect(prompt).toContain('Q1')
    expect(prompt).toContain('rev: 100')
  })

  it('produces a SALES prompt with pipeline framing', () => {
    const prompt = frameReportPrompt('sales', '', 'deals: 5')
    expect(prompt).toContain('SALES REPORT')
    expect(prompt).toContain('Pipeline Overview')
    expect(prompt).toContain('deals: 5')
  })

  it('produces an OPERATIONS prompt with throughput framing', () => {
    const prompt = frameReportPrompt('operations', 'Ops', 'tickets: 10')
    expect(prompt).toContain('OPERATIONS REPORT')
    expect(prompt).toContain('Throughput & Efficiency')
    expect(prompt).toContain('Ops')
  })

  it('produces a CUSTOM prompt for unknown type', () => {
    const prompt = frameReportPrompt('custom', 'Mine', 'stuff')
    expect(prompt).toContain('CUSTOM business report')
    expect(prompt).toContain('Mine')
  })

  it('uses the type as the title when none given', () => {
    const prompt = frameReportPrompt('sales', '', 'x')
    expect(prompt).toContain('titled "sales Report"')
  })

  it('financial and sales prompts are structurally different', () => {
    const fin = frameReportPrompt('financial', 'T', 'data')
    const sales = frameReportPrompt('sales', 'T', 'data')
    expect(fin).not.toBe(sales)
    expect(fin).toContain('Revenue Analysis')
    expect(sales).toContain('Pipeline Overview')
  })
})
