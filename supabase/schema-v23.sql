-- ════════════════════════════════════════════════════════════════
-- schema-v23 — Shared-business multi-user foundation
-- Enables team members (invited by the owner) to access the owner's
-- business data through team-aware RLS.
-- ════════════════════════════════════════════════════════════════

-- 1) Add business_owner_id to profiles (null for owners = they ARE the owner).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) is_team_member(target_user_id) — SECURITY DEFINER so it can read team_members
--    (which has owner-only RLS). Returns true if the current user is the owner
--    OR an active team member of that owner.
CREATE OR REPLACE FUNCTION public.is_team_member(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (select auth.uid()) = target_user_id
    OR EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = target_user_id
        AND member_user_id = (select auth.uid())
        AND status = 'active'
    )
$$;

-- Revoke public execute (only roles that already have table access should call it).
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;

-- 3) Update RLS on ALL user_id-keyed tables to use is_team_member.
--    This makes team members' queries resolve: they can SEE and MANAGE the
--    owner's rows (the approval system handles what actions need owner sign-off).
--    profiles uses `id` not `user_id` — it stays as-is (each person manages
--    their own profile). oauth_pending + change_requests have custom policies.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, p.polname AS pol, p.polcmd,
           pg_get_expr(p.polqual, p.polrelid) AS q,
           pg_get_expr(p.polwithcheck, p.polrelid) AS chk
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname NOT IN ('profiles', 'oauth_pending', 'change_requests')
      AND (
        pg_get_expr(p.polqual, p.polrelid) LIKE '%user_id%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%user_id%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    IF r.polcmd = '*' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_team_member(user_id)) WITH CHECK (public.is_team_member(user_id))',
        r.pol, r.tbl
      );
    ELSIF r.polcmd = 'r' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_team_member(user_id))',
        r.pol, r.tbl
      );
    ELSIF r.polcmd = 'a' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_team_member(user_id))',
        r.pol, r.tbl
      );
    ELSIF r.polcmd = 'w' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_team_member(user_id))',
        r.pol, r.tbl
      );
    END IF;
  END LOOP;
END $$;
