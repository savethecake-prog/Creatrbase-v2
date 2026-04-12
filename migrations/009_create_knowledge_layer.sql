-- ============================================================
-- 009_create_knowledge_layer.sql
-- Bounded context. All tables accessed only through
-- packages/knowledge/src/KnowledgeService.ts.
-- Never query these tables directly from other packages.
-- ============================================================

-- ============================================================
-- CREATOR KNOWLEDGE STORE
-- Per-creator longitudinal learning. Embeddings for semantic
-- retrieval via pgvector. Append + supersede pattern.
-- ============================================================
CREATE TABLE creator_knowledge_store (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id     UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
                   'content_pattern',
                   'audience_behaviour',
                   'negotiation_preference',
                   'recommendation_response',
                   'experiment_learning',
                   'communication_style',
                   'brand_relationship',
                   'constraint_history'
                 )),
  -- Plain English learning injected into Claude prompts
  content        TEXT NOT NULL,
  confidence     TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  evidence_type  TEXT NOT NULL,
  evidence_ids   UUID[],
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes_id  UUID REFERENCES creator_knowledge_store(id) ON DELETE SET NULL,
  valid_from     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- null = no expiry. Set for time-sensitive learnings.
  valid_until    TIMESTAMPTZ,
  -- Populated async after write by embedding job
  embedding      vector(1536),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cks_creator_type_active
  ON creator_knowledge_store(tenant_id, creator_id, knowledge_type, is_active)
  WHERE is_active = TRUE;

CREATE INDEX idx_cks_valid
  ON creator_knowledge_store(creator_id, valid_from DESC)
  WHERE is_active = TRUE AND valid_until IS NULL;

CREATE INDEX idx_cks_expired
  ON creator_knowledge_store(valid_until)
  WHERE valid_until IS NOT NULL AND is_active = TRUE;

-- Approximate nearest-neighbour index for semantic retrieval
-- lists = 100 is appropriate for up to ~1M vectors
CREATE INDEX idx_cks_embedding
  ON creator_knowledge_store USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- PATTERN KNOWLEDGE STORE
-- Cross-creator aggregate patterns. Never contains individual
-- creator data. Privacy boundary is absolute.
-- ============================================================
CREATE TABLE pattern_knowledge_store (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type    TEXT NOT NULL CHECK (pattern_type IN (
                    'action_outcome',
                    'niche_benchmark',
                    'tier_trajectory',
                    'experiment_outcome',
                    'recommendation_lift',
                    'constraint_resolution'
                  )),
  -- null = applies across all values of that dimension
  niche           TEXT,
  geo             TEXT,
  creator_tier    TEXT,
  dimension       TEXT,
  -- Plain English summary injected into recommendation prompts
  pattern_summary  TEXT NOT NULL,
  supporting_data  JSONB NOT NULL,
  creator_count    INTEGER NOT NULL DEFAULT 0,
  confidence       TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  -- high = 50+ creators, medium = 10-50, low = < 10
  effect_size      NUMERIC(5,4),
  last_calculated  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_from       DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until      DATE,
  embedding        vector(1536),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pks_niche_geo_type
  ON pattern_knowledge_store(niche, geo, pattern_type, confidence);

CREATE INDEX idx_pks_active
  ON pattern_knowledge_store(niche, geo, creator_tier, pattern_type)
  WHERE valid_until IS NULL;

CREATE INDEX idx_pks_embedding
  ON pattern_knowledge_store USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================
-- PROMPT PERFORMANCE LOG
-- Inference outcome tracking. Powers observability surface
-- and future fine-tuning dataset.
-- ============================================================
CREATE TABLE prompt_performance_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No tenant_id — aggregate across all creators
  prompt_name         TEXT NOT NULL,
  prompt_version      TEXT NOT NULL,
  job_type            TEXT NOT NULL,
  output_type         TEXT NOT NULL CHECK (output_type IN (
                        'niche_classification',
                        'task_generation',
                        'recommendation',
                        'experiment_design',
                        'negotiation_draft',
                        'contract_review',
                        'pitch_hook',
                        'knowledge_synthesis',
                        'pattern_mining'
                      )),
  -- Outcome signals (populated by follow-up job after interaction)
  was_accepted        BOOLEAN,
  was_dismissed       BOOLEAN,
  dismissal_reason    TEXT,
  creator_edited      BOOLEAN,
  edit_magnitude      TEXT CHECK (edit_magnitude IN ('minor','moderate','substantial')),
  outcome_measured    BOOLEAN NOT NULL DEFAULT FALSE,
  outcome_notes       TEXT,
  -- Performance metrics
  input_token_count   INTEGER,
  output_token_count  INTEGER,
  latency_ms          INTEGER,
  -- Source record for outcome linkage
  source_record_type  TEXT,
  source_record_id    UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ppl_prompt_version
  ON prompt_performance_log(prompt_name, prompt_version, created_at DESC);

CREATE INDEX idx_ppl_output_type_accepted
  ON prompt_performance_log(output_type, was_accepted, created_at DESC);

CREATE INDEX idx_ppl_unmeasured
  ON prompt_performance_log(source_record_type, source_record_id)
  WHERE outcome_measured = FALSE AND source_record_id IS NOT NULL;

-- ============================================================
-- MILESTONE THRESHOLDS
-- Dynamic threshold distributions derived from real outcomes.
-- Never hardcode thresholds — always read from this table.
-- ============================================================
CREATE TABLE milestone_thresholds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_type    TEXT NOT NULL CHECK (milestone_type IN (
                      'giftable',
                      'outreach_ready',
                      'paid_integration_viable',
                      'rate_negotiation_power',
                      'portfolio_creator'
                    )),
  niche_category    TEXT NOT NULL,
  geo               TEXT NOT NULL CHECK (geo IN ('UK','US','EU','global')),
  brand_category    TEXT,
  -- Threshold distribution (from real observed outcomes)
  threshold_floor   JSONB, -- lowest observed scores at milestone crossing
  threshold_median  JSONB, -- median observed scores
  threshold_ceiling JSONB, -- upper range of observed scores
  data_points_count INTEGER NOT NULL DEFAULT 0,
  confidence        TEXT NOT NULL DEFAULT 'low'
                      CHECK (confidence IN ('high','medium','low')),
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(milestone_type, niche_category, geo, brand_category)
);

CREATE INDEX idx_thresholds_milestone ON milestone_thresholds(milestone_type, niche_category, geo);

INSERT INTO schema_migrations (version) VALUES ('009');
