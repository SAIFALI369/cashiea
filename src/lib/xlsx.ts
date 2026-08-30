// ════════════════════════════════════════════════════════════════
// Minimal XLSX writer — real .xlsx files (Excel, Google Sheets,
// LibreOffice) with zero dependencies.
//
// An .xlsx is a ZIP of small XML parts. We write entries with the
// ZIP "stored" (uncompressed) method, which needs only a CRC-32 —
// no compression library. Sheets use inline strings, so numbers
// open as numbers and text as text.
// ════════════════════════════════════════════════════════════════

export interface XlsxSheet {
  name: string
  /** First row is the header row. */
  rows: (string | number | null | undefined)[][]
}

// ─── CRC-32 ──────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ─── ZIP (stored) ────────────────────────────────────────────────

interface ZipEntry { name: string; data: Uint8Array }

function zipStore(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const crc = crc32(entry.data)

    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)   // local file header signature
    lv.setUint16(4, 20, true)           // version needed
    lv.setUint16(6, 0, true)            // flags
    lv.setUint16(8, 0, true)            // method: stored
    lv.setUint16(10, 0, true)           // mod time
    lv.setUint16(12, 0x21, true)        // mod date (1980-01-01)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, entry.data.length, true)
    lv.setUint32(22, entry.data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true)           // extra length
    local.set(nameBytes, 30)

    chunks.push(local, entry.data)

    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)   // central directory signature
    cv.setUint16(4, 20, true)           // version made by
    cv.setUint16(6, 20, true)           // version needed
    cv.setUint16(8, 0, true)            // flags
    cv.setUint16(10, 0, true)           // method
    cv.setUint16(12, 0, true)           // mod time
    cv.setUint16(14, 0x21, true)        // mod date
    cv.setUint32(16, crc, true)
    cv.setUint32(20, entry.data.length, true)
    cv.setUint32(24, entry.data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    // 30..42: extra, comment, disk, internal/external attrs = 0
    cv.setUint32(42, offset, true)      // relative offset of local header
    cd.set(nameBytes, 46)
    central.push(cd)

    offset += local.length + entry.data.length
  }

  const centralSize = central.reduce((s, c) => s + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)     // end of central directory
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)

  const total = offset + centralSize + 22
  const out = new Uint8Array(total)
  let pos = 0
  for (const c of [...chunks, ...central, eocd]) { out.set(c, pos); pos += c.length }
  return out
}

// ─── Sheet XML ───────────────────────────────────────────────────

function colName(n: number): string {
  let s = ''
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function sheetXml(rows: XlsxSheet['rows']): string {
  const body = rows.map((row, r) => {
    const cells = row.map((cell, c) => {
      const ref = `${colName(c + 1)}${r + 1}`
      if (cell === null || cell === undefined || cell === '') return ''
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        return `<c r="${ref}"><v>${cell}</v></c>`
      }
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(String(cell))}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

// ─── Public API ──────────────────────────────────────────────────

function sanitizeSheetName(name: string, i: number): string {
  const clean = (name || `Sheet${i + 1}`).replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31)
  return clean || `Sheet${i + 1}`
}

/** Build an .xlsx workbook from simple row sheets. */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const enc = new TextEncoder()
  const names = sheets.map((s, i) => sanitizeSheetName(s.name, i))
  const sheetEntries = sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s.rows)) }))

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override Extension="xml" PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((_, i) => `<Override Extension="xml" PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n, i) => `<sheet name="${xmlEscape(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
</workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
</Relationships>`

  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels) },
    ...sheetEntries,
  ])
}

/** Build + download an .xlsx in one call. */
export function downloadXlsx(filename: string, sheets: XlsxSheet[]): void {
  const bytes = buildXlsx(sheets)
  const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
}
