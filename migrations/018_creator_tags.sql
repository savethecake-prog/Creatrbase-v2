-- ============================================================
-- 018_creator_tags.sql
-- Creator tag store: tracked tags, detections, effectiveness.
-- ============================================================

-- Tags the creator has chosen to track (free-form or from brand registry)
CREATE TABLE IF NOT EXISTS creator_tags (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  creator_id   UUID        NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  tag          TEXT        NOT NULL,
  -- Optional link to a brand in the registry
  brand_id     UUID        REFERENCES brands(id) ON DELETE SET NULL,
  -- Computed fields updated by the detection worker
  detection_count    INTEGER     NOT NULL DEFAULT 0,
  last_detected_at   TIMESTAMPTZ,
  effectiveness_score NUMERIC(5,2),   -- 0–100
  confidence         TEXT CHECK (confidence IN ('low','medium','high')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(creator_id, tag)
);

CREATE INDEX idx_creator_tags_creator ON creator_tags(creator_id);
CREATE INDEX idx_creator_tags_brand   ON creator_tags(brand_id) WHERE brand_id IS NOT NULL;

-- Every time a tag is found on a video
CREATE TABLE IF NOT EXISTS tag_detections (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_tag_id  UUID        NOT NULL REFERENCES creator_tags(id) ON DELETE CASCADE,
  creator_id      UUID        NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  video_id        TEXT        NOT NULL,  -- YouTube video ID
  video_title     TEXT,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  video_published_at TIMESTAMPTZ,
  view_count      BIGINT,
  like_count      BIGINT,
  -- Performance relative to creator baseline at time of detection
  views_vs_baseline NUMERIC(6,2),  -- e.g. 1.40 = 40% above baseline
  UNIQUE(creator_tag_id, video_id)
);

CREATE INDEX idx_tag_detections_tag     ON tag_detections(creator_tag_id);
CREATE INDEX idx_tag_detections_creator ON tag_detections(creator_id, detected_at DESC);

-- Store uploads playlist ID on platform profiles for tag detection
ALTER TABLE creator_platform_profiles
  ADD COLUMN IF NOT EXISTS uploads_playlist_id TEXT;

INSERT INTO schema_migrations (version) VALUES ('018_creator_tags');
