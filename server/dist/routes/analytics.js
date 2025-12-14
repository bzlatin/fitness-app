"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fatigue_1 = require("../services/fatigue");
const progression_1 = require("../services/progression");
const muscleAnalytics_1 = require("../services/muscleAnalytics");
const recap_1 = require("../services/recap");
const planLimits_1 = require("../middleware/planLimits");
const db_1 = require("../db");
const id_1 = require("../utils/id");
const router = (0, express_1.Router)();
const withTransaction = async (fn) => {
    const client = await db_1.pool.connect();
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
    finally {
        client.release();
    }
};
const normalizeDurationSeconds = (startedAt, finishedAt, provided) => {
    if (Number.isFinite(provided)) {
        return Math.max(0, Math.round(provided));
    }
    if (!finishedAt)
        return undefined;
    return Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));
};
const formatAppleWorkoutName = (raw) => {
    if (!raw)
        return undefined;
    const pretty = raw.replace(/[_-]+/g, " ").trim();
    return pretty ? pretty.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
};
const normalizeOptionalInteger = (value) => {
    if (!Number.isFinite(value))
        return null;
    return Math.round(value);
};
const isIgnoredAppleSession = async (client, userId, session) => {
    if (session.externalId) {
        const ignored = await client.query(`
        SELECT EXISTS(
          SELECT 1
          FROM apple_health_ignored_workouts
          WHERE user_id = $1 AND external_id = $2
        ) as exists
      `, [userId, session.externalId]);
        return ignored.rows[0]?.exists === true;
    }
    const windowStart = new Date(session.startedAt.getTime() - 5 * 60 * 1000);
    const windowEnd = new Date(session.startedAt.getTime() + 5 * 60 * 1000);
    const ignored = await client.query(`
      SELECT id
      FROM apple_health_ignored_workouts
      WHERE user_id = $1
        AND external_id IS NULL
        AND started_at BETWEEN $2 AND $3
        AND (
          $4::int IS NULL
          OR duration_seconds IS NULL
          OR ABS(duration_seconds - $4::int) <= 120
        )
        AND (
          $5::text IS NULL
          OR workout_type IS NULL
          OR workout_type = $5
        )
      LIMIT 1
    `, [
        userId,
        windowStart.toISOString(),
        windowEnd.toISOString(),
        session.durationSeconds ?? null,
        session.workoutType ?? null,
    ]);
    return (ignored.rowCount ?? 0) > 0;
};
const findDuplicateAppleSession = async (client, userId, startedAt, durationSeconds, externalId) => {
    const windowStart = new Date(startedAt.getTime() - 5 * 60 * 1000);
    const windowEnd = new Date(startedAt.getTime() + 5 * 60 * 1000);
    const candidates = await client.query(`
      SELECT id, started_at, finished_at, duration_seconds, external_id
      FROM workout_sessions
      WHERE user_id = $1
        AND (
          ($2::text IS NOT NULL AND external_id = $2)
          OR (started_at BETWEEN $3 AND $4)
        )
    `, [userId, externalId ?? null, windowStart.toISOString(), windowEnd.toISOString()]);
    for (const candidate of candidates.rows) {
        if (externalId && candidate.external_id === externalId) {
            return candidate.id;
        }
        if (!durationSeconds)
            continue;
        const candidateDuration = candidate.duration_seconds ??
            (candidate.finished_at
                ? Math.max(0, Math.round((new Date(candidate.finished_at).getTime() -
                    new Date(candidate.started_at).getTime()) /
                    1000))
                : undefined);
        if (candidateDuration === undefined)
            continue;
        const startDelta = Math.abs(new Date(candidate.started_at).getTime() - startedAt.getTime());
        const durationDelta = Math.abs(candidateDuration - durationSeconds);
        if (startDelta <= 5 * 60 * 1000 && durationDelta <= 120) {
            return candidate.id;
        }
    }
    return null;
};
router.post("/apple-health/import", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { sessions, permissions, lastSyncAt, } = req.body ?? {};
    const parsedSessions = Array.isArray(sessions) ? sessions : [];
    const normalizedSessions = parsedSessions
        .map((session) => {
        const startedAt = new Date(session.startedAt);
        const finishedAt = session.finishedAt ? new Date(session.finishedAt) : null;
        if (Number.isNaN(startedAt.getTime())) {
            return null;
        }
        const durationSeconds = normalizeDurationSeconds(startedAt, finishedAt, session.durationSeconds);
        return {
            externalId: session.externalId,
            workoutType: session.workoutType,
            templateName: session.templateName ?? formatAppleWorkoutName(session.workoutType) ?? "Imported workout",
            startedAt,
            finishedAt,
            durationSeconds,
            totalEnergyBurned: Number.isFinite(session.totalEnergyBurned)
                ? Number(session.totalEnergyBurned)
                : undefined,
            avgHeartRate: Number.isFinite(session.avgHeartRate)
                ? Number(session.avgHeartRate)
                : undefined,
            maxHeartRate: Number.isFinite(session.maxHeartRate)
                ? Number(session.maxHeartRate)
                : undefined,
            sourceName: session.sourceName,
            notes: session.notes,
            sets: Array.isArray(session.sets) && session.sets.length
                ? session.sets.map((set, idx) => ({
                    exerciseId: set.exerciseId ?? "imported_strength_work",
                    actualReps: normalizeOptionalInteger(set.actualReps),
                    actualWeight: Number.isFinite(set.actualWeight)
                        ? Number(set.actualWeight)
                        : null,
                    setIndex: normalizeOptionalInteger(set.setIndex) ?? idx,
                }))
                : [],
        };
    })
        .filter(Boolean);
    if (!normalizedSessions.length && !permissions) {
        return res.status(400).json({ error: "No valid sessions to import" });
    }
    const syncTimestamp = lastSyncAt && !Number.isNaN(new Date(lastSyncAt).getTime())
        ? new Date(lastSyncAt)
        : new Date();
    try {
        const { importedCount, skippedCount } = await withTransaction(async (client) => {
            let imported = 0;
            let skipped = 0;
            for (const session of normalizedSessions) {
                const isIgnored = await isIgnoredAppleSession(client, userId, session);
                if (isIgnored) {
                    skipped += 1;
                    continue;
                }
                const duplicateId = await findDuplicateAppleSession(client, userId, session.startedAt, session.durationSeconds, session.externalId ?? null);
                if (duplicateId) {
                    skipped += 1;
                    continue;
                }
                const sessionId = (0, id_1.generateId)();
                await client.query(`
            INSERT INTO workout_sessions (
              id, user_id, template_id, template_name, started_at, finished_at,
              duration_seconds, source, external_id, import_metadata,
              total_energy_burned, avg_heart_rate, max_heart_rate,
              created_at, updated_at
            )
            VALUES ($1, $2, NULL, $3, $4, $5, $6, 'apple_health', $7, $8, $9, $10, $11, NOW(), NOW())
          `, [
                    sessionId,
                    userId,
                    session.templateName,
                    session.startedAt.toISOString(),
                    session.finishedAt ? session.finishedAt.toISOString() : null,
                    session.durationSeconds ?? null,
                    session.externalId ?? null,
                    {
                        workoutType: session.workoutType,
                        sourceName: session.sourceName,
                        notes: session.notes,
                    },
                    session.totalEnergyBurned ?? null,
                    session.avgHeartRate ?? null,
                    session.maxHeartRate ?? null,
                ]);
                for (const set of session.sets) {
                    await client.query(`
              INSERT INTO workout_sets (
                id, session_id, template_exercise_id, exercise_id, set_index,
                target_reps, target_weight, actual_reps, actual_weight, rpe
              )
              VALUES ($1, $2, NULL, $3, $4, NULL, NULL, $5, $6, NULL)
            `, [
                        (0, id_1.generateId)(),
                        sessionId,
                        set.exerciseId,
                        set.setIndex,
                        set.actualReps ?? null,
                        set.actualWeight ?? null,
                    ]);
                }
                imported += 1;
            }
            if (permissions || imported > 0) {
                const permissionsJson = permissions && Object.keys(permissions).length > 0 ? permissions : null;
                await client.query(`
            UPDATE users
            SET apple_health_enabled = $1,
                apple_health_permissions = COALESCE($2, apple_health_permissions),
                apple_health_last_sync_at = $3,
                updated_at = NOW()
            WHERE id = $4
          `, [
                    Boolean(imported > 0 ||
                        permissions?.workouts ||
                        permissions?.activeEnergy ||
                        permissions?.heartRate),
                    permissionsJson,
                    syncTimestamp.toISOString(),
                    userId,
                ]);
            }
            return { importedCount: imported, skippedCount: skipped };
        });
        return res.json({ importedCount, skippedCount });
    }
    catch (err) {
        console.error("[Analytics] Failed to import Apple Health sessions", err);
        return res.status(500).json({ error: "Failed to import Apple Health sessions" });
    }
});
router.delete("/apple-health/imports", async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const result = await withTransaction(async (client) => {
            const deleted = await client.query(`
          DELETE FROM workout_sessions
          WHERE user_id = $1 AND source = 'apple_health'
          RETURNING id
        `, [userId]);
            await client.query(`
          UPDATE users
          SET apple_health_enabled = false,
              apple_health_permissions = COALESCE(apple_health_permissions, '{}'::jsonb) || '{"workouts": false, "activeEnergy": false, "heartRate": false}'::jsonb,
              apple_health_last_sync_at = NULL,
              updated_at = NOW()
          WHERE id = $1
        `, [userId]);
            return deleted.rowCount;
        });
        return res.json({ deletedCount: result });
    }
    catch (err) {
        console.error("[Analytics] Failed to clear Apple Health imports", err);
        return res.status(500).json({ error: "Failed to clear Apple Health imports" });
    }
});
router.get("/fatigue", async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const data = await (0, fatigue_1.getFatigueScores)(userId);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch fatigue scores", err);
        return res.status(500).json({ error: "Failed to fetch fatigue scores" });
    }
});
router.get("/recommendations", planLimits_1.requireProPlan, async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const fatigue = await (0, fatigue_1.getFatigueScores)(userId);
        const data = await (0, fatigue_1.getTrainingRecommendations)(userId, fatigue);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch training recommendations", err);
        return res.status(500).json({ error: "Failed to fetch recommendations" });
    }
});
router.get("/progression/:templateId", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { templateId } = req.params;
    if (!templateId) {
        return res.status(400).json({ error: "Template ID is required" });
    }
    try {
        const data = await (0, progression_1.getProgressionSuggestions)(userId, templateId);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch progression suggestions", err);
        return res.status(500).json({ error: "Failed to fetch progression suggestions" });
    }
});
router.post("/progression/:templateId/apply", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { templateId } = req.params;
    if (!templateId) {
        return res.status(400).json({ error: "Template ID is required" });
    }
    const { exerciseIds } = req.body;
    try {
        const result = await (0, progression_1.applyProgressionSuggestions)(userId, templateId, exerciseIds);
        return res.json({ data: result });
    }
    catch (err) {
        console.error("[Analytics] Failed to apply progression suggestions", err);
        return res.status(500).json({ error: "Failed to apply progression suggestions" });
    }
});
// Advanced Muscle Group Analytics (Pro feature)
router.get("/muscle-analytics", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getAdvancedAnalytics)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch muscle analytics", err);
        return res.status(500).json({ error: "Failed to fetch muscle analytics" });
    }
});
router.get("/weekly-volume", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getWeeklyVolumeByMuscleGroup)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch weekly volume", err);
        return res.status(500).json({ error: "Failed to fetch weekly volume" });
    }
});
router.get("/muscle-summaries", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getMuscleGroupSummaries)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch muscle summaries", err);
        return res.status(500).json({ error: "Failed to fetch muscle summaries" });
    }
});
router.get("/push-pull-balance", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getPushPullBalance)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch push/pull balance", err);
        return res.status(500).json({ error: "Failed to fetch push/pull balance" });
    }
});
router.get("/volume-prs", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 52;
    try {
        const data = await (0, muscleAnalytics_1.getVolumePRs)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch volume PRs", err);
        return res.status(500).json({ error: "Failed to fetch volume PRs" });
    }
});
router.get("/frequency-heatmap", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const weeks = parseInt(req.query.weeks) || 12;
    try {
        const data = await (0, muscleAnalytics_1.getFrequencyHeatmap)(userId, weeks);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch frequency heatmap", err);
        return res.status(500).json({ error: "Failed to fetch frequency heatmap" });
    }
});
router.get("/recap", planLimits_1.requireProPlan, async (_req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const data = await (0, recap_1.getRecapSlice)(userId);
        return res.json({ data });
    }
    catch (err) {
        console.error("[Analytics] Failed to fetch recap slice", err);
        return res.status(500).json({ error: "Failed to fetch recap" });
    }
});
exports.default = router;
