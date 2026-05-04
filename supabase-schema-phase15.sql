-- ─────────────────────────────────────────────────────────────────────
-- PHASE 15 — Products, Expenses, Knowledge Base, Announcements
-- (Calendar is a pure aggregation view — no schema needed)
-- ─────────────────────────────────────────────────────────────────────

-- 1. PRODUCTS CATALOG
create table if not exists crm_products (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  name         text not null,
  sku          text,
  description  text,
  unit_price   numeric(15,2) not null default 0,
  currency     text default 'INR',
  tax_pct      numeric(5,2) default 18,
  category     text,
  unit         text default 'unit',
  is_active    boolean default true,
  created_by   uuid references crm_users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_crm_products_org   on crm_products(org_id);
create index if not exists idx_crm_products_active on crm_products(org_id, is_active);
alter table crm_products enable row level security;
do $$ begin create policy "crm_products_org_isolation" on crm_products
  using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 2. EXPENSES
create table if not exists crm_expenses (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  expense_number  text not null,
  user_id         uuid not null references crm_users(id) on delete cascade,
  project_id      uuid references crm_projects(id) on delete set null,
  account_id      uuid references crm_accounts(id) on delete set null,
  category        text not null default 'general'
                    check (category in ('travel','meals','accommodation','supplies','software','marketing','training','client_entertainment','general','other')),
  amount          numeric(15,2) not null check (amount > 0),
  currency        text default 'INR',
  expense_date    date not null,
  description     text not null,
  receipt_url     text,
  status          text not null default 'draft'
                    check (status in ('draft','submitted','approved','rejected','reimbursed')),
  is_billable     boolean default false,
  reimbursable    boolean default true,
  submitted_at    timestamptz,
  approved_by     uuid references crm_users(id) on delete set null,
  approved_at     timestamptz,
  rejection_reason text,
  reimbursed_at   timestamptz,
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_crm_expenses_org    on crm_expenses(org_id);
create index if not exists idx_crm_expenses_user   on crm_expenses(user_id, expense_date desc);
create index if not exists idx_crm_expenses_status on crm_expenses(org_id, status);
alter table crm_expenses enable row level security;
do $$ begin create policy "crm_expenses_org_isolation" on crm_expenses
  using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 3. KNOWLEDGE BASE
create table if not exists crm_kb_articles (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  slug            text not null,
  title           text not null,
  content         text not null,
  excerpt         text,
  category        text default 'general',
  tags            text[] default '{}',
  status          text not null default 'draft'
                    check (status in ('draft','published','archived')),
  is_public       boolean default true,
  view_count      int default 0,
  helpful_count   int default 0,
  unhelpful_count int default 0,
  author_id       uuid references crm_users(id) on delete set null,
  published_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (org_id, slug)
);
create index if not exists idx_crm_kb_org      on crm_kb_articles(org_id, status);
create index if not exists idx_crm_kb_slug     on crm_kb_articles(slug) where is_public = true and status = 'published';
alter table crm_kb_articles enable row level security;
do $$ begin create policy "crm_kb_articles_org_isolation" on crm_kb_articles
  using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 4. ANNOUNCEMENTS
create table if not exists crm_announcements (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  title         text not null,
  body          text not null,
  category      text default 'general'
                  check (category in ('general','feature','maintenance','policy','event','urgent')),
  audience      text default 'all'
                  check (audience in ('all','admins','sales','support','finance')),
  is_pinned     boolean default false,
  starts_at     timestamptz default now(),
  ends_at       timestamptz,
  created_by    uuid references crm_users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists idx_crm_announcements_org on crm_announcements(org_id, starts_at desc);
alter table crm_announcements enable row level security;
do $$ begin create policy "crm_announcements_org_isolation" on crm_announcements
  using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 5. Update next_doc_number RPC to add EXP prefix for expenses
create or replace function next_doc_number(p_org_id uuid, p_type text, p_prefix text default null)
returns text language plpgsql as $$
declare
  v_prefix text;
  v_next int;
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
