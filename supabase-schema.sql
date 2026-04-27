-- ═══════════════════════════════════════════════════════════════
-- ICRM Supabase Schema  |  Imperial Tech Innovations Pvt Ltd
-- Run this on the SHARED Supabase project (same DB as IHRMS)
-- All ICRM-specific tables use the crm_ prefix.
-- NEVER modify: organisations, employees, ecosystem_events, audit_logs
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension (already enabled if IHRMS schema was run)
create extension if not exists "uuid-ossp";

-- ── CRM USERS ────────────────────────────────────────────────────
create table if not exists crm_users (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organisations(id) on delete cascade,
  email               text not null,
  full_name           text not null,
  avatar_url          text,
  role                text not null default 'sales_rep'
                        check (role in ('super_admin','admin','manager','sales_rep','support_rep','viewer')),
  is_active           boolean not null default true,
  crm_enabled         boolean not null default true,
  last_login_at       timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, email)
);

create index if not exists crm_users_org_id_idx on crm_users(org_id);
create index if not exists crm_users_email_idx on crm_users(email);

alter table crm_users enable row level security;
create policy "crm_users_org_isolation" on crm_users
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── PIPELINE STAGES ──────────────────────────────────────────────
-- Define before deals (FK dependency)
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

-- ── ACCOUNTS ─────────────────────────────────────────────────────
-- Must be defined BEFORE contacts (contacts FK to accounts)
create table if not exists crm_accounts (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  website         text,
  industry        text,
  account_type    text default 'prospect'
                    check (account_type in ('prospect','customer','partner','vendor','other')),
  phone           text,
  email           text,
  billing_address jsonb,
  shipping_address jsonb,
  annual_revenue  numeric(15,2),
  employee_count  int,
  assigned_to     uuid references crm_users(id) on delete set null,
  parent_account  uuid references crm_accounts(id) on delete set null,
  tags            text[] default '{}',
  custom_fields   jsonb default '{}',
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crm_accounts_org_id_idx on crm_accounts(org_id);
create index if not exists crm_accounts_assigned_to_idx on crm_accounts(assigned_to);

alter table crm_accounts enable row level security;
create policy "crm_accounts_org_isolation" on crm_accounts
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── CONTACTS ─────────────────────────────────────────────────────
create table if not exists crm_contacts (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  account_id      uuid references crm_accounts(id) on delete set null,
  first_name      text not null,
  last_name       text,
  email           text,
  phone           text,
  mobile          text,
  job_title       text,
  department      text,
  contact_source  text,
  lead_status     text default 'new'
                    check (lead_status in ('new','contacted','qualified','unqualified','converted')),
  assigned_to     uuid references crm_users(id) on delete set null,
  tags            text[] default '{}',
  custom_fields   jsonb default '{}',
  do_not_contact  boolean not null default false,
  synced_from_hrms boolean not null default false,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crm_contacts_org_id_idx on crm_contacts(org_id);
create index if not exists crm_contacts_account_id_idx on crm_contacts(account_id);
create index if not exists crm_contacts_assigned_to_idx on crm_contacts(assigned_to);
create index if not exists crm_contacts_email_idx on crm_contacts(email);

alter table crm_contacts enable row level security;
create policy "crm_contacts_org_isolation" on crm_contacts
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── LEADS ────────────────────────────────────────────────────────
create table if not exists crm_leads (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  first_name      text not null,
  last_name       text,
  email           text,
  phone           text,
  company         text,
  job_title       text,
  lead_source     text,
  lead_status     text not null default 'new'
                    check (lead_status in ('new','contacted','qualified','unqualified','converted','recycled')),
  rating          text default 'warm'
                    check (rating in ('hot','warm','cold')),
  ai_score        int check (ai_score between 0 and 100),
  assigned_to     uuid references crm_users(id) on delete set null,
  converted_to    uuid references crm_contacts(id) on delete set null,
  converted_at    timestamptz,
  notes           text,
  tags            text[] default '{}',
  custom_fields   jsonb default '{}',
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crm_leads_org_id_idx on crm_leads(org_id);
create index if not exists crm_leads_assigned_to_idx on crm_leads(assigned_to);
create index if not exists crm_leads_lead_status_idx on crm_leads(lead_status);

alter table crm_leads enable row level security;
create policy "crm_leads_org_isolation" on crm_leads
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── DEALS ────────────────────────────────────────────────────────
create table if not exists crm_deals (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  title           text not null,
  account_id      uuid references crm_accounts(id) on delete set null,
  contact_id      uuid references crm_contacts(id) on delete set null,
  stage_id        uuid references crm_pipeline_stages(id) on delete set null,
  deal_value      numeric(15,2) not null default 0,
  currency        text not null default 'INR',
  probability     int default 0 check (probability between 0 and 100),
  expected_close  date,
  actual_close    date,
  deal_status     text not null default 'open'
                    check (deal_status in ('open','won','lost','on_hold')),
  lost_reason     text,
  assigned_to     uuid references crm_users(id) on delete set null,
  tags            text[] default '{}',
  custom_fields   jsonb default '{}',
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crm_deals_org_id_idx on crm_deals(org_id);
create index if not exists crm_deals_stage_id_idx on crm_deals(stage_id);
create index if not exists crm_deals_assigned_to_idx on crm_deals(assigned_to);
create index if not exists crm_deals_deal_status_idx on crm_deals(deal_status);

alter table crm_deals enable row level security;
create policy "crm_deals_org_isolation" on crm_deals
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── ACTIVITIES ───────────────────────────────────────────────────
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

create index if not exists crm_activities_org_id_idx on crm_activities(org_id);
create index if not exists crm_activities_assigned_to_idx on crm_activities(assigned_to);
create index if not exists crm_activities_related_idx on crm_activities(related_to_type, related_to_id);

alter table crm_activities enable row level security;
create policy "crm_activities_org_isolation" on crm_activities
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── QUOTATIONS ───────────────────────────────────────────────────
create table if not exists crm_quotations (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  quote_number    text not null,
  deal_id         uuid references crm_deals(id) on delete set null,
  account_id      uuid references crm_accounts(id) on delete set null,
  contact_id      uuid references crm_contacts(id) on delete set null,
  status          text not null default 'draft'
                    check (status in ('draft','sent','accepted','rejected','expired')),
  valid_until     date,
  items           jsonb not null default '[]',
  subtotal        numeric(15,2) not null default 0,
  discount_pct    numeric(5,2) default 0,
  tax_pct         numeric(5,2) default 18,
  total           numeric(15,2) not null default 0,
  currency        text not null default 'INR',
  notes           text,
  terms           text,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, quote_number)
);

create index if not exists crm_quotations_org_id_idx on crm_quotations(org_id);
create index if not exists crm_quotations_deal_id_idx on crm_quotations(deal_id);

alter table crm_quotations enable row level security;
create policy "crm_quotations_org_isolation" on crm_quotations
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── INVOICES ─────────────────────────────────────────────────────
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

-- ── CONTRACTS ────────────────────────────────────────────────────
create table if not exists crm_contracts (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  contract_number text not null,
  title           text not null,
  account_id      uuid references crm_accounts(id) on delete set null,
  deal_id         uuid references crm_deals(id) on delete set null,
  contract_type   text default 'service',
  status          text not null default 'draft'
                    check (status in ('draft','active','expired','terminated','renewed')),
  start_date      date,
  end_date        date,
  value           numeric(15,2),
  currency        text not null default 'INR',
  auto_renew      boolean not null default false,
  renewal_notice_days int default 30,
  file_url        text,
  notes           text,
  signed_by       text,
  signed_at       timestamptz,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, contract_number)
);

create index if not exists crm_contracts_org_id_idx on crm_contracts(org_id);
create index if not exists crm_contracts_end_date_idx on crm_contracts(end_date);

alter table crm_contracts enable row level security;
create policy "crm_contracts_org_isolation" on crm_contracts
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── SUPPORT TICKETS ──────────────────────────────────────────────
create table if not exists crm_tickets (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  ticket_number   text not null,
  subject         text not null,
  description     text,
  contact_id      uuid references crm_contacts(id) on delete set null,
  account_id      uuid references crm_accounts(id) on delete set null,
  priority        text not null default 'medium'
                    check (priority in ('low','medium','high','critical')),
  status          text not null default 'open'
                    check (status in ('open','in_progress','waiting','resolved','closed')),
  category        text,
  assigned_to     uuid references crm_users(id) on delete set null,
  resolved_at     timestamptz,
  first_response_at timestamptz,
  tags            text[] default '{}',
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, ticket_number)
);

create index if not exists crm_tickets_org_id_idx on crm_tickets(org_id);
create index if not exists crm_tickets_assigned_to_idx on crm_tickets(assigned_to);
create index if not exists crm_tickets_status_idx on crm_tickets(status);

alter table crm_tickets enable row level security;
create policy "crm_tickets_org_isolation" on crm_tickets
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── NOTES ────────────────────────────────────────────────────────
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
create index if not exists crm_notes_org_id_idx on crm_notes(org_id);

alter table crm_notes enable row level security;
create policy "crm_notes_org_isolation" on crm_notes
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── EMAIL CAMPAIGNS ──────────────────────────────────────────────
create table if not exists crm_campaigns (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  campaign_type   text not null default 'email'
                    check (campaign_type in ('email','whatsapp','sms')),
  status          text not null default 'draft'
                    check (status in ('draft','scheduled','running','paused','completed','cancelled')),
  subject         text,
  body_html       text,
  body_text       text,
  template_id     uuid,
  target_segment  jsonb default '{}',
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  stats           jsonb default '{"sent":0,"opened":0,"clicked":0,"bounced":0,"unsubscribed":0}',
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists crm_campaigns_org_id_idx on crm_campaigns(org_id);

alter table crm_campaigns enable row level security;
create policy "crm_campaigns_org_isolation" on crm_campaigns
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── DOCUMENTS ────────────────────────────────────────────────────
create table if not exists crm_documents (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  file_url        text not null,
  file_type       text,
  file_size_kb    int,
  related_to_type text check (related_to_type in ('lead','contact','account','deal','contract','ticket')),
  related_to_id   uuid,
  tags            text[] default '{}',
  uploaded_by     uuid references crm_users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists crm_documents_org_id_idx on crm_documents(org_id);
create index if not exists crm_documents_related_idx on crm_documents(related_to_type, related_to_id);

alter table crm_documents enable row level security;
create policy "crm_documents_org_isolation" on crm_documents
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── ORG CREDITS (AI / Imperial Intelligence) ─────────────────────
create table if not exists org_credits (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id) on delete cascade unique,
  balance     int not null default 0,
  total_purchased int not null default 0,
  updated_at  timestamptz not null default now()
);

alter table org_credits enable row level security;
create policy "org_credits_org_isolation" on org_credits
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── CREDIT TRANSACTIONS ──────────────────────────────────────────
create table if not exists credit_transactions (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  user_id         uuid references crm_users(id) on delete set null,
  feature_key     text not null,
  amount          int not null,
  direction       text not null check (direction in ('debit','credit')),
  ref_id          text,
  description     text,
  created_at      timestamptz not null default now()
);

create index if not exists credit_transactions_org_id_idx on credit_transactions(org_id);

alter table credit_transactions enable row level security;
create policy "credit_transactions_org_isolation" on credit_transactions
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── FEATURE CATALOG ──────────────────────────────────────────────
create table if not exists feature_catalog (
  feature_key        text primary key,
  display_name       text not null,
  description        text,
  credit_cost        int not null default 0,
  preferred_provider text default 'openai',
  is_active          boolean not null default true
);

-- ── ORG FEATURES (per-org feature overrides) ─────────────────────
create table if not exists org_features (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id) on delete cascade,
  feature_key text not null references feature_catalog(feature_key) on delete cascade,
  enabled     boolean not null default true,
  unique (org_id, feature_key)
);

-- ── CONSUME CREDITS RPC ──────────────────────────────────────────
create or replace function consume_credits(
  p_org_id      uuid,
  p_feature_key text,
  p_amount      int,
  p_ref_id      text,
  p_user_id     uuid
) returns void
language plpgsql
security definer
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

-- ── DEFAULT FEATURE CATALOG ENTRIES ──────────────────────────────
insert into feature_catalog (feature_key, display_name, credit_cost, preferred_provider) values
  ('ai_lead_scoring',       'AI Lead Scoring',            5,  'openai'),
  ('ai_email_draft',        'AI Email Drafting',          3,  'gemini'),
  ('ai_document_analysis',  'AI Document Analysis',       10, 'openai'),
  ('ai_deal_insights',      'AI Deal Insights',           5,  'openai'),
  ('ai_reply_suggestion',   'AI Reply Suggestion',        3,  'gemini')
on conflict (feature_key) do nothing;

-- ── DEFAULT PIPELINE STAGES (inserted per org on signup) ─────────
-- Handled in the signup API route, not here.

-- ═══════════════════════════════════════════════════════════════
-- END OF ICRM SCHEMA
-- ═══════════════════════════════════════════════════════════════
