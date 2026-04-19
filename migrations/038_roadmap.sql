-- 038_roadmap.sql
-- Roadmap and feature voting for Power User hub.

CREATE TABLE IF NOT EXISTS roadmap_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  status      TEXT        NOT NULL DEFAULT 'thinking' CHECK (status IN ('thinking', 'building', 'testing', 'shipped')),
  visibility  TEXT        NOT NULL DEFAULT 'power_users' CHECK (visibility IN ('power_users', 'all')),
  sort_order  INT         NOT NULL DEFAULT 0,
  shipped_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_status_order ON roadmap_items(status, sort_order);

CREATE TABLE IF NOT EXISTS feature_votes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_item_id UUID        NOT NULL REFERENCES roadmap_items(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(roadmap_item_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_votes_item ON feature_votes(roadmap_item_id);

-- Auto-stamp shipped_at when status moves to shipped
CREATE OR REPLACE FUNCTION stamp_shipped_at() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'shipped' AND (OLD.status IS DISTINCT FROM 'shipped') THEN
    NEW.shipped_at = NOW();
  ELSIF NEW.status != 'shipped' THEN
    NEW.shipped_at = NULL;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stamp_shipped_at ON roadmap_items;
CREATE TRIGGER trg_stamp_shipped_at
  BEFORE UPDATE ON roadmap_items
  FOR EACH ROW EXECUTE FUNCTION stamp_shipped_at();
