-- ============================================================
-- 027_ingestion.sql
-- Content ingestion layer for editorial agents.
-- RSS sources and fetched items.
-- ============================================================

CREATE TABLE IF NOT EXISTS ingest_source (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type     TEXT NOT NULL DEFAULT 'rss',
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  config          JSONB DEFAULT '{}',
  active          BOOLEAN NOT NULL DEFAULT true,
  priority        INTEGER NOT NULL DEFAULT 5,
  last_fetched_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingest_item (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID NOT NULL REFERENCES ingest_source(id) ON DELETE CASCADE,
  external_id     TEXT NOT NULL,
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  published_at    TIMESTAMPTZ,
  summary         TEXT,
  content         TEXT,
  tags            TEXT[] DEFAULT '{}',
  used_in_send    UUID,
  seen_by_agent_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingest_item_dedup
  ON ingest_item(source_id, external_id);

CREATE INDEX IF NOT EXISTS idx_ingest_item_published
  ON ingest_item(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_item_unused
  ON ingest_item(created_at DESC) WHERE used_in_send IS NULL;

-- Seed initial RSS sources
INSERT INTO ingest_source (source_type, name, url, priority) VALUES
  ('rss', 'Simon Willison',       'https://simonwillison.net/atom/everything/', 8),
  ('rss', 'Latent Space',         'https://www.latent.space/feed',              8),
  ('rss', 'The Verge AI',         'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', 7),
  ('rss', 'TechCrunch AI',        'https://techcrunch.com/category/artificial-intelligence/feed/', 7),
  ('rss', 'CreatorIQ Blog',       'https://www.creatoriq.com/blog/rss.xml',     9),
  ('rss', 'Tubefilter',           'https://www.tubefilter.com/feed/',           9),
  ('rss', 'The Publish Press',    'https://www.publishpress.com/feed/',         7),
  ('rss', 'Passionfruit',         'https://www.passionfruit.me/feed',           7),
  ('rss', 'Ars Technica AI',      'https://feeds.arstechnica.com/arstechnica/features', 6),
  ('rss', 'MIT Tech Review AI',   'https://www.technologyreview.com/feed/',     6)
ON CONFLICT DO NOTHING;
