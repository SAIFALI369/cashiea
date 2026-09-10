-- ════════════════════════════════════════════════════════════════
-- Cashiea — schema v33: client_errors (front-end error telemetry)
-- Idempotent — safe to re-run. Run in Supabase SQL Editor (or via
-- `supabase db execute`) before/with the v33 deploy.
--
-- What it is:
--   A sink for structured client-side error reports from
--   src/lib/errorTracking.ts (uncaught errors, unhandled rejections,
--   ErrorBoundary crashes). Rows carry a per-browser session id (random,
--   not PII), the correlation request id, the page path and truncated
--   message/stack. `user_id` is only set when the visitor was signed in,
--   so support can correlate a report with a business.
--
-- Access model (fail-closed):
--   * INSERT: authenticated users only for their own row; anonymous
--     visitors may insert rows with user_id NULL (pre-signup crashes are
--     the ones we most need to see). Columns are constrained so a report
--     cannot smuggle arbitrary data in.
--   * SELECT/UPDATE/DELETE: no policy → only the service role can read
--     or manage the table. There is deliberately no UI for it.
--
-- Retention: add a scheduled cleanup (Sprint A of docs/PRODUCTION_AUDIT.md):
--   create extension if not exists pg_cron;
--   select cron.schedule('purge-client-errors', '0 4 * * *',
--     $$delete from public.client_errors where created_at < now() - interval '60 days'$$);
-- ════════════════════════════════════════════════════════════════

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  session_id text not null check (char_length(session_id) between 4 and 64),
  request_id text check (request_id is null or char_length(request_id) <= 32),
  user_id uuid,
  page_path text check (page_path is null or char_length(page_path) <= 200),
  error_type text not null check (error_type in ('uncaught', 'rejection', 'boundary', 'console', 'auth', 'app')),
  message text not null check (char_length(message) <= 520),
  stack text check (stack is null or char_length(stack) <= 4200),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Index for "what is broken right now" queries (most recent per type/page)
create index if not exists client_errors_created_idx
  on public.client_errors (created_at desc);
create index if not exists client_errors_user_idx
  on public.client_errors (user_id, created_at desc)
  where user_id is not null;

alter table public.client_errors enable row level security;
alter table public.client_errors force row level security;

drop policy if exists "client_errors_insert_own" on public.client_errors;
create policy "client_errors_insert_own"
  on public.client_errors for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "client_errors_insert_anon" on public.client_errors;
create policy "client_errors_insert_anon"
  on public.client_errors for insert
  to anon
  with check (user_id is null);

-- No select/update/delete policies: readable/manageable by service_role only.
