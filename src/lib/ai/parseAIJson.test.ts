import { describe, it, expect } from 'vitest'
import { parseAIJson } from '../ai'

describe('parseAIJson', () => {
  it('parses clean JSON', () => {
    const result = parseAIJson<{ a: number }>('{"a": 1}')
    expect(result).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in ```json fences', () => {
    const result = parseAIJson<{ a: number }>('```json\n{"a": 1}\n```')
    expect(result).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in bare ``` fences', () => {
    const result = parseAIJson<{ a: number }>('```\n{"a": 1}\n```')
    expect(result).toEqual({ a: 1 })
  })

  it('parses JSON with AI preamble ("Here is your invoice:")', () => {
    const text = `Sure! Here's the invoice you requested:

{"invoice_number": "INV-1", "total": 100, "items": [{"description": "Dev"}]}`
    const result = parseAIJson<{ invoice_number: string; total: number }>(text)
    expect(result?.invoice_number).toBe('INV-1')
    expect(result?.total).toBe(100)
  })

  it('parses JSON with trailing prose', () => {
    const text = `{"x": 42}

Let me know if you need anything else!`
    const result = parseAIJson<{ x: number }>(text)
    expect(result).toEqual({ x: 42 })
  })

  it('tolerates braces inside string values (does not false-match)', () => {
    // The value contains a literal "}" inside a string — naive brace counting
    // would break here. The balanced matcher must respect string boundaries.
    const text = `{"note": "use the } symbol carefully", "ok": true}`
    const result = parseAIJson<{ note: string; ok: boolean }>(text)
    expect(result?.note).toBe('use the } symbol carefully')
    expect(result?.ok).toBe(true)
  })

  it('tolerates escaped quotes inside strings', () => {
    const text = `{"msg": "he said \\"hi\\"", "n": 3}`
    const result = parseAIJson<{ msg: string; n: number }>(text)
    expect(result?.msg).toBe('he said "hi"')
    expect(result?.n).toBe(3)
  })

  it('parses a JSON array', () => {
    const result = parseAIJson<number[]>('[1, 2, 3]')
    expect(result).toEqual([1, 2, 3])
  })

  it('extracts a JSON array surrounded by prose', () => {
    const text = `Here are the items:

[{"id": 1}, {"id": 2}]

That's all!`
    const result = parseAIJson<{ id: number }[]>(text)
    expect(result).toHaveLength(2)
    expect(result?.[0].id).toBe(1)
  })

  it('parses nested objects', () => {
    const text = '{"outer": {"inner": {"deep": true}}}'
    const result = parseAIJson<{ outer: { inner: { deep: boolean } } }>(text)
    expect(result?.outer.inner.deep).toBe(true)
  })

  it('returns null for malformed JSON', () => {
    expect(parseAIJson('not json at all')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(parseAIJson('')).toBeNull()
  })

  it('returns null for whitespace-only input', () => {
    expect(parseAIJson('   \n  ')).toBeNull()
  })

  it('returns null for prose with no JSON structure', () => {
    expect(parseAIJson('I cannot help with that. Please try again.')).toBeNull()
  })

  it('handles real-world invoice-like AI output', () => {
    const realOutput = `Here's the invoice:

\`\`\`json
{
  "invoice_number": "INV-2026-0042",
  "client_name": "Acme Corp",
  "client_email": "billing@acme.com",
  "items": [
    {"description": "Web design", "quantity": 10, "unit_price": 100},
    {"description": "Logo", "quantity": 1, "unit_price": 500}
  ],
  "tax_rate": 8,
  "total": 1620
}
\`\`\`

Let me know if you need adjustments!`
    const result = parseAIJson<{
      invoice_number: string
      client_name: string
      items: { quantity: number; unit_price: number }[]
      total: number
    }>(realOutput)
    expect(result?.invoice_number).toBe('INV-2026-0042')
    expect(result?.items).toHaveLength(2)
    expect(result?.items[1].unit_price).toBe(500)
    expect(result?.total).toBe(1620)
  })
})
