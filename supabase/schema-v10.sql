-- ════════════════════════════════════════════════════════════════
-- Schema v10 (UPI ID for merchant + fix) — run AFTER schema-v9
-- Adds the merchant's UPI VPA to profiles so invoices can build
-- real upi:// payment links + QR codes.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists upi_id text;  -- e.g. shop@okhdfcbank, business@paytm

-- The Invoices page reads profile.upi_id to generate payment links.
-- Users set it in Settings → it powers every invoice's "Pay via UPI"
-- button + scannable QR code.
