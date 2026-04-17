-- ============================================================
-- 022_create_distribution_signals.sql
-- Signal logging for distribution vectors.
-- ============================================================

CREATE TABLE IF NOT EXISTS distribution_signals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type           TEXT NOT NULL,
  vector                TEXT NOT NULL,
  source_surface        TEXT NOT NULL,
  reference_object_id   UUID,
  signal_payload        JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_type_created ON distribution_signals(signal_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ds_vector ON distribution_signals(vector, created_at DESC);
