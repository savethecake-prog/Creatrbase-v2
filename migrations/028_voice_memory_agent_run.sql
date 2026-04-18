-- ============================================================
-- 028_voice_memory_agent_run.sql
-- Voice memory for editorial positions, agent run tracking,
-- and skill edit proposals.
-- ============================================================

-- Voice memory: accumulated editorial positions
CREATE TABLE IF NOT EXISTS voice_memory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic            TEXT NOT NULL,
  position         TEXT NOT NULL,
  context          TEXT,
  confidence       TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high', 'medium', 'low')),
  source           TEXT NOT NULL DEFAULT 'inferred' CHECK (source IN ('anthony', 'inferred', 'published')),
  supersedes_id    UUID REFERENCES voice_memory(id),
  superseded_by    UUID REFERENCES voice_memory(id),
  deprecated_at    TIMESTAMPTZ,
  last_referenced_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_memory_topic ON voice_memory(topic);
CREATE INDEX IF NOT EXISTS idx_voice_memory_active ON voice_memory(created_at DESC) WHERE deprecated_at IS NULL;

-- Agent runs: tracks every agent invocation
CREATE TABLE IF NOT EXISTS agent_run (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed')),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  output_snapshot  JSONB DEFAULT '{}',
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_run_type ON agent_run(agent_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_run_status ON agent_run(status) WHERE status IN ('queued', 'running');

-- Skill edit proposals
CREATE TABLE IF NOT EXISTS skill_edit_proposal (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name            TEXT NOT NULL,
  proposed_content      TEXT NOT NULL,
  rationale             TEXT,
  proposed_by_agent_run UUID REFERENCES agent_run(id),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by_user_id   UUID REFERENCES users(id),
  resolved_at           TIMESTAMPTZ,
  pr_url                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_proposal_pending ON skill_edit_proposal(created_at DESC) WHERE status = 'pending';
