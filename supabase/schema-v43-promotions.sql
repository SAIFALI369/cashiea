-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v43 — Promotions (BOGO / tiered / percent, scheduled).
--
-- Closes the "Shopify dynamic discounting" gap: owner-configured deal
-- rules with an active date window that the POS evaluates
-- deterministically at cart time. Discounts ride the EXISTING
-- validated fields (per-line line_discount + cart discount with a
-- reason), so complete_sale's server-side maths and audit trail stay
-- untouched — a promotion can never produce an unbalanced sale.
--
-- Rule shapes (config jsonb):
--   bogo    { productId?, category?, buy, get, discountPct }
--           — buy N of a product/category, get M at discountPct% off
--   tiered  { tiers: [{ minSpend, pct }, ...] }
--           — best matching spend tier applies to the cart
--   percent { pct, maxDiscount? }
--           — flat % off the cart (optional cap)
--
-- Harmlessness rules baked into the design:
--   * Rules never stack at the cart level — the best single cart deal
--     wins (predictable for the cashier and the customer).
--   * BOGO line discounts may combine with one cart-level deal, but
--     the total discount is capped at the cart's value.
--   * Everything is owner-configured; cashiers see exactly which deal
--     applied on the receipt (discount reason carries the rule name).
--
-- Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('bogo', 'tiered', 'percent')),
  config jsonb not null default '{}',
  /** Inclusive active window; null = open-ended on that side. */
  starts_at date,
  ends_at date,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.promotions enable row level security;
drop policy if exists "owner manages promotions" on public.promotions;
create policy "owner manages promotions" on public.promotions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_promotions_user on public.promotions (user_id, created_at desc);
