ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS rir NUMERIC;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_sets_rir_check'
  ) THEN
    ALTER TABLE workout_sets
      ADD CONSTRAINT workout_sets_rir_check
      CHECK (rir IS NULL OR (rir >= 0 AND rir <= 10));
  END IF;
END $$;
