// Test setup — mocks for browser globals that the lib code touches.

// `import.meta.env.VITE_*` is provided by Vite; stub it for tests.
import { vi } from 'vitest'

// @ts-expect-error – assign a minimal env shape for tests
import.meta.env = {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
}

// Stub URL.createObjectURL / revokeObjectURL (used by export.ts Blob downloads)
globalThis.URL.createObjectURL = vi.fn(() => 'blob:test')
globalThis.URL.revokeObjectURL = vi.fn()

// Stub the anchor click used by export.ts to trigger downloads
globalThis.document.createElement = (() => {
  const orig = document.createElement.bind(document)
  return (tagName: string) => {
    const el = orig(tagName)
    if (tagName === 'a') {
      el.click = vi.fn()
    }
    return el
  }
})()

// Suppress react-router Link's reliance on a router during component import tests
// (we only smoke-test that modules export without throwing).
