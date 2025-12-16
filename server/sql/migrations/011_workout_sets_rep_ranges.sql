-- Add rep range support to workout sets
ALTER TABLE workout_sets
  ADD COLUMN IF NOT EXISTS target_reps_min integer,
  ADD COLUMN IF NOT EXISTS target_reps_max integer;

-- Backfill existing data so historical sets preserve their rep targets
UPDATE workout_sets
SET
  target_reps_min = COALESCE(target_reps_min, target_reps),
  target_reps_max = COALESCE(target_reps_max, target_reps)
WHERE target_reps IS NOT NULL;
