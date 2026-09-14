-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v41 — Loyalty program (points + ledger + earn trigger).
--
-- Closes the "Square Loyalty / KORONA loyalty ecosystem" gap in the
-- kirana-native way: points earned automatically on every completed
-- sale with a customer attached, a full ledger (auditable, adjustable),
-- tiers for display/perks, and redemption at the POS as a cart discount
-- backed by an idempotent RPC.
--
-- Safety model:
--   * OFF by default (loyalty_program.enabled = false) — the owner
--     switches it on from the Customers page.
--   * Earning happens in a AFTER INSERT trigger on transactions — the
--     audited complete_sale body is NOT modified; the trigger only
--     fires for status='completed' rows with a customer, once per
--     transaction id (partial unique index).
--   * customers.loyalty_points (a stub column since schema v4) becomes
--     the cached balance, maintained only by the trigger + RPC.
--   * Redemption deducts points FIRST inside one transaction and is
--     idempotent by ref (receipt number) so an offline replay can never
--     double-deduct.
--
-- Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Program settings (one row per business) ──────────────────
create table if not exists public.loyalty_program (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  /** Points earned per ₹100 spent. */
  points_per_100 numeric(8,2) not null default 1,
  /** Rupees one point redeems to. */
  point_value numeric(8,2) not null default 0.50,
  /** Minimum points per redemption. */
  min_redeem_points integer not null default 20,
  updated_at timestamptz not null default now(),
  constraint loyalty_points_per_100_sane check (points_per_100 >= 0 and points_per_100 <= 1000),
  constraint loyalty_point_value_sane check (point_value >= 0 and point_value <= 100),
  constraint loyalty_min_redeem_sane check (min_redeem_points >= 0 and min_redeem_points <= 100000)
);

alter table public.loyalty_program enable row level security;
drop policy if exists "owner manages own loyalty program" on public.loyalty_program;
create policy "owner manages own loyalty program" on public.loyalty_program
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 2. Ledger — every point movement, forever ────────────────────
create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  /** + earn / − redeem / ± adjust (owner correction). */
  points integer not null,
  kind text not null check (kind in ('earn', 'redeem', 'adjust')),
  /** The sale that earned the points (earn rows). */
  transaction_id uuid,
  /** Idempotency key for redeems — the receipt number. */
  ref text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.loyalty_ledger enable row level security;
drop policy if exists "owner manages own loyalty ledger" on public.loyalty_ledger;
create policy "owner manages own loyalty ledger" on public.loyalty_ledger
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_loyalty_ledger_user_customer
  on public.loyalty_ledger (user_id, customer_id, created_at desc);

-- One earn per transaction, one redeem per receipt.
create unique index if not exists uq_loyalty_earn_per_txn
  on public.loyalty_ledger (user_id, transaction_id)
  where kind = 'earn' and transaction_id is not null;
create unique index if not exists uq_loyalty_redeem_per_ref
  on public.loyalty_ledger (user_id, ref)
  where kind = 'redeem' and ref is not null;

-- ── 3. Earn trigger (fires after complete_sale commits the row) ──
create or replace function public.handle_loyalty_earn()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  prog public.loyalty_program%rowtype;
  pts integer;
  affected integer;
begin
  if new.status <> 'completed' or new.customer_id is null then
    return null;
  end if;
  select * into prog from public.loyalty_program
    where user_id = new.user_id and enabled;
  if not found then
    return null;
  end if;
  pts := floor(new.total / 100.0 * prog.points_per_100);
  if pts is null or pts <= 0 then
    return null;
  end if;
  insert into public.loyalty_ledger (user_id, customer_id, points, kind, transaction_id, note)
  values (new.user_id, new.customer_id, pts, 'earn', new.id, 'Earned on sale')
  on conflict do nothing;
  get diagnostics affected = row_count;
  -- The cache moves only when this row actually earned (a replayed
  -- transaction id skips both halves together).
  if affected = 1 then
    update public.customers
      set loyalty_points = coalesce(loyalty_points, 0) + pts
      where id = new.customer_id and user_id = new.user_id;
  end if;
  return null;
end;
$function$;

drop trigger if exists on_transaction_loyalty_earn on public.transactions;
create trigger on_transaction_loyalty_earn
  after insert on public.transactions
  for each row execute function public.handle_loyalty_earn();

-- ── 4. Redemption RPC — idempotent, balance-checked ─────────────
-- Returns { ok, points, value } in rupees, or { ok: false, error }.
create or replace function public.redeem_loyalty_points(
  p_owner_id uuid,
  p_customer_id uuid,
  p_points integer,
  p_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  caller uuid := auth.uid();
  member_of boolean;
  prog public.loyalty_program%rowtype;
  cust public.customers%rowtype;
  existing_points integer;
  affected integer;
begin
  if caller is null or p_owner_id is null or p_customer_id is null then
    return jsonb_build_object('ok', false, 'error', 'Not authorised');
  end if;

  -- The caller must be the owner or a member of this business.
  select exists (
    select 1 from public.profiles p
    where p.id = caller and (p.id = p_owner_id or p.business_owner_id = p_owner_id)
  ) into member_of;
  if not member_of then
    return jsonb_build_object('ok', false, 'error', 'Not authorised');
  end if;

  select * into prog from public.loyalty_program where user_id = p_owner_id;
  if not found or not prog.enabled then
    return jsonb_build_object('ok', false, 'error', 'Loyalty is not enabled');
  end if;
  if p_points is null or p_points <= 0 or p_points > 10000000 then
    return jsonb_build_object('ok', false, 'error', 'Invalid points amount');
  end if;
  if p_points < prog.min_redeem_points then
    return jsonb_build_object('ok', false, 'error', 'Minimum ' || prog.min_redeem_points || ' points per redemption');
  end if;

  select * into cust from public.customers
    where id = p_customer_id and user_id = p_owner_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Customer not found');
  end if;

  -- Idempotent replay: same ref returns the original redemption value.
  select points into existing_points from public.loyalty_ledger
    where user_id = p_owner_id and kind = 'redeem' and ref = p_ref
    limit 1;
  if existing_points is not null then
    return jsonb_build_object('ok', true, 'points', -existing_points, 'value', round(-existing_points * prog.point_value, 2), 'duplicate', true);
  end if;

  if coalesce(cust.loyalty_points, 0) < p_points then
    return jsonb_build_object('ok', false, 'error', 'Not enough points — balance is ' || coalesce(cust.loyalty_points, 0));
  end if;

  insert into public.loyalty_ledger (user_id, customer_id, points, kind, ref, note)
  values (p_owner_id, p_customer_id, -p_points, 'redeem', nullif(trim(coalesce(p_ref, '')), ''), 'Redeemed at POS')
  on conflict do nothing;
  get diagnostics affected = row_count;
  if affected = 1 then
    update public.customers
      set loyalty_points = loyalty_points - p_points
      where id = p_customer_id and user_id = p_owner_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'points', p_points,
    'value', round(p_points * prog.point_value, 2)
  );
end;
$function$;

revoke execute on function public.redeem_loyalty_points(uuid, uuid, integer, text) from public, anon;
grant execute on function public.redeem_loyalty_points(uuid, uuid, integer, text) to authenticated;
