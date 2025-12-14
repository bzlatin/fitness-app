"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = exports.query = exports.pool = void 0;
const pg_1 = require("pg");
const dns_1 = __importDefault(require("dns"));
const exerciseData_1 = require("./utils/exerciseData");
const migrationRunner_1 = require("./utils/migrationRunner");
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
    await (0, migrationRunner_1.runSqlMigrations)(exports.pool);
    const bootstrapModeRaw = process.env.DB_BOOTSTRAP_MODE;
    const bootstrapMode = bootstrapModeRaw
        ? bootstrapModeRaw.toLowerCase()
        : process.env.NODE_ENV === "production"
            ? "prod"
            : "dev";
    if (bootstrapMode !== "dev" && bootstrapMode !== "prod") {
        throw new Error(`Invalid DB_BOOTSTRAP_MODE: ${bootstrapModeRaw}`);
    }
    if (bootstrapMode === "prod")
        return;
    await seedExercisesFromJson();
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
};
exports.initDb = initDb;
