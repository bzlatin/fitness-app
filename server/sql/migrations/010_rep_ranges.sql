-- Add rep range support to workout templates
ALTER TABLE workout_template_exercises
  ADD COLUMN IF NOT EXISTS default_reps_min integer,
  ADD COLUMN IF NOT EXISTS default_reps_max integer;

-- Backfill existing data so historical templates preserve their rep targets
UPDATE workout_template_exercises
SET
  default_reps_min = COALESCE(default_reps_min, default_reps),
  default_reps_max = COALESCE(default_reps_max, default_reps)
WHERE default_reps IS NOT NULL;
