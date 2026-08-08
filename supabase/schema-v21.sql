-- ════════════════════════════════════════════════════════════════
-- schema-v21 — Performance linter fixes (RLS initplan + FK indexes + unused indexes)
-- Applied live to prwvaetatdidsugczluv. Atomic (DO block rolls back on error).
-- ════════════════════════════════════════════════════════════════

-- 1) auth_rls_initplan (WARN, ~27 tables): replace bare auth.uid() with
--    (select auth.uid()) in every RLS policy expression so Postgres plans
--    it once per query instead of per row.
DO $$
DECLARE
  r RECORD;
  nq text;  -- new qual expression
  nc text;  -- new check expression
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, p.polname AS pol, p.polcmd,
           pg_get_expr(p.polqual, p.polrelid) AS q,
           pg_get_expr(p.polwithcheck, p.polrelid) AS c
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        (pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid()%' AND
         pg_get_expr(p.polqual, p.polrelid) NOT LIKE '%select auth.uid()%')
        OR
        (pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid()%' AND
         pg_get_expr(p.polwithcheck, p.polrelid) NOT LIKE '%select auth.uid()%')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);

    nq := CASE WHEN r.q IS NOT NULL
      THEN replace(replace(r.q, 'auth.uid()', '(select auth.uid())'), '(select (select auth.uid()))', '(select auth.uid())')
      ELSE NULL END;
    nc := CASE WHEN r.c IS NOT NULL
      THEN replace(replace(r.c, 'auth.uid()', '(select auth.uid())'), '(select (select auth.uid()))', '(select auth.uid())')
      ELSE NULL END;

    IF r.polcmd = '*' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING %s WITH CHECK %s', r.pol, r.tbl, COALESCE(nq, 'true'), COALESCE(nc, 'true'));
    ELSIF r.polcmd = 'r' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING %s', r.pol, r.tbl, COALESCE(nq, 'true'));
    ELSIF r.polcmd = 'a' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK %s', r.pol, r.tbl, COALESCE(nc, 'true'));
    ELSIF r.polcmd = 'w' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING %s', r.pol, r.tbl, COALESCE(nq, 'true'));
    END IF;
  END LOOP;
END $$;

-- 2) unindexed_foreign_keys (INFO, 18 FKs): add covering indexes.
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_user_id ON public.campaign_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_data_entries_user_id ON public.data_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_user_id ON public.failed_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_user_id ON public.integration_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice_id ON public.invoice_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_user_id ON public.invoice_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON public.summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_user_id ON public.team_members(member_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions(customer_id);

-- 3) unused_index (INFO, 3): drop indexes that have never been used.
DROP INDEX IF EXISTS public.idx_corrections_user;
DROP INDEX IF EXISTS public.oauth_pending_user_id_idx;
DROP INDEX IF EXISTS public.change_requests_requester_idx;
