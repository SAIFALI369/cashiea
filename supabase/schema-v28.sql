-- ══════════════════════════════════════════════════════════════════════
-- Cashiea schema v28 — Supabase Security Advisor remediation (2026-09-05)
--
-- Fixes linter warnings:
--   0028  anon_security_definer_function_executable          (3 functions)
--   0029  authenticated_security_definer_function_executable (12 functions)
--
-- What changed:
--   1. generate_recurring_invoices / mark_overdue_invoices:
--      PUBLIC, anon AND authenticated can no longer execute them. They are
--      scheduled by pg_cron (which runs as `postgres`, the function owner)
--      and remain callable by service_role. Direct /rest/v1/rpc calls are
--      refused with permission denied / 404.
--   2. get_dashboard_stats: anon can no longer execute it. It stays
--      executable by authenticated (Dashboard calls it via supabase.rpc)
--      and service_role, and now authorizes the caller in the body.
--   3. can_create_customer: no RLS policy references it and no client code
--      calls it — authenticated EXECUTE removed (service_role keeps it).
--   4. get_dashboard_stats now raises `Not authorised to view these stats`
--      unless the caller is the business owner, an ACTIVE team member of
--      that business, or the service role. Previously ANY signed-in user
--      could pass another business's uuid and read its dashboard numbers
--      (cross-tenant information leak).
--
-- What deliberately did NOT change (and why):
--   * is_business_owner, is_team_member, can_manage_customer and
--     can_direct_capability keep EXECUTE for `authenticated`: they are
--     referenced inside ~100 RLS policies, and PostgreSQL checks EXECUTE
--     during policy evaluation for the querying role. Verified live: with
--     the grant revoked, an authenticated SELECT fails with
--     `permission denied for function is_team_member`. Their 0029 warnings
--     are therefore by design and safe (all are boolean helpers with
--     pinned search_path).
--   * complete_sale, void_sale, restock_product, update_onboarding_step
--     keep EXECUTE for `authenticated`: they are the app's RPC surface.
--     Each already validates the caller internally (auth.uid() /
--     can_direct_capability / is_business_owner checks) and pins
--     search_path = public.
--   * set_updated_at is SECURITY INVOKER, so lint 0028/0029 do not apply.
--
-- Auth-service changes made alongside (dashboard / Management API, not SQL):
--   * Broken custom SMTP (smtp_host "Cashiea.vercel/vercel.com") was reset
--     to Supabase's built-in email — it had been returning HTTP 500
--     "Error sending confirmation email" for every signup. Custom branded
--     templates are kept; only the transport reverted.
--   * site_url corrected from http://localhost:3000 to
--     https://cashiea.vercel.app, plus redirect allow-list entry.
--   * password_hibp_enabled (leaked-password protection) is Pro-plan only,
--     left disabled on the free plan.
-- ══════════════════════════════════════════════════════════════════════

-- 1) Lint 0028: the signed-out (anon) role must not run SECURITY DEFINER code.
--    Lint 0029 for the two cron-only functions: signed-in users must not either.
REVOKE EXECUTE ON FUNCTION public.generate_recurring_invoices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_invoices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_create_customer(uuid) FROM authenticated;

-- 2) Re-grant explicitly to the roles that legitimately call them.
--    (postgres, the owner, always retains EXECUTE — pg_cron jobs run as postgres.)
GRANT EXECUTE ON FUNCTION public.generate_recurring_invoices() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_overdue_invoices() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated, service_role;

-- 3) Cross-tenant authorization inside get_dashboard_stats.
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  result jsonb;
  week_start date := (date_trunc('week', now()))::date;
begin
  -- Cashiea security fix (schema v28): only the business owner, an active team
  -- member of that business, or the service role may read these stats.
  -- Previously any signed-in user could read any other business's numbers.
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;
  if (select auth.role()) <> 'service_role'
     and (
       (select auth.uid()) is null
       or (
         (select auth.uid()) <> target_user_id
         and not public.is_team_member(target_user_id)
       )
     ) then
    raise exception 'Not authorised to view these stats';
  end if;

  select jsonb_build_object(
    'sales_today', coalesce((select sum(total) from transactions where user_id = target_user_id and status = 'completed' and created_at >= date_trunc('day', now())), 0),
    'sales_yesterday', coalesce((select sum(total) from transactions where user_id = target_user_id and status = 'completed' and created_at >= date_trunc('day', now()) - interval '1 day' and created_at < date_trunc('day', now())), 0),
    'pending_count', coalesce((select count(*) from invoices where user_id = target_user_id and status in ('sent','viewed','partial','overdue')), 0),
    'pending_sum', coalesce((select sum(total) from invoices where user_id = target_user_id and status in ('sent','viewed','partial','overdue')), 0),
    'overdue', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'invoice_number', invoice_number, 'client_name', client_name, 'total', total, 'due_date', due_date) order by total desc) from (select * from invoices where user_id = target_user_id and status = 'overdue' order by total desc limit 5) sub), '[]'::jsonb),
    'low_stock_count', coalesce((select count(*) from products where user_id = target_user_id and stock_quantity <= low_stock_threshold), 0),
    'unread_messages', coalesce((select count(*) from whatsapp_messages where user_id = target_user_id and direction = 'inbound' and created_at >= now() - interval '1 day'), 0),
    'pending_orders', coalesce((select count(*) from quotations where user_id = target_user_id and status = 'sent'), 0),
    'active_staff', coalesce((select count(*) from team_members where user_id = target_user_id and status = 'active'), 0),
    'week_sales_total', coalesce((select sum(total) from transactions where user_id = target_user_id and status = 'completed' and created_at >= week_start), 0),
    'week_expenses', coalesce((select sum(amount) from expenses where user_id = target_user_id and type = 'expense' and date >= week_start), 0),
    'week_daily', coalesce((select jsonb_agg(jsonb_build_object('amount', day_total) order by d) from (
      select d::int, coalesce((select sum(total) from transactions where user_id = target_user_id and status = 'completed' and created_at >= week_start + d and created_at < week_start + d + 1), 0) as day_total
      from generate_series(0, 6) d
    ) daily), '[]'::jsonb)
  ) into result;
  return result;
end;
$function$;
