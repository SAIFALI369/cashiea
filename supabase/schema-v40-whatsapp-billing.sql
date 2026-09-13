-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v40 — WhatsApp billing commands (opt-in flag)
--
-- Adds profiles.whatsapp_billing_enabled (default OFF). When ON, the
-- whatsapp-webhook parses billing commands sent from the owner's or a
-- staff member's own WhatsApp number ("Add 50 notebooks at ₹25") and
-- creates a GST invoice from the catalogue, replying with the bill.
--
-- Safety model:
--   * OFF by default — the owner switches it on in Settings.
--   * Only executes for senders whose number belongs to the business
--     (owner or team member) — customer messages are stored only.
--   * Deterministic parser; no AI tokens; unknown/ambiguous catalogue
--     items are never guessed.
--   * The existing "Users can update own profile" RLS policy already
--     gates who may flip this flag — no new policy needed.
--
-- Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists whatsapp_billing_enabled boolean not null default false;
