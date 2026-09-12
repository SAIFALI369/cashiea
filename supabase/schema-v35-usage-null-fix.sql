create or replace function public.reserve_api_usage(
  p_user_id uuid,
  p_amount integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  usage_limit integer;
  profile_row public.profiles%rowtype;
begin
  if (select auth.role()) <> 'service_role' and not public.is_team_member(p_user_id) then
    raise exception 'Not authorised to reserve usage for this business';
  end if;
  if p_user_id is null or p_amount is null or p_amount < 1 or p_amount > 1000 then
    raise exception 'Invalid usage reservation';
  end if;
  select * into profile_row from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Usage owner not found'; end if;
  -- Bulletproof limit: NULL columns on brand-new profiles must never lock
  -- a new shop out of onboarding (the stuck-signup bug).
  usage_limit := coalesce(profile_row.api_usage_limit, 500);
  if profile_row.trial_ends_at > now() then
    usage_limit := greatest(usage_limit, 500);
  end if;
  update public.profiles
  set api_usage_count = coalesce(api_usage_count, 0) + p_amount, updated_at = now()
  where id = p_user_id and coalesce(api_usage_count, 0) + p_amount <= usage_limit;
  return found;
end;
$function$;
revoke execute on function public.reserve_api_usage(uuid,integer) from public, anon, authenticated;
grant execute on function public.reserve_api_usage(uuid,integer) to service_role;
