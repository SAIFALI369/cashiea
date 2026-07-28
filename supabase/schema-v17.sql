-- ════════════════════════════════════════════════════════════════
-- schema-v17 — Supabase Database Linter fixes
-- Applied live via the Management API. Safe to re-run.
--
-- 1) WARN auth_rls_initplan — whatsapp_messages policies used bare
--    auth.uid(), which re-evaluates per row. Switch to (select auth.uid())
--    so Postgres plans it once per query.
-- 2) INFO unindexed_foreign_keys — oauth_pending.user_id FK had no index.
-- 3) INFO unused_index — drop 10 flagged single-column indexes that aren't
--    backing any current query (re-add if a feature needs them at scale).
-- ════════════════════════════════════════════════════════════════

-- 1) RLS init-plan fix
drop policy if exists "Owner can read own messages" on public.whatsapp_messages;
drop policy if exists "Owner can insert own messages" on public.whatsapp_messages;
create policy "Owner can read own messages" on public.whatsapp_messages
  for select using ((select auth.uid()) = user_id);
create policy "Owner can insert own messages" on public.whatsapp_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- 2) Cover the oauth_pending.user_id foreign key
create index if not exists oauth_pending_user_id_idx on public.oauth_pending(user_id);

-- 3) Drop unused indexes flagged by the linter
drop index if exists public.whatsapp_messages_from_idx;
drop index if exists public.idx_daily_reports_status;
drop index if exists public.idx_audit_logs_user;
drop index if exists public.idx_campaign_recipients_campaign_id;
drop index if exists public.idx_campaign_recipients_user_id;
drop index if exists public.idx_invoice_reminders_invoice_id;
drop index if exists public.idx_invoice_reminders_user_id;
drop index if exists public.idx_quotations_customer_id;
drop index if exists public.idx_team_members_member_user_id;
drop index if exists public.idx_transactions_customer_id;
