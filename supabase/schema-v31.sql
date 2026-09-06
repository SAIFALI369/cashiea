-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v31 — Meraj Autopilot schedules (2026-09-06)
--
-- Three pg_cron jobs driving the meraj-autopilot edge function:
--   meraj-briefing  02:30 UTC (08:00 IST) — morning plan + auto-drafted PO
--   meraj-reminders 04:00 UTC (09:30 IST) — policy-gated payment reminders
--   meraj-recap     15:30 UTC (21:00 IST) — evening recap
--
-- Policies are stored per business in business_memory.preferences.autopilot
-- (owner-editable from Meraj's Plan page; the Owner-manages-business-memory
-- RLS policy already covers it).
-- ════════════════════════════════════════════════════════════════

SELECT cron.schedule('meraj-briefing', '30 2 * * *', $$
  select net.http_post(url := 'https://prwvaetatdidsugczluv.functions.supabase.co/meraj-autopilot?job=briefing',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='cron_service_role_key')),
    body := '{}'::jsonb);
$$);

SELECT cron.schedule('meraj-reminders', '0 4 * * *', $$
  select net.http_post(url := 'https://prwvaetatdidsugczluv.functions.supabase.co/meraj-autopilot?job=reminders',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='cron_service_role_key')),
    body := '{}'::jsonb);
$$);

SELECT cron.schedule('meraj-recap', '30 15 * * *', $$
  select net.http_post(url := 'https://prwvaetatdidsugczluv.functions.supabase.co/meraj-autopilot?job=recap',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='cron_service_role_key')),
    body := '{}'::jsonb);
$$);
