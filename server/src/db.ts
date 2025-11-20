import { Pool, QueryResultRow } from "pg";
import { MOCK_USER_IDS } from "./data/mockUsers";

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
    CREATE TABLE IF NOT EXISTS squads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS squad_members (
      squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (squad_id, user_id)
    )
  `);

  await query(`
    INSERT INTO users (id, email, name, handle, bio, plan, plan_expires_at, profile_completed_at, training_style, gym_name, gym_visibility)
    VALUES 
      ('demo-user', 'demo-user@example.com', 'Demo User', NULL, 'Curated demo account for previewing workouts', 'pro', NOW() + INTERVAL '30 days', NOW() - INTERVAL '1 day', 'Hybrid', 'Demo Studio', 'shown'),
      ('demo-lifter', 'demo1@example.com', 'Alex Strong', '@alex', 'Hybrid strength + cardio', 'pro', NOW() + INTERVAL '60 days', NOW() - INTERVAL '10 days', 'Hybrid', 'Pulse Labs', 'shown'),
      ('coach-amy', 'coach@example.com', 'Coach Amy', '@coachamy', 'Strength coach, progressive overload', 'pro', NOW() + INTERVAL '30 days', NOW() - INTERVAL '1 day', 'Strength', 'Ironclad Coaching', 'shown'),
      ('iron-mile', 'miles@example.com', 'Miles R.', '@ironmile', 'Trail runs and hypertrophy', 'free', NULL, NOW() - INTERVAL '20 days', 'Running', 'Riverside Tracks', 'hidden'),
      ('neon-flash', 'neon@example.com', 'Neon Flash', '@neonflash', 'City runner + high-volume lifting', 'free', NULL, NOW() - INTERVAL '4 days', 'Metcon', 'Neon District', 'shown'),
      ('pulse-strider', 'pulse@example.com', 'Pulse Strider', '@pulse', 'Long runs, tempo spikes, and recovery walks', 'pro', NOW() + INTERVAL '60 days', NOW() - INTERVAL '8 days', 'Cardio + speed', 'Stride Lab', 'shown'),
      ('corecraft', 'core@example.com', 'Core Craft', '@corecraft', 'Iron-core strength + functional flows', 'pro', NOW() + INTERVAL '25 days', NOW() - INTERVAL '12 days', 'Strength', 'Foundry Gym', 'hidden'),
      ('tempo-squad', 'tempo@example.com', 'Tempo Squad', '@temposquad', 'Team tempo runs with tempo pickups', 'free', NULL, NOW() - INTERVAL '20 days', 'Tempo runs', 'Flashpoint Studio', 'hidden'),
      ('lifty-liz', 'liz@example.com', 'Lifty Liz', '@liftyliz', 'Powerlifting PR chaser', 'pro', NOW() + INTERVAL '90 days', NOW() - INTERVAL '2 days', 'Powerlifting', 'Iron Haven', 'shown')
    ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, users.email),
        name = COALESCE(EXCLUDED.name, users.name),
        handle = COALESCE(users.handle, EXCLUDED.handle),
        bio = COALESCE(users.bio, EXCLUDED.bio),
        plan = COALESCE(users.plan, EXCLUDED.plan),
        plan_expires_at = COALESCE(users.plan_expires_at, EXCLUDED.plan_expires_at),
        profile_completed_at = COALESCE(users.profile_completed_at, EXCLUDED.profile_completed_at),
        training_style = COALESCE(users.training_style, EXCLUDED.training_style),
        gym_name = COALESCE(users.gym_name, EXCLUDED.gym_name),
        gym_visibility = COALESCE(users.gym_visibility, EXCLUDED.gym_visibility),
        updated_at = NOW()
  `);

  await query(`
    UPDATE users
    SET handle = '@exhibited'
    WHERE id = 'demo-user'
      AND (handle IS NULL OR handle = '')
      AND NOT EXISTS (
        SELECT 1
        FROM users
        WHERE handle = '@exhibited'
          AND id <> 'demo-user'
      )
  `);

  const seededValues = MOCK_USER_IDS.map((id) => `('${id}')`).join(",\n      ");
  await query(`
    WITH seeded_users(id) AS (
      VALUES
        ${seededValues}
    ),
    valid_pairs AS (
      SELECT a.id AS user_id, b.id AS target_user_id
      FROM seeded_users a
      JOIN seeded_users b ON a.id <> b.id
      JOIN users u1 ON u1.id = a.id
      JOIN users u2 ON u2.id = b.id
    )
    INSERT INTO follows (user_id, target_user_id)
    SELECT user_id, target_user_id FROM valid_pairs
    ON CONFLICT DO NOTHING
  `);

  await query(`
    WITH status_rows(session_id, user_id, template_id, template_name, started_at, visibility, current_exercise_name, is_active) AS (
      VALUES
        ('status-demo-1', 'demo-lifter', NULL, 'Push Day', NOW() - INTERVAL '8 minutes', 'followers', 'Bench Press', true),
        ('status-demo-2', 'iron-mile', NULL, 'Long run', NOW() - INTERVAL '22 minutes', 'squad', 'Tempo interval', true),
        ('status-demo-user-1', 'demo-user', NULL, 'Warm-up Flow', NOW() - INTERVAL '12 minutes', 'followers', 'Jump Rope', true),
        ('status-neon-1', 'neon-flash', NULL, 'Speed Ladder', NOW() - INTERVAL '5 minutes', 'squad', 'Agility Drills', true),
        ('status-pulse-1', 'pulse-strider', NULL, 'Endurance Loop', NOW() - INTERVAL '15 minutes', 'followers', 'Hill Sprints', true),
        ('status-corecraft-1', 'corecraft', NULL, 'Core Burner', NOW() - INTERVAL '9 minutes', 'private', 'Plank Holds', true)
    ),
    valid_statuses AS (
      SELECT s.session_id, s.user_id, s.template_id, s.template_name, s.started_at, s.visibility, s.current_exercise_name, s.is_active
      FROM status_rows s
      JOIN users u ON u.id = s.user_id
    )
    INSERT INTO active_workout_statuses (session_id, user_id, template_id, template_name, started_at, visibility, current_exercise_name, is_active)
    SELECT session_id, user_id, template_id, template_name, started_at, visibility, current_exercise_name, is_active
    FROM valid_statuses
    ON CONFLICT (session_id) DO NOTHING
  `);

  await query(`
    INSERT INTO workout_shares (id, user_id, session_id, template_name, total_sets, total_volume, pr_count, visibility, created_at)
    VALUES
      ('share-demo-1', 'demo-lifter', 'session-demo-1', 'Pull Day', 18, 12400, 2, 'followers', NOW() - INTERVAL '2 hours'),
      ('share-demo-2', 'coach-amy', 'session-demo-2', 'Legs', 22, 15200, 3, 'squad', NOW() - INTERVAL '1 day'),
      ('share-demo-user-1', 'demo-user', 'session-demo-user-1', 'Full Body Flow', 21, 13800, 4, 'squad', NOW() - INTERVAL '1 hour'),
      ('share-neon-1', 'neon-flash', 'session-neon-1', 'City Sprint', 16, 8600, 1, 'followers', NOW() - INTERVAL '45 minutes'),
      ('share-pulse-1', 'pulse-strider', 'session-pulse-1', 'Tempo Circuit', 20, 10150, 3, 'followers', NOW() - INTERVAL '2 hours')
    ON CONFLICT (id) DO NOTHING
  `);

  await query(`
    INSERT INTO squads (id, name, created_by)
    VALUES
      ('squad-demo-crew', 'Demo Crew', 'demo-user'),
      ('squad-pulse-gang', 'Pulse Gang', 'pulse-strider')
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          created_by = EXCLUDED.created_by,
          updated_at = NOW()
  `);

  await query(`
    INSERT INTO squad_members (squad_id, user_id, role)
    VALUES
      ('squad-demo-crew', 'demo-user', 'owner'),
      ('squad-demo-crew', 'demo-lifter', 'member'),
      ('squad-demo-crew', 'coach-amy', 'member'),
      ('squad-pulse-gang', 'pulse-strider', 'owner'),
      ('squad-pulse-gang', 'corecraft', 'member'),
      ('squad-pulse-gang', 'tempo-squad', 'member')
    ON CONFLICT (squad_id, user_id) DO NOTHING
  `);
};
