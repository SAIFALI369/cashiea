-- ════════════════════════════════════════════════════════════════
-- schema-v22 — Fix oauth_pending RLS + consolidate change_requests policies + FK indexes
-- Applied live to prwvaetatdidsugczluv.
-- ════════════════════════════════════════════════════════════════

-- 1) auth_rls_initplan (oauth_pending): wrap auth.role() in a subselect.
DROP POLICY IF EXISTS "service_role only" ON public.oauth_pending;
CREATE POLICY "service_role only" ON public.oauth_pending
  FOR ALL USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- 2) multiple_permissive_policies (change_requests): the FOR ALL owner policy
--    overlapped with the requester SELECT + INSERT policies for the same
--    role+action. Consolidate into exactly ONE policy per action.
DROP POLICY IF EXISTS "Owner manages their change requests" ON public.change_requests;
DROP POLICY IF EXISTS "Requester can create and read own" ON public.change_requests;
DROP POLICY IF EXISTS "Requester can insert" ON public.change_requests;

-- One SELECT policy (owner OR requester can read):
CREATE POLICY "Owner or requester can read" ON public.change_requests
  FOR SELECT TO authenticated USING ((select auth.uid()) = owner_user_id OR (select auth.uid()) = requester_id);
-- One INSERT policy (requester creates):
CREATE POLICY "Requester can insert" ON public.change_requests
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = requester_id);
-- One UPDATE policy (owner approves/denies):
CREATE POLICY "Owner can update" ON public.change_requests
  FOR UPDATE TO authenticated USING ((select auth.uid()) = owner_user_id);
-- One DELETE policy (owner denies = delete):
CREATE POLICY "Owner can delete" ON public.change_requests
  FOR DELETE TO authenticated USING ((select auth.uid()) = owner_user_id);

-- 3) unindexed_foreign_keys: add covering indexes for the 3 flagged FKs.
--    (These were dropped as "unused" in schema-v21 because the DB is empty —
--     but FK covering indexes are correct practice. They become "used" once
--     real data/traffic arrives. Keeping them is the right call.)
CREATE INDEX IF NOT EXISTS idx_ai_corrections_user_id ON public.ai_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester_id ON public.change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_oauth_pending_user_id ON public.oauth_pending(user_id);
