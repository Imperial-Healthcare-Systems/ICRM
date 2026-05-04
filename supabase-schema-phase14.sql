-- ─────────────────────────────────────────────────────────────────────
-- PHASE 14 — Delivery (Projects + Tasks + Time Entries)
-- ─────────────────────────────────────────────────────────────────────

-- 1. PROJECTS
create table if not exists crm_projects (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  description     text,
  account_id      uuid references crm_accounts(id) on delete set null,
  deal_id         uuid references crm_deals(id) on delete set null,
  status          text not null default 'planning'
                    check (status in ('planning','active','on_hold','completed','cancelled')),
  priority        text not null default 'medium'
                    check (priority in ('low','medium','high','critical')),
  start_date      date,
  end_date        date,
  actual_end_date date,
  budget          numeric(15,2),
  currency        text default 'INR',
  hourly_rate     numeric(10,2),
  is_billable     boolean default true,
  owner_id        uuid references crm_users(id) on delete set null,
  tags            text[] default '{}',
  notes           text,
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_crm_projects_org      on crm_projects(org_id);
create index if not exists idx_crm_projects_account  on crm_projects(account_id);
create index if not exists idx_crm_projects_status   on crm_projects(org_id, status);

alter table crm_projects enable row level security;
do $$ begin
  create policy "crm_projects_org_isolation" on crm_projects
    using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 2. TASKS
create table if not exists crm_tasks (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  project_id      uuid references crm_projects(id) on delete cascade,
  title           text not null,
  description     text,
  status          text not null default 'todo'
                    check (status in ('todo','in_progress','review','done','cancelled')),
  priority        text not null default 'medium'
                    check (priority in ('low','medium','high','critical')),
  assignee_id     uuid references crm_users(id) on delete set null,
  due_date        date,
  estimated_minutes int,
  actual_minutes  int default 0,
  completed_at    timestamptz,
  position        int default 0,
  tags            text[] default '{}',
  created_by      uuid references crm_users(id) on delete set null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists idx_crm_tasks_org      on crm_tasks(org_id);
create index if not exists idx_crm_tasks_project  on crm_tasks(project_id, position);
create index if not exists idx_crm_tasks_assignee on crm_tasks(assignee_id, status);

alter table crm_tasks enable row level security;
do $$ begin
  create policy "crm_tasks_org_isolation" on crm_tasks
    using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 3. TIME ENTRIES
create table if not exists crm_time_entries (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  user_id       uuid not null references crm_users(id) on delete cascade,
  task_id       uuid references crm_tasks(id) on delete set null,
  project_id    uuid references crm_projects(id) on delete set null,
  description   text,
  started_at    timestamptz not null,
  ended_at      timestamptz,
  duration_secs int,
  is_billable   boolean default true,
  hourly_rate   numeric(10,2),
  approved      boolean default false,
  approved_by   uuid references crm_users(id) on delete set null,
  approved_at   timestamptz,
  notes         text,
  created_at    timestamptz default now()
);

-- Only ONE active (running) timer per user
create unique index if not exists uniq_crm_time_active_per_user
  on crm_time_entries(user_id) where ended_at is null;

create index if not exists idx_crm_time_entries_user    on crm_time_entries(user_id, started_at desc);
create index if not exists idx_crm_time_entries_task    on crm_time_entries(task_id);
create index if not exists idx_crm_time_entries_project on crm_time_entries(project_id, started_at desc);

alter table crm_time_entries enable row level security;
do $$ begin
  create policy "crm_time_entries_org_isolation" on crm_time_entries
    using (org_id = (select org_id from crm_users where id = auth.uid()));
exception when duplicate_object then null; end $$;

-- 4. RPC: rollup actual_minutes onto a task whenever a time entry changes
create or replace function recalc_task_actual_minutes(p_task_id uuid) returns void
language plpgsql as $$
begin
  update crm_tasks set actual_minutes = coalesce((
    select sum(coalesce(duration_secs, 0)) / 60
    from crm_time_entries
    where task_id = p_task_id and ended_at is not null
  ), 0)
  where id = p_task_id;
end; $$;

notify pgrst, 'reload schema';
