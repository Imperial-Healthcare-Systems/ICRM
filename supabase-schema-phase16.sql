-- ─────────────────────────────────────────────────────────────────────
-- PHASE 16 — Recurring Subscriptions (customer-facing, not platform billing)
-- These are subscriptions sold BY the org to its customers — e.g. SaaS
-- monthly fees, retainer agreements, AMC contracts. Auto-generates an
-- invoice on each next_billing_date via a daily cron.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists crm_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organisations(id) on delete cascade,
  subscription_number text not null,
  account_id          uuid not null references crm_accounts(id) on delete cascade,
  contact_id          uuid references crm_contacts(id) on delete set null,
  product_id          uuid references crm_products(id) on delete set null,
  name                text not null,
  description         text,
  amount              numeric(15,2) not null check (amount > 0),
  currency            text default 'INR',
  tax_pct             numeric(5,2) default 18,
  billing_cycle       text not null default 'monthly'
                        check (billing_cycle in ('weekly','monthly','quarterly','half_yearly','yearly','custom')),
  cycle_days          int,           -- only used when billing_cycle='custom'
  status              text not null default 'active'
                        check (status in ('active','paused','cancelled','expired')),
  start_date          date not null,
  end_date            date,          -- null = open-ended
  next_billing_date   date not null,
  last_billed_at      timestamptz,
  invoices_generated  int default 0,
  auto_renew          boolean default true,
  payment_terms_days  int default 7,
  notes               text,
  cancellation_reason text,
  cancelled_at        timestamptz,
  created_by          uuid references crm_users(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_crm_subscriptions_org      on crm_subscriptions(org_id);
create index if not exists idx_crm_subscriptions_account  on crm_subscriptions(account_id);
create index if not exists idx_crm_subscriptions_billing  on crm_subscriptions(next_billing_date) where status = 'active';
create index if not exists idx_crm_subscriptions_status   on crm_subscriptions(org_id, status);

alter table crm_subscriptions enable row level security;
do $$ begin
  create policy "crm_subscriptions_org_isolation" on crm_subscriptions
    using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- Helper: compute next_billing_date from a cycle
create or replace function compute_next_billing_date(p_current date, p_cycle text, p_cycle_days int default null) returns date
language sql immutable as $$
  select case p_cycle
    when 'weekly'      then p_current + interval '7 days'
    when 'monthly'     then p_current + interval '1 month'
    when 'quarterly'   then p_current + interval '3 months'
    when 'half_yearly' then p_current + interval '6 months'
    when 'yearly'      then p_current + interval '1 year'
    when 'custom'      then p_current + (coalesce(p_cycle_days, 30) || ' days')::interval
    else p_current + interval '1 month'
  end::date
$$;

-- Update next_doc_number to add SUB prefix
create or replace function next_doc_number(p_org_id uuid, p_type text, p_prefix text default null)
returns text language plpgsql as $$
declare v_prefix text; v_next int;
begin
  v_prefix := coalesce(p_prefix, case p_type
    when 'invoice'        then 'INV'
    when 'quotation'      then 'QT'
    when 'proposal'       then 'PROP'
    when 'contract'       then 'CON'
    when 'purchase_order' then 'PO'
    when 'ticket'         then 'TKT'
    when 'visit'          then 'FV'
    when 'expense'        then 'EXP'
    when 'subscription'   then 'SUB'
    else upper(left(p_type, 3))
  end);
  insert into crm_doc_sequences (org_id, doc_type, last_number)
  values (p_org_id, p_type, 1)
  on conflict (org_id, doc_type)
  do update set last_number = crm_doc_sequences.last_number + 1
  returning last_number into v_next;
  return v_prefix || '-' || lpad(v_next::text, 4, '0');
end; $$;

notify pgrst, 'reload schema';
