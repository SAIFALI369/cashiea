// ────────────────────────────────────────────────────────────────
// generate-hsn-seed — writes supabase/schema-v38-hsn-rates.sql from
// the canonical dataset in src/lib/hsnRates.ts.
//
// The TS dataset is the single source of truth (the client uses it for
// instant offline lookup); this script keeps the server-side table in
// lock-step so the two can never drift. Same esbuild-bundle pattern as
// generate-llms.mjs.
//
// Run: node scripts/generate-hsn-seed.mjs
// ────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build } from 'esbuild'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const tmp = path.join(root, 'node_modules', '.cache', 'hsn-data.mjs')

await build({
  entryPoints: [path.join(root, 'src/lib/hsnRates.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: tmp,
  logLevel: 'silent',
})

const { HSN_RATE_ENTRIES } = await import(path.toNamespacedPath(tmp) + `?t=${Date.now()}`)

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`
const num = (n) => (n === undefined || n === null ? 'null' : String(n))
const date = (d) => (d ? sql(d) : 'null')

const rows = HSN_RATE_ENTRIES.map((e) =>
  `  (${sql(e.code)}, ${sql(e.kind)}, ${sql(e.description)}, ${e.gstRate}, ${num(e.legacyRate)}, ${num(e.threshold)}, ${num(e.altRate)}, ${date(e.wef)})`,
).join(',\n')

const out = `-- ════════════════════════════════════════════════════════════════
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
${rows}
on conflict (code) do update set
  kind = excluded.kind,
  description = excluded.description,
  gst_rate = excluded.gst_rate,
  legacy_rate = excluded.legacy_rate,
  threshold = excluded.threshold,
  alt_rate = excluded.alt_rate,
  wef = excluded.wef,
  updated_at = now();
`

const dest = path.join(root, 'supabase/schema-v38-hsn-rates.sql')
writeFileSync(dest, out)
console.log(`wrote ${dest} — ${HSN_RATE_ENTRIES.length} entries`)
