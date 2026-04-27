-- ═══════════════════════════════════════════════════════════════════════
-- ICRM COMPLETE SCHEMA — Imperial Tech Innovations Pvt Ltd
-- Single consolidated script covering all phases (0–7)
-- Run this ONCE on a fresh Supabase project in the SQL Editor.
-- Prerequisites: organisations table must already exist (IHRMS schema).
-- ═══════════════════════════════════════════════════════════════════════

-- ── EXTENSIONS ───────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ════════════════════════════════════════════════════════════════════
-- CORE TABLES
-- ════════════════════════════════════════════════════════════════════

-- ── CRM USERS ────────────────────────────────────────────────────────
create table if not exists crm_users (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organisations(id) on delete cascade,
  email         text not null,
  full_name     text not null,
  avatar_url    text,
  role          text not null default 'sales_rep'
                  check (role in ('super_admin','admin','manager','sales_rep','support_rep','viewer')),
  is_active     boolean not null default true,
  crm_enabled   boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists crm_users_org_id_idx on crm_users(org_id);
create index if not exists crm_users_email_idx  on crm_users(email);

alter table crm_users enable row level security;
create policy "crm_users_org_isolation" on crm_users
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── PIPELINE STAGES ──────────────────────────────────────────────────
create table if not exists crm_pipeline_stages (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  position    int not null default 0,
  color       text default '#6B7280',
  probability int not null default 0 check (probability between 0 and 100),
  is_won      boolean not null default false,
  is_lost     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists crm_pipeline_stages_org_id_idx on crm_pipeline_stages(org_id);

alter table crm_pipeline_stages enable row level security;
create policy "crm_pipeline_stages_org_isolation" on crm_pipeline_stages
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── ACCOUNTS ─────────────────────────────────────────────────────────
create table if not exists crm_accounts (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organisations(id) on delete cascade,
  name             text not null,
  website          text,
  industry         text,
  account_type     text default 'prospect'
                     check (account_type in ('prospect','customer','partner','vendor','other')),
  phone            text,
  email            text,
  billing_address  jsonb,
  shipping_address jsonb,
  annual_revenue   numeric(15,2),
  employee_count   int,
  assigned_to      uuid references crm_users(id) on delete set null,
  parent_account   uuid references crm_accounts(id) on delete set null,
  tags             text[] default '{}',
  custom_fields    jsonb default '{}',
  notes            text,
  created_by       uuid references crm_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists crm_accounts_org_id_idx      on crm_accounts(org_id);
create index if not exists crm_accounts_assigned_to_idx on crm_accounts(assigned_to);

alter table crm_accounts enable row level security;
create policy "crm_accounts_org_isolation" on crm_accounts
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── CONTACTS ─────────────────────────────────────────────────────────
create table if not exists crm_contacts (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organisations(id) on delete cascade,
  account_id       uuid references crm_accounts(id) on delete set null,
  first_name       text not null,
  last_name        text,
  email            text,
  phone            text,
  mobile           text,
  job_title        text,
  department       text,
  contact_source   text,
  lead_status      text default 'new'
                     check (lead_status in ('new','contacted','qualified','unqualified','converted')),
  assigned_to      uuid references crm_users(id) on delete set null,
  tags             text[] default '{}',
  custom_fields    jsonb default '{}',
  notes            text,
  do_not_contact   boolean not null default false,
  synced_from_hrms boolean not null default false,
  created_by       uuid references crm_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists crm_contacts_org_id_idx      on crm_contacts(org_id);
create index if not exists crm_contacts_account_id_idx  on crm_contacts(account_id);
create index if not exists crm_contacts_assigned_to_idx on crm_contacts(assigned_to);
create index if not exists crm_contacts_email_idx       on crm_contacts(email);

alter table crm_contacts enable row level security;
create policy "crm_contacts_org_isolation" on crm_contacts
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── LEADS ────────────────────────────────────────────────────────────
create table if not exists crm_leads (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organisations(id) on delete cascade,
  first_name    text not null,
  last_name     text,
  email         text,
  phone         text,
  company       text,
  job_title     text,
  lead_source   text,
  lead_status   text not null default 'new'
                  check (lead_status in ('new','contacted','qualified','unqualified','converted','recycled')),
  rating        text default 'warm'
                  check (rating in ('hot','warm','cold')),
  ai_score      int check (ai_score between 0 and 100),
  assigned_to   uuid references crm_users(id) on delete set null,
  converted_to  uuid references crm_contacts(id) on delete set null,
  converted_at  timestamptz,
  notes         text,
  tags          text[] default '{}',
  custom_fields jsonb default '{}',
  created_by    uuid references crm_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists crm_leads_org_id_idx      on crm_leads(org_id);
create index if not exists crm_leads_assigned_to_idx on crm_leads(assigned_to);
create index if not exists crm_leads_lead_status_idx on crm_leads(lead_status);

alter table crm_leads enable row level security;
create policy "crm_leads_org_isolation" on crm_leads
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── DEALS ────────────────────────────────────────────────────────────
create table if not exists crm_deals (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references organisations(id) on delete cascade,
  title          text not null,
  account_id     uuid references crm_accounts(id) on delete set null,
  contact_id     uuid references crm_contacts(id) on delete set null,
  stage_id       uuid references crm_pipeline_stages(id) on delete set null,
  deal_value     numeric(15,2) not null default 0,
  currency       text not null default 'INR',
  probability    int default 0 check (probability between 0 and 100),
  expected_close date,
  actual_close   date,
  deal_status    text not null default 'open'
                   check (deal_status in ('open','won','lost','on_hold')),
  lost_reason    text,
  assigned_to    uuid references crm_users(id) on delete set null,
  notes          text,
  tags           text[] default '{}',
  custom_fields  jsonb default '{}',
  created_by     uuid references crm_users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists crm_deals_org_id_idx      on crm_deals(org_id);
create index if not exists crm_deals_stage_id_idx    on crm_deals(stage_id);
create index if not exists crm_deals_assigned_to_idx on crm_deals(assigned_to);
create index if not exists crm_deals_status_idx      on crm_deals(deal_status);

alter table crm_deals enable row level security;
create policy "crm_deals_org_isolation" on crm_deals
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── ACTIVITIES ───────────────────────────────────────────────────────
create table if not exists crm_activities (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  activity_type   text not null
                    check (activity_type in ('call','email','meeting','task','note','demo','follow_up')),
  subject         text not null,
  description     text,
  status          text not null default 'pending'
                    check (status in ('pending','completed','cancelled')),
  due_date        timestamptz,
  completed_at    timestamptz,
  duration_mins   int,
  related_to_type text check (related_to_type in ('lead','contact','account','deal')),
  related_to_id   uuid,
  assigned_to     uuid references crm_users(id) on delete set null,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crm_activities_org_id_idx      on crm_activities(org_id);
create index if not exists crm_activities_assigned_to_idx on crm_activities(assigned_to);
create index if not exists crm_activities_related_idx     on crm_activities(related_to_type, related_to_id);

alter table crm_activities enable row level security;
create policy "crm_activities_org_isolation" on crm_activities
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── QUOTATIONS ───────────────────────────────────────────────────────
create table if not exists crm_quotations (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organisations(id) on delete cascade,
  quote_number  text not null,
  deal_id       uuid references crm_deals(id) on delete set null,
  account_id    uuid references crm_accounts(id) on delete set null,
  contact_id    uuid references crm_contacts(id) on delete set null,
  status        text not null default 'draft'
                  check (status in ('draft','sent','accepted','rejected','expired')),
  valid_until   date,
  items         jsonb not null default '[]',
  subtotal      numeric(15,2) not null default 0,
  discount_pct  numeric(5,2) default 0,
  tax_pct       numeric(5,2) default 18,
  total         numeric(15,2) not null default 0,
  currency      text not null default 'INR',
  notes         text,
  terms         text,
  created_by    uuid references crm_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, quote_number)
);

create index if not exists crm_quotations_org_id_idx on crm_quotations(org_id);
create index if not exists crm_quotations_deal_id_idx on crm_quotations(deal_id);

alter table crm_quotations enable row level security;
create policy "crm_quotations_org_isolation" on crm_quotations
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── INVOICES ─────────────────────────────────────────────────────────
create table if not exists crm_invoices (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  invoice_number  text not null,
  quotation_id    uuid references crm_quotations(id) on delete set null,
  account_id      uuid references crm_accounts(id) on delete set null,
  contact_id      uuid references crm_contacts(id) on delete set null,
  status          text not null default 'draft'
                    check (status in ('draft','sent','paid','overdue','cancelled','void')),
  issue_date      date not null default current_date,
  due_date        date,
  paid_date       date,
  items           jsonb not null default '[]',
  subtotal        numeric(15,2) not null default 0,
  discount_pct    numeric(5,2) default 0,
  tax_pct         numeric(5,2) default 18,
  total           numeric(15,2) not null default 0,
  paid_amount     numeric(15,2) not null default 0,
  currency        text not null default 'INR',
  notes           text,
  terms           text,
  payment_ref     text,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, invoice_number)
);

create index if not exists crm_invoices_org_id_idx on crm_invoices(org_id);
create index if not exists crm_invoices_status_idx on crm_invoices(status);

alter table crm_invoices enable row level security;
create policy "crm_invoices_org_isolation" on crm_invoices
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── CONTRACTS ────────────────────────────────────────────────────────
create table if not exists crm_contracts (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organisations(id) on delete cascade,
  contract_number     text not null,
  title               text not null,
  account_id          uuid references crm_accounts(id) on delete set null,
  deal_id             uuid references crm_deals(id) on delete set null,
  contract_type       text default 'service',
  status              text not null default 'draft'
                        check (status in ('draft','active','expired','terminated','renewed')),
  start_date          date,
  end_date            date,
  value               numeric(15,2),
  currency            text not null default 'INR',
  auto_renew          boolean not null default false,
  renewal_notice_days int default 30,
  file_url            text,
  notes               text,
  signed_by           text,
  signed_at           timestamptz,
  created_by          uuid references crm_users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, contract_number)
);

create index if not exists crm_contracts_org_id_idx  on crm_contracts(org_id);
create index if not exists crm_contracts_end_date_idx on crm_contracts(end_date);

alter table crm_contracts enable row level security;
create policy "crm_contracts_org_isolation" on crm_contracts
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── NOTES ────────────────────────────────────────────────────────────
create table if not exists crm_notes (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  content         text not null,
  related_to_type text check (related_to_type in ('lead','contact','account','deal','ticket')),
  related_to_id   uuid,
  is_pinned       boolean not null default false,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crm_notes_related_idx on crm_notes(related_to_type, related_to_id);
create index if not exists crm_notes_org_id_idx  on crm_notes(org_id);

alter table crm_notes enable row level security;
create policy "crm_notes_org_isolation" on crm_notes
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════
-- CREDITS / BILLING
-- ════════════════════════════════════════════════════════════════════

create table if not exists org_credits (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade unique,
  balance         int not null default 0,
  total_purchased int not null default 0,
  updated_at      timestamptz not null default now()
);

alter table org_credits enable row level security;
create policy "org_credits_org_isolation" on org_credits
  using (org_id = (select org_id from crm_users where id = auth.uid()));

create table if not exists credit_transactions (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id) on delete cascade,
  user_id     uuid references crm_users(id) on delete set null,
  feature_key text not null,
  amount      int not null,
  direction   text not null check (direction in ('debit','credit')),
  ref_id      text,
  description text,
  created_at  timestamptz not null default now()
);

create index if not exists credit_transactions_org_id_idx on credit_transactions(org_id);

alter table credit_transactions enable row level security;
create policy "credit_transactions_org_isolation" on credit_transactions
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── FEATURE CATALOG ──────────────────────────────────────────────────
create table if not exists feature_catalog (
  feature_key        text primary key,
  display_name       text not null,
  description        text,
  credit_cost        int not null default 0,
  preferred_provider text default 'openai',
  is_active          boolean not null default true
);

create table if not exists org_features (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id) on delete cascade,
  feature_key text not null references feature_catalog(feature_key) on delete cascade,
  enabled     boolean not null default true,
  unique (org_id, feature_key)
);

-- ── CONSUME CREDITS RPC ──────────────────────────────────────────────
create or replace function consume_credits(
  p_org_id      uuid,
  p_feature_key text,
  p_amount      int,
  p_ref_id      text,
  p_user_id     uuid
) returns void
language plpgsql security definer
as $$
begin
  update org_credits
  set balance = balance - p_amount, updated_at = now()
  where org_id = p_org_id and balance >= p_amount;

  if not found then
    raise exception 'Insufficient credits';
  end if;

  insert into credit_transactions (org_id, user_id, feature_key, amount, direction, ref_id)
  values (p_org_id, p_user_id, p_feature_key, p_amount, 'debit', p_ref_id);
end;
$$;

-- ── DEFAULT FEATURE CATALOG ENTRIES ──────────────────────────────────
insert into feature_catalog (feature_key, display_name, credit_cost, preferred_provider) values
  ('ai_lead_scoring',      'AI Lead Scoring',       5, 'openai'),
  ('ai_deal_insights',     'AI Deal Insights',      5, 'openai'),
  ('ai_document_analysis', 'AI Document Analysis', 10, 'openai'),
  ('ai_reply_suggestion',  'AI Reply Suggestion',   3, 'gemini'),
  -- Imperial Intelligence features (Phase 7)
  ('ai_summarize',         'AI Summarize',          1, 'gemini'),
  ('ai_draft_email',       'AI Draft Email',        1, 'gemini'),
  ('ai_insights',          'AI Sales Insights',     2, 'gemini')
on conflict (feature_key) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- PHASE 5 — Finance: Proposals, Vendors, Purchase Orders, Sequences
-- ════════════════════════════════════════════════════════════════════

-- ── PROPOSALS ────────────────────────────────────────────────────────
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

-- ── VENDORS — must be defined BEFORE purchase orders ─────────────────
create table if not exists crm_vendors (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid not null references organisations(id) on delete cascade,
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  website       text,
  category      text,
  gstin         text,
  pan           text,
  payment_terms text,
  billing_address jsonb,
  bank_details  jsonb,
  status        text not null default 'active'
                  check (status in ('active','inactive','blacklisted')),
  rating        int check (rating between 1 and 5),
  notes         text,
  created_by    uuid references crm_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists crm_vendors_org_id_idx on crm_vendors(org_id);
alter table crm_vendors enable row level security;
create policy "crm_vendors_org_isolation" on crm_vendors
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── PURCHASE ORDERS — FK to crm_vendors (defined above) ──────────────
create table if not exists crm_purchase_orders (
  id               uuid primary key default uuid_generate_v4(),
  org_id           uuid not null references organisations(id) on delete cascade,
  po_number        text not null,
  vendor_id        uuid references crm_vendors(id) on delete set null,
  status           text not null default 'draft'
                     check (status in ('draft','sent','acknowledged','partially_received','received','cancelled')),
  issue_date       date not null default current_date,
  expected_date    date,
  received_date    date,
  items            jsonb not null default '[]',
  subtotal         numeric(15,2) not null default 0,
  tax_pct          numeric(5,2) default 18,
  total            numeric(15,2) not null default 0,
  currency         text not null default 'INR',
  notes            text,
  shipping_address jsonb,
  created_by       uuid references crm_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (org_id, po_number)
);

create index if not exists crm_purchase_orders_org_id_idx on crm_purchase_orders(org_id);
alter table crm_purchase_orders enable row level security;
create policy "crm_purchase_orders_org_isolation" on crm_purchase_orders
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── SEQUENCES — auto-increment doc numbers per org ───────────────────
create table if not exists crm_sequences (
  org_id     uuid not null references organisations(id) on delete cascade,
  seq_type   text not null,
  last_value int not null default 0,
  primary key (org_id, seq_type)
);

-- next_doc_number: p_prefix is optional — defaults to a sensible short code
create or replace function next_doc_number(
  p_org_id uuid,
  p_type   text,
  p_prefix text default null
) returns text
language plpgsql security definer
as $$
declare
  v_next   int;
  v_prefix text;
begin
  -- Derive prefix from type when not supplied
  v_prefix := coalesce(p_prefix,
    case p_type
      when 'ticket'   then 'TKT'
      when 'visit'    then 'FV'
      when 'quote'    then 'QT'
      when 'invoice'  then 'INV'
      when 'contract' then 'CNT'
      when 'proposal' then 'PROP'
      when 'po'       then 'PO'
      else upper(substring(p_type from 1 for 3))
    end
  );

  insert into crm_sequences (org_id, seq_type, last_value)
  values (p_org_id, p_type, 1)
  on conflict (org_id, seq_type)
  do update set last_value = crm_sequences.last_value + 1
  returning last_value into v_next;

  return v_prefix || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- PHASE 6 — Support, Field Visits, Loyalty, Documents, Campaigns
-- ════════════════════════════════════════════════════════════════════

-- ── SUPPORT TICKETS ──────────────────────────────────────────────────
-- Uses Phase 6 column set (title, type, sla_due_at) — matches API routes
create table if not exists crm_tickets (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  ticket_number text not null,
  title         text not null,
  description   text,
  status        text not null default 'open'
                  check (status in ('open','in_progress','waiting','resolved','closed')),
  priority      text not null default 'medium'
                  check (priority in ('low','medium','high','critical')),
  type          text default 'general'
                  check (type in ('general','billing','technical','feature_request','complaint','other')),
  account_id    uuid references crm_accounts(id) on delete set null,
  contact_id    uuid references crm_contacts(id) on delete set null,
  assigned_to   uuid references crm_users(id) on delete set null,
  resolved_at   timestamptz,
  sla_due_at    timestamptz,
  created_by    uuid references crm_users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (org_id, ticket_number)
);

create index if not exists idx_crm_tickets_org    on crm_tickets(org_id, created_at desc);
create index if not exists idx_crm_tickets_status on crm_tickets(org_id, status);

alter table crm_tickets enable row level security;
create policy "crm_tickets_org_isolation" on crm_tickets
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── TICKET COMMENTS ──────────────────────────────────────────────────
create table if not exists crm_ticket_comments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  ticket_id   uuid not null references crm_tickets(id) on delete cascade,
  body        text not null,
  is_internal boolean default false,
  created_by  uuid references crm_users(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists idx_crm_ticket_comments on crm_ticket_comments(ticket_id, created_at);

alter table crm_ticket_comments enable row level security;
create policy "crm_ticket_comments_org_isolation" on crm_ticket_comments
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── FIELD VISITS ─────────────────────────────────────────────────────
create table if not exists crm_field_visits (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  visit_number text not null,
  title        text not null,
  account_id   uuid references crm_accounts(id) on delete set null,
  contact_id   uuid references crm_contacts(id) on delete set null,
  assigned_to  uuid references crm_users(id) on delete set null,
  status       text not null default 'scheduled'
                 check (status in ('scheduled','in_progress','completed','cancelled')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  location     text,
  notes        text,
  outcome      text,
  created_by   uuid references crm_users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_crm_field_visits_org on crm_field_visits(org_id, scheduled_at desc);

alter table crm_field_visits enable row level security;
create policy "crm_field_visits_org_isolation" on crm_field_visits
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── LOYALTY ACCOUNTS ─────────────────────────────────────────────────
create table if not exists crm_loyalty_accounts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  contact_id      uuid references crm_contacts(id) on delete set null,
  account_id      uuid references crm_accounts(id) on delete set null,
  points_balance  integer not null default 0,
  tier            text not null default 'bronze'
                    check (tier in ('bronze','silver','gold','platinum')),
  total_earned    integer not null default 0,
  total_redeemed  integer not null default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_crm_loyalty_contact on crm_loyalty_accounts(org_id, contact_id);

alter table crm_loyalty_accounts enable row level security;
create policy "crm_loyalty_accounts_org_isolation" on crm_loyalty_accounts
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── LOYALTY TRANSACTIONS ─────────────────────────────────────────────
create table if not exists crm_loyalty_transactions (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organisations(id) on delete cascade,
  loyalty_account_id uuid not null references crm_loyalty_accounts(id) on delete cascade,
  type               text not null check (type in ('earn','redeem','adjust','expire')),
  points             integer not null,
  description        text,
  reference_id       uuid,
  created_by         uuid references crm_users(id) on delete set null,
  created_at         timestamptz default now()
);

alter table crm_loyalty_transactions enable row level security;
create policy "crm_loyalty_transactions_org_isolation" on crm_loyalty_transactions
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── DOCUMENTS ────────────────────────────────────────────────────────
-- Uses Phase 6 column set (file_size BIGINT, category, account_id/deal_id direct FKs)
create table if not exists crm_documents (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  file_url    text not null,
  file_type   text,
  file_size   bigint,
  category    text default 'general'
                check (category in ('contract','proposal','invoice','report','legal','general','other')),
  account_id  uuid references crm_accounts(id) on delete set null,
  contact_id  uuid references crm_contacts(id) on delete set null,
  deal_id     uuid references crm_deals(id) on delete set null,
  uploaded_by uuid references crm_users(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists idx_crm_documents_org on crm_documents(org_id, created_at desc);

alter table crm_documents enable row level security;
create policy "crm_documents_org_isolation" on crm_documents
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── CAMPAIGNS ────────────────────────────────────────────────────────
-- Uses Phase 6 column set (type not campaign_type, body, separate count columns)
create table if not exists crm_campaigns (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  name              text not null,
  type              text not null default 'email'
                      check (type in ('email','whatsapp','sms')),
  status            text not null default 'draft'
                      check (status in ('draft','scheduled','sending','sent','paused','cancelled')),
  subject           text,
  body              text,
  from_name         text,
  scheduled_at      timestamptz,
  sent_at           timestamptz,
  recipient_count   integer default 0,
  open_count        integer default 0,
  click_count       integer default 0,
  bounce_count      integer default 0,
  unsubscribe_count integer default 0,
  target_segment    jsonb default '{}',
  created_by        uuid references crm_users(id) on delete set null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_crm_campaigns_org on crm_campaigns(org_id, created_at desc);

alter table crm_campaigns enable row level security;
create policy "crm_campaigns_org_isolation" on crm_campaigns
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════
-- PHASE 7 — Automation Rules, Email Sequences, AI Logs
-- ════════════════════════════════════════════════════════════════════

-- ── AUTOMATION RULES ─────────────────────────────────────────────────
create table if not exists crm_automation_rules (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organisations(id) on delete cascade,
  name               text not null,
  description        text,
  trigger_event      text not null
                       check (trigger_event in (
                         'deal.created','deal.won','deal.lost','deal.stage_changed',
                         'contact.created','lead.created','lead.qualified',
                         'ticket.created','ticket.resolved',
                         'invoice.overdue','invoice.paid',
                         'contract.expiring'
                       )),
  trigger_conditions jsonb default '{}',
  action_type        text not null
                       check (action_type in (
                         'send_email','create_activity','assign_user',
                         'award_loyalty_points','add_note','update_field',
                         'create_ticket','send_webhook'
                       )),
  action_config      jsonb default '{}',
  is_active          boolean not null default true,
  run_count          integer not null default 0,
  last_run_at        timestamptz,
  created_by         uuid references crm_users(id) on delete set null,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists idx_crm_automation_active  on crm_automation_rules(org_id, is_active);
create index if not exists idx_crm_automation_trigger on crm_automation_rules(trigger_event);

alter table crm_automation_rules enable row level security;
create policy "crm_automation_rules_org_isolation" on crm_automation_rules
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── EMAIL SEQUENCES ───────────────────────────────────────────────────
create table if not exists crm_email_sequences (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  description text,
  status      text not null default 'draft'
                check (status in ('draft','active','paused','archived')),
  trigger_on  text default 'manual'
                check (trigger_on in ('manual','lead.created','deal.won','contact.created')),
  created_by  uuid references crm_users(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table crm_email_sequences enable row level security;
create policy "crm_email_sequences_org_isolation" on crm_email_sequences
  using (org_id = (select org_id from crm_users where id = auth.uid()));

create table if not exists crm_email_sequence_steps (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  sequence_id uuid not null references crm_email_sequences(id) on delete cascade,
  step_order  integer not null default 1,
  delay_days  integer not null default 1,
  subject     text not null,
  body        text not null,
  created_at  timestamptz default now()
);

alter table crm_email_sequence_steps enable row level security;
create policy "crm_email_sequence_steps_org_isolation" on crm_email_sequence_steps
  using (org_id = (select org_id from crm_users where id = auth.uid()));

create table if not exists crm_email_sequence_enrollments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  sequence_id  uuid not null references crm_email_sequences(id) on delete cascade,
  contact_id   uuid references crm_contacts(id) on delete cascade,
  status       text not null default 'active'
                 check (status in ('active','completed','paused','unsubscribed')),
  current_step integer not null default 0,
  next_send_at timestamptz,
  enrolled_at  timestamptz default now(),
  completed_at timestamptz
);

create index if not exists idx_crm_seq_enrollments on crm_email_sequence_enrollments(org_id, status, next_send_at);

alter table crm_email_sequence_enrollments enable row level security;
create policy "crm_email_sequence_enrollments_org_isolation" on crm_email_sequence_enrollments
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── AI USAGE LOGS ────────────────────────────────────────────────────
create table if not exists crm_ai_logs (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  user_id      uuid references crm_users(id) on delete set null,
  feature      text not null,
  provider     text not null,
  prompt_tokens integer default 0,
  total_tokens  integer default 0,
  credits_used  integer default 1,
  created_at   timestamptz default now()
);

create index if not exists idx_crm_ai_logs_org on crm_ai_logs(org_id, created_at desc);

alter table crm_ai_logs enable row level security;
create policy "crm_ai_logs_org_isolation" on crm_ai_logs
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET for documents
-- ════════════════════════════════════════════════════════════════════
-- Run this separately in Supabase Dashboard → Storage if not already created:
-- insert into storage.buckets (id, name, public) values ('crm-documents', 'crm-documents', false);
-- create policy "Authenticated upload" on storage.objects for insert
--   to authenticated with check (bucket_id = 'crm-documents');
-- create policy "Org member read" on storage.objects for select
--   to authenticated using (bucket_id = 'crm-documents');

-- ════════════════════════════════════════════════════════════════════
-- END — ICRM COMPLETE SCHEMA
-- ════════════════════════════════════════════════════════════════════
