-- ════════════════════════════════════════════════════════════════
-- Schema v11 (Auth + Onboarding flow) — run AFTER schema-v10
-- Adds: phone, shop_category, whatsapp_number, onboarding_step,
--       plan_tier='trial', and a trigger that fires on signup.
-- ════════════════════════════════════════════════════════════════

-- ─── New columns on profiles ────────────────────────────────────
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists shop_category text;
alter table public.profiles add column if not exists whatsapp_number text;
alter table public.profiles add column if not exists onboarding_step integer not null default 0;
alter table public.profiles add column if not exists role text not null default 'owner';
-- onboarding_step: 0=not started, 1=category, 2=items, 3=whatsapp, 4=done

-- ─── plan_tier replaces 'plan' for the trial concept ────────────
-- Keep plan as-is (free/starter/pro/enterprise) but add plan_tier
-- that distinguishes trial vs paid vs free.
alter table public.profiles add column if not exists plan_tier text not null default 'free'
  check (plan_tier in ('free', 'trial', 'paid'));

-- ─── handle_new_user trigger (rewritten to be authoritative) ────
-- This fires ON auth.users INSERT. It's the single source of truth for
-- new-profile creation — clients CANNOT skip or fake it.
-- Reads shop_name, phone from raw_user_meta_data (sent at signup).
-- Sets: role='owner', plan_tier='trial', trial_ends_at = now()+14d,
-- onboarding_step=1 (so the wizard starts at step 1 after login).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, company_name, phone,
    role, plan_tier, trial_ends_at, onboarding_step
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'phone',
    'owner',
    'trial',
    now() + interval '14 days',
    1   -- start onboarding at step 1 (category)
  )
  on conflict (id) do nothing;  -- safe if profile somehow already exists
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RPCs for the onboarding wizard ─────────────────────────────
-- update_onboarding_step: called after each wizard step completes.
-- Uses the user's JWT auth.uid() so it can't be faked for other users.
create or replace function public.update_onboarding_step(step integer, data jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if step = 1 then
    -- Shop category chosen
    update public.profiles
    set shop_category = data->>'shop_category',
        onboarding_step = greatest(onboarding_step, 2),
        updated_at = now()
    where id = auth.uid();
  elsif step = 2 then
    -- First 3 inventory items added (client also inserts into products table)
    update public.profiles
    set onboarding_step = greatest(onboarding_step, 3),
        updated_at = now()
    where id = auth.uid();
  elsif step = 3 then
    -- WhatsApp number + report time confirmed → onboarding done
    update public.profiles
    set whatsapp_number = data->>'whatsapp_number',
        report_time_utc = coalesce(data->>'report_time_utc', '17:00'),
        onboarding_step = 4,
        updated_at = now()
    where id = auth.uid();
  end if;
end;
$$;
