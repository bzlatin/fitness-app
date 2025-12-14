CREATE TABLE IF NOT EXISTS apple_health_ignored_workouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER,
  workout_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS apple_health_ignored_workouts_user_external_unique
  ON apple_health_ignored_workouts(user_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS apple_health_ignored_workouts_user_started_idx
  ON apple_health_ignored_workouts(user_id, started_at);

