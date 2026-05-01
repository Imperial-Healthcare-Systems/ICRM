-- ─────────────────────────────────────────────────────────────────────
-- PHASE 11 — Invoice Payments Ledger
-- Adds an immutable payment records table for tracking individual
-- payments against invoices. Multiple payments can be recorded per
-- invoice (partial payments, instalments). Total paid is computed via
-- the existing crm_invoices.paid_amount column, kept in sync by the
-- application layer.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists crm_invoice_payments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  invoice_id      uuid not null references crm_invoices(id) on delete cascade,
  amount          numeric(15,2) not null check (amount > 0),
  currency        text not null default 'INR',
  payment_method  text not null default 'bank_transfer'
                    check (payment_method in (
                      'cash', 'bank_transfer', 'cheque', 'upi',
                      'card', 'online', 'other'
                    )),
  reference       text,
  paid_at         timestamptz not null default now(),
  notes           text,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_crm_invoice_payments_invoice on crm_invoice_payments(invoice_id, paid_at desc);
create index if not exists idx_crm_invoice_payments_org     on crm_invoice_payments(org_id, paid_at desc);

alter table crm_invoice_payments enable row level security;
do $$ begin
  create policy "crm_invoice_payments_org_isolation" on crm_invoice_payments
    using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;
