-- ============================================================
-- 025_admin_access_level.sql
-- Add cfo_access_level to users for admin gating.
-- Admin threshold: >= 100
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS cfo_access_level INTEGER NOT NULL DEFAULT 0;

-- Grant admin to Anthony's accounts
UPDATE users SET cfo_access_level = 100
WHERE email IN ('creatrbase@gmail.com', 'savethecake@gmail.com', 'anthony.nell@journeyfurther.com');

-- Admin action log
CREATE TABLE IF NOT EXISTS admin_action_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   UUID NOT NULL REFERENCES users(id),
  action_type     TEXT NOT NULL,
  action_target   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_action_log_actor ON admin_action_log(actor_user_id);
CREATE INDEX idx_admin_action_log_created ON admin_action_log(created_at DESC);
