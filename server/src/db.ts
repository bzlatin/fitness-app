import { Pool, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Please add it to your .env.");
}

const ssl =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1")
    ? undefined
    : { rejectUnauthorized: false };

export const pool = new Pool({
  connectionString,
  ssl,
});

export const query = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) => pool.query<T>(text, params);

export const initDb = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS training_style TEXT,
      ADD COLUMN IF NOT EXISTS gym_name TEXT,
      ADD COLUMN IF NOT EXISTS gym_visibility TEXT NOT NULL DEFAULT 'hidden'
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique_idx
    ON users(handle)
    WHERE handle IS NOT NULL
  `);

  await query(`UPDATE users SET plan = 'free' WHERE plan IS NULL`);

  await query(`
    CREATE TABLE IF NOT EXISTS workout_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      split_type TEXT,
      is_favorite BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workout_template_exercises (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      exercise_id TEXT NOT NULL,
      default_sets INTEGER NOT NULL,
      default_reps INTEGER NOT NULL,
      default_rest_seconds INTEGER,
      default_weight NUMERIC,
      default_incline NUMERIC,
      default_distance NUMERIC,
      default_duration_minutes NUMERIC,
      notes TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS follows (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, target_user_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT REFERENCES workout_templates(id) ON DELETE SET NULL,
      started_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workout_sets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      template_exercise_id TEXT,
      exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      target_reps INTEGER,
      target_weight NUMERIC,
      actual_reps INTEGER,
      actual_weight NUMERIC,
      rpe NUMERIC
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS workout_sets_session_idx ON workout_sets(session_id)
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS active_workout_statuses (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT,
      template_name TEXT,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      visibility TEXT NOT NULL DEFAULT 'private',
      current_exercise_name TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS workout_shares (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_id TEXT,
      template_name TEXT,
      total_sets INTEGER,
      total_volume NUMERIC,
      pr_count INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      visibility TEXT NOT NULL DEFAULT 'private',
      progress_photo_url TEXT
    )
  `);

  await query(`
    INSERT INTO users (id, email, name, handle, bio, plan, profile_completed_at, training_style)
    VALUES 
      ('demo-lifter', 'demo1@example.com', 'Alex Strong', '@alex', 'Hybrid strength + cardio', 'pro', NOW(), 'Hybrid'),
      ('coach-amy', 'coach@example.com', 'Coach Amy', '@coachamy', 'Strength coach, progressive overload', 'pro', NOW(), 'Strength'),
      ('iron-mile', 'miles@example.com', 'Miles R.', '@ironmile', 'Trail runs and hypertrophy', 'free', NOW(), 'Running')
    ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name,
        email = EXCLUDED.email,
        handle = COALESCE(users.handle, EXCLUDED.handle),
        bio = COALESCE(users.bio, EXCLUDED.bio),
        training_style = COALESCE(users.training_style, EXCLUDED.training_style),
        updated_at = NOW()
  `);

  await query(`
    INSERT INTO follows (user_id, target_user_id)
    VALUES 
      ('coach-amy', 'demo-lifter'),
      ('iron-mile', 'demo-lifter'),
      ('demo-lifter', 'iron-mile')
    ON CONFLICT DO NOTHING
  `);

  await query(`
    INSERT INTO active_workout_statuses (session_id, user_id, template_id, template_name, started_at, visibility, current_exercise_name, is_active)
    VALUES
      ('status-demo-1', 'demo-lifter', NULL, 'Push Day', NOW() - INTERVAL '8 minutes', 'followers', 'Bench Press', true),
      ('status-demo-2', 'iron-mile', NULL, 'Long run', NOW() - INTERVAL '22 minutes', 'squad', 'Tempo interval', true)
    ON CONFLICT (session_id) DO NOTHING
  `);

  await query(`
    INSERT INTO workout_shares (id, user_id, session_id, template_name, total_sets, total_volume, pr_count, visibility, created_at)
    VALUES
      ('share-demo-1', 'demo-lifter', 'session-demo-1', 'Pull Day', 18, 12400, 2, 'followers', NOW() - INTERVAL '2 hours'),
      ('share-demo-2', 'coach-amy', 'session-demo-2', 'Legs', 22, 15200, 3, 'squad', NOW() - INTERVAL '1 day')
    ON CONFLICT (id) DO NOTHING
  `);
};
