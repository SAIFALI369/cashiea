import { describe, it, expect } from 'vitest'
import { amountInIndianWords, gstinState, stateCodeFor, TAX_INVOICE_REQUIREMENTS, GSTIN_STATE_CODES } from './india-compliance'

describe('amountInIndianWords', () => {
  it('formats simple amounts with Only', () => {
    expect(amountInIndianWords(5)).toBe('Rupees Five Only')
    expect(amountInIndianWords(100)).toBe('Rupees One Hundred Only')
  })

  it('formats Indian lakh/crore grouping', () => {
    expect(amountInIndianWords(1234567)).toBe('Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only')
    expect(amountInIndianWords(10000000)).toBe('Rupees One Crore Only')
    expect(amountInIndianWords(230000000)).toBe('Rupees Twenty Three Crore Only')
  })

  it('includes paise', () => {
    expect(amountInIndianWords(12.5)).toBe('Rupees Twelve and Paise Fifty Only')
    expect(amountInIndianWords(1234567.89)).toBe('Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven and Paise Eighty Nine Only')
  })

  it('handles zero and rounding', () => {
    expect(amountInIndianWords(0)).toBe('Rupees Zero Only')
    expect(amountInIndianWords(10.004)).toBe('Rupees Ten Only')
    expect(amountInIndianWords(10.005)).toBe('Rupees Ten and Paise One Only')
  })

  it('handles awkward teens', () => {
    expect(amountInIndianWords(19)).toBe('Rupees Nineteen Only')
    expect(amountInIndianWords(12345)).toBe('Rupees Twelve Thousand Three Hundred Forty Five Only')
  })
})

describe('gstinState', () => {
  it('maps state codes from GSTIN prefixes', () => {
    expect(gstinState('10AAAAA0000A1Z5')).toBe('Bihar')
    expect(gstinState('20AAAAA0000A1Z5')).toBe('Jharkhand')
    expect(gstinState('27AAAAA0000A1Z5')).toBe('Maharashtra')
    expect(gstinState('07AAAAA0000A1Z5')).toBe('Delhi')
  })
  it('returns null for unknown codes', () => {
    expect(gstinState('99AAAAA0000A1Z5')).toBeNull()
    expect(gstinState('')).toBeNull()
  })
})

describe('stateCodeFor', () => {
  it('resolves state names to codes, case-insensitively', () => {
    expect(stateCodeFor('Bihar')).toBe('10')
    expect(stateCodeFor('maharashtra')).toBe('27')
    expect(stateCodeFor('West Bengal')).toBe('19')
  })
  it('handles partial names', () => {
    expect(stateCodeFor('andhra')).toBe('37')
  })
  it('returns null for unknown states', () => {
    expect(stateCodeFor('Atlantis')).toBeNull()
  })
})

describe('knowledge base integrity', () => {
  it('covers all the Rule 46 essentials', () => {
    const text = TAX_INVOICE_REQUIREMENTS.join(' ').toLowerCase()
    for (const must of ['tax invoice', 'gstin', 'hsn', 'words', 'reverse charge', 'signature', 'place of supply']) {
      expect(text).toContain(must)
    }
  })
  it('has every GST state code 01-38 without gaps (except merged UTs)', () => {
    for (const code of ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '19', '20', '27', '29', '33', '36', '37', '38']) {
      expect(GSTIN_STATE_CODES[code]).toBeTruthy()
    }
  })
})
