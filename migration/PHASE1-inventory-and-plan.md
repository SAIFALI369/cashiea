# Phase 1 — Migration Inventory & Plan (Supabase → Render Postgres + Clerk + R2)

> **Status: INVESTIGATION ONLY.** No code changed, nothing deployed. Phase 2 is gated on user approval.

## 0. Architectural shift I must confirm I understand

Supabase enforces authorization **at the database** via Row-Level Security: every one of the 30
tables has RLS on, and every query is silently filtered by `auth.uid()`. There is **no RLS in
Render Postgres**, and Clerk is a separate auth provider (not the DB). Therefore the exact trust
boundary RLS enforces today must be **re-implemented in the Express route layer**: each request is
authenticated by Clerk middleware (→ `req.auth.userId`), and **every** DB query must be explicitly
scoped `WHERE user_id = req.auth.userId` (and writes re-checked for ownership). Missing one = a
data-leak between users. The mitigation is a **centralized data-access layer that injects the
tenant filter automatically**, not hand-written checks on every route.

This is the highest-risk part of the migration. Confirmed and accounted for below.

## 1. Live schema inventory (authoritative — queried from the live DB)

- **Tables: 30** (the brief said 26 — actual is 30; I added `whatsapp_messages` + `oauth_pending`
  recently, plus other tables exist). ALL 30 have RLS enabled.
- **RLS policies: 34.** Pattern is highly uniform → de-risks the rewrite:
  - 29 tables: `auth.uid() = user_id` (full-manage `ALL`, or read/insert-only).
  - `profiles`: `auth.uid() = id` (the PK *is* the user id).
- **RPC functions: 11** — `decrement_stock`, `grant_trial`, `handle_new_user` (DEFINER, trigger),
  `increment_api_usage`, `log_integration_event` (DEFINER), `recompute_customer_stats`,
  `recompute_supplier_outstanding`, `reset_monthly_usage` (DEFINER), `set_updated_at` (trigger helper),
  `sync_campaign_stats`, `update_onboarding_step`.
- **Triggers:** `set_updated_at()` on `invoices` + `profiles` (UPDATE); `handle_new_user()` on
  **`auth.users`** (INSERT) — creates the `profiles` row on signup. ⚠️ `auth.users` does not exist
  under Clerk → this trigger becomes a **Clerk `user.created` webhook → Express → INSERT profile**.

### Full RLS policy map (→ becomes Express ownership checks)
| Table | Rule |
|---|---|
| profiles | owner where `id = userId` |
| customers, products, suppliers, invoices, quotations, transactions, expenses, purchase_orders, emails, email_campaigns, campaign_recipients, reports, summaries, data_entries, ai_predictions, ai_corrections, business_memory, api_keys, subscriptions, integrations, connected_apps, team_members, invoice_reminders | owner where `user_id = userId` (full manage) |
| activity_logs, daily_reports, failed_jobs, integration_audit_logs, whatsapp_messages | owner `user_id = userId` (read + insert only) |

## 2. Edge Functions → Express routes (actual count: **21**, brief said 18)

Grouped by migration complexity:

**A. Simple / no-auth (port directly):** `support-email` (email only).

**B. Service-role only (no user JWT — port to a server route / cron):**
`daily-reports`, `daily-brain`, `invoice-reminders`, `google-fetch`, `google-oauth`, `canva-oauth`,
`quickbooks-oauth`, `stripe-webhook`, `whatsapp-webhook`, `track`, `api-draft-email`,
`api-generate-invoice`. (Cron ones → Render Cron Jobs.)

**C. User-JWT + complex business logic (auth.getUser → Clerk middleware; port logic exactly):**
`ai-assistant` (Gemini function-calling + memory + tools + live context), `ai-automation`,
`business-brain`, `quick-tasks`, `campaign-send` (AI personalization + Resend delivery),
`integrations-api` (~12 connector actions), `create-checkout` (Stripe), `whatsapp-send`.

Every function uses: `@supabase/supabase-js` (→ `pg`/Prisma), Deno globals (→ Node), some use
`req Authorization` for user JWT (→ Clerk `requireAuth`), `SERVICE_ROLE_KEY` (→ server connection,
since there's no RLS to bypass), `.rpc()` (→ direct SQL or port to JS), `.storage.` (→ R2).

`_shared/`: `ai-default.ts`, `openrouter.ts`, `ai-gateway.ts`, `google.ts`, `canva.ts`,
`whatsapp.ts`, `connectors/*`, `retry.ts` — all port to Node modules (Deno `esm.sh` → npm).

## 3. Frontend surface (must be rewritten, not tweaked)

~**30 files** import the Supabase client directly (`src/lib/supabase.ts`) and run queries/inserts
client-side relying on RLS. Under the new stack the client must **call the Express API** (the server
enforces authz), and auth moves to Clerk:
- `AuthContext.tsx` → `ClerkProvider` + `useUser`/`useAuth` (replace `signIn`/`signUp`/`signOut`).
- `Login.tsx` / `Signup.tsx` → Clerk `<SignIn />` / `<SignUp />` components.
- Every page's `supabase.from(...).select/insert/update/delete` → `api.get/post/put/delete('/...')`.
- `src/lib/supabase.ts` → a thin `api` fetch wrapper pointing at the Render backend.

## 4. Unavoidable schema changes (the brief said "same schema" — this is the exception)

Swapping Supabase Auth → Clerk forces identity changes, because Clerk user IDs are strings
(`user_…`), not the Supabase `auth.users` UUIDs:
- `profiles.id` (`uuid references auth.users(id)`) → `text` (Clerk user id), drop the FK.
- Every `user_id uuid references auth.users(id)` column (~29 tables) → `text`, drop FKs.
- Drop the `handle_new_user` trigger; profile creation → Clerk webhook.
- Drop all 34 RLS policies + `ENABLE ROW LEVEL SECURITY` (Render has no RLS).
- Keep the 11 functions (or port the INVOKER ones to JS in Express; keep DEFINER ones as SQL).

## 5. Data-migration decision (MUST answer before Phase 2)

Existing rows are keyed by **old Supabase user UUIDs**; Clerk users get **new IDs**. Options:
- **(a) Preserve:** store each user's old Supabase UUID as a Clerk `external_id`/metadata, and
  re-key existing data (one-time UPDATE) — keeps the 5 existing accounts + their data.
- **(b) Fresh start:** wipe/migrate structure only, recreate users in Clerk — loses the small
  amount of test data (5 profiles, ~51 activity logs, a few products/transactions).
Data volume is tiny now, so either is feasible; the choice affects Phase 2.

## 6. Honest scope & risk

This is a **full backend rewrite + large frontend refactor**, on the order of **weeks of focused
work**, not days. Highest risks: (1) re-implementing 34 RLS rules in Express without missing one
(data leak); (2) porting 21 functions' exact behavior (esp. `ai-assistant`, `campaign-send`,
`integrations-api`); (3) rewriting ~30 frontend files; (4) the auth identity-type change rippling
through every table; (5) re-scheduling cron jobs. Each phase must be verified feature-by-feature.

Note: if the *only* driver is the current Supabase Auth outage, a Supabase-support fix would restore
service far faster. If the decision is to leave Supabase for reliability/vendor reasons, the scope
above is accurate.

## 7. Decisions needed from you before Phase 2
1. Preserve existing user data (5a) or fresh start (5b)?
2. `user_id` strategy: change column type `uuid→text`, or add a `clerk_id` column + keep uuid?
3. ORM: raw `pg` / **Prisma** / Drizzle? (Prisma recommended for safety/speed.)
4. Have you / will you create: **Clerk app**, **Render web service + Postgres**, **Cloudflare R2 bucket + API token**? (These need your dashboard access — I'll give exact values to enter.)
5. Express API base URL / domain + CORS allow-list for the Vercel frontend?

## 8. Preview of Phase 2 deliverables (after approval)
- Render Build/Start commands, Root Dir, full env-var name list (DB, Clerk keys, R2, Gemini keys,
  Resend, Google/Canva/WhatsApp secrets, Stripe, APP_URL).
- Vercel env changes (`VITE_API_URL`, Clerk publishable key; remove Supabase vars).
- Migration SQL (schema with type changes, functions, indexes; data re-key).
- Express app: Clerk middleware + tenant-scoped data layer + 21 routes + cron.
- Frontend: ClerkProvider + api wrapper + rewritten pages.
