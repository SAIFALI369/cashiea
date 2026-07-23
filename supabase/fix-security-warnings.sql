-- ════════════════════════════════════════════════════════════════
-- SECURITY FIXES — paste this in Supabase SQL Editor and Run once.
-- Resolves ALL linter warnings:
--   1. function_search_path_mutable (set_updated_at)
--   2. anon_security_definer_function_executable (all functions)
--   3. authenticated_security_definer_function_executable (service-only fns)
-- ════════════════════════════════════════════════════════════════

-- ══ FIX 1: function_search_path_mutable ══
-- Recreate set_updated_at with a locked search_path
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ══ FIX 2: Revoke EXECUTE from anon (public/unauthenticated) ══
-- NONE of these functions should be callable without signing in.
revoke execute on function public.set_updated_at() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.increment_api_usage(uuid) from anon;
revoke execute on function public.reset_monthly_usage() from anon, authenticated;
revoke execute on function public.grant_trial(uuid) from anon;
revoke execute on function public.decrement_stock(uuid, integer) from anon;
revoke execute on function public.recompute_customer_stats(uuid) from anon, authenticated;
revoke execute on function public.recompute_supplier_outstanding(uuid) from anon, authenticated;
revoke execute on function public.sync_campaign_stats(uuid) from anon, authenticated;
revoke execute on function public.update_onboarding_step(integer, jsonb) from anon;
revoke execute on function public.log_integration_event(uuid, text, text, text, text, jsonb) from anon, authenticated;

-- Drop the auto-generated rls_auto_enable if it exists (not needed)
drop function if exists public.rls_auto_enable() cascade;

-- ══ FIX 3: Revoke EXECUTE from authenticated for service-role-only functions ══
-- These are called ONLY by edge functions (service role), never by the client.
-- The client calls them via the edge function which uses the service role key.
revoke execute on function public.increment_api_usage(uuid) from authenticated;
revoke execute on function public.decrement_stock(uuid, integer) from authenticated;
revoke execute on function public.sync_campaign_stats(uuid) from authenticated;

-- ══ KEEP: These ARE called by authenticated users (client-side via RPC) ══
-- grant_trial — called after signup (client → RPC)
-- update_onboarding_step — called during onboarding wizard (client → RPC)
-- These stay executable by authenticated only (already revoked from anon above).

-- ══ VERIFY: Confirm anon can't execute anything sensitive ══
-- After running this, the warnings should disappear on next linter run.
