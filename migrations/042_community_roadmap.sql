-- 042_community_roadmap.sql
-- Extends roadmap with new stages, upvote/downvote, voter avatars, launch_date, tag.
-- Adds community suggestions system with category, voting, weekly creation cap.

-- ── 1. Roadmap items: new status values ─────────────────────────────────────

ALTER TABLE roadmap_items
  DROP CONSTRAINT IF EXISTS roadmap_items_status_check;

-- Migrate existing rows before adding new constraint
UPDATE roadmap_items SET status = 'scoping'   WHERE status = 'thinking';
UPDATE roadmap_items SET status = 'planning'  WHERE status = 'testing';
-- 'building' and 'shipped' stay as-is

ALTER TABLE roadmap_items
  ADD CONSTRAINT roadmap_items_status_check
    CHECK (status IN ('scoping', 'planning', 'building', 'launching', 'shipped'));

ALTER TABLE roadmap_items
  ALTER COLUMN status SET DEFAULT 'scoping';

-- ── 2. Roadmap items: new columns ────────────────────────────────────────────

ALTER TABLE roadmap_items
  ADD COLUMN IF NOT EXISTS launch_date DATE,
  ADD COLUMN IF NOT EXISTS tag         TEXT,
  ADD COLUMN IF NOT EXISTS upvotes     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvotes   INT NOT NULL DEFAULT 0;

-- ── 3. Feature votes: add vote_type ─────────────────────────────────────────

ALTER TABLE feature_votes
  ADD COLUMN IF NOT EXISTS vote_type TEXT NOT NULL DEFAULT 'up';

-- Backfill existing rows (all historical votes become upvotes)
UPDATE feature_votes SET vote_type = 'up' WHERE vote_type IS NULL OR vote_type = '';

ALTER TABLE feature_votes
  DROP CONSTRAINT IF EXISTS feature_votes_vote_type_check;
ALTER TABLE feature_votes
  ADD CONSTRAINT feature_votes_vote_type_check
    CHECK (vote_type IN ('up', 'down'));

-- Backfill upvotes count from existing feature_votes
UPDATE roadmap_items ri SET upvotes = (
  SELECT COUNT(*) FROM feature_votes fv
  WHERE fv.roadmap_item_id = ri.id AND fv.vote_type = 'up'
);

-- ── 4. Roadmap vote count trigger ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_roadmap_vote_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE roadmap_items SET upvotes   = upvotes   + 1 WHERE id = NEW.roadmap_item_id;
    ELSE
      UPDATE roadmap_items SET downvotes = downvotes + 1 WHERE id = NEW.roadmap_item_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'up' THEN
      UPDATE roadmap_items SET upvotes   = GREATEST(0, upvotes   - 1) WHERE id = OLD.roadmap_item_id;
    ELSE
      UPDATE roadmap_items SET downvotes = GREATEST(0, downvotes - 1) WHERE id = OLD.roadmap_item_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.vote_type IS DISTINCT FROM NEW.vote_type THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE roadmap_items
        SET upvotes   = upvotes   + 1,
            downvotes = GREATEST(0, downvotes - 1)
        WHERE id = NEW.roadmap_item_id;
    ELSE
      UPDATE roadmap_items
        SET downvotes = downvotes + 1,
            upvotes   = GREATEST(0, upvotes   - 1)
        WHERE id = NEW.roadmap_item_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roadmap_vote_counts ON feature_votes;
CREATE TRIGGER trg_roadmap_vote_counts
  AFTER INSERT OR UPDATE OR DELETE ON feature_votes
  FOR EACH ROW EXECUTE FUNCTION update_roadmap_vote_counts();

-- ── 5. Community categories ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  slug       TEXT        NOT NULL UNIQUE,
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO community_categories (name, slug, sort_order) VALUES
  ('Feature Requests',  'feature-requests',  1),
  ('Platform Growth',   'platform-growth',   2),
  ('Content Strategy',  'content-strategy',  3),
  ('Deals & Rates',     'deals-and-rates',   4),
  ('Analytics',         'analytics',         5),
  ('General',           'general',           6)
ON CONFLICT (slug) DO NOTHING;

-- ── 6. Community suggestions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_suggestions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  category_id     UUID        REFERENCES community_categories(id) ON DELETE SET NULL,
  title           TEXT        NOT NULL,
  description     TEXT,
  status          TEXT        NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'considering', 'declined', 'archived', 'promoted')),
  upvotes         INT         NOT NULL DEFAULT 0,
  downvotes       INT         NOT NULL DEFAULT 0,
  week_year       INT         NOT NULL, -- ISOYEAR * 100 + ISOWEEK e.g. 202617
  decline_reason  TEXT,
  roadmap_item_id UUID        REFERENCES roadmap_items(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_community_suggestions_status  ON community_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_suggestions_user    ON community_suggestions(user_id, week_year);
CREATE INDEX IF NOT EXISTS idx_community_suggestions_cat     ON community_suggestions(category_id);
CREATE INDEX IF NOT EXISTS idx_community_suggestions_votes   ON community_suggestions(upvotes DESC, downvotes ASC, created_at DESC);

-- ── 7. Community votes ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_votes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID        NOT NULL REFERENCES community_suggestions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type     TEXT        NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_votes_suggestion ON community_votes(suggestion_id);

-- ── 8. Community vote count trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_community_vote_counts() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE community_suggestions SET upvotes   = upvotes   + 1, updated_at = NOW() WHERE id = NEW.suggestion_id;
    ELSE
      UPDATE community_suggestions SET downvotes = downvotes + 1, updated_at = NOW() WHERE id = NEW.suggestion_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'up' THEN
      UPDATE community_suggestions SET upvotes   = GREATEST(0, upvotes   - 1), updated_at = NOW() WHERE id = OLD.suggestion_id;
    ELSE
      UPDATE community_suggestions SET downvotes = GREATEST(0, downvotes - 1), updated_at = NOW() WHERE id = OLD.suggestion_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.vote_type IS DISTINCT FROM NEW.vote_type THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE community_suggestions
        SET upvotes   = upvotes   + 1,
            downvotes = GREATEST(0, downvotes - 1),
            updated_at = NOW()
        WHERE id = NEW.suggestion_id;
    ELSE
      UPDATE community_suggestions
        SET downvotes = downvotes + 1,
            upvotes   = GREATEST(0, upvotes   - 1),
            updated_at = NOW()
        WHERE id = NEW.suggestion_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_vote_counts ON community_votes;
CREATE TRIGGER trg_community_vote_counts
  AFTER INSERT OR UPDATE OR DELETE ON community_votes
  FOR EACH ROW EXECUTE FUNCTION update_community_vote_counts();

-- Auto-stamp updated_at on community_suggestions
CREATE OR REPLACE FUNCTION stamp_suggestion_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_suggestion_updated_at ON community_suggestions;
CREATE TRIGGER trg_suggestion_updated_at
  BEFORE UPDATE ON community_suggestions
  FOR EACH ROW EXECUTE FUNCTION stamp_suggestion_updated_at();
