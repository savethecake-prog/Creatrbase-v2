-- ============================================================
-- 002_create_creators_platforms.sql
-- Creator identity, platform connections, niche classification,
-- commercial profiles, content analysis run audit trail.
-- ============================================================

-- ============================================================
-- CREATORS
-- One per user. Created in the same transaction as tenant+user.
-- ============================================================
CREATE TABLE creators (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id                  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name             TEXT NOT NULL,
  onboarding_step          TEXT NOT NULL DEFAULT 'account_created'
                             CHECK (onboarding_step IN (
                               'account_created',
                               'platform_connected',
                               'baseline_complete',
                               'insight_shown',
                               'niche_confirmed',
                               'dashboard_reached'
                             )),
  onboarding_completed_at  TIMESTAMPTZ,
  first_insight_shown_at   TIMESTAMPTZ,
  first_action_accepted_at TIMESTAMPTZ,
  digest_send_day          INTEGER NOT NULL DEFAULT 1
                             CHECK (digest_send_day BETWEEN 1 AND 7),
  digest_send_time         TIME NOT NULL DEFAULT '08:00:00',
  analysis_mode            TEXT NOT NULL DEFAULT 'automatic'
                             CHECK (analysis_mode IN ('automatic','manual','scheduled')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id),
  UNIQUE(user_id)
);

CREATE INDEX idx_creators_tenant ON creators(tenant_id);

CREATE TRIGGER set_updated_at_creators
  BEFORE UPDATE ON creators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CREATOR PLATFORM PROFILES
-- One row per connected platform per creator.
-- Tokens stored encrypted at application layer (AES-256-GCM)
-- before write. Never decrypt in SQL queries.
-- ============================================================
CREATE TABLE creator_platform_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                  UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform                    TEXT NOT NULL CHECK (platform IN ('youtube','twitch')),
  platform_user_id            TEXT NOT NULL,
  platform_username           TEXT,
  platform_display_name       TEXT,
  platform_url                TEXT,
  connected_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at              TIMESTAMPTZ,
  sync_status                 TEXT NOT NULL DEFAULT 'active'
                                CHECK (sync_status IN (
                                  'active','paused','error','disconnected'
                                )),
  -- Tokens: encrypted at application layer before write
  access_token                TEXT NOT NULL,
  refresh_token               TEXT,
  token_expires_at            TIMESTAMPTZ,
  scopes_granted              TEXT[],
  -- Current metric snapshot (updated on each sync)
  subscriber_count            INTEGER,
  total_view_count            BIGINT,
  video_count                 INTEGER,
  avg_views_per_video_30d     NUMERIC(10,2),
  engagement_rate_30d         NUMERIC(5,4),
  -- YouTube-specific (24-72h analytics lag — always display with timestamp)
  watch_hours_12mo            NUMERIC(10,2),
  shorts_views_90d            BIGINT,
  public_uploads_90d          INTEGER,
  analytics_last_synced_at    TIMESTAMPTZ,
  -- Twitch-specific
  avg_concurrent_viewers_30d  NUMERIC(6,2),
  stream_hours_30d            NUMERIC(8,2),
  unique_broadcast_days_30d   INTEGER,
  -- Audience signals
  primary_audience_geo        TEXT,
  secondary_audience_geo      TEXT,
  audience_age_range          TEXT,
  audience_gender_skew        TEXT CHECK (audience_gender_skew IN (
                                'male_dominant','female_dominant','balanced','unknown'
                              )),
  -- Platform monetisation status
  ypp_status                  TEXT CHECK (ypp_status IN (
                                'not_eligible','early_access','full_ypp','unknown'
                              )),
  twitch_affiliate            BOOLEAN,
  twitch_partner              BOOLEAN,
  -- WebSub (YouTube PubSubHubbub)
  pubsub_topic                TEXT,
  pubsub_subscribed_at        TIMESTAMPTZ,
  pubsub_expires_at           TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, platform),
  UNIQUE(platform, platform_user_id)
);

CREATE INDEX idx_cpp_tenant        ON creator_platform_profiles(tenant_id);
CREATE INDEX idx_cpp_creator       ON creator_platform_profiles(creator_id);
CREATE INDEX idx_cpp_sync_status   ON creator_platform_profiles(sync_status)
  WHERE sync_status = 'active';
CREATE INDEX idx_cpp_pubsub_expiry ON creator_platform_profiles(pubsub_expires_at)
  WHERE pubsub_expires_at IS NOT NULL;

CREATE TRIGGER set_updated_at_cpp
  BEFORE UPDATE ON creator_platform_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CONTENT ANALYSIS RUNS
-- Append only. Never update a row.
-- Audit trail for every niche classification run.
-- ============================================================
CREATE TABLE content_analysis_runs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id            UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform              TEXT NOT NULL CHECK (platform IN ('youtube','twitch')),
  run_type              TEXT NOT NULL CHECK (run_type IN (
                          'baseline','refinement','triggered'
                        )),
  triggered_by          TEXT NOT NULL CHECK (triggered_by IN (
                          'system_onboarding',
                          'scheduled_refinement',
                          'user_requested',
                          'significant_metric_change',
                          'user_manual_within_cap',
                          'user_manual_credit_spend'
                        )),
  run_status            TEXT NOT NULL DEFAULT 'queued'
                          CHECK (run_status IN (
                            'queued','running','complete','failed'
                          )),
  videos_sampled        INTEGER,
  video_ids_sampled     TEXT[],
  signals_extracted     JSONB,
  -- REQUIRED: log prompt version on every AI call
  claude_prompt_version TEXT,
  claude_raw_output     JSONB,
  classification_output JSONB,
  confidence_score      INTEGER CHECK (confidence_score BETWEEN 0 AND 100),
  error_details         TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_car_tenant_creator ON content_analysis_runs(tenant_id, creator_id, created_at DESC);
CREATE INDEX idx_car_status         ON content_analysis_runs(run_status)
  WHERE run_status IN ('queued','running');

-- ============================================================
-- CREATOR NICHE PROFILES
-- Classification output. One per creator per platform.
-- Updated by content analysis runs.
-- ============================================================
CREATE TABLE creator_niche_profiles (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                 UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform                   TEXT NOT NULL CHECK (platform IN ('youtube','twitch')),
  primary_niche_category     TEXT CHECK (primary_niche_category IN (
                               'gaming','lifestyle','tech','fitness',
                               'beauty','finance','other'
                             )),
  primary_niche_specific     TEXT,
  secondary_niche_specific   TEXT,
  content_format_primary     TEXT CHECK (content_format_primary IN (
                               'review','walkthrough','commentary','tutorial',
                               'lifestyle_vlog','challenge','educational'
                             )),
  content_format_secondary   TEXT,
  affiliate_domains_detected TEXT[],
  promo_codes_detected       TEXT[],
  brands_mentioned           UUID[],
  existing_partnerships      BOOLEAN NOT NULL DEFAULT FALSE,
  classification_confidence  TEXT NOT NULL DEFAULT 'low'
                               CHECK (classification_confidence IN ('high','medium','low')),
  classification_method      TEXT NOT NULL DEFAULT 'baseline_run'
                               CHECK (classification_method IN (
                                 'baseline_run','user_confirmed','manually_reviewed'
                               )),
  user_confirmed             BOOLEAN NOT NULL DEFAULT FALSE,
  user_confirmed_at          TIMESTAMPTZ,
  user_correction_notes      TEXT,
  niche_creator_density      TEXT DEFAULT 'unknown'
                               CHECK (niche_creator_density IN (
                                 'sparse','moderate','saturated','unknown'
                               )),
  density_confidence         TEXT DEFAULT 'low'
                               CHECK (density_confidence IN ('high','medium','low')),
  density_last_calculated    TIMESTAMPTZ,
  baseline_run_id            UUID REFERENCES content_analysis_runs(id) ON DELETE SET NULL,
  last_refined_at            TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, platform)
);

CREATE INDEX idx_cnp_tenant   ON creator_niche_profiles(tenant_id);
CREATE INDEX idx_cnp_creator  ON creator_niche_profiles(creator_id);

CREATE TRIGGER set_updated_at_cnp
  BEFORE UPDATE ON creator_niche_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- CREATOR COMMERCIAL PROFILES
-- Viability scores, gap analysis, rate estimates.
-- One row per creator. Updated by scoring engine.
-- ============================================================
CREATE TABLE creator_commercial_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                  UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  -- Overall viability
  commercial_viability_score  INTEGER CHECK (commercial_viability_score BETWEEN 0 AND 100),
  viability_score_confidence  TEXT CHECK (viability_score_confidence IN ('high','medium','low')),
  viability_last_calculated   TIMESTAMPTZ,
  viability_breakdown         JSONB, -- full dimension scores and weights, auditable
  commercial_tier             TEXT CHECK (commercial_tier IN (
                                'pre_commercial','emerging','viable','established'
                              )),
  gap_to_next_tier            JSONB, -- what metrics need to move and by how much
  gap_primary_constraint      TEXT CHECK (gap_primary_constraint IN (
                                'subscriber_momentum',
                                'engagement_quality',
                                'niche_commercial_value',
                                'audience_geo_alignment',
                                'content_consistency',
                                'content_brand_alignment'
                              )),
  projected_tier_upgrade_date DATE,
  -- Rate estimates (stored in pence/cents — never float)
  estimated_rate_low          INTEGER,
  estimated_rate_high         INTEGER,
  rate_currency               TEXT CHECK (rate_currency IN ('GBP','USD')),
  rate_confidence             TEXT CHECK (rate_confidence IN (
                                'high','medium','low','insufficient_data'
                              )),
  rate_last_calculated        TIMESTAMPTZ,
  -- Confirmed deal history
  confirmed_deals_count       INTEGER NOT NULL DEFAULT 0,
  confirmed_earnings_total    INTEGER NOT NULL DEFAULT 0,
  confirmed_earnings_12mo     INTEGER NOT NULL DEFAULT 0,
  last_deal_date              DATE,
  -- Content consistency signals
  avg_posts_per_week          NUMERIC(4,2),
  posting_consistency_score   INTEGER CHECK (posting_consistency_score BETWEEN 0 AND 100),
  last_posted_at              TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_ccp_tenant  ON creator_commercial_profiles(tenant_id);
CREATE INDEX idx_ccp_creator ON creator_commercial_profiles(creator_id);

CREATE TRIGGER set_updated_at_ccp
  BEFORE UPDATE ON creator_commercial_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DIMENSION SCORE HISTORY
-- Time-series. Append only. Powers the progress chart.
-- ============================================================
CREATE TABLE dimension_score_history (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                      UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  scored_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trigger_type                    TEXT NOT NULL,
  subscriber_momentum_score       INTEGER,
  subscriber_momentum_conf        TEXT,
  engagement_quality_score        INTEGER,
  engagement_quality_conf         TEXT,
  niche_commercial_value_score    INTEGER,
  niche_commercial_value_conf     TEXT,
  audience_geo_alignment_score    INTEGER,
  audience_geo_alignment_conf     TEXT,
  content_consistency_score       INTEGER,
  content_consistency_conf        TEXT,
  content_brand_alignment_score   INTEGER,
  content_brand_alignment_conf    TEXT,
  overall_score                   INTEGER,
  commercial_tier                 TEXT
);

CREATE INDEX idx_dsh_creator_time ON dimension_score_history(tenant_id, creator_id, scored_at DESC);

-- ============================================================
-- CREATOR MILESTONES
-- One row per milestone per creator.
-- ============================================================
CREATE TABLE creator_milestones (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id            UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  milestone_type        TEXT NOT NULL CHECK (milestone_type IN (
                          'giftable',
                          'outreach_ready',
                          'paid_integration_viable',
                          'rate_negotiation_power',
                          'portfolio_creator'
                        )),
  status                TEXT NOT NULL DEFAULT 'not_started'
                          CHECK (status IN (
                            'not_started','in_progress','approaching','crossed'
                          )),
  approaching_threshold NUMERIC(5,2),
  crossed_at            TIMESTAMPTZ,
  crossing_metric       TEXT,
  crossing_metric_value TEXT,
  threshold_snapshot    JSONB,
  capabilities_unlocked TEXT[],
  first_shown_at        TIMESTAMPTZ,
  notification_sent_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(creator_id, milestone_type)
);

CREATE INDEX idx_milestones_creator ON creator_milestones(tenant_id, creator_id);

CREATE TRIGGER set_updated_at_milestones
  BEFORE UPDATE ON creator_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO schema_migrations (version) VALUES ('002');
