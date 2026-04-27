-- ─────────────────────────────────────────────────────────────────────
-- PHASE 10 — additive migration for shared `organisations` table.
-- Adds all columns ICRM expects without disturbing IHRMS columns.
-- Safe to run multiple times (uses IF NOT EXISTS where supported,
-- and DO blocks for idempotent column adds).
-- ─────────────────────────────────────────────────────────────────────

-- 1. ORG: identity / contact
alter table organisations add column if not exists email      text;
alter table organisations add column if not exists phone      text;
alter table organisations add column if not exists website    text;
alter table organisations add column if not exists industry   text;
alter table organisations add column if not exists address    text;
alter table organisations add column if not exists logo_url   text;

-- 2. ORG: India compliance
alter table organisations add column if not exists gstin      text;
alter table organisations add column if not exists pan        text;

-- 3. ORG: subscription / plan
alter table organisations add column if not exists plan_tier           text default 'starter';
alter table organisations add column if not exists subscription_status text default 'trialing';
alter table organisations add column if not exists trial_ends_at       timestamptz;

-- enforce allowed values (idempotent)
do $$ begin
  alter table organisations
    add constraint organisations_plan_tier_check
      check (plan_tier in ('starter','growth','pro','enterprise'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table organisations
    add constraint organisations_subscription_status_check
      check (subscription_status in ('trialing','active','past_due','cancelled','suspended','trial_expired'));
exception when duplicate_object then null; end $$;

-- 4. ORG: feature flags
alter table organisations add column if not exists icrm_enabled boolean default true;

-- 5. timestamps (in case the IHRMS table predates them)
alter table organisations add column if not exists created_at timestamptz default now();
alter table organisations add column if not exists updated_at timestamptz default now();
