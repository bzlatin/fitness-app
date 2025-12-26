-- 002_add_timezone_offset_minutes.sql
-- Store user timezone offset (minutes behind UTC) for local notification scheduling.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone_offset_minutes INTEGER NOT NULL DEFAULT 0;
