import { describe, it, expect } from 'vitest'
import {
  parseCsv, csvEscape, autoMapHeaders, validateProductRows,
  buildProductCsvTemplate, productsToCsv,
} from './csv'

describe('parseCsv', () => {
  it('parses simple rows', () => {
    const r = parseCsv('name,price,qty\nRice,52,25\nSoap,35,80')
    expect(r.headers).toEqual(['name', 'price', 'qty'])
    expect(r.rows).toEqual([['Rice', '52', '25'], ['Soap', '35', '80']])
    expect(r.errors).toEqual([])
  })

  it('handles quoted fields with commas and escaped quotes', () => {
    const r = parseCsv('name,note\n"Rice, 5kg","premium ""long"" grain"\nSoap,plain')
    expect(r.rows[0]).toEqual(['Rice, 5kg', 'premium "long" grain'])
    expect(r.rows[1]).toEqual(['Soap', 'plain'])
  })

  it('handles newlines inside quotes', () => {
    const r = parseCsv('name,note\n"Multi\nline",ok')
    expect(r.rows[0]).toEqual(['Multi\nline', 'ok'])
  })

  it('handles CRLF and BOM', () => {
    const r = parseCsv('\uFEFFa,b\r\n1,2\r\n')
    expect(r.headers).toEqual(['a', 'b'])
    expect(r.rows).toEqual([['1', '2']])
  })

  it('skips fully empty lines and reports unterminated quotes', () => {
    const r = parseCsv('a,b\n\n1,2\n"open quote,3')
    // The unterminated row is still surfaced (with its content) so the
    // user can fix it, plus a file-level error explains why.
    expect(r.rows).toEqual([['1', '2'], ['open quote,3']])
    expect(r.errors.length).toBe(1)
  })

  it('parses the template it generates (round-trip)', () => {
    const r = parseCsv(buildProductCsvTemplate())
    expect(r.errors).toEqual([])
    expect(r.rows.length).toBe(2)
  })
})

describe('csvEscape', () => {
  it('quotes only when needed', () => {
    expect(csvEscape('plain')).toBe('plain')
    expect(csvEscape('has,comma')).toBe('"has,comma"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
  })
})

describe('autoMapHeaders', () => {
  it('maps common header spellings', () => {
    const m = autoMapHeaders(['Product Name', 'MRP', 'Qty', 'HSN Code', 'GST %'])
    expect(m.name).toBe('Product Name')
    expect(m.price).toBe('MRP')
    expect(m.stock_quantity).toBe('Qty')
    expect(m.hsn_code).toBe('HSN Code')
    expect(m.gst_rate).toBe('GST %')
  })

  it('never maps two fields to the same column', () => {
    const m = autoMapHeaders(['price', 'cost price'])
    expect(m.price).toBe('price')
    expect(m.cost).toBe('cost price')
  })

  it('leaves unmapped fields null', () => {
    const m = autoMapHeaders(['name', 'something else'])
    expect(m.name).toBe('name')
    expect(m.sku).toBeUndefined()
  })
})

describe('validateProductRows', () => {
  const headers = ['name', 'sku', 'category', 'price', 'stock', 'gst', 'hsn']
  const mapping = { name: 'name', sku: 'sku', category: 'category', price: 'price', stock_quantity: 'stock', gst_rate: 'gst', hsn_code: 'hsn' }
  const rows = [
    ['Rice 5kg', 'RICE-5', 'Grocery', '520', '25', '5', '1006'],
    ['Soap', 'SOAP-1', 'personal care', '35', '80', '18', '3401'],
  ]

  it('accepts clean rows', () => {
    const out = validateProductRows(rows, mapping, headers, new Set())
    expect(out[0].errors).toEqual([])
    expect(out[0].product).toMatchObject({ name: 'Rice 5kg', sku: 'RICE-5', price: 520, stock_quantity: 25, gst_rate: 5 })
  })

  it('flags missing name and bad price', () => {
    const out = validateProductRows([['', 'X-1', 'c', 'abc', '5', '0', '']], mapping, headers, new Set())
    expect(out[0].errors.join(' ')).toContain('Name is missing')
    expect(out[0].errors.join(' ')).toContain('not a valid amount')
    expect(out[0].product).toBeNull()
  })

  it('flags invalid GST slab and HSN format', () => {
    const out = validateProductRows([['Item', 'I-1', 'c', '10', '1', '15', '12ab']], mapping, headers, new Set())
    expect(out[0].errors.join(' ')).toContain('GST "15" must be one of 0, 5, 12, 18, 28')
    expect(out[0].errors.join(' ')).toContain('HSN "12ab" must be 2–8 digits')
  })

  it('flags duplicate SKUs within the file', () => {
    const out = validateProductRows([['A', 'DUP-1', 'c', '10', '1', '0', ''], ['B', 'DUP-1', 'c', '20', '2', '0', '']], mapping, headers, new Set())
    expect(out[0].errors).toEqual([])
    expect(out[1].errors.join(' ')).toContain('Duplicate SKU "DUP-1" — also on row 1')
  })

  it('warns (not errors) when the SKU already exists in the catalog', () => {
    const out = validateProductRows([['A', 'EXIST-1', 'c', '10', '1', '0', '']], mapping, headers, new Set(['exist-1']))
    expect(out[0].errors).toEqual([])
    expect(out[0].warnings.join(' ')).toContain('already exists')
  })

  it('duplicate detection is case-insensitive', () => {
    const out = validateProductRows([['A', 'rice-5', 'c', '10', '1', '0', ''], ['B', 'RICE-5', 'c', '20', '2', '0', '']], mapping, headers, new Set())
    expect(out[1].errors.join(' ')).toContain('Duplicate SKU')
  })

  it('reuses the existing category spelling (case-insensitive)', () => {
    const out = validateProductRows([['A', '', 'ELECTRONICS', '10', '1', '0', '']], mapping, headers, new Set(), ['Electronics'])
    expect(out[0].product?.category).toBe('Electronics')
  })
})

describe('productsToCsv', () => {
  it('round-trips through parseCsv', () => {
    const products = [
      { id: '1', user_id: 'u', name: 'Rice, 5kg', description: null, sku: 'RICE-5', category: 'grocery', price: 520, cost: 410, stock_quantity: 25, low_stock_threshold: 5, active: true, units: null, hsn_code: '1006', gst_rate: 5, created_at: '', updated_at: '' },
    ] as never as import('./types').Product[]
    const csv = productsToCsv(products)
    const parsed = parseCsv(csv)
    expect(parsed.rows[0][0]).toBe('Rice, 5kg')
    expect(parsed.rows[0][1]).toBe('RICE-5')
    expect(parsed.rows[0][3]).toBe('520')
  })
})
