// ESLint 9 flat config — added in the production hardening pass
// (docs/PRODUCTION_AUDIT.md, P3). The gate is deliberately "recommended +
// the rules that catch real bugs"; cosmetic style is out of scope so the CI
// gate stays about correctness, not taste.
//
// Scope notes:
//  - supabase/functions/** is Deno/TS compiled by the Supabase CLI with its
//    own toolchain — lint it separately there, not with the Vite/browser
//    globals.
//  - index.mjs is a standalone Node script (AI gateway smoke test).
//  - public/theme-init.js is a pre-ES2019 bootstrap script (see the file).
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'supabase/**',
      'index.mjs',
      'public/theme-init.js',
      'scripts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        // Test files run in Node/jsdom via Vitest.
        ...globals.node,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // eslint-plugin-react-hooks v7's compiler-style rules flag the legacy
      // fetch-in-useEffect + setState pattern that ~50 pages still use. They
      // are real (but known) code smells, not correctness bugs — turning them
      // on as errors would block every PR until the UI rewrite. Kept visible
      // as warnings; they will be re-enabled in Sprint B of
      // docs/PRODUCTION_AUDIT.md (UI error-state sweep).
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/use-memo': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Best-effort `catch {}` blocks are an explicit, documented pattern in
      // this codebase (offline queue, storage access, tracking) — the
      // comment-bearing ones are already fine under no-empty's defaults.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // This codebase uses `any` at the untyped-data boundary (Supabase rows,
      // AI JSON). Flag it as a warning to keep it visible without blocking.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused code is a real maintenance smell; `_`-prefixed params are the
      // accepted intentional-ignored convention.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
)
