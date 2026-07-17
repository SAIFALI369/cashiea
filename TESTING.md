# Testing

The project ships with a Vitest test suite so feature claims and regressions
can be verified objectively with `npm test`.

## Run

```bash
npm test           # run all tests once
npm run test:watch # watch mode (re-runs on file change)
npm run test:coverage  # with code coverage report (coverage/index.html)
```

CI runs type-check + tests + build on every push / PR — see
`.github/workflows/ci.yml`.

## What's covered

| Test file | What it verifies |
|-----------|-----------------|
| `src/lib/ai/parseAIJson.test.ts` | The robust AI-JSON parser: markdown fences, prose preamble/trailing, braces inside strings, escaped quotes, nested objects, **arrays surrounded by prose**, malformed input → null. |
| `src/lib/ai/retry.test.ts` | `fetchWithRetry` behavior: succeeds first try, retries on 429 & 5xx, does **not** retry on 4xx, retries network errors, exhausts retries, no-session guard. |
| `src/lib/export.test.ts` | CSV/JSON export: header unioning, comma/quote/newline escaping, object serialization, empty arrays, anchor download. |
| `src/lib/report-templates.test.ts` | Report types: 4 types present, each has Executive Summary, **financial/sales/operations are structurally different** (not word-swapped), prompt framing per type, custom fallback. |
| `src/test/structure.test.ts` | **Structural integrity:** every page file exists, every page is imported + routed in `App.tsx`, the sidebar links to every route, all 7 edge functions exist, all SQL files exist, core lib modules exist, export.ts is imported by the pages that use it. |

## Why these tests exist

These tests specifically guard the exact things that have been (or could be)
disputed:

- *"Is the campaign page implemented?"* → `structure.test.ts` asserts
  `Campaigns.tsx`, `CampaignBuilder.tsx`, and their routes exist.
- *"Does CSV export work?"* → `export.test.ts` + structure test that it's imported.
- *"Is the JSON parser robust?"* → `parseAIJson.test.ts` covers 15 real-world
  AI-output shapes.
- *"Do report types actually differ?"* → `report-templates.test.ts` asserts
  the section lists are genuinely different per type.
- *"Is there retry logic?"* → `retry.test.ts` proves backoff on 429/5xx.

If any of these claims break in the future, `npm test` fails and CI goes red.

## Adding tests

New tests live next to the code they test, named `*.test.ts` / `*.test.tsx`:

```
src/lib/ai/index.ts
src/lib/ai/parseAIJson.test.ts   ← co-located
```

Use the shared setup in `src/test/setup.ts` for browser-global stubs.
