-- ============================================================
-- ICRM Phase 7 Schema: Automation Rules & Email Sequences
-- Run this in Supabase SQL Editor after phase6 schema
-- ============================================================

-- ─── Automation Rules ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_automation_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  trigger_event       TEXT NOT NULL
                        CHECK (trigger_event IN (
                          'deal.created','deal.won','deal.lost','deal.stage_changed',
                          'contact.created','lead.created','lead.qualified',
                          'ticket.created','ticket.resolved',
                          'invoice.overdue','invoice.paid',
                          'contract.expiring'
                        )),
  trigger_conditions  JSONB DEFAULT '{}',
  action_type         TEXT NOT NULL
                        CHECK (action_type IN (
                          'send_email','create_activity','assign_user',
                          'award_loyalty_points','add_note','update_field',
                          'create_ticket','send_webhook'
                        )),
  action_config       JSONB DEFAULT '{}',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  run_count           INTEGER NOT NULL DEFAULT 0,
  last_run_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── Email Sequences ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_email_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','paused','archived')),
  trigger_on  TEXT DEFAULT 'manual'
                CHECK (trigger_on IN ('manual','lead.created','deal.won','contact.created')),
  created_by  UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_email_sequence_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES crm_email_sequences(id) ON DELETE CASCADE,
  step_order  INTEGER NOT NULL DEFAULT 1,
  delay_days  INTEGER NOT NULL DEFAULT 1,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_email_sequence_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES crm_email_sequences(id) ON DELETE CASCADE,
  contact_id  UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','completed','paused','unsubscribed')),
  current_step INTEGER NOT NULL DEFAULT 0,
  next_send_at TIMESTAMPTZ,
  enrolled_at  TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- ─── AI Usage Logs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_ai_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  feature      TEXT NOT NULL,
  provider     TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  total_tokens  INTEGER DEFAULT 0,
  credits_used  INTEGER DEFAULT 1,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE crm_automation_rules           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_email_sequences            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_email_sequence_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_ai_logs                    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON crm_automation_rules           USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_email_sequences            USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_email_sequence_steps       USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_email_sequence_enrollments USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_ai_logs                    USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_automation_active ON crm_automation_rules(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_crm_automation_trigger ON crm_automation_rules(trigger_event);
CREATE INDEX IF NOT EXISTS idx_crm_seq_enrollments   ON crm_email_sequence_enrollments(org_id, status, next_send_at);
CREATE INDEX IF NOT EXISTS idx_crm_ai_logs_org       ON crm_ai_logs(org_id, created_at DESC);
