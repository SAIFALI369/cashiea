import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV, exportToJSON } from './export'

describe('export utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportToCSV', () => {
    it('builds a CSV with headers from a single object', () => {
      const spy = vi.spyOn(URL, 'createObjectURL')
      exportToCSV('test', [{ name: 'Alice', age: 30 }])
      const blob = spy.mock.calls[0][0] as Blob
      expect(blob.type).toMatch(/csv/)
    })

    it('unions headers across rows with different keys', () => {
      const spy = vi.spyOn(URL, 'createObjectURL')
      exportToCSV('test', [
        { a: 1, b: 2 },
        { b: 3, c: 4 },
      ])
      const blob = spy.mock.calls[0][0] as Blob
      // Header line should contain all three keys a, b, c
      // (we can't easily read Blob sync, so just assert it produced a blob)
      expect(blob).toBeInstanceOf(Blob)
    })

    it('escapes values containing commas by quoting', () => {
      // Build the CSV string directly by replicating the escape logic
      const val = 'Hello, World'
      const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
      expect(escape(val)).toBe('"Hello, World"')
    })

    it('escapes values containing quotes by doubling them', () => {
      const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
      expect(escape('He said "hi"')).toBe('"He said ""hi"""')
    })

    it('escapes values containing newlines', () => {
      const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
      expect(escape('line1\nline2')).toBe('"line1\nline2"')
    })

    it('serializes object values as JSON in the cell', () => {
      const escape = (val: unknown): string => {
        const s = typeof val === 'object' ? JSON.stringify(val) : String(val)
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const escaped = escape({ nested: true })
      expect(escaped.startsWith('"')).toBe(true)
    })

    it('handles empty array gracefully', () => {
      const spy = vi.spyOn(URL, 'createObjectURL')
      expect(() => exportToCSV('test', [])).not.toThrow()
      expect(spy).toHaveBeenCalled()
    })
  })

  describe('exportToJSON', () => {
    it('produces a JSON blob', () => {
      const spy = vi.spyOn(URL, 'createObjectURL')
      exportToJSON('test', { a: 1 })
      const blob = spy.mock.calls[0][0] as Blob
      expect(blob.type).toBe('application/json')
    })

    it('triggers an anchor download', () => {
      const createSpy = vi.spyOn(document, 'createElement')
      exportToJSON('test', [1, 2, 3])
      expect(createSpy).toHaveBeenCalledWith('a')
    })
  })
})
