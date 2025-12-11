"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = exports.query = exports.pool = void 0;
const pg_1 = require("pg");
const dns_1 = __importDefault(require("dns"));
const exerciseData_1 = require("./utils/exerciseData");
// Favor IPv4 to avoid connection failures on hosts that resolve to IPv6 first (e.g., Supabase)
if (dns_1.default.setDefaultResultOrder) {
    dns_1.default.setDefaultResultOrder("ipv4first");
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Please add it to your .env.");
}
const normalizeConnectionString = (raw) => {
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
    }
    catch {
        const isLocalHost = raw.includes("localhost") || raw.includes("127.0.0.1");
        return { normalized: raw, isLocalHost };
    }
};
const { normalized: normalizedConnectionString, isLocalHost } = normalizeConnectionString(connectionString);
const ssl = isLocalHost ? false : { rejectUnauthorized: false };
// Force pg to apply the same relaxed SSL policy (avoids self-signed chain errors from poolers)
pg_1.defaults.ssl = ssl;
// Ensure pg skips TLS chain verification on hosted DBs with self-signed certs (e.g., Supabase pooler)
if (!ssl) {
    process.env.PGSSLMODE = "disable";
}
else {
    process.env.PGSSLMODE = "no-verify";
}
exports.pool = new pg_1.Pool({
    connectionString: normalizedConnectionString,
    ssl,
});
const query = (text, params) => exports.pool.query(text, params);
exports.query = query;
const normalizePrimaryMuscleGroup = (value) => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw)
        return "other";
    const muscle = raw.toLowerCase();
    if (muscle.includes("glute"))
        return "glutes";
    if (muscle.includes("quad") ||
        muscle.includes("hamstring") ||
        muscle.includes("calf") ||
        muscle.includes("adductor") ||
        muscle.includes("abductor") ||
        muscle.includes("hip") ||
        muscle.includes("leg")) {
        return "legs";
    }
    if (muscle.includes("abdom") || muscle.includes("core") || muscle.includes("oblique")) {
        return "core";
    }
    if (muscle.includes("chest") || muscle.includes("pec"))
        return "chest";
    if (muscle.includes("back") || muscle.includes("lat") || muscle.includes("trap"))
        return "back";
    if (muscle.includes("shoulder") || muscle.includes("deltoid"))
        return "shoulders";
    if (muscle.includes("tricep"))
        return "triceps";
    if (muscle.includes("bicep"))
        return "biceps";
    return muscle || "other";
};
const normalizeEquipment = (value) => {
    const raw = (value ?? "").toLowerCase();
    if (raw.includes("body"))
        return "bodyweight";
    if (raw.includes("machine"))
        return "machine";
    if (raw.includes("cable"))
        return "cable";
    if (raw.includes("dumbbell"))
        return "dumbbell";
    if (raw.includes("barbell"))
        return "barbell";
    if (raw.includes("kettlebell"))
        return "kettlebell";
    return raw || "other";
};
const normalizeExercise = (item) => {
    const primary = normalizePrimaryMuscleGroup(item.primaryMuscles || item.primaryMuscleGroup);
    const equipment = normalizeEquipment(item.equipment ||
        (Array.isArray(item.equipments) ? item.equipments[0] : item.equipments) ||
        "bodyweight");
    return {
        id: (item.id || item.name.replace(/\s+/g, "_")).trim(),
        name: item.name.trim(),
        primaryMuscleGroup: primary.toLowerCase(),
        equipment: equipment.toLowerCase(),
        category: item.category?.toLowerCase() ?? null,
        level: item.level?.toLowerCase() ?? null,
        force: item.force?.toLowerCase() ?? null,
        mechanic: item.mechanic?.toLowerCase() ?? null,
        primaryMuscles: item.primaryMuscles?.map((m) => m.toLowerCase()) ?? null,
        secondaryMuscles: item.secondaryMuscles?.map((m) => m.toLowerCase()) ?? null,
        instructions: item.instructions ?? null,
        imagePaths: item.images ?? null,
    };
};
const chunk = (items, size) => {
    const result = [];
    for (let i = 0; i < items.length; i += size) {
        result.push(items.slice(i, i + size));
    }
    return result;
};
const SEEDED_USER_IDS = [
    "demo-user",
    "demo-lifter",
    "coach-amy",
    "iron-mile",
    "neon-flash",
    "pulse-strider",
    "corecraft",
    "tempo-squad",
    "lifty-liz",
];
const seedExercisesFromJson = async () => {
    const rawExercises = (0, exerciseData_1.loadExercisesJson)();
    if (!rawExercises.length)
        return;
    // Reset exercises to ensure we pick up any new metadata or images from the source JSON
    await (0, exports.query)(`DELETE FROM exercises`);
    const normalized = Array.from(new Map(rawExercises.map((ex) => [ex.id ?? ex.name, normalizeExercise(ex)])).values());
    const batches = chunk(normalized, 150);
    for (const batch of batches) {
        const values = [];
        const params = [];
        batch.forEach((ex, idx) => {
            const offset = idx * 12;
            values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`);
            params.push(ex.id, ex.name, ex.primaryMuscleGroup, ex.equipment, ex.category, ex.level, ex.force, ex.mechanic, ex.primaryMuscles, ex.secondaryMuscles, ex.instructions, ex.imagePaths);
        });
        await (0, exports.query)(`
        INSERT INTO exercises (
          id,
          name,
          primary_muscle_group,
          equipment,
          category,
          level,
          force,
          mechanic,
          primary_muscles,
          secondary_muscles,
          instructions,
          image_paths
        )
        VALUES ${values.join(", ")}
        ON CONFLICT (id) DO UPDATE
          SET name = EXCLUDED.name,
              primary_muscle_group = COALESCE(EXCLUDED.primary_muscle_group, exercises.primary_muscle_group),
              equipment = COALESCE(EXCLUDED.equipment, exercises.equipment),
              category = COALESCE(EXCLUDED.category, exercises.category),
              level = COALESCE(EXCLUDED.level, exercises.level),
              force = COALESCE(EXCLUDED.force, exercises.force),
              mechanic = COALESCE(EXCLUDED.mechanic, exercises.mechanic),
              primary_muscles = COALESCE(EXCLUDED.primary_muscles, exercises.primary_muscles),
              secondary_muscles = COALESCE(EXCLUDED.secondary_muscles, exercises.secondary_muscles),
              instructions = COALESCE(EXCLUDED.instructions, exercises.instructions),
              image_paths = COALESCE(EXCLUDED.image_paths, exercises.image_paths)
      `, params);
    }
};
const initDb = async () => {
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
    await (0, exports.query)(`
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
      ADD COLUMN IF NOT EXISTS last_handle_change_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS training_style TEXT,
      ADD COLUMN IF NOT EXISTS gym_name TEXT,
      ADD COLUMN IF NOT EXISTS gym_visibility TEXT NOT NULL DEFAULT 'hidden',
      ADD COLUMN IF NOT EXISTS weekly_goal INTEGER NOT NULL DEFAULT 4,
      ADD COLUMN IF NOT EXISTS onboarding_data JSONB,
      ADD COLUMN IF NOT EXISTS progressive_overload_enabled BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS rest_timer_sound_enabled BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS push_token TEXT,
      ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"goalReminders": true, "inactivityNudges": true, "squadActivity": true, "weeklyGoalMet": true, "quietHoursStart": 22, "quietHoursEnd": 8, "maxNotificationsPerWeek": 3}'::jsonb
  `);
    await (0, exports.query)(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique_idx
    ON users(handle)
    WHERE handle IS NOT NULL
  `);
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS subscription_events (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      event_type TEXT NOT NULL,
      stripe_event_id TEXT UNIQUE,
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
    await (0, exports.query)(`
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
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS idx_appstore_notifications_user ON appstore_notifications(user_id)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS idx_appstore_notifications_original_tx ON appstore_notifications(original_transaction_id)
  `);
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS waitlist_emails (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
    await (0, exports.query)(`UPDATE users SET plan = 'free' WHERE plan IS NULL`);
    await (0, exports.query)(`
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
    await (0, exports.query)(`
    ALTER TABLE workout_templates
      ADD COLUMN IF NOT EXISTS progressive_overload_enabled BOOLEAN
  `);
    await (0, exports.query)(`
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
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS follows (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, target_user_id)
    )
  `);
    await (0, exports.query)(`
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
    await (0, exports.query)(`
    ALTER TABLE workout_sessions
      ADD COLUMN IF NOT EXISTS template_name TEXT
  `);
    await (0, exports.query)(`
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
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS workout_sets_session_idx ON workout_sets(session_id)
  `);
    // Add cardio-specific columns to workout_sets table
    await (0, exports.query)(`
    ALTER TABLE workout_sets
      ADD COLUMN IF NOT EXISTS target_distance NUMERIC,
      ADD COLUMN IF NOT EXISTS actual_distance NUMERIC,
      ADD COLUMN IF NOT EXISTS target_incline NUMERIC,
      ADD COLUMN IF NOT EXISTS actual_incline NUMERIC,
      ADD COLUMN IF NOT EXISTS target_duration_minutes NUMERIC,
      ADD COLUMN IF NOT EXISTS actual_duration_minutes NUMERIC
  `);
    await (0, exports.query)(`
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
    await (0, exports.query)(`
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
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS squads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
    await (0, exports.query)(`
    ALTER TABLE squads
      ADD COLUMN IF NOT EXISTS max_members INTEGER NOT NULL DEFAULT 50
  `);
    // Squad description and visibility
    await (0, exports.query)(`
    ALTER TABLE squads
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false
  `);
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS squad_members (
      squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (squad_id, user_id)
    )
  `);
    await (0, exports.query)(`
    ALTER TABLE squad_members
      ADD COLUMN IF NOT EXISTS invited_by TEXT REFERENCES users(id) ON DELETE SET NULL
  `);
    await (0, exports.query)(`
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
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS squad_invite_links_code_idx ON squad_invite_links(code)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS squad_invite_links_squad_id_idx ON squad_invite_links(squad_id)
  `);
    // Workout reactions (emoji reactions and comments)
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS workout_reactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('status', 'share')),
      target_id TEXT NOT NULL,
      reaction_type TEXT NOT NULL CHECK (reaction_type IN ('emoji', 'comment')),
      emoji TEXT,
      comment TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS workout_reactions_target_idx ON workout_reactions(target_type, target_id)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS workout_reactions_user_idx ON workout_reactions(user_id)
  `);
    // Unique constraint for emoji reactions (one emoji type per user per target)
    await (0, exports.query)(`
    CREATE UNIQUE INDEX IF NOT EXISTS workout_reactions_unique_emoji_idx
    ON workout_reactions(user_id, target_type, target_id, emoji)
    WHERE reaction_type = 'emoji'
  `);
    // User blocks table
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS user_blocks (
      blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (blocker_id, blocked_id)
    )
  `);
    // AI Workout Generation tracking
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS ai_generations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      generation_type TEXT NOT NULL,
      input_params JSONB,
      output_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS ai_generations_user_id_idx ON ai_generations(user_id)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS ai_generations_created_at_idx ON ai_generations(created_at)
  `);
    // Notification events tracking
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS notification_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type TEXT NOT NULL,
      trigger_reason TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data JSONB,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      clicked_at TIMESTAMPTZ,
      delivery_status TEXT NOT NULL DEFAULT 'sent',
      error_message TEXT
    )
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS notification_events_user_id_idx ON notification_events(user_id)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS notification_events_sent_at_idx ON notification_events(sent_at)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS notification_events_user_read_idx ON notification_events(user_id, read_at)
  `);
    // Admin users table (for feedback moderation and status updates)
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS admin_users (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      granted_by TEXT REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    // Feedback items table
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS feedback_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('feature_request', 'bug_report', 'ui_ux_improvement', 'performance', 'social_features')),
      impact TEXT NOT NULL CHECK (impact IN ('critical', 'high', 'medium', 'low', 'must_have', 'nice_to_have')),
      status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'planned', 'in_progress', 'shipped', 'wont_fix', 'duplicate')),
      vote_count INTEGER NOT NULL DEFAULT 0,
      is_hidden BOOLEAN NOT NULL DEFAULT false,
      auto_hidden_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status_updated_at TIMESTAMPTZ,
      status_updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
    )
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_items_user_id_idx ON feedback_items(user_id)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_items_created_at_idx ON feedback_items(created_at DESC)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_items_vote_count_idx ON feedback_items(vote_count DESC)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_items_status_idx ON feedback_items(status)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_items_category_idx ON feedback_items(category)
  `);
    // Feedback votes table (one vote per user per item)
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS feedback_votes (
      id TEXT PRIMARY KEY,
      feedback_item_id TEXT NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(feedback_item_id, user_id)
    )
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_votes_feedback_item_id_idx ON feedback_votes(feedback_item_id)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_votes_user_id_idx ON feedback_votes(user_id)
  `);
    // Feedback reports table (for moderation)
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS feedback_reports (
      id TEXT PRIMARY KEY,
      feedback_item_id TEXT NOT NULL REFERENCES feedback_items(id) ON DELETE CASCADE,
      reported_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      action_taken TEXT CHECK (action_taken IN ('hidden', 'dismissed', 'pending')),
      UNIQUE(feedback_item_id, reported_by)
    )
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_reports_feedback_item_id_idx ON feedback_reports(feedback_item_id)
  `);
    await (0, exports.query)(`
    CREATE INDEX IF NOT EXISTS feedback_reports_reviewed_at_idx ON feedback_reports(reviewed_at)
  `);
    // Add exercises table for fatigue calculations
    await (0, exports.query)(`
    CREATE TABLE IF NOT EXISTS exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      primary_muscle_group TEXT,
      equipment TEXT,
      category TEXT,
      level TEXT,
      force TEXT,
      mechanic TEXT,
      primary_muscles TEXT[],
      secondary_muscles TEXT[],
      instructions TEXT[],
      image_paths TEXT[]
    )
  `);
    await (0, exports.query)(`
    ALTER TABLE exercises
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS level TEXT,
      ADD COLUMN IF NOT EXISTS force TEXT,
      ADD COLUMN IF NOT EXISTS mechanic TEXT,
      ADD COLUMN IF NOT EXISTS primary_muscles TEXT[],
      ADD COLUMN IF NOT EXISTS secondary_muscles TEXT[],
      ADD COLUMN IF NOT EXISTS instructions TEXT[],
      ADD COLUMN IF NOT EXISTS image_paths TEXT[]
  `);
    await seedExercisesFromJson();
    await (0, exports.query)(`
    ALTER TABLE workout_sets
      ADD COLUMN IF NOT EXISTS exercise_name TEXT,
      ADD COLUMN IF NOT EXISTS exercise_image_url TEXT
  `);
    await (0, exports.query)(`
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
    const seededValues = SEEDED_USER_IDS.map((id) => `('${id}')`).join(",\n      ");
    await (0, exports.query)(`
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
    await (0, exports.query)(`
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
    await (0, exports.query)(`
    INSERT INTO workout_shares (id, user_id, session_id, template_name, total_sets, total_volume, pr_count, visibility, created_at)
    VALUES
      ('share-demo-1', 'demo-lifter', 'session-demo-1', 'Pull Day', 18, 12400, 2, 'followers', NOW() - INTERVAL '2 hours'),
      ('share-demo-2', 'coach-amy', 'session-demo-2', 'Legs', 22, 15200, 3, 'squad', NOW() - INTERVAL '1 day'),
      ('share-demo-user-1', 'demo-user', 'session-demo-user-1', 'Full Body Flow', 21, 13800, 4, 'squad', NOW() - INTERVAL '1 hour'),
      ('share-neon-1', 'neon-flash', 'session-neon-1', 'City Sprint', 16, 8600, 1, 'followers', NOW() - INTERVAL '45 minutes'),
      ('share-pulse-1', 'pulse-strider', 'session-pulse-1', 'Tempo Circuit', 20, 10150, 3, 'followers', NOW() - INTERVAL '2 hours')
    ON CONFLICT (id) DO NOTHING
  `);
    await (0, exports.query)(`
    INSERT INTO squads (id, name, created_by)
    VALUES
      ('squad-demo-crew', 'Demo Crew', 'demo-user'),
      ('squad-pulse-gang', 'Pulse Gang', 'pulse-strider')
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          created_by = EXCLUDED.created_by,
          updated_at = NOW()
  `);
    await (0, exports.query)(`
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
    // Grant admin access to users with handle @exhibited
    await (0, exports.query)(`
    INSERT INTO admin_users (user_id)
    SELECT id FROM users WHERE handle = '@exhibited'
    ON CONFLICT (user_id) DO NOTHING
  `);
};
exports.initDb = initDb;
