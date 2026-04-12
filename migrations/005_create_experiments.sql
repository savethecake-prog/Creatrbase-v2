-- ============================================================
-- 005_create_experiments.sql
-- Experimentation engine. Surfaces structured experiments
-- when data is insufficient for confident recommendations.
-- ============================================================

CREATE TABLE experiments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  -- What gap triggered this experiment
  triggered_by_insufficiency TEXT NOT NULL,
  dimension_target          TEXT NOT NULL CHECK (dimension_target IN (
                              'subscriber_momentum',
                              'engagement_quality',
                              'niche_commercial_value',
                              'audience_geo_alignment',
                              'content_consistency',
                              'content_brand_alignment'
                            )),
  experiment_type           TEXT NOT NULL CHECK (experiment_type IN (
                              'thumbnail_title_test',
                              'posting_time_test',
                              'integration_style_test',
                              'format_test',
                              'brand_category_resonance_test'
                            )),
  -- Plain English fields shown to creator
  hypothesis                TEXT NOT NULL,
  measurement_method        TEXT NOT NULL,
  -- Content references
  control_content_id        TEXT,
  variant_content_ids       TEXT[],
  duration_days             INTEGER NOT NULL,
  start_date                DATE,
  end_date                  DATE,
  status                    TEXT NOT NULL DEFAULT 'designed'
                              CHECK (status IN (
                                'designed','active','completed','abandoned'
                              )),
  -- Results
  results_raw               JSONB,
  results_interpretation    TEXT,
  confidence_gained         TEXT CHECK (confidence_gained IN ('high','medium','low','none')),
  model_update_applied      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Priority scoring
  impact_score              TEXT CHECK (impact_score IN ('high','medium','low')),
  impact_confidence_delta   NUMERIC(3,2),
  impact_dimension_weight   NUMERIC(3,2),
  impact_downstream_unlocks TEXT[],
  -- Interference prevention
  interference_variables    TEXT[],
  -- AI audit
  prompt_version            TEXT,
  raw_design_output         JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_experiments_creator ON experiments(tenant_id, creator_id, status, created_at DESC);
CREATE INDEX idx_experiments_active  ON experiments(creator_id, status)
  WHERE status IN ('designed','active');

CREATE TRIGGER set_updated_at_experiments
  BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO schema_migrations (version) VALUES ('005');
