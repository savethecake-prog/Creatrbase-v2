-- ============================================================
-- 030_programmatic_seo.sql
-- Programmatic SEO page infrastructure:
--   niche_pages, rate_pages, threshold_pages
-- ============================================================

-- Niche pages: /niche/:slug
CREATE TABLE IF NOT EXISTS niche_pages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT NOT NULL UNIQUE,
  display_name          TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  typical_brand_categories TEXT[] DEFAULT '{}',
  analysis_markdown     TEXT NOT NULL DEFAULT '',
  analysis_html         TEXT NOT NULL DEFAULT '',
  meta_description      TEXT NOT NULL DEFAULT '' CHECK (char_length(meta_description) <= 155),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at          TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CPM benchmarks: used by both niche and rate pages
CREATE TABLE IF NOT EXISTS cpm_benchmarks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche_slug        TEXT NOT NULL,
  platform          TEXT NOT NULL CHECK (platform IN ('youtube', 'twitch')),
  country           TEXT NOT NULL DEFAULT 'uk',
  audience_tier     TEXT NOT NULL CHECK (audience_tier IN ('1k-10k', '10k-50k', '50k-100k', '100k+')),
  cpm_low           INTEGER NOT NULL,
  cpm_high          INTEGER NOT NULL,
  typical_rate_low  INTEGER,
  typical_rate_high INTEGER,
  currency          TEXT NOT NULL DEFAULT 'GBP',
  source            TEXT DEFAULT 'creatrbase',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cpm_benchmark_unique
  ON cpm_benchmarks(niche_slug, platform, country, audience_tier);

CREATE INDEX IF NOT EXISTS idx_cpm_by_niche ON cpm_benchmarks(niche_slug);
CREATE INDEX IF NOT EXISTS idx_cpm_by_country ON cpm_benchmarks(country, niche_slug);

-- Threshold pages: /threshold/:metric (content-driven, not data-driven)
CREATE TABLE IF NOT EXISTS threshold_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  metric_name       TEXT NOT NULL,
  title             TEXT NOT NULL,
  meta_description  TEXT NOT NULL DEFAULT '' CHECK (char_length(meta_description) <= 155),
  content_markdown  TEXT NOT NULL DEFAULT '',
  content_html      TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Research reports: /research/:slug
CREATE TABLE IF NOT EXISTS research_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  meta_description  TEXT NOT NULL CHECK (char_length(meta_description) <= 155),
  summary_markdown  TEXT NOT NULL DEFAULT '',
  summary_html      TEXT NOT NULL DEFAULT '',
  key_findings      JSONB NOT NULL DEFAULT '[]',
  pdf_url           TEXT,
  email_gated       BOOLEAN NOT NULL DEFAULT false,
  methodology_md    TEXT NOT NULL DEFAULT '',
  sample_size       INTEGER,
  period_start      DATE,
  period_end        DATE,
  published_at      TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
