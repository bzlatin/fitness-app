import { Pool, QueryResultRow, defaults as pgDefaults } from "pg";
import dns from "dns";
import { MOCK_USER_IDS } from "./data/mockUsers";

// Favor IPv4 to avoid connection failures on hosts that resolve to IPv6 first (e.g., Supabase)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Please add it to your .env.");
}

const normalizeConnectionString = (raw: string) => {
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";

    // Strip ssl directives from provider URLs so our explicit config isn't overwritten by pg's parser
    url.searchParams.delete("ssl");
    url.searchParams.delete("sslmode");

    if (!isLocalHost) {
      url.searchParams.set("sslmode", "no-verify");
    }

    return { normalized: url.toString(), isLocalHost };
  } catch {
    const isLocalHost =
      raw.includes("localhost") || raw.includes("127.0.0.1");
    return { normalized: raw, isLocalHost };
  }
};

const { normalized: normalizedConnectionString, isLocalHost } =
  normalizeConnectionString(connectionString);

const ssl = isLocalHost ? false : { rejectUnauthorized: false };

// Force pg to apply the same relaxed SSL policy (avoids self-signed chain errors from poolers)
pgDefaults.ssl = ssl;

// Ensure pg skips TLS chain verification on hosted DBs with self-signed certs (e.g., Supabase pooler)
if (!ssl) {
  process.env.PGSSLMODE = "disable";
} else {
  process.env.PGSSLMODE = "no-verify";
}

export const pool = new Pool({
  connectionString: normalizedConnectionString,
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
      ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
      ADD COLUMN IF NOT EXISTS apple_subscription_id TEXT,
      ADD COLUMN IF NOT EXISTS subscription_platform TEXT,
      ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS training_style TEXT,
      ADD COLUMN IF NOT EXISTS gym_name TEXT,
      ADD COLUMN IF NOT EXISTS gym_visibility TEXT NOT NULL DEFAULT 'hidden',
      ADD COLUMN IF NOT EXISTS weekly_goal INTEGER NOT NULL DEFAULT 4,
      ADD COLUMN IF NOT EXISTS onboarding_data JSONB,
      ADD COLUMN IF NOT EXISTS progressive_overload_enabled BOOLEAN NOT NULL DEFAULT true
  `);

  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique_idx
    ON users(handle)
    WHERE handle IS NOT NULL
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS subscription_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      event_type TEXT NOT NULL,
      stripe_event_id TEXT UNIQUE,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS appstore_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      notification_type TEXT NOT NULL,
      transaction_id TEXT,
      original_transaction_id TEXT,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_appstore_notifications_user ON appstore_notifications(user_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_appstore_notifications_original_tx ON appstore_notifications(original_transaction_id)
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
    ALTER TABLE workout_templates
      ADD COLUMN IF NOT EXISTS progressive_overload_enabled BOOLEAN
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
      template_name TEXT,
      started_at TIMESTAMPTZ NOT NULL,
      finished_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    ALTER TABLE workout_sessions
      ADD COLUMN IF NOT EXISTS template_name TEXT
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
    ALTER TABLE squads
      ADD COLUMN IF NOT EXISTS max_members INTEGER NOT NULL DEFAULT 50
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
    ALTER TABLE squad_members
      ADD COLUMN IF NOT EXISTS invited_by TEXT REFERENCES users(id) ON DELETE SET NULL
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS squad_invite_links (
      id TEXT PRIMARY KEY,
      squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      is_revoked BOOLEAN NOT NULL DEFAULT false,
      uses_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS squad_invite_links_code_idx ON squad_invite_links(code)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS squad_invite_links_squad_id_idx ON squad_invite_links(squad_id)
  `);

  // AI Workout Generation tracking
  await query(`
    CREATE TABLE IF NOT EXISTS ai_generations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      generation_type TEXT NOT NULL,
      input_params JSONB,
      output_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS ai_generations_user_id_idx ON ai_generations(user_id)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS ai_generations_created_at_idx ON ai_generations(created_at)
  `);

  // Add exercises table for fatigue calculations
  await query(`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      primary_muscle_group TEXT,
      equipment TEXT
    )
  `);

  // Minimal exercise seed to support fatigue analytics + templates
  await query(`
    INSERT INTO exercises (id, name, primary_muscle_group, equipment)
    VALUES
      ('ex-back-squat', 'Barbell Back Squat', 'legs', 'barbell'),
      ('ex-bench-press', 'Bench Press', 'chest', 'barbell'),
      ('ex-deadlift', 'Deadlift', 'legs', 'barbell'),
      ('ex-ohp', 'Overhead Press', 'shoulders', 'barbell'),
      ('ex-row', 'Barbell Row', 'back', 'barbell'),
      ('ex-lat-pulldown', 'Lat Pulldown', 'back', 'machine'),
      ('ex-leg-press', 'Leg Press', 'legs', 'machine'),
      ('ex-leg-curl', 'Leg Curl', 'legs', 'machine'),
      ('ex-plank', 'Plank', 'core', 'bodyweight'),
      ('ex-pushup', 'Push-Up', 'chest', 'bodyweight'),
      ('ex-dumbbell-curl', 'Dumbbell Curl', 'biceps', 'dumbbell'),
      ('ex-tricep-pushdown', 'Cable Pushdown', 'triceps', 'cable'),
      ('ex-lateral-raise', 'Dumbbell Lateral Raise', 'shoulders', 'dumbbell')
    ON CONFLICT (id) DO UPDATE
      SET primary_muscle_group = COALESCE(EXCLUDED.primary_muscle_group, exercises.primary_muscle_group),
          equipment = COALESCE(EXCLUDED.equipment, exercises.equipment),
          name = EXCLUDED.name
  `);

  await query(`
    ALTER TABLE workout_sets
      ADD COLUMN IF NOT EXISTS exercise_name TEXT,
      ADD COLUMN IF NOT EXISTS exercise_image_url TEXT
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

  const exhibitedUserIdResult = await query<{ id: string }>(
    `SELECT id FROM users WHERE handle = $1 ORDER BY updated_at DESC LIMIT 1`,
    ["@exhibited"]
  );
  const exhibitedUserId = exhibitedUserIdResult.rows[0]?.id ?? "demo-user";

  // Seed @exhibited with split templates and recent history for fatigue
  await query(`
    INSERT INTO workout_templates (id, user_id, name, description, split_type, is_favorite, created_at, updated_at)
    VALUES
      ('tmpl-exh-chest-back', '${exhibitedUserId}', 'Chest / Back Power', 'Heavy press + rows for upper balance', 'upper', false, NOW() - INTERVAL '40 days', NOW() - INTERVAL '2 days'),
      ('tmpl-exh-arms-shoulders', '${exhibitedUserId}', 'Arms + Shoulders Volume', 'Arm pump with overhead stability', 'upper', false, NOW() - INTERVAL '39 days', NOW() - INTERVAL '1 day'),
      ('tmpl-exh-legs', '${exhibitedUserId}', 'Legs + Glutes Strength', 'Compound lower day with hinge + squat', 'legs', false, NOW() - INTERVAL '38 days', NOW() - INTERVAL '3 days')
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          split_type = EXCLUDED.split_type,
          user_id = EXCLUDED.user_id,
          updated_at = NOW()
  `);

  await query(`
    INSERT INTO workout_template_exercises (
      id, template_id, order_index, exercise_id, default_sets, default_reps,
      default_rest_seconds, default_weight, default_incline, default_distance, default_duration_minutes, notes
    )
    VALUES
      ('tmpl-exh-chest-back-ex1', 'tmpl-exh-chest-back', 0, 'ex-bench-press', 4, 8, 120, 185, NULL, NULL, NULL, 'Pause on first rep'),
      ('tmpl-exh-chest-back-ex2', 'tmpl-exh-chest-back', 1, 'ex-row', 4, 10, 90, 155, NULL, NULL, NULL, NULL),
      ('tmpl-exh-chest-back-ex3', 'tmpl-exh-chest-back', 2, 'ex-lat-pulldown', 3, 12, 75, 140, NULL, NULL, NULL, NULL),
      ('tmpl-exh-chest-back-ex4', 'tmpl-exh-chest-back', 3, 'ex-plank', 3, 0, 60, NULL, NULL, NULL, 2, '60-90s holds'),
      ('tmpl-exh-arms-shoulders-ex1', 'tmpl-exh-arms-shoulders', 0, 'ex-ohp', 4, 8, 120, 115, NULL, NULL, NULL, 'Standing'),
      ('tmpl-exh-arms-shoulders-ex2', 'tmpl-exh-arms-shoulders', 1, 'ex-dumbbell-curl', 3, 12, 75, 35, NULL, NULL, NULL, NULL),
      ('tmpl-exh-arms-shoulders-ex3', 'tmpl-exh-arms-shoulders', 2, 'ex-tricep-pushdown', 3, 12, 75, 70, NULL, NULL, NULL, NULL),
      ('tmpl-exh-arms-shoulders-ex4', 'tmpl-exh-arms-shoulders', 3, 'ex-lateral-raise', 3, 15, 60, 25, NULL, NULL, NULL, NULL),
      ('tmpl-exh-legs-ex1', 'tmpl-exh-legs', 0, 'ex-back-squat', 4, 8, 150, 245, NULL, NULL, NULL, 'Depth focus'),
      ('tmpl-exh-legs-ex2', 'tmpl-exh-legs', 1, 'ex-deadlift', 3, 6, 180, 275, NULL, NULL, NULL, 'Controlled eccentric'),
      ('tmpl-exh-legs-ex3', 'tmpl-exh-legs', 2, 'ex-leg-press', 4, 12, 120, 360, NULL, NULL, NULL, NULL),
      ('tmpl-exh-legs-ex4', 'tmpl-exh-legs', 3, 'ex-leg-curl', 3, 15, 90, 110, NULL, NULL, NULL, NULL)
    ON CONFLICT (id) DO UPDATE
      SET order_index = EXCLUDED.order_index,
          default_sets = EXCLUDED.default_sets,
          default_reps = EXCLUDED.default_reps,
          default_rest_seconds = EXCLUDED.default_rest_seconds,
          default_weight = EXCLUDED.default_weight,
          notes = EXCLUDED.notes,
          template_id = EXCLUDED.template_id
  `);

  await query(`
    INSERT INTO workout_sessions (
      id, user_id, template_id, template_name, started_at, finished_at, created_at, updated_at
    )
    VALUES
      ('sess-exh-01', '${exhibitedUserId}', 'tmpl-exh-chest-back', 'Chest / Back Power', NOW() - INTERVAL '35 days' + INTERVAL '9 hours', NOW() - INTERVAL '35 days' + INTERVAL '10.2 hours', NOW() - INTERVAL '35 days', NOW() - INTERVAL '35 days'),
      ('sess-exh-02', '${exhibitedUserId}', 'tmpl-exh-legs', 'Legs + Glutes Strength', NOW() - INTERVAL '32 days' + INTERVAL '8 hours', NOW() - INTERVAL '32 days' + INTERVAL '9.5 hours', NOW() - INTERVAL '32 days', NOW() - INTERVAL '32 days'),
      ('sess-exh-03', '${exhibitedUserId}', 'tmpl-exh-arms-shoulders', 'Arms + Shoulders Volume', NOW() - INTERVAL '30 days' + INTERVAL '7 hours', NOW() - INTERVAL '30 days' + INTERVAL '8.1 hours', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days'),
      ('sess-exh-04', '${exhibitedUserId}', 'tmpl-exh-chest-back', 'Chest / Back Power', NOW() - INTERVAL '27 days' + INTERVAL '7 hours', NOW() - INTERVAL '27 days' + INTERVAL '8.1 hours', NOW() - INTERVAL '27 days', NOW() - INTERVAL '27 days'),
      ('sess-exh-05', '${exhibitedUserId}', 'tmpl-exh-legs', 'Legs + Glutes Strength', NOW() - INTERVAL '24 days' + INTERVAL '6 hours', NOW() - INTERVAL '24 days' + INTERVAL '7.3 hours', NOW() - INTERVAL '24 days', NOW() - INTERVAL '24 days'),
      ('sess-exh-06', '${exhibitedUserId}', 'tmpl-exh-arms-shoulders', 'Arms + Shoulders Volume', NOW() - INTERVAL '21 days' + INTERVAL '9 hours', NOW() - INTERVAL '21 days' + INTERVAL '10 hours', NOW() - INTERVAL '21 days', NOW() - INTERVAL '21 days'),
      ('sess-exh-07', '${exhibitedUserId}', 'tmpl-exh-chest-back', 'Chest / Back Power', NOW() - INTERVAL '17 days' + INTERVAL '8 hours', NOW() - INTERVAL '17 days' + INTERVAL '9.2 hours', NOW() - INTERVAL '17 days', NOW() - INTERVAL '17 days'),
      ('sess-exh-08', '${exhibitedUserId}', 'tmpl-exh-legs', 'Legs + Glutes Strength', NOW() - INTERVAL '13 days' + INTERVAL '7 hours', NOW() - INTERVAL '13 days' + INTERVAL '8.4 hours', NOW() - INTERVAL '13 days', NOW() - INTERVAL '13 days'),
      ('sess-exh-09', '${exhibitedUserId}', 'tmpl-exh-arms-shoulders', 'Arms + Shoulders Volume', NOW() - INTERVAL '10 days' + INTERVAL '6 hours', NOW() - INTERVAL '10 days' + INTERVAL '7 hours', NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
      ('sess-exh-10', '${exhibitedUserId}', 'tmpl-exh-chest-back', 'Chest / Back Power', NOW() - INTERVAL '6 days' + INTERVAL '9 hours', NOW() - INTERVAL '6 days' + INTERVAL '10 hours', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
      ('sess-exh-11', '${exhibitedUserId}', 'tmpl-exh-legs', 'Legs + Glutes Strength', NOW() - INTERVAL '4 days' + INTERVAL '8 hours', NOW() - INTERVAL '4 days' + INTERVAL '9.3 hours', NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
      ('sess-exh-12', '${exhibitedUserId}', 'tmpl-exh-arms-shoulders', 'Arms + Shoulders Volume', NOW() - INTERVAL '2 days' + INTERVAL '7 hours', NOW() - INTERVAL '2 days' + INTERVAL '8 hours', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
      ('sess-exh-13', '${exhibitedUserId}', 'tmpl-exh-chest-back', 'Chest / Back Power', NOW() - INTERVAL '1 day' + INTERVAL '6 hours', NOW() - INTERVAL '1 day' + INTERVAL '7.2 hours', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
    ON CONFLICT (id) DO UPDATE
      SET template_id = EXCLUDED.template_id,
          template_name = EXCLUDED.template_name,
          started_at = EXCLUDED.started_at,
          finished_at = EXCLUDED.finished_at,
          user_id = EXCLUDED.user_id,
          updated_at = NOW()
  `);

  await query(`
    INSERT INTO workout_sets (
      id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight, actual_reps, actual_weight, rpe
    )
    VALUES
      -- sess-exh-01 chest/back
      ('set-exh-01-1', 'sess-exh-01', 'tmpl-exh-chest-back-ex1', 'ex-bench-press', 0, 8, 185, 8, 185, 7.5),
      ('set-exh-01-2', 'sess-exh-01', 'tmpl-exh-chest-back-ex1', 'ex-bench-press', 1, 8, 185, 7, 195, 8),
      ('set-exh-01-3', 'sess-exh-01', 'tmpl-exh-chest-back-ex2', 'ex-row', 0, 10, 155, 10, 155, 7),
      ('set-exh-01-4', 'sess-exh-01', 'tmpl-exh-chest-back-ex2', 'ex-row', 1, 10, 155, 9, 165, 7.5),
      ('set-exh-01-5', 'sess-exh-01', 'tmpl-exh-chest-back-ex3', 'ex-lat-pulldown', 0, 12, 140, 12, 140, 7),
      ('set-exh-01-6', 'sess-exh-01', 'tmpl-exh-chest-back-ex3', 'ex-lat-pulldown', 1, 12, 140, 11, 150, 7.5),
      -- sess-exh-02 legs
      ('set-exh-02-1', 'sess-exh-02', 'tmpl-exh-legs-ex1', 'ex-back-squat', 0, 8, 245, 8, 245, 7.5),
      ('set-exh-02-2', 'sess-exh-02', 'tmpl-exh-legs-ex1', 'ex-back-squat', 1, 8, 245, 7, 255, 8),
      ('set-exh-02-3', 'sess-exh-02', 'tmpl-exh-legs-ex2', 'ex-deadlift', 0, 6, 275, 6, 275, 7.5),
      ('set-exh-02-4', 'sess-exh-02', 'tmpl-exh-legs-ex2', 'ex-deadlift', 1, 6, 275, 5, 285, 8),
      ('set-exh-02-5', 'sess-exh-02', 'tmpl-exh-legs-ex3', 'ex-leg-press', 0, 12, 360, 12, 360, 7),
      ('set-exh-02-6', 'sess-exh-02', 'tmpl-exh-legs-ex3', 'ex-leg-press', 1, 12, 360, 11, 380, 7.5),
      -- sess-exh-03 arms/shoulders
      ('set-exh-03-1', 'sess-exh-03', 'tmpl-exh-arms-shoulders-ex1', 'ex-ohp', 0, 8, 115, 8, 115, 7.5),
      ('set-exh-03-2', 'sess-exh-03', 'tmpl-exh-arms-shoulders-ex1', 'ex-ohp', 1, 8, 115, 7, 125, 8),
      ('set-exh-03-3', 'sess-exh-03', 'tmpl-exh-arms-shoulders-ex2', 'ex-dumbbell-curl', 0, 12, 35, 12, 35, 7),
      ('set-exh-03-4', 'sess-exh-03', 'tmpl-exh-arms-shoulders-ex3', 'ex-tricep-pushdown', 0, 12, 70, 12, 70, 7),
      ('set-exh-03-5', 'sess-exh-03', 'tmpl-exh-arms-shoulders-ex4', 'ex-lateral-raise', 0, 15, 25, 15, 25, 7),
      -- sess-exh-04 chest/back
      ('set-exh-04-1', 'sess-exh-04', 'tmpl-exh-chest-back-ex1', 'ex-bench-press', 0, 8, 185, 8, 190, 7.5),
      ('set-exh-04-2', 'sess-exh-04', 'tmpl-exh-chest-back-ex2', 'ex-row', 0, 10, 155, 10, 160, 7),
      ('set-exh-04-3', 'sess-exh-04', 'tmpl-exh-chest-back-ex3', 'ex-lat-pulldown', 0, 12, 140, 12, 145, 7),
      -- sess-exh-05 legs
      ('set-exh-05-1', 'sess-exh-05', 'tmpl-exh-legs-ex1', 'ex-back-squat', 0, 8, 245, 8, 250, 7.5),
      ('set-exh-05-2', 'sess-exh-05', 'tmpl-exh-legs-ex2', 'ex-deadlift', 0, 6, 275, 6, 280, 7.5),
      ('set-exh-05-3', 'sess-exh-05', 'tmpl-exh-legs-ex3', 'ex-leg-press', 0, 12, 360, 12, 380, 7),
      ('set-exh-05-4', 'sess-exh-05', 'tmpl-exh-legs-ex4', 'ex-leg-curl', 0, 15, 110, 15, 110, 7),
      -- sess-exh-06 arms/shoulders
      ('set-exh-06-1', 'sess-exh-06', 'tmpl-exh-arms-shoulders-ex1', 'ex-ohp', 0, 8, 115, 8, 120, 7.5),
      ('set-exh-06-2', 'sess-exh-06', 'tmpl-exh-arms-shoulders-ex2', 'ex-dumbbell-curl', 0, 12, 35, 12, 37.5, 7.5),
      ('set-exh-06-3', 'sess-exh-06', 'tmpl-exh-arms-shoulders-ex3', 'ex-tricep-pushdown', 0, 12, 70, 12, 75, 7.5),
      ('set-exh-06-4', 'sess-exh-06', 'tmpl-exh-arms-shoulders-ex4', 'ex-lateral-raise', 0, 15, 25, 15, 27.5, 7.5),
      -- sess-exh-07 chest/back
      ('set-exh-07-1', 'sess-exh-07', 'tmpl-exh-chest-back-ex1', 'ex-bench-press', 0, 8, 185, 8, 200, 8),
      ('set-exh-07-2', 'sess-exh-07', 'tmpl-exh-chest-back-ex2', 'ex-row', 0, 10, 155, 10, 165, 7.5),
      ('set-exh-07-3', 'sess-exh-07', 'tmpl-exh-chest-back-ex3', 'ex-lat-pulldown', 0, 12, 140, 12, 150, 7.5),
      -- sess-exh-08 legs
      ('set-exh-08-1', 'sess-exh-08', 'tmpl-exh-legs-ex1', 'ex-back-squat', 0, 8, 245, 8, 255, 7.5),
      ('set-exh-08-2', 'sess-exh-08', 'tmpl-exh-legs-ex3', 'ex-leg-press', 0, 12, 360, 12, 390, 7.5),
      ('set-exh-08-3', 'sess-exh-08', 'tmpl-exh-legs-ex4', 'ex-leg-curl', 0, 15, 110, 15, 115, 7.5),
      -- sess-exh-09 arms/shoulders
      ('set-exh-09-1', 'sess-exh-09', 'tmpl-exh-arms-shoulders-ex1', 'ex-ohp', 0, 8, 115, 8, 125, 7.5),
      ('set-exh-09-2', 'sess-exh-09', 'tmpl-exh-arms-shoulders-ex2', 'ex-dumbbell-curl', 0, 12, 35, 12, 37.5, 7.5),
      ('set-exh-09-3', 'sess-exh-09', 'tmpl-exh-arms-shoulders-ex3', 'ex-tricep-pushdown', 0, 12, 70, 12, 75, 7.5),
      ('set-exh-09-4', 'sess-exh-09', 'tmpl-exh-arms-shoulders-ex4', 'ex-lateral-raise', 0, 15, 25, 15, 27.5, 7.5),
      -- sess-exh-10 chest/back
      ('set-exh-10-1', 'sess-exh-10', 'tmpl-exh-chest-back-ex1', 'ex-bench-press', 0, 8, 185, 8, 195, 7.5),
      ('set-exh-10-2', 'sess-exh-10', 'tmpl-exh-chest-back-ex1', 'ex-bench-press', 1, 8, 185, 7, 205, 8),
      ('set-exh-10-3', 'sess-exh-10', 'tmpl-exh-chest-back-ex2', 'ex-row', 0, 10, 155, 10, 165, 7.5),
      ('set-exh-10-4', 'sess-exh-10', 'tmpl-exh-chest-back-ex3', 'ex-lat-pulldown', 0, 12, 140, 12, 150, 7.5),
      -- sess-exh-11 legs
      ('set-exh-11-1', 'sess-exh-11', 'tmpl-exh-legs-ex1', 'ex-back-squat', 0, 8, 245, 8, 260, 7.5),
      ('set-exh-11-2', 'sess-exh-11', 'tmpl-exh-legs-ex2', 'ex-deadlift', 0, 6, 275, 6, 290, 8),
      ('set-exh-11-3', 'sess-exh-11', 'tmpl-exh-legs-ex3', 'ex-leg-press', 0, 12, 360, 12, 400, 7.5),
      ('set-exh-11-4', 'sess-exh-11', 'tmpl-exh-legs-ex4', 'ex-leg-curl', 0, 15, 110, 15, 120, 7.5),
      -- sess-exh-12 arms/shoulders
      ('set-exh-12-1', 'sess-exh-12', 'tmpl-exh-arms-shoulders-ex1', 'ex-ohp', 0, 8, 115, 8, 122.5, 7.5),
      ('set-exh-12-2', 'sess-exh-12', 'tmpl-exh-arms-shoulders-ex2', 'ex-dumbbell-curl', 0, 12, 35, 13, 37.5, 7.5),
      ('set-exh-12-3', 'sess-exh-12', 'tmpl-exh-arms-shoulders-ex3', 'ex-tricep-pushdown', 0, 12, 70, 13, 75, 7.5),
      ('set-exh-12-4', 'sess-exh-12', 'tmpl-exh-arms-shoulders-ex4', 'ex-lateral-raise', 0, 15, 25, 16, 27.5, 7.5),
      -- sess-exh-13 chest/back (recent)
      ('set-exh-13-1', 'sess-exh-13', 'tmpl-exh-chest-back-ex1', 'ex-bench-press', 0, 8, 185, 8, 200, 7.5),
      ('set-exh-13-2', 'sess-exh-13', 'tmpl-exh-chest-back-ex2', 'ex-row', 0, 10, 155, 10, 170, 7.5),
      ('set-exh-13-3', 'sess-exh-13', 'tmpl-exh-chest-back-ex3', 'ex-lat-pulldown', 0, 12, 140, 12, 155, 7.5),
      ('set-exh-13-4', 'sess-exh-13', 'tmpl-exh-chest-back-ex4', 'ex-plank', 0, 0, NULL, 0, NULL, NULL)
    ON CONFLICT (id) DO UPDATE
      SET actual_reps = EXCLUDED.actual_reps,
          actual_weight = EXCLUDED.actual_weight,
          target_reps = EXCLUDED.target_reps,
          target_weight = EXCLUDED.target_weight,
          template_exercise_id = EXCLUDED.template_exercise_id,
          exercise_id = EXCLUDED.exercise_id
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
