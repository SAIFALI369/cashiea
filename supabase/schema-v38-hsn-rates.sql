-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v38 — HSN/SAC → GST rate master.
--
-- GENERATED FILE — do not edit by hand.
-- Source of truth: src/lib/hsnRates.ts · regenerate with:
--   node scripts/generate-hsn-seed.mjs
--
-- Server-side companion to the client lookup: the AI assistant, edge
-- functions and any SQL can resolve "HSN 4820 → 0%" without shipping
-- the dataset in code. Rates reflect GST 2.0 (22 Sep 2025); changed
-- rows keep their legacy rate + effective date for old bills.
--
-- Access: read-only for authenticated users; writes are service-role
-- only (the dataset changes only through this migration).
--
-- Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.hsn_rates (
  code text primary key,
  kind text not null check (kind in ('hsn', 'sac')),
  description text not null,
  gst_rate numeric(5,2) not null,
  legacy_rate numeric(5,2),
  threshold numeric(12,2),
  alt_rate numeric(5,2),
  wef date,
  updated_at timestamptz not null default now()
);

alter table public.hsn_rates enable row level security;
alter table public.hsn_rates force row level security;

drop policy if exists "authenticated users read hsn rates" on public.hsn_rates;
create policy "authenticated users read hsn rates" on public.hsn_rates
  for select to authenticated using (true);
-- No insert/update/delete policies: rows change only via migration
-- (service role), never from a client.

-- Seed / refresh from the canonical dataset.
insert into public.hsn_rates (code, kind, description, gst_rate, legacy_rate, threshold, alt_rate, wef)
values
  ('01', 'hsn', 'Live animals', 0, null, null, null, null),
  ('02', 'hsn', 'Meat & edible offal', 0, null, null, null, null),
  ('03', 'hsn', 'Fish & seafood', 0, null, null, null, null),
  ('04', 'hsn', 'Dairy, eggs, honey (fresh milk, curd, paneer)', 0, 5, null, null, '2025-09-22'),
  ('0405', 'hsn', 'Butter & ghee', 5, 12, null, null, '2025-09-22'),
  ('0406', 'hsn', 'Cheese', 5, 12, null, null, '2025-09-22'),
  ('06', 'hsn', 'Live plants & flowers', 0, null, null, null, null),
  ('07', 'hsn', 'Vegetables', 0, null, null, null, null),
  ('08', 'hsn', 'Fruits & nuts (fresh)', 0, null, null, null, null),
  ('09', 'hsn', 'Coffee, tea, mate & spices', 5, null, null, null, null),
  ('10', 'hsn', 'Cereals (rice, wheat)', 0, null, null, null, null),
  ('11', 'hsn', 'Milling products (flour, atta)', 5, null, null, null, null),
  ('12', 'hsn', 'Oil seeds', 0, null, null, null, null),
  ('15', 'hsn', 'Edible fats & oils', 5, null, null, null, null),
  ('17', 'hsn', 'Sugar & jaggery', 5, null, null, null, null),
  ('1704', 'hsn', 'Sugar confectionery (toffees, candy)', 5, 18, null, null, '2025-09-22'),
  ('18', 'hsn', 'Cocoa & chocolate', 5, 18, null, null, '2025-09-22'),
  ('1806', 'hsn', 'Chocolate & chocolate products', 5, 18, null, null, '2025-09-22'),
  ('19', 'hsn', 'Cereal & bakery preparations', 5, 12, null, null, '2025-09-22'),
  ('1905', 'hsn', 'Bread, bakery & puffed products', 5, 12, null, null, '2025-09-22'),
  ('20', 'hsn', 'Preserved vegetables, fruit, jams', 5, 12, null, null, '2025-09-22'),
  ('2008', 'hsn', 'Dry fruits & prepared nuts', 5, 12, null, null, '2025-09-22'),
  ('21', 'hsn', 'Miscellaneous edible preparations', 5, 18, null, null, '2025-09-22'),
  ('2105', 'hsn', 'Ice cream & frozen desserts', 5, 18, null, null, '2025-09-22'),
  ('2106', 'hsn', 'Food preparations (namkeen, snacks)', 5, 18, null, null, '2025-09-22'),
  ('22', 'hsn', 'Beverages (non-aerated)', 5, 18, null, null, '2025-09-22'),
  ('2201', 'hsn', 'Packaged drinking water', 5, 18, null, null, '2025-09-22'),
  ('2202', 'hsn', 'Aerated & carbonated drinks', 40, 28, null, null, '2025-09-22'),
  ('23', 'hsn', 'Food industry residues & animal feed', 5, null, null, null, null),
  ('24', 'hsn', 'Tobacco & tobacco products', 28, null, null, null, null),
  ('25', 'hsn', 'Salt, stone & mineral products', 5, null, null, null, null),
  ('2523', 'hsn', 'Portland cement', 18, 28, null, null, '2025-09-22'),
  ('3304', 'hsn', 'Beauty & make-up preparations', 5, 18, null, null, '2025-09-22'),
  ('3305', 'hsn', 'Shampoos, hair oils & hair care', 5, 18, null, null, '2025-09-22'),
  ('3306', 'hsn', 'Toothpaste & oral hygiene', 5, 18, null, null, '2025-09-22'),
  ('3307', 'hsn', 'Perfumery, cosmetics & personal care', 5, 18, null, null, '2025-09-22'),
  ('3401', 'hsn', 'Soap & organic surface cleaners', 5, 18, null, null, '2025-09-22'),
  ('3402', 'hsn', 'Detergents & washing preparations', 5, 18, null, null, '2025-09-22'),
  ('39', 'hsn', 'Plastics & articles thereof', 18, null, null, null, null),
  ('3924', 'hsn', 'Household & kitchen articles of plastics', 5, 18, null, null, '2025-09-22'),
  ('42', 'hsn', 'Leather articles & travel goods', 18, null, null, null, null),
  ('48', 'hsn', 'Paper & paperboard', 5, null, null, null, null),
  ('4820', 'hsn', 'Notebooks, registers & paper stationery', 0, 12, null, null, '2025-09-22'),
  ('49', 'hsn', 'Printed books, newspapers & pictures', 0, null, null, null, null),
  ('9609', 'hsn', 'Pencils & crayons', 0, 12, null, null, '2025-09-22'),
  ('4010', 'hsn', 'Erasers', 0, 5, null, null, '2025-09-22'),
  ('52', 'hsn', 'Cotton & cotton fabrics', 5, null, null, null, null),
  ('54', 'hsn', 'Man-made filament yarn', 5, 18, null, null, '2025-09-22'),
  ('61', 'hsn', 'Knitted apparel (shirts, t-shirts)', 5, 5, 2500, 18, '2025-09-22'),
  ('62', 'hsn', 'Woven apparel (sarees, kurtas, trousers)', 5, 5, 2500, 18, '2025-09-22'),
  ('63', 'hsn', 'Made-ups (bed linen, towels, curtains)', 5, null, 2500, 18, '2025-09-22'),
  ('64', 'hsn', 'Footwear', 5, 12, 2500, 18, '2025-09-22'),
  ('66', 'hsn', 'Umbrellas & sunshades', 5, 12, null, null, '2025-09-22'),
  ('72', 'hsn', 'Iron & steel', 18, null, null, null, null),
  ('7214', 'hsn', 'Steel bars & rods', 18, null, null, null, null),
  ('7323', 'hsn', 'Household steel utensils & kitchenware', 5, 12, null, null, '2025-09-22'),
  ('7615', 'hsn', 'Household aluminium utensils', 5, 12, null, null, '2025-09-22'),
  ('82', 'hsn', 'Tools & hardware', 18, null, null, null, null),
  ('8205', 'hsn', 'Hand tools (spanners, hammers)', 18, null, null, null, null),
  ('94', 'hsn', 'Furniture, bedding & lighting', 18, null, null, null, null),
  ('84', 'hsn', 'Machinery & mechanical appliances', 18, null, null, null, null),
  ('8415', 'hsn', 'Air conditioners', 18, 28, null, null, '2025-09-22'),
  ('8450', 'hsn', 'Washing machines', 18, 28, null, null, '2025-09-22'),
  ('85', 'hsn', 'Electrical machinery & electronics', 18, null, null, null, null),
  ('8517', 'hsn', 'Mobile phones & communication devices', 18, null, null, null, null),
  ('8528', 'hsn', 'Televisions & monitors', 18, 28, null, null, '2025-09-22'),
  ('8536', 'hsn', 'Electrical switches, plugs & fittings', 18, null, null, null, null),
  ('8712', 'hsn', 'Bicycles', 5, 12, null, null, '2025-09-22'),
  ('87', 'hsn', 'Vehicles & auto parts (small cars, bikes ≤350cc)', 18, 28, null, null, '2025-09-22'),
  ('8703', 'hsn', 'Motor cars (luxury/SUV → 40%)', 18, 28, null, 40, '2025-09-22'),
  ('30', 'hsn', 'Pharmaceutical products', 18, null, null, null, null),
  ('3004', 'hsn', 'Medicines (most; 33 life-saving drugs are nil)', 5, 12, null, null, '2025-09-22'),
  ('90', 'hsn', 'Optical, photographic & precision instruments', 18, null, null, null, null),
  ('9004', 'hsn', 'Spectacles & corrective eyewear', 5, 12, null, null, '2025-09-22'),
  ('9018', 'hsn', 'Medical devices & instruments', 5, 12, null, null, '2025-09-22'),
  ('71', 'hsn', 'Precious stones & metals', 3, null, null, null, null),
  ('7103', 'hsn', 'Precious & semi-precious stones', 3, null, null, null, null),
  ('7113', 'hsn', 'Gold & platinum jewellery', 3, null, null, null, null),
  ('9963', 'sac', 'Food & beverage services (restaurants)', 5, null, null, null, null),
  ('9961', 'sac', 'Hotel & lodging (≤ ₹7,500/night)', 5, 12, 7500, 18, '2025-09-22'),
  ('9997', 'sac', 'Health, wellness, salons, gyms & yoga', 5, 18, null, null, '2025-09-22'),
  ('9972', 'sac', 'IT & software services', 18, null, null, null, null),
  ('9983', 'sac', 'Professional & consulting services', 18, null, null, null, null),
  ('9987', 'sac', 'Education & training services', 0, null, null, null, null)
on conflict (code) do update set
  kind = excluded.kind,
  description = excluded.description,
  gst_rate = excluded.gst_rate,
  legacy_rate = excluded.legacy_rate,
  threshold = excluded.threshold,
  alt_rate = excluded.alt_rate,
  wef = excluded.wef,
  updated_at = now();
