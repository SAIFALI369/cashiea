-- v36: free-tier AI policy + onboarding can never trap or meter

-- 1. update_onboarding_step: step 4 = skip/complete (was: raised 'Unknown step')
create or replace function public.update_onboarding_step(step integer, data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  next_phone text;
  next_time text;
begin
  if (select auth.uid()) is null or not public.is_business_owner((select auth.uid())) then
    raise exception 'Only the business owner can complete onboarding';
  end if;
  if data is null then data := '{}'::jsonb; end if;
  if step = 1 then
    if nullif(trim(coalesce(data->>'shop_category','')), '') is null
       or length(data->>'shop_category') > 120 then
      raise exception 'A valid shop category is required';
    end if;
    update public.profiles
    set shop_category = left(trim(data->>'shop_category'), 120),
        onboarding_step = greatest(onboarding_step, 2), updated_at = now()
    where id = (select auth.uid());
  elsif step = 2 then
    update public.profiles
    set onboarding_step = greatest(onboarding_step, 3), updated_at = now()
    where id = (select auth.uid());
  elsif step = 3 then
    next_phone := nullif(trim(data->>'whatsapp_number'), '');
    next_time := coalesce(nullif(trim(data->>'report_time_utc'), ''), '17:00');
    if next_phone is not null and next_phone !~ '^\+?[0-9 ()-]{7,24}$' then
      raise exception 'WhatsApp number is invalid';
    end if;
    if next_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Report time is invalid';
    end if;
    update public.profiles
    set whatsapp_number = next_phone, report_time_utc = next_time,
        onboarding_step = greatest(onboarding_step, 4), updated_at = now()
    where id = (select auth.uid());
  elsif step = 4 then
    -- Skip / complete: never let a new shop owner be trapped in onboarding.
    update public.profiles
    set onboarding_step = 4, updated_at = now()
    where id = (select auth.uid());
  else
    raise exception 'Unknown onboarding step';
  end if;
end;
$function$;
revoke execute on function public.update_onboarding_step(integer,jsonb) from public, anon;
grant execute on function public.update_onboarding_step(integer,jsonb) to authenticated;

-- 2. Free tier: 14-day trial default + backfill NULLs (trial was silently broken)
alter table public.profiles alter column trial_ends_at set default (now() + interval '14 days');
update public.profiles set trial_ends_at = now() + interval '14 days' where trial_ends_at is null;

-- 3. reserve_api_usage: ALL AI features on free tier, 50 requests (trial window)
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
  -- Free tier: every AI feature, 50 requests across the 14-day trial.
  usage_limit := coalesce(profile_row.api_usage_limit, 50);
  if profile_row.trial_ends_at > now() then
    usage_limit := greatest(usage_limit, 50);
  end if;
  update public.profiles
  set api_usage_count = coalesce(api_usage_count, 0) + p_amount, updated_at = now()
  where id = p_user_id and coalesce(api_usage_count, 0) + p_amount <= usage_limit;
  return found;
end;
$function$;
revoke execute on function public.reserve_api_usage(uuid,integer) from public, anon, authenticated;
grant execute on function public.reserve_api_usage(uuid,integer) to service_role;
