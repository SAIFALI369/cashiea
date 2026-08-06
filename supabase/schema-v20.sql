-- ════════════════════════════════════════════════════════════════
-- schema-v20 — Security/hygiene linter fixes (new project)
-- Applied live to prwvaetatdidsugczluv. Safe to re-run.
-- ════════════════════════════════════════════════════════════════

-- 1) rls_enabled_no_policy (oauth_pending): it's a service-role-only PKCE store.
--    RLS stays enabled; this policy documents intent and satisfies the lint.
--    service_role bypasses RLS; client roles never match → denied.
drop policy if exists "service_role only" on public.oauth_pending;
create policy "service_role only" on public.oauth_pending
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 2) function_search_path_mutable (set_updated_at): lock the search_path.
alter function public.set_updated_at() set search_path = public;

-- 3) anon + authenticated can execute SECURITY DEFINER log_integration_event.
--    Callers (integrations-api via user JWT, google-oauth via service role) pass
--    their own user_id, so RLS permits the audit insert → switch to INVOKER and
--    restrict EXECUTE to authenticated (clears both definer lints).
alter function public.log_integration_event(uuid, text, text, text, text, jsonb) security invoker;
revoke execute on function public.log_integration_event(uuid, text, text, text, text, jsonb) from public;
revoke execute on function public.log_integration_event(uuid, text, text, text, text, jsonb) from anon;
grant execute on function public.log_integration_event(uuid, text, text, text, text, jsonb) to authenticated;
