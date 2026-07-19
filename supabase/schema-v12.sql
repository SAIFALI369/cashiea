-- ════════════════════════════════════════════════════════════════
-- Schema v12 (Daily Reports job) — run AFTER schema-v11
-- Adds: daily_reports, failed_jobs, report_time_utc on profiles
-- ════════════════════════════════════════════════════════════════

-- ─── Owner-configurable report time (UTC HH:MM, default 17:00 = 22:30 IST) ─
alter table public.profiles add column if not exists report_time_utc text not null default '17:00';
alter table public.profiles add column if not exists report_timezone text not null default 'Asia/Kolkata';
-- Allow 'cancelled' as a plan_tier so the job filter is meaningful
alter table public.profiles drop constraint if exists profiles_plan_tier_check;
alter table public.profiles add constraint profiles_plan_tier_check
  check (plan_tier in ('free', 'trial', 'paid', 'cancelled'));

-- ─── DAILY REPORTS (one per shop per day) ───────────────────────
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  total_revenue numeric(12,2) not null default 0,
  transaction_count integer not null default 0,
  top_items jsonb not null default '[]'::jsonb,        -- [{name, qty, revenue}]
  payment_breakdown jsonb not null default '{}'::jsonb,-- {cash: 60, upi: 30, card: 10}
  message_text text,
  status text not null default 'pending' check (status in ('pending','sent','failed','retry')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

alter table public.daily_reports enable row level security;
create policy "Owner can view daily reports" on public.daily_reports
  for select using (auth.uid() = user_id);

-- One report per shop per day (the job uses this to avoid dupes)
create unique index if not exists daily_reports_user_date_unique
  on public.daily_reports (user_id, report_date);

create index if not exists idx_daily_reports_status on public.daily_reports (status, report_date);

-- ─── FAILED JOBS (Task 8 referenced — needed now for retry logging) ──
create table if not exists public.failed_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,                              -- 'daily_report', 'reminder', etc.
  user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,          -- enough to retry
  error text,
  retry_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending','retried','dead')),
  last_attempted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.failed_jobs enable row level security;
create policy "Owner can view failed jobs" on public.failed_jobs
  for select using (auth.uid() = user_id);

create index if not exists idx_failed_jobs_status on public.failed_jobs (status, created_at desc);

-- ─── pg_cron schedule: run the daily-reports function every 30 min ─
-- It self-filters to shops whose report_time_utc matches the current slot
-- AND haven't received today's report yet.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- NOTE: scheduling requires your service-role key as a named setting.
-- Run these manually ONCE after deploy (replace $KEY):
--   alter database current_database() set app.service_role_key to '$KEY';
--   alter database current_database() set app.functions_url to 'https://<proj>.functions.supabase.co';
--   select cron.schedule('daily-reports', '*/30 * * * *',
--     $$ select net.http_post(
--          url := current_setting('app.functions_url') || '/daily-reports',
--          headers := jsonb_build_object('Content-Type','application/json',
--                    'Authorization','Bearer '||current_setting('app.service_role_key')),
--          body := '{}'::jsonb) $$);
