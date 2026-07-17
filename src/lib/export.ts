// ════════════════════════════════════════════════════════════════
// Export utility — CSV & JSON downloads for any data
// ════════════════════════════════════════════════════════════════

export function exportToCSV(filename: string, rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    downloadFile(filename + '.csv', 'text/csv', '')
    return
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k))
      return set
    }, new Set<string>())
  )

  const escape = (val: unknown): string => {
    const s = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n')

  downloadFile(filename + '.csv', 'text/csv;charset=utf-8;', csv)
}

export function exportToJSON(filename: string, data: unknown): void {
  downloadFile(filename + '.json', 'application/json', JSON.stringify(data, null, 2))
}

function downloadFile(filename: string, type: string, content: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
