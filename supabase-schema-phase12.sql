-- ─────────────────────────────────────────────────────────────────────
-- PHASE 12 — Public Invoice Sharing
-- Adds a public token column to crm_invoices for generating shareable
-- links that don't require authentication (similar to Stripe's hosted
-- invoice pages). The token is generated on demand when an admin clicks
-- "Share" — invoices are private by default.
-- ─────────────────────────────────────────────────────────────────────

alter table crm_invoices add column if not exists public_token text unique;
alter table crm_invoices add column if not exists public_token_created_at timestamptz;

create index if not exists idx_crm_invoices_public_token on crm_invoices(public_token) where public_token is not null;

notify pgrst, 'reload schema';
