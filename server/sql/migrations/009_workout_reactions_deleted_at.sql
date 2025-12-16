ALTER TABLE workout_reactions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_workout_reactions_deleted_at
  ON workout_reactions(deleted_at);
