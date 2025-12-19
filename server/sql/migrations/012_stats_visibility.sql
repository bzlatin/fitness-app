-- 012_stats_visibility.sql
-- Add stats visibility preference for profile highlights

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stats_visibility TEXT NOT NULL DEFAULT 'friends';
