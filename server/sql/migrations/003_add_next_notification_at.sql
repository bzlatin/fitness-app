-- 003_add_next_notification_at.sql
-- Track the next scheduled notification time per user.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS next_notification_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_next_notification_at_idx
  ON users(next_notification_at)
  WHERE push_token IS NOT NULL;
