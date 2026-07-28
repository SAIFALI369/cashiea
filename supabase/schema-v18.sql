-- ════════════════════════════════════════════════════════════════
-- schema-v18 — Security linter fixes
-- Applied live via the Management API. Safe to re-run.
--
-- 1) public_bucket_allows_listing — drop the broad SELECT policy on the
--    public 'avatars' bucket. Public buckets serve object URLs without it,
--    so avatars still load; the bucket just can't be listed anymore.
-- 2) anon_security_definer_function_executable — revoke EXECUTE from anon
--    (PUBLIC) on every flagged SECURITY DEFINER function. None should be
--    callable without signing in.
-- 3) authenticated_security_definer_function_executable (trigger/cron fns) —
--    handle_new_user (auth trigger) and reset_monthly_usage (service-role
--    cron) must stay DEFINER, so they lose the authenticated grant instead.
-- 4) authenticated_security_definer_function_executable (client/user-JWT fns) —
--    switch SECURITY DEFINER -> SECURITY INVOKER. Each already operates only on
--    the caller's own rows (RLS: "Owner can manage …" on products/customers/
--    suppliers/profiles/campaigns/transactions/purchase_orders), so INVOKER keeps
--    them working for logged-in users AND removes the privilege-escalation surface
--    (a user can no longer pass a foreign id to touch someone else's data).
-- ════════════════════════════════════════════════════════════════

-- 1) Public bucket: remove the listing policy (object URLs still work)
drop policy if exists "avatars public read" on storage.objects;

-- 2) Revoke EXECUTE from anon on all flagged functions
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.reset_monthly_usage() from anon;
revoke execute on function public.grant_trial(uuid) from anon;
revoke execute on function public.increment_api_usage(uuid) from anon;
revoke execute on function public.decrement_stock(uuid, integer) from anon;
revoke execute on function public.recompute_customer_stats(uuid) from anon;
revoke execute on function public.recompute_supplier_outstanding(uuid) from anon;
revoke execute on function public.sync_campaign_stats(uuid) from anon;
revoke execute on function public.update_onboarding_step(integer, jsonb) from anon;

-- 3) Trigger/cron-only DEFINER functions: drop the authenticated grant
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.reset_monthly_usage() from authenticated;

-- 4) Client/user-JWT functions: DEFINER -> INVOKER (RLS-enforced, no escalation)
alter function public.decrement_stock(uuid, integer) security invoker;
alter function public.increment_api_usage(uuid) security invoker;
alter function public.recompute_customer_stats(uuid) security invoker;
alter function public.recompute_supplier_outstanding(uuid) security invoker;
alter function public.update_onboarding_step(integer, jsonb) security invoker;
alter function public.grant_trial(uuid) security invoker;
alter function public.sync_campaign_stats(uuid) security invoker;

-- 5) Lock down PUBLIC execute (anon + authenticated inherit it) and re-grant
--    authenticated ONLY to the functions the client calls with a logged-in JWT.
--    Without this, `revoke from anon` alone is ineffective (anon inherits PUBLIC).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.reset_monthly_usage() from public;
revoke execute on function public.grant_trial(uuid) from public;
revoke execute on function public.increment_api_usage(uuid) from public;
revoke execute on function public.decrement_stock(uuid, integer) from public;
revoke execute on function public.recompute_customer_stats(uuid) from public;
revoke execute on function public.recompute_supplier_outstanding(uuid) from public;
revoke execute on function public.sync_campaign_stats(uuid) from public;
revoke execute on function public.update_onboarding_step(integer, jsonb) from public;

grant execute on function public.grant_trial(uuid) to authenticated;
grant execute on function public.increment_api_usage(uuid) to authenticated;
grant execute on function public.decrement_stock(uuid, integer) to authenticated;
grant execute on function public.recompute_customer_stats(uuid) to authenticated;
grant execute on function public.recompute_supplier_outstanding(uuid) to authenticated;
grant execute on function public.sync_campaign_stats(uuid) to authenticated;
grant execute on function public.update_onboarding_step(integer, jsonb) to authenticated;
