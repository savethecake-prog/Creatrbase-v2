-- ============================================================
-- 004_create_tasks_recommendations.sql
-- Task engine, recommendation engine, engine run audit trail.
-- ============================================================

-- ============================================================
-- TASK TEMPLATES
-- Recurring task instructions. Templates persist.
-- Instances are generated fresh each cycle.
-- ============================================================
CREATE TABLE task_templates (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  dimension                 TEXT CHECK (dimension IN (
                              'subscriber_momentum',
                              'engagement_quality',
                              'niche_commercial_value',
                              'audience_geo_alignment',
                              'content_consistency',
                              'content_brand_alignment'
                            )),
  template_type             TEXT NOT NULL CHECK (template_type IN (
                              'maintenance','user_defined_recurring'
                            )),
  cadence                   TEXT NOT NULL CHECK (cadence IN (
                              'weekly','fortnightly','monthly'
                            )),
  cadence_day               INTEGER CHECK (cadence_day BETWEEN 1 AND 7),
  last_generated_at         TIMESTAMPTZ,
  next_generation_at        TIMESTAMPTZ,
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  generation_prompt_context JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_creator ON task_templates(tenant_id, creator_id, is_active);
CREATE INDEX idx_templates_next    ON task_templates(next_generation_at)
  WHERE is_active = TRUE;

CREATE TRIGGER set_updated_at_task_templates
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TASKS
-- Every row is a discrete fresh instance.
-- Never re-queue old rows. Recurring tasks generate new rows
-- from task_templates on each cycle.
-- ============================================================
CREATE TABLE tasks (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                  UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  template_id                 UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  task_mode                   TEXT NOT NULL CHECK (task_mode IN (
                                'gap_closure',
                                'maintenance',
                                'adaptation',
                                'user_generated'
                              )),
  dimension                   TEXT CHECK (dimension IN (
                                'subscriber_momentum',
                                'engagement_quality',
                                'niche_commercial_value',
                                'audience_geo_alignment',
                                'content_consistency',
                                'content_brand_alignment'
                              )),
  dimension_state_at_creation TEXT CHECK (dimension_state_at_creation IN (
                                'constraining','stable','ceiling','not_applicable'
                              )),
  triggered_by                TEXT NOT NULL CHECK (triggered_by IN (
                                'system_gap_analysis',
                                'system_maintenance_cadence',
                                'system_adaptation_signal',
                                'user_created'
                              )),
  trigger_signal_type         TEXT CHECK (trigger_signal_type IN (
                                'metric_threshold_crossed',
                                'external_market_change',
                                'algorithm_signal_detected',
                                'brand_activity_change',
                                'creator_density_shift',
                                'scheduled_cadence',
                                'user_initiated'
                              )),
  -- FK to brand_activity_log or content_analysis_runs — polymorphic
  trigger_signal_id           UUID,
  trigger_confidence          TEXT CHECK (trigger_confidence IN ('high','medium','low')),
  title                       TEXT NOT NULL,
  description                 TEXT NOT NULL,
  -- Plain English shown to creator explaining why task was generated
  reasoning_summary           TEXT,
  expected_impact             TEXT,
  related_brand_ids           UUID[],
  priority                    TEXT NOT NULL CHECK (priority IN ('high','medium','low')),
  due_date                    DATE,
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN (
                                  'active','completed','snoozed',
                                  'dismissed','superseded'
                                )),
  completed_at                TIMESTAMPTZ,
  snoozed_until               TIMESTAMPTZ,
  dismissed_at                TIMESTAMPTZ,
  superseded_by               UUID REFERENCES tasks(id) ON DELETE SET NULL,
  -- Creator feedback signals
  creator_notes               TEXT,
  creator_feedback            TEXT CHECK (creator_feedback IN (
                                'helpful',
                                'not_relevant',
                                'already_doing',
                                'not_possible'
                              )),
  feedback_detail             TEXT,
  -- AI generation audit
  generated_by                TEXT,
  prompt_version              TEXT,
  raw_generation_output       JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_creator_status ON tasks(tenant_id, creator_id, status, created_at DESC);
CREATE INDEX idx_tasks_active         ON tasks(creator_id, status)
  WHERE status = 'active';
CREATE INDEX idx_tasks_due            ON tasks(due_date)
  WHERE status = 'active' AND due_date IS NOT NULL;

CREATE TRIGGER set_updated_at_tasks
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ENGINE RUNS
-- Audit trail for every recommendation generation run.
-- ============================================================
CREATE TABLE engine_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id    UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  run_type      TEXT NOT NULL DEFAULT 'recommendation'
                  CHECK (run_type IN ('recommendation','experiment_design')),
  status        TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','complete','failed')),
  constraints_identified JSONB,
  error_details TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_engine_runs_creator ON engine_runs(tenant_id, creator_id, started_at DESC);

-- ============================================================
-- RECOMMENDATIONS
-- Outputs from the recommendation engine.
-- Creator accepts to convert to task.
-- ============================================================
CREATE TABLE recommendations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id                  UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  engine_run_id               UUID REFERENCES engine_runs(id) ON DELETE SET NULL,
  generated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Constraint context
  constraint_dimension        TEXT CHECK (constraint_dimension IN (
                                'subscriber_momentum',
                                'engagement_quality',
                                'niche_commercial_value',
                                'audience_geo_alignment',
                                'content_consistency',
                                'content_brand_alignment'
                              )),
  constraint_severity         TEXT CHECK (constraint_severity IN (
                                'critical','significant','moderate'
                              )),
  recommendation_category     TEXT,
  -- Content
  title                       TEXT NOT NULL,
  specific_action             TEXT NOT NULL,
  reasoning                   TEXT NOT NULL,
  -- Data citations
  data_references             JSONB,
  -- Impact model
  expected_impact_dimension   TEXT,
  expected_impact_description TEXT,
  expected_impact_confidence  TEXT CHECK (expected_impact_confidence IN ('high','medium','low')),
  time_horizon                TEXT CHECK (time_horizon IN (
                                'immediate','short_term','strategic'
                              )),
  sequencing_dependencies     UUID[],
  priority_rank               INTEGER,
  -- AI audit
  prompt_version              TEXT,
  raw_inference_output        JSONB,
  -- Creator response
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending','accepted','deferred',
                                  'declined','superseded','converted_to_task'
                                )),
  converted_to_task_id        UUID REFERENCES tasks(id) ON DELETE SET NULL,
  creator_response            TEXT CHECK (creator_response IN (
                                'accepted','deferred','declined'
                              )),
  creator_response_reason     TEXT,
  creator_response_at         TIMESTAMPTZ
);

CREATE INDEX idx_recs_creator_status ON recommendations(tenant_id, creator_id, status, generated_at DESC);
CREATE INDEX idx_recs_pending        ON recommendations(creator_id, status)
  WHERE status = 'pending';

INSERT INTO schema_migrations (version) VALUES ('004');
