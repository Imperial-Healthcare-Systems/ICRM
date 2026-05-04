-- ─────────────────────────────────────────────────────────────────────
-- PHASE 17 — Estimates · Territory · Quotas · Communications
-- ─────────────────────────────────────────────────────────────────────

-- 1. Estimates = lighter quotations. Add a flag to crm_quotations.
alter table crm_quotations add column if not exists is_estimate boolean default false;
create index if not exists idx_crm_quotations_estimate on crm_quotations(org_id, is_estimate) where is_estimate = true;

-- 2. TERRITORIES
create table if not exists crm_territories (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  name         text not null,
  description  text,
  parent_id    uuid references crm_territories(id) on delete set null,
  regions      text[] default '{}',         -- list of states/zones/cities
  manager_id   uuid references crm_users(id) on delete set null,
  member_ids   uuid[] default '{}',         -- assigned users
  is_active    boolean default true,
  created_by   uuid references crm_users(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists idx_crm_territories_org on crm_territories(org_id);
alter table crm_territories enable row level security;
do $$ begin create policy "crm_territories_org_isolation" on crm_territories
  using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 3. QUOTAS (sales targets per user per period)
create table if not exists crm_quotas (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  user_id         uuid not null references crm_users(id) on delete cascade,
  territory_id    uuid references crm_territories(id) on delete set null,
  period_type     text not null default 'monthly'
                    check (period_type in ('monthly','quarterly','yearly','custom')),
  period_start    date not null,
  period_end      date not null,
  target_amount   numeric(15,2) not null check (target_amount > 0),
  currency        text default 'INR',
  metric          text default 'revenue'
                    check (metric in ('revenue','deals_won','new_accounts','calls','meetings')),
  notes           text,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (user_id, period_type, period_start, metric)
);
create index if not exists idx_crm_quotas_org_period on crm_quotas(org_id, period_start desc);
create index if not exists idx_crm_quotas_user       on crm_quotas(user_id, period_start desc);
alter table crm_quotas enable row level security;
do $$ begin create policy "crm_quotas_org_isolation" on crm_quotas
  using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 4. Helper RPC: compute current achievement for a quota
create or replace function quota_achievement(p_quota_id uuid) returns numeric
language plpgsql stable as $$
declare
  v_quota record;
  v_achieved numeric := 0;
begin
  select * into v_quota from crm_quotas where id = p_quota_id;
  if not found then return 0; end if;

  if v_quota.metric = 'revenue' then
    select coalesce(sum(deal_value), 0) into v_achieved
    from crm_deals
    where org_id = v_quota.org_id
      and assigned_to = v_quota.user_id
      and deal_status = 'won'
      and actual_close between v_quota.period_start and v_quota.period_end;
  elsif v_quota.metric = 'deals_won' then
    select count(*) into v_achieved
    from crm_deals
    where org_id = v_quota.org_id
      and assigned_to = v_quota.user_id
      and deal_status = 'won'
      and actual_close between v_quota.period_start and v_quota.period_end;
  elsif v_quota.metric = 'new_accounts' then
    select count(*) into v_achieved
    from crm_accounts
    where org_id = v_quota.org_id
      and assigned_to = v_quota.user_id
      and created_at::date between v_quota.period_start and v_quota.period_end;
  elsif v_quota.metric = 'calls' then
    select count(*) into v_achieved
    from crm_activities
    where org_id = v_quota.org_id
      and assigned_to = v_quota.user_id
      and activity_type = 'call'
      and status = 'completed'
      and (completed_at::date between v_quota.period_start and v_quota.period_end);
  elsif v_quota.metric = 'meetings' then
    select count(*) into v_achieved
    from crm_activities
    where org_id = v_quota.org_id
      and assigned_to = v_quota.user_id
      and activity_type = 'meeting'
      and status = 'completed'
      and (completed_at::date between v_quota.period_start and v_quota.period_end);
  end if;

  return v_achieved;
end; $$;

notify pgrst, 'reload schema';
