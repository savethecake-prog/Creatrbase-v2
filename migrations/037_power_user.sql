-- 037_power_user.sql
-- Adds BYOK (Bring Your Own Key) infrastructure.
-- user_api_keys stores encrypted provider keys.
-- is_power_user on users is maintained by trigger.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_power_user BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS user_api_keys (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      TEXT        NOT NULL CHECK (provider IN ('anthropic', 'google', 'openai')),
  encrypted_key TEXT        NOT NULL,
  model_pref    TEXT,
  verified_at   TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);

CREATE OR REPLACE FUNCTION sync_power_user_flag() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE users SET is_power_user = true WHERE id = NEW.user_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users SET is_power_user = (
      SELECT COUNT(*) > 0 FROM user_api_keys WHERE user_id = OLD.user_id
    ) WHERE id = OLD.user_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_power_user ON user_api_keys;
CREATE TRIGGER trg_sync_power_user
  AFTER INSERT OR UPDATE OR DELETE ON user_api_keys
  FOR EACH ROW EXECUTE FUNCTION sync_power_user_flag();
