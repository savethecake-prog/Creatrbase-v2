-- ============================================================
-- 021_create_blog.sql
-- Blog posts and categories for the Creatrbase content programme.
-- ============================================================

CREATE TABLE IF NOT EXISTS blog_categories (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT         NOT NULL UNIQUE,
  name        TEXT         NOT NULL,
  description TEXT,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT         NOT NULL UNIQUE,
  title           TEXT         NOT NULL,
  excerpt         TEXT,
  body_html       TEXT,
  body_markdown   TEXT,
  cover_image_url TEXT,
  category_id     UUID         REFERENCES blog_categories(id) ON DELETE SET NULL,
  author_name     TEXT         NOT NULL DEFAULT 'Creatrbase',
  author_avatar   TEXT,
  status          TEXT         NOT NULL DEFAULT 'draft'
                               CHECK (status IN ('draft', 'published', 'archived')),
  featured        BOOLEAN      NOT NULL DEFAULT FALSE,
  reading_time_min INTEGER,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status     ON blog_posts (status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published  ON blog_posts (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured   ON blog_posts (featured)          WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_posts_category   ON blog_posts (category_id);

-- before-update trigger (matches project convention)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_blog_posts_updated_at'
  ) THEN
    CREATE TRIGGER trg_blog_posts_updated_at
      BEFORE UPDATE ON blog_posts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- Seed initial categories
INSERT INTO blog_categories (slug, name, description, sort_order) VALUES
  ('creator-economy',  'Creator Economy',  'Trends, data, and analysis on the creator economy.',            1),
  ('brand-deals',      'Brand Deals',      'How to find, pitch, and close brand partnership deals.',        2),
  ('growth',           'Growth',           'Strategies for growing your audience and engagement.',          3),
  ('platform-guides',  'Platform Guides',  'Deep dives into YouTube, Twitch, TikTok, and Instagram.',      4),
  ('creatrbase',       'Creatrbase',       'Product updates, feature releases, and company news.',         5)
ON CONFLICT (slug) DO NOTHING;
