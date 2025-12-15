ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS difficulty_rating TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workout_sets_difficulty_rating_check'
  ) THEN
    ALTER TABLE workout_sets
      ADD CONSTRAINT workout_sets_difficulty_rating_check
      CHECK (
        difficulty_rating IS NULL OR difficulty_rating IN ('too_easy', 'just_right', 'too_hard')
      );
  END IF;
END $$;

