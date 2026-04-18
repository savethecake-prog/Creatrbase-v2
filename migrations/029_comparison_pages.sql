-- ============================================================
-- 029_comparison_pages.sql
-- Comparison pages for /compare/:competitor SEO surfaces.
-- ============================================================

CREATE TABLE IF NOT EXISTS comparison_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  competitor_name   TEXT NOT NULL,
  competitor_url    TEXT,
  title             TEXT NOT NULL,
  meta_description  TEXT NOT NULL CHECK (char_length(meta_description) <= 155),
  content_markdown  TEXT NOT NULL DEFAULT '',
  content_html      TEXT NOT NULL DEFAULT '',
  comparison_table  JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparison_pages_status ON comparison_pages(status, published_at DESC);
