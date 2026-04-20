-- 039_creator_acquisition.sql
-- Admin-side creator acquisition and outreach pipeline

CREATE TABLE creator_prospects (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  platform          TEXT        NOT NULL DEFAULT 'other',
  channel_url       TEXT,
  channel_name      TEXT        NOT NULL,
  niche             TEXT,
  est_subs          BIGINT,
  stage             TEXT        NOT NULL DEFAULT 'identified'
                                CHECK (stage IN ('identified','contacted','responded','signed_up','active','rejected')),
  assigned_admin_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  notes             TEXT,
  converted_user_id UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prospect_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  UUID        NOT NULL REFERENCES creator_prospects(id) ON DELETE CASCADE,
  admin_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  event_type   TEXT        NOT NULL
               CHECK (event_type IN ('note','stage_change','outreach_sent','reply_received','meeting_booked','signed_up')),
  channel      TEXT,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX creator_prospects_stage_idx    ON creator_prospects(stage);
CREATE INDEX creator_prospects_assigned_idx ON creator_prospects(assigned_admin_id);
CREATE INDEX creator_prospects_updated_idx  ON creator_prospects(updated_at DESC);
CREATE INDEX prospect_events_prospect_idx   ON prospect_events(prospect_id, created_at ASC);
