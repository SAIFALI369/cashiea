import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { friendlyAuthError, isTransientAuthError } from './auth-errors'

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('friendlyAuthError', () => {
  it('turns invalid login into a friendly credential message', () => {
    expect(friendlyAuthError(new Error('Invalid login credentials'))).toBe('Wrong email or password. Try again, or create an account.')
  })

  it('turns a Supabase `{}` error into a service message instead of blaming ad blockers', () => {
    const message = friendlyAuthError(new Error('{}'))
    expect(message).not.toMatch(/ad block/i)
    expect(message).not.toMatch(/internet connection/i)
    expect(message).toMatch(/sign-in service/i)
  })

  it('hands the user an actionable config message when auth returns 404', () => {
    const err = Object.assign(new Error('{}'), { status: 404, code: 'project_not_found' })
    expect(friendlyAuthError(err)).toMatch(/VITE_SUPABASE_URL/)
    expect(friendlyAuthError(err)).toMatch(/Supabase project/i)
  })

  it('maps an empty 401 response to wrong credentials', () => {
    const err = Object.assign(new Error('{}'), { status: 401, code: 'invalid_credentials' })
    expect(friendlyAuthError(err)).toBe('Wrong email or password. Try again, or create an account.')
  })

  it('maps an empty 429 response to a rate-limit message', () => {
    const err = Object.assign(new Error('{}'), { status: 429, code: 'too_many_requests' })
    expect(friendlyAuthError(err)).toBe('Too many attempts — wait a minute and try again.')
  })

  it('maps a network fetch failure to a connection message', () => {
    const err = new Error('Failed to fetch')
    expect(friendlyAuthError(err)).toBe('Network problem — check your connection and try again.')
  })

  it('uses the fallback when the payload is empty and nothing else can be inferred', () => {
    const err = new Error('{}')
    expect(friendlyAuthError(err, 'Could not create account. Please try again.')).toBe('Could not create account. Please try again.')
  })

  it('does not show the old misleading "couldn’t reach the sign-in service" for opaque API errors', () => {
    const err = Object.assign(new Error('{}'), { status: 400, code: 'bad_request' })
    expect(friendlyAuthError(err)).toMatch(/rejected that request/)
  })
})

describe('isTransientAuthError', () => {
  it('retries 5xx / network / retryable auth errors', () => {
    expect(isTransientAuthError(Object.assign(new Error('boom'), { status: 503 }))).toBe(true)
    expect(isTransientAuthError(Object.assign(new Error('boom'), { status: 0 }))).toBe(true)
    expect(isTransientAuthError(Object.assign(new Error('boom'), { name: 'AuthRetryableFetchError' }))).toBe(true)
  })

  it('does not retry credential / validation errors', () => {
    expect(isTransientAuthError(Object.assign(new Error('Invalid login credentials'), { status: 400, code: 'invalid_credentials' }))).toBe(false)
  })
})
