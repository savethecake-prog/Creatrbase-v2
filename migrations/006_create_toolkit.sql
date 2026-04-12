-- ============================================================
-- 006_create_toolkit.sql
-- Self-representation toolkit: negotiations, pitch packages,
-- contract reviews, campaign deliveries, brand relationships.
-- ============================================================

-- ============================================================
-- NEGOTIATIONS
-- Brand deal negotiation state machine.
-- ============================================================
CREATE TABLE negotiations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id       UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  brand_id         UUID NOT NULL REFERENCES brands(id),
  status           TEXT NOT NULL DEFAULT 'drafting'
                     CHECK (status IN (
                       'drafting',
                       'offer_received',
                       'counter_drafted',
                       'counter_sent',
                       'agreed',
                       'declined',
                       'brand_declined'
                     )),
  deliverable_type TEXT,
  -- Rates (pence/cents — never float)
  our_opening_rate INTEGER,
  brand_offer_rate INTEGER,
  agreed_rate      INTEGER,
  rate_currency    TEXT CHECK (rate_currency IN ('GBP','USD')),
  -- Market context shown to creator at each negotiation step
  rate_benchmark   JSONB,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_negotiations_creator ON negotiations(tenant_id, creator_id, created_at DESC);
CREATE INDEX idx_negotiations_brand   ON negotiations(brand_id);

CREATE TRIGGER set_updated_at_negotiations
  BEFORE UPDATE ON negotiations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- NEGOTIATION MESSAGES
-- Per-message log with draft and approved content.
-- ============================================================
CREATE TABLE negotiation_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  negotiation_id  UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('outbound','inbound')),
  message_type    TEXT NOT NULL CHECK (message_type IN (
                    'opening_position',
                    'counter_response',
                    'scope_management',
                    'contract_review_response',
                    'inbound_offer',
                    'inbound_reply',
                    'deal_confirmed'
                  )),
  draft_content   TEXT,
  final_content   TEXT,
  -- Was the draft substantially edited before sending?
  creator_edited  BOOLEAN,
  edit_magnitude  TEXT CHECK (edit_magnitude IN ('minor','moderate','substantial')),
  sent_at         TIMESTAMPTZ,
  -- AI audit
  prompt_version  TEXT,
  raw_draft_output JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_neg_messages_negotiation ON negotiation_messages(negotiation_id, created_at ASC);

-- ============================================================
-- CONTRACT REVIEWS
-- Creator pastes contract text, system produces structured review.
-- ============================================================
CREATE TABLE contract_reviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id       UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  negotiation_id   UUID REFERENCES negotiations(id) ON DELETE SET NULL,
  brand_id         UUID REFERENCES brands(id),
  -- Raw contract not stored — privacy. Only the analysis output.
  contract_summary TEXT,
  flags            JSONB,
  risk_rating      TEXT CHECK (risk_rating IN ('low','medium','high')),
  counter_language JSONB,
  -- Always appended to output
  legal_disclaimer TEXT NOT NULL DEFAULT
    'This review reflects market-standard terms and does not constitute legal advice. For contracts of significant value, independent legal review is recommended.',
  prompt_version   TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contract_reviews_creator ON contract_reviews(tenant_id, creator_id, created_at DESC);

-- ============================================================
-- PITCH PACKAGES
-- Outreach email + media kit per brand.
-- ============================================================
CREATE TABLE pitch_packages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id        UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  brand_id          UUID NOT NULL REFERENCES brands(id),
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN (
                        'draft','sent','opened','clicked','replied','archived'
                      )),
  subject_line      TEXT NOT NULL,
  -- Ordered array of block objects: { id, type, content, isEditable }
  -- Block types: header | hook | numbers | audience |
  --              integration | proposal | close | footer
  blocks            JSONB NOT NULL,
  to_email          TEXT,
  -- Resend tracking
  resend_message_id TEXT,
  sent_at           TIMESTAMPTZ,
  opened_at         TIMESTAMPTZ,
  first_click_at    TIMESTAMPTZ,
  click_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pitches_creator ON pitch_packages(tenant_id, creator_id, status, created_at DESC);
CREATE INDEX idx_pitches_resend  ON pitch_packages(resend_message_id)
  WHERE resend_message_id IS NOT NULL;

CREATE TRIGGER set_updated_at_pitches
  BEFORE UPDATE ON pitch_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BRAND RELATIONSHIPS
-- Post-deal relationship health tracking.
-- ============================================================
CREATE TABLE brand_relationships (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id              UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  brand_id                UUID NOT NULL REFERENCES brands(id),
  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','dormant','ended')),
  first_deal_date         DATE,
  last_deal_date          DATE,
  total_deals             INTEGER NOT NULL DEFAULT 0,
  -- Relationship health (updated by monitoring job)
  health_score            INTEGER CHECK (health_score BETWEEN 0 AND 100),
  rebooking_signal        BOOLEAN NOT NULL DEFAULT FALSE,
  rebooking_signal_at     TIMESTAMPTZ,
  last_touchpoint_at      TIMESTAMPTZ,
  next_touchpoint_due     DATE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, brand_id)
);

CREATE INDEX idx_relationships_creator ON brand_relationships(tenant_id, creator_id, status);
CREATE INDEX idx_relationships_rebooking ON brand_relationships(rebooking_signal)
  WHERE rebooking_signal = TRUE;

CREATE TRIGGER set_updated_at_relationships
  BEFORE UPDATE ON brand_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CAMPAIGN DELIVERIES
-- Delivery tracking against agreed contract terms.
-- ============================================================
CREATE TABLE campaign_deliveries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id        UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  brand_id          UUID NOT NULL REFERENCES brands(id),
  negotiation_id    UUID REFERENCES negotiations(id) ON DELETE SET NULL,
  deliverable_type  TEXT NOT NULL,
  due_date          DATE NOT NULL,
  delivered_at      TIMESTAMPTZ,
  revision_rounds_agreed INTEGER NOT NULL DEFAULT 1,
  revisions_used    INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN (
                        'pending','submitted','approved',
                        'revision_requested','complete'
                      )),
  content_url       TEXT,
  performance_report_sent_at TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deliveries_creator ON campaign_deliveries(tenant_id, creator_id, status);
CREATE INDEX idx_deliveries_due     ON campaign_deliveries(due_date)
  WHERE status IN ('pending','submitted','revision_requested');

CREATE TRIGGER set_updated_at_deliveries
  BEFORE UPDATE ON campaign_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO schema_migrations (version) VALUES ('006');
