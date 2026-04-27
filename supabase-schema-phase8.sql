-- ═══════════════════════════════════════════════════════════════
-- ICRM Phase 8 — Payment Orders & Automation Execution Tracking
-- Run in Supabase SQL Editor after the COMPLETE schema
-- ═══════════════════════════════════════════════════════════════

-- ── PAYMENT ORDERS ───────────────────────────────────────────────────
-- Tracks Cashfree payment sessions for credit top-ups
create table if not exists crm_payment_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  user_id       uuid references crm_users(id) on delete set null,
  cf_order_id   text not null unique,
  credits       int not null,
  amount_inr    numeric(10,2) not null,
  package_id    text not null,
  status        text not null default 'created'
                  check (status in ('created','paid','failed','expired')),
  payment_ref   text,
  cf_payment_id text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_crm_payment_orders_org    on crm_payment_orders(org_id);
create index if not exists idx_crm_payment_orders_status on crm_payment_orders(status);

alter table crm_payment_orders enable row level security;
create policy "crm_payment_orders_org_isolation" on crm_payment_orders
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── AUTOMATION EXECUTIONS ────────────────────────────────────────────
-- Prevents duplicate automation runs on the same resource
create table if not exists crm_automation_executions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  rule_id     uuid not null references crm_automation_rules(id) on delete cascade,
  resource_id uuid not null,
  executed_at timestamptz default now(),
  unique (rule_id, resource_id)
);

create index if not exists idx_crm_automation_executions on crm_automation_executions(rule_id, executed_at);

alter table crm_automation_executions enable row level security;
create policy "crm_automation_executions_org_isolation" on crm_automation_executions
  using (org_id = (select org_id from crm_users where id = auth.uid()));

-- ── AUTOMATION RUN COUNT INCREMENT ───────────────────────────────────
create or replace function increment_rule_run_count(p_rule_id uuid) returns void
language sql security definer as $$
  update crm_automation_rules
  set run_count = run_count + 1, last_run_at = now()
  where id = p_rule_id;
$$;

-- ── ADD CREDITS RPC ──────────────────────────────────────────────────
-- Called by webhook after successful Cashfree payment
create or replace function add_org_credits(
  p_org_id      uuid,
  p_amount      int,
  p_user_id     uuid,
  p_ref_id      text,
  p_description text default 'Credit top-up'
) returns void
language plpgsql security definer
as $$
begin
  insert into org_credits (org_id, balance, total_purchased, updated_at)
  values (p_org_id, p_amount, p_amount, now())
  on conflict (org_id) do update
    set balance         = org_credits.balance + p_amount,
        total_purchased = org_credits.total_purchased + p_amount,
        updated_at      = now();

  insert into credit_transactions (org_id, user_id, feature_key, amount, direction, ref_id, description)
  values (p_org_id, p_user_id, 'credit_purchase', p_amount, 'credit', p_ref_id, p_description);
end;
$$;
