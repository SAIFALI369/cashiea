import { describe, it, expect } from 'vitest'
import { buildXlsx } from './xlsx'

// Tiny in-test ZIP reader (STORED entries only) to prove the file is
// structurally valid and the CRCs match the content.
function unzip(bytes: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const files = new Map<string, Uint8Array>()
  const dec = new TextDecoder()
  let i = 0
  while (i + 4 <= bytes.length && dv.getUint32(i, true) === 0x04034b50) {
    const nameLen = dv.getUint16(i + 26, true)
    const extraLen = dv.getUint16(i + 28, true)
    const crc = dv.getUint32(i + 14, true)
    const size = dv.getUint32(i + 18, true)
    const name = dec.decode(bytes.subarray(i + 30, i + 30 + nameLen))
    const start = i + 30 + nameLen + extraLen
    files.set(name, bytes.subarray(start, start + size))
    // CRC spot-check
    const data = bytes.subarray(start, start + size)
    let c = 0xffffffff
    for (let k = 0; k < data.length; k++) {
      // reuse the same polynomial as the writer
      c = crcStep(c, data[k])
    }
    const computed = (c ^ 0xffffffff) >>> 0
    expect(computed).toBe(crc)
    i = start + size
  }
  return files
}
const table = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crcStep(c: number, byte: number): number { return table[(c ^ byte) & 0xff] ^ (c >>> 8) }

describe('buildXlsx', () => {
  it('produces a valid ZIP with the required parts', () => {
    const bytes = buildXlsx([{ name: 'Sales', rows: [['Item', 'Qty', 'Price'], ['Rice', 2, 52.5]] }])
    expect(bytes[0]).toBe(0x50) // P
    expect(bytes[1]).toBe(0x4b) // K
    const files = unzip(bytes)
    expect([...files.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ])
  })

  it('writes numbers as numeric cells and text as inline strings', () => {
    const bytes = buildXlsx([{ name: 'Data', rows: [['Item', 'Qty'], ['Rice', 25]] }])
    const files = unzip(bytes)
    const xml = new TextDecoder().decode(files.get('xl/worksheets/sheet1.xml')!)
    expect(xml).toContain('<c r="B2"><v>25</v></c>')
    expect(xml).toContain('<is><t>Rice</t></is>')
    expect(xml).not.toContain('<is><t>25</t></is>')
  })

  it('escapes XML in text cells', () => {
    const bytes = buildXlsx([{ name: 'D', rows: [['Note'], ['a < b & "c"']] }])
    const xml = new TextDecoder().decode(unzip(bytes).get('xl/worksheets/sheet1.xml')!)
    expect(xml).toContain('a &lt; b &amp; &quot;c&quot;')
  })

  it('supports multiple sheets with sanitized names', () => {
    const bytes = buildXlsx([
      { name: 'Sales/2026?', rows: [['a'], [1]] },
      { name: 'Expenses', rows: [['b'], [2]] },
    ])
    const wb = new TextDecoder().decode(unzip(bytes).get('xl/workbook.xml')!)
    expect(wb).toContain('name="Sales 2026"')
    expect(wb).toContain('name="Expenses"')
    expect(unzip(bytes).has('xl/worksheets/sheet2.xml')).toBe(true)
  })

  it('handles empty cells and empty sheets', () => {
    const bytes = buildXlsx([{ name: 'S', rows: [['a', 'b'], ['x', null]] }])
    const xml = new TextDecoder().decode(unzip(bytes).get('xl/worksheets/sheet1.xml')!)
    expect(xml).toContain('<c r="A2" t="inlineStr">')
    expect(xml).not.toContain('<c r="B2"')
  })
})
