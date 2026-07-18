-- ════════════════════════════════════════════════════════════════
-- Schema v7 (Daily Brain cron + briefing opt-in) — run AFTER schema-v6
-- ════════════════════════════════════════════════════════════════

-- Opt-in flag for the daily morning briefing email (default: on)
alter table public.profiles add column if not exists daily_briefing boolean not null default true;

-- ─── pg_cron schedule for the daily-brain edge function ─────────
-- Runs at 7:00 AM server time daily. Requires the pg_cron extension.
-- The function call uses the service role key (set via a stored secret).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Store the service-role key for the cron job to call the function.
-- Replace the placeholder with your actual service role key, then run.
-- (We keep this as a manual step so the key isn't in source control.)
-- CREATE OR REPLACE FUNCTION public._run_daily_brain() RETURNS void
-- AS $$
-- DECLARE
--   req_url text;
-- BEGIN
--   req_url := current_setting('app.functions_url') || '/daily-brain';
--   PERFORM net.http_post(
--     url := req_url,
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body := jsonb_build_object('opted_in_only', true)
--   );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule: 7:00 AM daily
-- SELECT cron.schedule(
--   'daily-brain',
--   '0 7 * * *',
--   $$SELECT cron.alter_job(job_id, database := 'postgres');$$
-- );
-- NOTE: The exact scheduling syntax depends on your Supabase version.
-- Easiest path: use the Supabase Dashboard → Database → Scheduled Functions,
-- or run from the edge function with a separate scheduler service.
