-- ═══════════════════════════════════════════════════════════════
-- ICRM Phase 5 — Finance tables
-- Run after supabase-schema.sql
-- ═══════════════════════════════════════════════════════════════

-- ── PROPOSALS ────────────────────────────────────────────────────
create table if not exists crm_proposals (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  proposal_number text not null,
  title           text not null,
  account_id      uuid references crm_accounts(id) on delete set null,
  contact_id      uuid references crm_contacts(id) on delete set null,
  deal_id         uuid references crm_deals(id) on delete set null,
  status          text not null default 'draft'
                    check (status in ('draft','sent','accepted','rejected','expired')),
  valid_until     date,
  cover_note      text,
  sections        jsonb default '[]',
  items           jsonb not null default '[]',
  subtotal        numeric(15,2) not null default 0,
  discount_pct    numeric(5,2) default 0,
  tax_pct         numeric(5,2) default 18,
  total           numeric(15,2) not null default 0,
  currency        text not null default 'INR',
  terms           text,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, proposal_number)
);

create index if not exists crm_proposals_org_id_idx on crm_proposals(org_id);
alter table crm_proposals enable row level security;
create policy "crm_proposals_org_isolation" on crm_proposals
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── PURCHASE ORDERS ───────────────────────────────────────────────
create table if not exists crm_purchase_orders (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  po_number       text not null,
  vendor_id       uuid references crm_vendors(id) on delete set null,
  status          text not null default 'draft'
                    check (status in ('draft','sent','acknowledged','partially_received','received','cancelled')),
  issue_date      date not null default current_date,
  expected_date   date,
  received_date   date,
  items           jsonb not null default '[]',
  subtotal        numeric(15,2) not null default 0,
  tax_pct         numeric(5,2) default 18,
  total           numeric(15,2) not null default 0,
  currency        text not null default 'INR',
  notes           text,
  shipping_address jsonb,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, po_number)
);

create index if not exists crm_purchase_orders_org_id_idx on crm_purchase_orders(org_id);
alter table crm_purchase_orders enable row level security;
create policy "crm_purchase_orders_org_isolation" on crm_purchase_orders
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── VENDORS ───────────────────────────────────────────────────────
create table if not exists crm_vendors (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  contact_name    text,
  email           text,
  phone           text,
  website         text,
  category        text,
  gstin           text,
  pan             text,
  payment_terms   text,
  billing_address jsonb,
  bank_details    jsonb,
  status          text not null default 'active'
                    check (status in ('active','inactive','blacklisted')),
  rating          int check (rating between 1 and 5),
  notes           text,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crm_vendors_org_id_idx on crm_vendors(org_id);
alter table crm_vendors enable row level security;
create policy "crm_vendors_org_isolation" on crm_vendors
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── SEQUENCE HELPERS ──────────────────────────────────────────────
-- Auto-increment number per org per document type
create table if not exists crm_sequences (
  org_id          uuid not null references organisations(id) on delete cascade,
  seq_type        text not null,
  last_value      int not null default 0,
  primary key (org_id, seq_type)
);

create or replace function next_doc_number(
  p_org_id  uuid,
  p_type    text,
  p_prefix  text
) returns text
language plpgsql
security definer
as $$
declare
  v_next int;
begin
  insert into crm_sequences (org_id, seq_type, last_value)
  values (p_org_id, p_type, 1)
  on conflict (org_id, seq_type)
  do update set last_value = crm_sequences.last_value + 1
  returning last_value into v_next;

  return p_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;
