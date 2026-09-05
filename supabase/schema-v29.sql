-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v29 — honest dashboard math (2026-09-06)
--
-- Extends get_dashboard_stats (v28) with two keys the Dashboard now uses:
--   • week_income         — income-type accounts entries this week. The
--                           Dashboard "Profit" figure becomes
--                           sales + other income − expenses instead of
--                           quietly ignoring recorded income.
--   • week_expenses_daily — per-day expense buckets (Mon–Sun) so the
--                           weekly chart's expense bars show real data
--                           instead of permanent zero-stubs.
--
-- Nothing else changes. The v28 caller-authorization check (owner /
-- active team member / service_role only) is retained verbatim.
-- ════════════════════════════════════════════════════════════════

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
    'week_income', coalesce((select sum(amount) from expenses where user_id = target_user_id and type = 'income' and date >= week_start), 0),
    'week_daily', coalesce((select jsonb_agg(jsonb_build_object('amount', day_total) order by d) from (
      select d::int, coalesce((select sum(total) from transactions where user_id = target_user_id and status = 'completed' and created_at >= week_start + d and created_at < week_start + d + 1), 0) as day_total
      from generate_series(0, 6) d
    ) daily), '[]'::jsonb),
    'week_expenses_daily', coalesce((select jsonb_agg(jsonb_build_object('amount', day_total) order by d) from (
      select d::int, coalesce((select sum(amount) from expenses where user_id = target_user_id and type = 'expense' and date >= week_start + d and date < week_start + d + 1), 0) as day_total
      from generate_series(0, 6) d
    ) daily), '[]'::jsonb)
  ) into result;
  return result;
end;
$function$;
