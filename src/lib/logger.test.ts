import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { log, requestId, rotateRequestId } from './logger'

beforeEach(() => {
  vi.spyOn(console, 'debug').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logger', () => {
  it('issues a short, stable request id per correlation scope', () => {
    const a = requestId()
    expect(a).toMatch(/^[a-z0-9]{4,10}$/i)
    expect(requestId()).toBe(a) // stable until rotated
  })

  it('rotateRequestId starts a new correlation scope', () => {
    const before = requestId()
    rotateRequestId()
    const after = requestId()
    expect(after).not.toBe(before)
    expect(after).toMatch(/^[a-z0-9]{4,10}$/i)
  })

  it('prefixes every level with the correlation id', () => {
    const id = requestId()
    log.info('hello', { a: 1 })
    log.warn('careful')
    log.error('bad', { b: [1, 2] })
    for (const spy of [console.info, console.warn, console.error]) {
      expect(spy).toHaveBeenCalled()
      const arg = (spy as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)![0] as string
      expect(arg).toContain(`req:${id}`)
      expect(arg).toContain('[cashiea]')
    }
  })

  it('serializes structured meta and survives unserializable meta', () => {
    log.warn('meta-test', { n: 1 })
    expect((console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)![0])
      .toContain('{"n":1}')
    // Circular meta must not throw — it degrades to the plain message.
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => log.warn('meta-circular', circular)).not.toThrow()
  })
})
