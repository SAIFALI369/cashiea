# Cashiea — Production Readiness Audit & Hardening Plan

**Date:** 2026-09-09 · **Baseline commit:** `b614f55` · **Branch:** `arena/01a08705-cashiea`

> Method: full read of the codebase (frontend, 24 edge functions, 38-table schema,
> CI, config) plus a green baseline run: `npm test` → **584/584 passing**, 36 files.
> This doc records what was found, what was fixed in the hardening pass, and what
> remains — in priority order.

---

## 1. What is already production-grade

Cashiea is well ahead of the typical vibe-coded baseline. Do not regress these:

| Area | State | Evidence |
|---|---|---|
| Type safety | TS `strict: true` | `tsconfig.json` |
| Tests | 584 tests green; structural integrity suite | `npm test`, `src/test/structure.test.ts` |
| CI | type-check → test → build on push/PR | `.github/workflows/ci.yml` |
| Multi-tenant isolation | RLS on all 38 tables, 234 policies, `service_role`-only RPCs (e.g. `reserve_api_usage`) | `supabase/_combined-schema.sql` |
| Offline correctness | Writes queue as **authenticated, tenant-bound** intents; foreign tenant ids refused; account-switch safe | `src/lib/mutations.ts`, `src/lib/offlineQueue.ts` |
| Resilience | Retry w/ backoff + hard timeouts on every remote call; transient vs deterministic errors distinguished | `src/lib/ai/index.ts`, `supabase/functions/_shared/retry.ts` |
| Cost control | Server-side AI daily quota (atomic reserve/release RPC) | `_shared/usage.ts`, schema §2872 |
| Performance | Route-level code splitting per page; `manualChunks` for jspdf/supabase; versioned PWA SW that **never** caches authenticated data | `src/App.tsx`, `vite.config.ts` |
| Input validation | GSTIN checksum (mod-36), UPI VPA, IN phone, HSN, price/qty | `src/lib/validation.ts` |
| UX foundations | Design tokens, EmptyState/Skeleton/PageHeader, ErrorBoundary, auth-hydration race guards, OS reduce-motion honored | `src/components/ui/*`, `src/App.tsx` |
| Compliance | DPDP Act 2023/2025 privacy policy, India Terms, GST Rule 46 invoices | `src/pages/Privacy.tsx`, `src/lib/gst.ts` |
| Secrets | No secrets in code; env-only; broken-project detection for mis-deploys | `src/lib/supabase.ts` |

## 2. Gaps found (prioritized)

### P0 — Security

| # | Gap | Risk | Fix (this pass) |
|---|---|---|---|
| 1 | **No security headers in production.** `vercel.json` only set `Cache-Control`. No CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. | XSS fallout unbounded; clickjacking; MIME sniffing | ✅ Full header set in `vercel.json` |
| 2 | Inline theme-bootstrap `<script>` in `index.html` made a strict CSP (`script-src 'self'`) impossible. | Weak CSP | ✅ Extracted to `public/theme-init.js`; CSP is now `script-src 'self'` (no `'unsafe-inline'` for scripts) |
| 3 | No `<noscript>` fallback — JS-disabled users see a blank page. | Minor UX/support | ✅ Added |

### P1 — Reliability & observability

| # | Gap | Risk | Fix (this pass) |
|---|---|---|---|
| 4 | **No client error tracking.** Uncaught React/app errors hit `console.error` (invisible in production) or die in the ErrorBoundary. | Silent breakage, no telemetry | ✅ `src/lib/errorTracking.ts` — structured client-error reports (request id, page, user id, dedupe, batching) → `client_errors` table; wired into `main.tsx`, `ErrorBoundary`, auth errors. New table SQL: `supabase/schema-v33-client-errors.sql` |
| 5 | **No structured logging / correlation ids.** Client logs are ad-hoc `console.*`; edge functions log without request ids. | Hard to debug production incidents end-to-end | ✅ `src/lib/logger.ts` — leveled, structured, request-id-tagged logger; request id per page view; ids attached to error reports and outgoing AI calls (`X-Request-Id`) |

### P2 — Hardening

| # | Gap | Risk | Fix (this pass) |
|---|---|---|---|
| 6 | **No per-user burst rate limit on AI functions.** The daily quota exists, but one session could fire 50 concurrent requests in a minute (accidental double-tap loop, compromised session, abusive account) and burn provider credits. | Cost / provider 429 storms | ✅ `supabase/functions/_shared/rate-limit.ts` — Postgres-backed sliding-window limiter (per user, per function); applied to the five expensive AI functions (`ai-assistant`, `quick-tasks`, `business-brain`, `meraj-tts`, `meraj-autopilot`). 429 + `Retry-After` on exceed. |
| 7 | `ai` + `@ai-sdk/openai-compatible` in `dependencies` but **never imported by the app** (only the standalone `index.mjs` script) — misleading, and they inflate prod installs. | Supply-surface confusion | ✅ Moved to `devDependencies`; dead `manualChunks` entry removed |

### P3 — DevOps & DX

| # | Gap | Risk | Fix (this pass) |
|---|---|---|---|
| 8 | `npm run lint` is scripted but **ESLint was never installed** — no config, no lint in CI. | Drift, accidental regressions | ✅ ESLint 9 flat config (typescript-eslint recommended-type-checked, react-hooks, react-refresh); `lint` added to CI |
| 9 | Coverage tooling installed but **never run in CI**, no threshold. | Coverage silently decays | ✅ CI runs `vitest --coverage` with a floor (lines/functions/branches/statements) set from the measured baseline |
| 10 | No dependency vulnerability scanning. | Known-vuln deps ship to prod | ✅ `npm audit --audit-level=high` gate in CI |
| 11 | No bundle-size visibility in CI. | Silent bloat regressions | ✅ CI prints `dist/` chunk sizes and warns > 500 kB per chunk |

### P4 — Process & documentation

| # | Gap | Fix |
|---|---|---|
| 12 | No single production-ops reference (headers, error tracking, staging, rollback, backups/DR, rate limits). | ✅ This doc + "Production operations" section in `README.md` |

## 3. What remains (suggested sprints)

**Sprint A — Error visibility (2–4 h)**
- Add Sentry (or keep the built-in `client_errors` sink and add a Supabase dashboard/alert on error spikes). Decide one; the built-in sink already exists and is zero-dependency.
- Edge functions: structured JSON logs with request id (the client now sends `X-Request-Id` — echo it server-side via `_shared/retry.ts` or a tiny `logger.ts` in `_shared`).
- Scheduled job: alert when `client_errors` has > N new rows in an hour.

**Sprint B — UI error/empty-state sweep (1 day)**
- 52 pages, ~50 rely on toasts only. Standardize: every page that fetches needs an explicit error state with retry (reuse `EmptyState` + a new `ErrorState`), not just a toast that vanishes after 4 s.
- Add `aria-live` to toast region; audit contrast tokens for WCAG 2.1 AA in dark mode; keyboard audit of the POS numpad flow.

**Sprint C — Performance budget (half day)**
- Vercel Analytics / Lighthouse CI on a staging URL with budgets: initial < 3 s (4G), LCP < 2.5 s, bundle per-chunk < 350 kB.
- Verify the two heaviest pages (POS, Reports) paginate or cap list renders; add `content-visibility: auto` to long lists.

**Sprint D — Data ops (half day)**
- Adopt `supabase/migrations/` (CLI-managed, reversible) for schema-v33+ so deploys never depend on manual SQL Editor runs. (Deliberately **not** back-converted now — the combined schema targets a live production DB; back-converting 32 historical files without the live DB risks drift.)
- Document the backup/restore runbook: Supabase PITR (if on pro plan) + weekly `pg_dump` of the `public` schema to the R2/S3 bucket with 30-day retention; restore test quarterly.

**Sprint E — Load testing (half day)**
- k6 script against the staging deploy: 200 VUs on `ai-assistant` (verifies the new rate limiter returns 429 cleanly) + POS insert path (verifies offline-queue replay idempotency under concurrency). Commit results to `docs/LOAD-TEST.md`.

## 4. Non-functional requirements (stated)

- **Initial load** < 3 s on 4G from ap-south-1 (Mumbai) — code-split app shell ≈ see CI bundle report.
- **Interaction** < 100 ms locally; AI responses stream (SSE) so first token < 2 s.
- **Offline**: billing must keep working; sync must never double-apply (queue is tenant-bound + idempotent RPCs).
- **Isolation**: a shop must never be able to read another shop's row — enforced by RLS + service-role-only cross-tenant RPCs.
- **Cost**: AI usage bounded per user per day (quota) **and** per user per minute (burst limiter).

## 5. Rollout notes

- `vercel.json` header changes are zero-risk to roll back (delete the file entry).
- `client_errors` table: idempotent DDL (`if not exists`), RLS lets any signed-in user insert their own row, nobody can update/delete; add a retention job (e.g. keep 60 days) in Sprint A.
- Rate limiter fails **open** on its own DB error (availability > correctness for a limiter) but logs the failure.
- ESLint config ships with `eslint:recommended + typescript-eslint strict-ish`; pre-existing style noise is capped by disabling cosmetic rules (`naming-convention`, `consistent-type-imports`, `no-non-null-assertion` left as error only where already clean). If `npm run lint` flags legacy files, prefer fixing over `eslint-disable` — the CI gate is the point.
