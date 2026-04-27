-- ============================================================
-- ICRM Phase 6 Schema: Support, Field Visits, Loyalty,
--                       Documents, Campaigns
-- Run this in Supabase SQL Editor after phase5 schema
-- ============================================================

-- ─── Support Tickets ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_tickets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  priority      TEXT NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','critical')),
  type          TEXT DEFAULT 'general'
                  CHECK (type IN ('general','billing','technical','feature_request','complaint','other')),
  account_id    UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  sla_due_at    TIMESTAMPTZ,
  created_by    UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_ticket_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  ticket_id   UUID NOT NULL REFERENCES crm_tickets(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_by  UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Field Visits ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_field_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  visit_number  TEXT NOT NULL,
  title         TEXT NOT NULL,
  account_id    UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  contact_id    UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  assigned_to   UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled'
                  CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  scheduled_at  TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  location      TEXT,
  notes         TEXT,
  outcome       TEXT,
  created_by    UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Loyalty ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_loyalty_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  contact_id      UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  account_id      UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  points_balance  INTEGER NOT NULL DEFAULT 0,
  tier            TEXT NOT NULL DEFAULT 'bronze'
                    CHECK (tier IN ('bronze','silver','gold','platinum')),
  total_earned    INTEGER NOT NULL DEFAULT 0,
  total_redeemed  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_loyalty_transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  loyalty_account_id UUID NOT NULL REFERENCES crm_loyalty_accounts(id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN ('earn','redeem','adjust','expire')),
  points             INTEGER NOT NULL,
  description        TEXT,
  reference_id       UUID,
  created_by         UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ─── Documents ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_type   TEXT,
  file_size   BIGINT,
  category    TEXT DEFAULT 'general'
                CHECK (category IN ('contract','proposal','invoice','report','legal','general','other')),
  account_id  UUID REFERENCES crm_accounts(id) ON DELETE SET NULL,
  contact_id  UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  deal_id     UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─── Campaigns ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'email'
                     CHECK (type IN ('email','whatsapp','sms')),
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','scheduled','sending','sent','paused','cancelled')),
  subject          TEXT,
  body             TEXT,
  from_name        TEXT,
  scheduled_at     TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  recipient_count  INTEGER DEFAULT 0,
  open_count       INTEGER DEFAULT 0,
  click_count      INTEGER DEFAULT 0,
  bounce_count     INTEGER DEFAULT 0,
  unsubscribe_count INTEGER DEFAULT 0,
  target_segment   JSONB DEFAULT '{}',
  created_by       UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── RLS Policies ────────────────────────────────────────────
ALTER TABLE crm_tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_ticket_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_field_visits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_loyalty_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_campaigns            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON crm_tickets              USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_ticket_comments      USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_field_visits         USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_loyalty_accounts     USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_loyalty_transactions USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_documents            USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));
CREATE POLICY "org_isolation" ON crm_campaigns            USING (org_id = (SELECT org_id FROM crm_users WHERE id = auth.uid()));

-- ─── Document numbering for tickets and field visits ─────────
-- Uses the same next_doc_number RPC from phase5 schema
-- ticket: TKT-XXXX, visit: FV-XXXX

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_crm_tickets_org       ON crm_tickets(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_tickets_status    ON crm_tickets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_field_visits_org  ON crm_field_visits(org_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_loyalty_contact   ON crm_loyalty_accounts(org_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_documents_org     ON crm_documents(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_campaigns_org     ON crm_campaigns(org_id, created_at DESC);
