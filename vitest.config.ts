/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/components/**'],
      exclude: ['src/**/*.test.*', 'src/test/**'],
      // Regression gate (measured 2026-09-09 after the hardening pass:
      // 30.93% statements / 74.84% branches / 66.88% functions /
      // 30.93% lines on lib+components). CI fails if coverage drops below
      // these floors — new code should raise them, see docs/PRODUCTION_AUDIT.md
      // Sprint A/B. Raise in steps, not all at once.
      thresholds: {
        statements: 30,
        branches: 74,
        functions: 66,
        lines: 30,
      },
    },
  },
})
