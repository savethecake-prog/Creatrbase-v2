-- ============================================================
-- 003_create_brand_registry.sql
-- Brand intelligence layer. Not tenant-scoped — shared across
-- all creators. The brand registry is a platform-level asset.
-- ============================================================

-- ============================================================
-- BRANDS
-- Stable identity data. Manually curated. Changes rarely.
-- ============================================================
CREATE TABLE brands (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name              TEXT NOT NULL,
  brand_slug              TEXT NOT NULL,
  parent_brand_id         UUID REFERENCES brands(id) ON DELETE SET NULL,
  category                TEXT NOT NULL CHECK (category IN (
                            'gaming_hardware',
                            'gaming_software',
                            'gaming_nutrition',
                            'gaming_apparel',
                            'd2c_grooming',
                            'd2c_wellness',
                            'd2c_tech_accessories',
                            'publisher',
                            'other'
                          )),
  sub_category            TEXT,
  website                 TEXT,
  known_affiliate_domains TEXT[],
  known_promo_patterns    TEXT[],
  partnership_email       TEXT,
  partnership_url         TEXT,
  geo_presence            TEXT[] NOT NULL DEFAULT '{}',
  creator_programme_type  TEXT NOT NULL DEFAULT 'unknown'
                            CHECK (creator_programme_type IN (
                              'direct','agency_managed','platform_managed','unknown'
                            )),
  notes                   TEXT,
  registry_confidence     TEXT NOT NULL DEFAULT 'minimal'
                            CHECK (registry_confidence IN (
                              'established','partial','minimal'
                            )),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by              TEXT NOT NULL,
  UNIQUE(brand_slug)
);

CREATE INDEX idx_brands_category   ON brands(category);
CREATE INDEX idx_brands_confidence ON brands(registry_confidence);

CREATE TRIGGER set_updated_at_brands
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BRAND ACTIVITY LOG
-- Append only. Never update a row.
-- Time-series of every observed brand campaign event.
-- ============================================================
CREATE TABLE brand_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  observed_at   TIMESTAMPTZ NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
                  'gifting_cluster',
                  'paid_integration_observed',
                  'promo_code_active',
                  'affiliate_programme_active',
                  'user_confirmed_deal',
                  'user_confirmed_gifting',
                  'outreach_sequence_detected',
                  'campaign_ended'
                )),
  niche         TEXT NOT NULL,
  geo           TEXT NOT NULL CHECK (geo IN ('UK','US','EU','global')),
  creator_tier  TEXT CHECK (creator_tier IN ('micro','rising','mid','established')),
  evidence_type TEXT NOT NULL CHECK (evidence_type IN (
                  'public_content_scan',
                  'user_report',
                  'affiliate_link_detected',
                  'promo_code_detected',
                  'seed_data',
                  'manual_research'
                )),
  evidence_url  TEXT,
  confidence    TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  notes         TEXT,
  logged_by     TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bal_brand_time   ON brand_activity_log(brand_id, observed_at DESC);
CREATE INDEX idx_bal_niche_geo    ON brand_activity_log(niche, geo, observed_at DESC);
CREATE INDEX idx_bal_type_recent  ON brand_activity_log(activity_type, observed_at DESC);

-- ============================================================
-- BRAND TIER PROFILES
-- Commercial intelligence layer. Buying window + rate model.
-- One row per brand + niche + geo + creator_tier combination.
-- ============================================================
CREATE TABLE brand_tier_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  niche                       TEXT NOT NULL,
  geo                         TEXT NOT NULL CHECK (geo IN ('UK','US','EU','global')),
  creator_tier                TEXT NOT NULL CHECK (creator_tier IN (
                                'micro','rising','mid','established'
                              )),
  -- Buying window
  buying_window_status        TEXT NOT NULL DEFAULT 'inactive'
                                CHECK (buying_window_status IN (
                                  'active','warming','cycling','prospecting','inactive'
                                )),
  status_confidence           TEXT NOT NULL DEFAULT 'low'
                                CHECK (status_confidence IN ('high','medium','low')),
  status_last_reviewed        TIMESTAMPTZ,
  status_reasoning            TEXT,
  -- Rate model (stored in pence/cents — never float)
  typical_deliverable         TEXT CHECK (typical_deliverable IN (
                                'dedicated_video',
                                'integrated_60s',
                                'integrated_30s',
                                'shorts_only',
                                'multi_platform',
                                'gifting_only'
                              )),
  rate_range_low              INTEGER,
  rate_range_high             INTEGER,
  rate_currency               TEXT CHECK (rate_currency IN ('GBP','USD')),
  rate_confidence             TEXT CHECK (rate_confidence IN (
                                'high','medium','low','insufficient_data'
                              )),
  rate_data_points            INTEGER NOT NULL DEFAULT 0,
  rate_last_updated           TIMESTAMPTZ,
  -- Campaign pattern
  typical_campaign_duration_days INTEGER,
  typical_cycle_gap_days         INTEGER,
  last_active_date               DATE,
  next_window_estimate           DATE,
  next_window_confidence         TEXT CHECK (next_window_confidence IN ('high','medium','low')),
  -- Creator requirements (observed minimums — not prescriptive)
  min_subscribers_observed       INTEGER,
  min_engagement_rate_observed   NUMERIC(5,4),
  exclusivity_typical            TEXT CHECK (exclusivity_typical IN ('none','category','full')),
  payment_terms_typical          INTEGER, -- days
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by                     TEXT NOT NULL,
  UNIQUE(brand_id, niche, geo, creator_tier)
);

CREATE INDEX idx_btp_brand          ON brand_tier_profiles(brand_id);
CREATE INDEX idx_btp_niche_geo      ON brand_tier_profiles(niche, geo, buying_window_status);
CREATE INDEX idx_btp_active_windows ON brand_tier_profiles(niche, geo, creator_tier)
  WHERE buying_window_status IN ('active','warming');

CREATE TRIGGER set_updated_at_btp
  BEFORE UPDATE ON brand_tier_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- BRAND CREATOR INTERACTIONS
-- Relationship layer. Every confirmed touchpoint between
-- a brand and a creator. Powers rate inference model.
-- ============================================================
CREATE TABLE brand_creator_interactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id                 UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  -- creator_id nullable: external creators not on platform
  creator_id               UUID REFERENCES creators(id) ON DELETE SET NULL,
  tenant_id                UUID REFERENCES tenants(id) ON DELETE SET NULL,
  external_creator_handle  TEXT,
  external_creator_platform TEXT CHECK (external_creator_platform IN (
                               'youtube','twitch','instagram','tiktok'
                             )),
  external_creator_tier    TEXT CHECK (external_creator_tier IN (
                             'micro','rising','mid','established'
                           )),
  niche                    TEXT NOT NULL,
  geo                      TEXT NOT NULL CHECK (geo IN ('UK','US','EU','global')),
  interaction_type         TEXT NOT NULL CHECK (interaction_type IN (
                             'gifting_received',
                             'paid_deal_confirmed',
                             'outreach_sent',
                             'outreach_responded',
                             'outreach_declined',
                             'deal_negotiating',
                             'deal_completed',
                             'relationship_ongoing'
                           )),
  interaction_date         DATE NOT NULL,
  deliverable_type         TEXT,
  -- Rate data (pence/cents — never float)
  agreed_rate              INTEGER,
  rate_currency            TEXT CHECK (rate_currency IN ('GBP','USD')),
  offered_rate             INTEGER,
  negotiation_delta        INTEGER GENERATED ALWAYS AS (
                             CASE
                               WHEN agreed_rate IS NOT NULL AND offered_rate IS NOT NULL
                               THEN agreed_rate - offered_rate
                               ELSE NULL
                             END
                           ) STORED,
  deal_notes               TEXT,
  evidence_type            TEXT NOT NULL CHECK (evidence_type IN (
                             'user_reported',
                             'observed_public_content',
                             'seed_data',
                             'inferred'
                           )),
  confidence               TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  -- Privacy: false = creator marked private, never feeds aggregate model
  is_public                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               TEXT NOT NULL
);

CREATE INDEX idx_bci_brand_id   ON brand_creator_interactions(brand_id);
CREATE INDEX idx_bci_creator_id ON brand_creator_interactions(creator_id)
  WHERE creator_id IS NOT NULL;
CREATE INDEX idx_bci_niche_geo  ON brand_creator_interactions(niche, geo, interaction_date DESC);
CREATE INDEX idx_bci_public     ON brand_creator_interactions(niche, geo, external_creator_tier)
  WHERE is_public = TRUE AND interaction_type = 'paid_deal_confirmed';

INSERT INTO schema_migrations (version) VALUES ('003');
