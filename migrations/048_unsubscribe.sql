-- Migration 048: notifications opt-out for product emails
ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS notifications_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
