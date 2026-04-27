-- ═══════════════════════════════════════════════════════════════
-- ICRM Phase 9 — Client Portal Tokens
-- Run in Supabase SQL Editor after phase8 schema
-- ═══════════════════════════════════════════════════════════════

create table if not exists crm_portal_tokens (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  account_id  uuid not null references crm_accounts(id) on delete cascade,
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  label       text,
  expires_at  timestamptz not null default now() + interval '30 days',
  last_used_at timestamptz,
  is_active   boolean not null default true,
  created_by  uuid references crm_users(id) on delete set null,
  created_at  timestamptz default now()
);

create index if not exists idx_crm_portal_tokens_token on crm_portal_tokens(token) where is_active = true;
create index if not exists idx_crm_portal_tokens_org   on crm_portal_tokens(org_id, account_id);

alter table crm_portal_tokens enable row level security;
create policy "crm_portal_tokens_org_isolation" on crm_portal_tokens
  using (org_id = (select org_id from crm_users where id = auth.uid()));
