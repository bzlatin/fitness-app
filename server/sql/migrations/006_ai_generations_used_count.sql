-- 006_ai_generations_used_count.sql
-- Track lifetime AI workout generations used for free-tier gating.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_generations_used_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'users_ai_generations_used_count_nonnegative'
      AND t.relname = 'users'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_ai_generations_used_count_nonnegative
      CHECK (ai_generations_used_count >= 0);
  END IF;
END $$;
