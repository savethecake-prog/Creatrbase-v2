-- ============================================================
-- 023_create_public_score_cards.sql
-- Cached public score cards for the V1 viral loop.
-- ============================================================

CREATE TABLE IF NOT EXISTS public_score_cards (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform            TEXT NOT NULL CHECK (platform IN ('youtube','twitch')),
  handle              TEXT NOT NULL,
  channel_name        TEXT,
  channel_avatar_url  TEXT,
  calculated_score    INTEGER CHECK (calculated_score BETWEEN 0 AND 100),
  tier_band           TEXT CHECK (tier_band IN ('pre_commercial','emerging','viable','established')),
  top_constraint      TEXT,
  confidence_summary  JSONB NOT NULL DEFAULT '{}',
  score_breakdown     JSONB NOT NULL DEFAULT '{}',
  what_this_means     TEXT,
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ NOT NULL,
  view_count          INTEGER NOT NULL DEFAULT 0,
  claimed_at          TIMESTAMPTZ,
  claimed_by_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_psc_platform_handle ON public_score_cards(platform, lower(handle));
CREATE INDEX IF NOT EXISTS idx_psc_expires ON public_score_cards(expires_at);
