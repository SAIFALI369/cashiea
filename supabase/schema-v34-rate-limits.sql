-- ════════════════════════════════════════════════════════════════
-- Cashiea — schema v34: per-user burst rate limiting for AI functions
-- Idempotent — safe to re-run. Run in the Supabase SQL Editor (or
-- `supabase db execute`) before/with the edge-function deploy.
--
-- What it is:
--   A sliding-window request log backing the `checkRateLimit` helper used
--   by the expensive AI edge functions (ai-assistant, quick-tasks,
--   business-brain, meraj-tts — see _shared/rate-limit.ts). One atomic
--   RPC per request: purge expired rows, count the window, insert the new
--   hit (or report how long to wait). The daily AI quota remains the hard
--   ceiling; this only bounds one-minute bursts (compromised sessions,
--   stuck retry loops, abusive accounts).
--
-- Access model (fail-closed):
--   * RLS is enabled + forced with NO policies → only the service role
--     (edge functions) can touch this table. Clients can never read or
--     write it, and `check_rate_limit` is SECURITY DEFINER so the table's
--     own RLS applies to the function owner, not the caller.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.api_rate_limits (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  scope text not null,
  created_at timestamptz not null default now()
);

-- The hot query: "how many hits for this (user, scope) inside the window".
create index if not exists api_rate_limits_user_scope_idx
  on public.api_rate_limits (user_id, scope, created_at);

alter table public.api_rate_limits enable row level security;
alter table public.api_rate_limits force row level security;

-- Atomic sliding-window check. Returns (allowed, retry_after_seconds).
-- Concurrency note: two truly concurrent callers can both read count =
-- limit-1 and both insert, overshooting by a couple of requests. Acceptable
-- for cost protection (the daily quota is the hard ceiling); a strict token
-- bucket is not worth the lock traffic here.
create or replace function public.check_rate_limit(
  p_user_id uuid,
  p_scope text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count  integer;
  v_oldest timestamptz;
begin
  -- Keep the table small: the periodic purge (below) is the janitor, this
  -- keeps per-user rows bounded even if the janitor has not run yet.
  delete from public.api_rate_limits
   where user_id = p_user_id
     and scope = p_scope
     and created_at < v_cutoff;

  select count(*), min(created_at)
    into v_count, v_oldest
    from public.api_rate_limits
   where user_id = p_user_id
     and scope = p_scope
     and created_at >= v_cutoff;

  if coalesce(v_count, 0) >= p_limit then
    -- Wait until the oldest hit in the window slides out.
    return query
      select false,
             greatest(1, least(p_window_seconds,
               ceil(extract(epoch from (v_oldest + make_interval(secs => p_window_seconds) - now()))))::integer);
    return;
  end if;

  insert into public.api_rate_limits (user_id, scope)
  values (p_user_id, p_scope);

  return query select true, 0;
end;
$$;

revoke execute on function public.check_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid, text, integer, integer) to service_role;

-- Janitor: windows are ≤ 60s, so 10-minute retention is far beyond any
-- active window. Skipped (with a notice) when pg_cron is not installed.
do $$
begin
  begin
    if not exists (select 1 from cron.job where jobname = 'purge_api_rate_limits') then
      perform cron.schedule(
        'purge_api_rate_limits',
        '*/5 * * * *',
        'delete from public.api_rate_limits where created_at < now() - interval ''10 minutes'''
      );
    end if;
  exception when undefined_table then
    raise notice 'pg_cron extension not installed — skipping scheduled purge (each check self-purges its own user/scope rows)';
  end;
end
$$;
