ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS admin_override_plan TEXT,
  ADD COLUMN IF NOT EXISTS admin_override_by   TEXT;
