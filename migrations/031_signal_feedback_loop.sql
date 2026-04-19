-- ============================================================
-- 031_signal_feedback_loop.sql
-- Signal feedback loop infrastructure:
--   signal_events table + creator_state_snapshot column
-- ============================================================

-- Signals captured automatically from Negotiations, Gmail, and Outreach.
-- Each signal is quality-scored algebraically and applied to the
-- creator's commercial profile without any user friction.

CREATE TABLE IF NOT EXISTS signal_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  creator_id            UUID NOT NULL,
  source_feature        TEXT NOT NULL CHECK (source_feature IN ('negotiations', 'gmail_sync', 'brands_outreach')),
  signal_type           TEXT NOT NULL CHECK (signal_type IN ('deal_closed', 'brand_replied', 'outreach_sent_with_state')),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'applied', 'failed', 'skipped')),
  source_interaction_id UUID REFERENCES brand_creator_interactions(id) ON DELETE SET NULL,
  quality_score         NUMERIC(4,3),
  quality_factors       JSONB NOT NULL DEFAULT '{}',
  payload               JSONB NOT NULL DEFAULT '{}',
  applied_updates       JSONB,
  description           TEXT NOT NULL DEFAULT '',
  processed_at          TIMESTAMPTZ,
  error_detail          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signal_events_creator_created
  ON signal_events (creator_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_events_type_status_created
  ON signal_events (signal_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signal_events_pending_status
  ON signal_events (status)
  WHERE status = 'pending';

-- Snapshot of the creator's commercial profile at the moment outreach was sent.
-- Used by deal_closed corroboration: did this creator have a prior signal for this brand?
ALTER TABLE brand_creator_interactions
  ADD COLUMN IF NOT EXISTS creator_state_snapshot JSONB;
