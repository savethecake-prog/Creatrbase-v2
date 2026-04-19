-- Migration 035: Content Studio
-- content_sources: local index for NBLM notebook sources (freshness tracking)
-- content_sessions: persists AI drafting sessions with message history + structured draft

CREATE TABLE content_sources (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_key       TEXT        NOT NULL,
  notebook_id        TEXT        NOT NULL,
  source_id          TEXT,
  url                TEXT,
  title              TEXT,
  topic_tags         TEXT[]      NOT NULL DEFAULT '{}',
  added_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ NOT NULL,
  removed_at         TIMESTAMPTZ,
  brief_note_id      TEXT,
  brief_generated_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_sources_notebook
  ON content_sources(notebook_key, removed_at, expires_at);
CREATE INDEX idx_content_sources_brief
  ON content_sources(notebook_key, brief_generated_at DESC);
CREATE UNIQUE INDEX idx_content_sources_url
  ON content_sources(notebook_key, url)
  WHERE url IS NOT NULL AND removed_at IS NULL;

CREATE TABLE content_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type  TEXT        NOT NULL CHECK (content_type IN ('blog', 'comparison', 'niche', 'threshold', 'research')),
  content_id    UUID,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  messages      JSONB       NOT NULL DEFAULT '[]',
  current_draft JSONB,
  brief_used    TEXT,
  created_by    TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_sessions_type
  ON content_sessions(content_type, status, created_at DESC);
CREATE INDEX idx_content_sessions_content
  ON content_sessions(content_id)
  WHERE content_id IS NOT NULL;
