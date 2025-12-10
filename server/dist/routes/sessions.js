"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const id_1 = require("../utils/id");
const exerciseCatalog_1 = require("../utils/exerciseCatalog");
const router = (0, express_1.Router)();
const formatExerciseId = (id) => id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
const buildMetaMapFromSets = async (setRows) => {
    const ids = Array.from(new Set(setRows.map((set) => set.exercise_id).filter(Boolean)));
    return (0, exerciseCatalog_1.fetchExerciseMetaByIds)(ids);
};
const mapSet = (row, metaMap) => {
    const exerciseMeta = metaMap?.get(row.exercise_id);
    const exerciseName = exerciseMeta?.name ?? formatExerciseId(row.exercise_id);
    return {
        id: row.id,
        sessionId: row.session_id,
        templateExerciseId: row.template_exercise_id ?? undefined,
        exerciseId: row.exercise_id,
        setIndex: row.set_index,
        targetReps: row.target_reps ?? undefined,
        targetWeight: row.target_weight === null ? undefined : Number(row.target_weight),
        actualReps: row.actual_reps ?? undefined,
        actualWeight: row.actual_weight === null ? undefined : Number(row.actual_weight),
        rpe: row.rpe === null ? undefined : Number(row.rpe),
        exerciseName,
        exerciseImageUrl: exerciseMeta?.gifUrl,
        // Cardio-specific fields
        targetDistance: row.target_distance === null ? undefined : Number(row.target_distance),
        actualDistance: row.actual_distance === null ? undefined : Number(row.actual_distance),
        targetIncline: row.target_incline === null ? undefined : Number(row.target_incline),
        actualIncline: row.actual_incline === null ? undefined : Number(row.actual_incline),
        targetDurationMinutes: row.target_duration_minutes === null ? undefined : Number(row.target_duration_minutes),
        actualDurationMinutes: row.actual_duration_minutes === null ? undefined : Number(row.actual_duration_minutes),
    };
};
const mapSession = (row, setRows, meta, metaMap) => ({
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id ?? undefined,
    templateName: meta?.templateName ?? row.template_name ?? undefined,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    sets: setRows
        .filter((set) => set.session_id === row.id)
        .sort((a, b) => a.set_index - b.set_index)
        .map((set) => mapSet(set, metaMap)),
});
const startOfDayUtc = (date) => {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
};
const formatDateKey = (date) => startOfDayUtc(date).toISOString().split("T")[0];
const startOfWeekUtc = (date) => {
    const day = date.getUTCDay(); // 0 is Sunday
    const diff = day === 0 ? -6 : 1 - day; // start on Monday
    const start = new Date(date);
    start.setUTCDate(date.getUTCDate() + diff);
    start.setUTCHours(0, 0, 0, 0);
    return start;
};
const computeSetVolume = (set) => {
    const weight = set.actualWeight ?? set.targetWeight ?? 0;
    const reps = set.actualReps ?? set.targetReps ?? 0;
    return weight * reps;
};
const computeSessionVolume = (sets) => sets.reduce((total, current) => total + computeSetVolume(current), 0);
const computeStreak = (dates, today) => {
    const dateSet = new Set(dates);
    let streak = 0;
    let cursor = startOfDayUtc(today);
    while (dateSet.has(formatDateKey(cursor))) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
};
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
const fetchSessionById = async (sessionId, userId) => {
    const sessionResult = await (0, db_1.query)(`
      SELECT s.*, COALESCE(s.template_name, t.name) as template_name
      FROM workout_sessions s
      LEFT JOIN workout_templates t ON t.id = s.template_id
      WHERE s.id = $1 AND s.user_id = $2
      LIMIT 1
    `, [sessionId, userId]);
    if (!sessionResult.rowCount)
        return null;
    const setRows = await (0, db_1.query)(`SELECT * FROM workout_sets WHERE session_id = $1 ORDER BY set_index ASC`, [sessionId]);
    const metaMap = await buildMetaMapFromSets(setRows.rows);
    return mapSession(sessionResult.rows[0], setRows.rows, undefined, metaMap);
};
router.post("/from-template/:templateId", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const templateResult = await (0, db_1.query)(`SELECT id, name FROM workout_templates WHERE id = $1 AND user_id = $2`, [req.params.templateId, userId]);
        const template = templateResult.rows[0];
        if (!template) {
            return res.status(404).json({ error: "Template not found" });
        }
        const templateExercises = await (0, db_1.query)(`
        SELECT id, template_id, exercise_id, default_sets, default_reps, default_weight
        FROM workout_template_exercises
        WHERE template_id = $1
        ORDER BY order_index ASC
      `, [template.id]);
        if (!templateExercises.rowCount) {
            return res.status(400).json({ error: "Template has no exercises" });
        }
        const session = await withTransaction(async (client) => {
            const sessionId = (0, id_1.generateId)();
            const now = new Date().toISOString();
            let setIndex = 0;
            await client.query(`
          INSERT INTO workout_sessions (id, user_id, template_id, template_name, started_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $5, $5)
        `, [sessionId, userId, template.id, template.name, now]);
            for (const templateExercise of templateExercises.rows) {
                for (let index = 0; index < templateExercise.default_sets; index += 1) {
                    await client.query(`
              INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                        (0, id_1.generateId)(),
                        sessionId,
                        templateExercise.id,
                        templateExercise.exercise_id,
                        setIndex,
                        templateExercise.default_reps,
                        templateExercise.default_weight,
                    ]);
                    setIndex += 1;
                }
            }
            const setRows = (await client.query(`SELECT * FROM workout_sets WHERE session_id = $1 ORDER BY set_index ASC`, [sessionId])).rows;
            const metaMap = await buildMetaMapFromSets(setRows);
            return mapSession({
                id: sessionId,
                user_id: userId,
                template_id: template.id,
                started_at: now,
                finished_at: null,
                created_at: now,
                updated_at: now,
            }, setRows, { templateName: template.name }, metaMap);
        });
        return res.status(201).json(session);
    }
    catch (err) {
        console.error("Failed to start session", err);
        return res.status(500).json({ error: "Failed to start session" });
    }
});
router.get("/history/range", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const startParam = req.query.start;
    const endParam = req.query.end;
    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setUTCFullYear(defaultStart.getUTCFullYear() - 2);
    defaultStart.setUTCMonth(0, 1);
    defaultStart.setUTCHours(0, 0, 0, 0);
    const defaultEnd = new Date(today);
    defaultEnd.setUTCFullYear(defaultEnd.getUTCFullYear() + 1);
    defaultEnd.setUTCMonth(11, 31);
    defaultEnd.setUTCHours(23, 59, 59, 999);
    const rangeStart = startParam ? new Date(startParam) : defaultStart;
    const rangeEnd = endParam ? new Date(endParam) : defaultEnd;
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
        return res.status(400).json({ error: "Invalid date range" });
    }
    try {
        // CRITICAL: Only return completed sessions (finished_at IS NOT NULL)
        // This ensures in-progress/abandoned sessions don't appear in workout history
        const sessionRows = await (0, db_1.query)(`
        SELECT s.*, COALESCE(s.template_name, t.name) as template_name
        FROM workout_sessions s
        LEFT JOIN workout_templates t ON t.id = s.template_id
        WHERE s.user_id = $1
          AND s.started_at >= $2
          AND s.started_at < $3
          AND s.finished_at IS NOT NULL
        ORDER BY s.started_at DESC
      `, [userId, rangeStart.toISOString(), rangeEnd.toISOString()]);
        const sessionIds = sessionRows.rows.map((row) => row.id);
        const setRows = sessionIds.length === 0
            ? []
            : (await (0, db_1.query)(`SELECT * FROM workout_sets WHERE session_id = ANY($1::text[])`, [sessionIds])).rows;
        const metaMap = await buildMetaMapFromSets(setRows);
        const summaries = sessionRows.rows.map((row) => {
            const sets = setRows
                .filter((set) => set.session_id === row.id)
                .map((set) => mapSet(set, metaMap));
            const totalVolume = computeSessionVolume(sets);
            const exerciseMap = new Map();
            sets.forEach((set) => {
                const existing = exerciseMap.get(set.exerciseId);
                const volume = computeSetVolume(set);
                if (existing) {
                    exerciseMap.set(set.exerciseId, {
                        ...existing,
                        sets: existing.sets + 1,
                        volumeLbs: existing.volumeLbs + volume,
                    });
                }
                else {
                    exerciseMap.set(set.exerciseId, {
                        name: set.exerciseName ?? set.exerciseId,
                        sets: 1,
                        volumeLbs: volume,
                    });
                }
            });
            return {
                id: row.id,
                startedAt: row.started_at,
                finishedAt: row.finished_at ?? undefined,
                templateName: row.template_name ?? undefined,
                totalVolumeLbs: totalVolume,
                estimatedCalories: Math.round(totalVolume * 0.03),
                exercises: Array.from(exerciseMap.entries()).map(([exerciseId, details]) => ({
                    exerciseId,
                    name: details.name,
                    sets: details.sets,
                    volumeLbs: details.volumeLbs,
                })),
            };
        });
        const dayMap = new Map();
        summaries.forEach((summary) => {
            const key = formatDateKey(new Date(summary.startedAt));
            const existing = dayMap.get(key);
            if (!existing) {
                dayMap.set(key, {
                    date: key,
                    sessions: [summary],
                    totalVolumeLbs: summary.totalVolumeLbs,
                    estimatedCalories: summary.estimatedCalories,
                });
            }
            else {
                dayMap.set(key, {
                    ...existing,
                    sessions: [...existing.sessions, summary],
                    totalVolumeLbs: existing.totalVolumeLbs + summary.totalVolumeLbs,
                    estimatedCalories: existing.estimatedCalories + summary.estimatedCalories,
                });
            }
        });
        const days = Array.from(dayMap.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
        // Only count completed workouts for streak calculation
        const streakRows = await (0, db_1.query)(`
        SELECT started_at
        FROM workout_sessions
        WHERE user_id = $1 AND finished_at IS NOT NULL
        ORDER BY started_at DESC
      `, [userId]);
        const allDates = streakRows.rows.map((row) => formatDateKey(new Date(row.started_at)));
        const uniqueDates = Array.from(new Set(allDates));
        const currentWeekStart = startOfWeekUtc(today);
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setUTCDate(currentWeekEnd.getUTCDate() + 7);
        // Count unique workout DAYS in the current week, not total sessions
        const uniqueWorkoutDaysThisWeek = new Set(summaries
            .filter((summary) => {
            const started = new Date(summary.startedAt);
            return started >= currentWeekStart && started < currentWeekEnd;
        })
            .map((summary) => formatDateKey(new Date(summary.startedAt)))).size;
        const weeklyCompleted = uniqueWorkoutDaysThisWeek;
        const userResult = await (0, db_1.query)(`SELECT weekly_goal FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const weeklyGoal = userResult.rows[0]?.weekly_goal ?? 4;
        const stats = {
            totalWorkouts: summaries.length,
            weeklyGoal,
            weeklyCompleted,
            currentStreak: computeStreak(uniqueDates, today),
        };
        return res.json({ days, stats });
    }
    catch (err) {
        console.error("Failed to fetch history", err);
        return res.status(500).json({ error: "Failed to fetch history" });
    }
});
// Get active (uncompleted) session for current user
router.get("/active/current", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        // Find most recent uncompleted session
        // Sessions are only "finished" when user completes or explicitly deletes them
        const sessionResult = await (0, db_1.query)(`SELECT * FROM workout_sessions
       WHERE user_id = $1 AND finished_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`, [userId]);
        if (sessionResult.rows.length === 0) {
            return res.json({ session: null });
        }
        const sessionRow = sessionResult.rows[0];
        // Fetch sets for this session
        const setsResult = await (0, db_1.query)(`SELECT * FROM workout_sets WHERE session_id = $1 ORDER BY set_index ASC`, [sessionRow.id]);
        // Build meta map for exercise names and images
        const metaMap = await buildMetaMapFromSets(setsResult.rows);
        // Get template name if exists
        let templateName;
        if (sessionRow.template_id) {
            const templateResult = await (0, db_1.query)(`SELECT name FROM workout_templates WHERE id = $1`, [sessionRow.template_id]);
            templateName = templateResult.rows[0]?.name;
        }
        const session = mapSession(sessionRow, setsResult.rows, { templateName }, metaMap);
        return res.json({ session });
    }
    catch (err) {
        console.error("Failed to fetch active session", err);
        return res.status(500).json({ error: "Failed to fetch active session" });
    }
});
router.get("/:id", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const session = await fetchSessionById(req.params.id, userId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }
        return res.json(session);
    }
    catch (err) {
        console.error("Failed to fetch session", err);
        return res.status(500).json({ error: "Failed to fetch session" });
    }
});
router.patch("/:id", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const { sets, startedAt, finishedAt } = req.body;
    try {
        const sessionExists = await (0, db_1.query)(`SELECT 1 FROM workout_sessions WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
        if (!sessionExists.rowCount) {
            return res.status(404).json({ error: "Session not found" });
        }
        await withTransaction(async (client) => {
            if (sets) {
                await client.query(`DELETE FROM workout_sets WHERE session_id = $1`, [req.params.id]);
                for (const set of sets) {
                    await client.query(`
              INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight, actual_reps, actual_weight, rpe)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                        set.id ?? (0, id_1.generateId)(),
                        req.params.id,
                        set.templateExerciseId ?? null,
                        set.exerciseId,
                        set.setIndex,
                        set.targetReps ?? null,
                        set.targetWeight ?? null,
                        set.actualReps ?? null,
                        set.actualWeight ?? null,
                        set.rpe ?? null,
                    ]);
                }
            }
            if (startedAt !== undefined || finishedAt !== undefined) {
                await client.query(`
            UPDATE workout_sessions
            SET
              started_at = COALESCE($1, started_at),
              finished_at = COALESCE($2, finished_at),
              updated_at = NOW()
            WHERE id = $3
          `, [startedAt ?? null, finishedAt ?? null, req.params.id]);
            }
            else {
                await client.query(`UPDATE workout_sessions SET updated_at = NOW() WHERE id = $1`, [
                    req.params.id,
                ]);
            }
        });
        const session = await fetchSessionById(req.params.id, userId);
        return res.json(session);
    }
    catch (err) {
        console.error("Failed to update session", err);
        return res.status(500).json({ error: "Failed to update session" });
    }
});
router.post("/manual", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { startedAt, finishedAt, templateName, sets, } = req.body ?? {};
    if (!sets || sets.length === 0) {
        return res.status(400).json({ error: "At least one set is required" });
    }
    const sessionId = (0, id_1.generateId)();
    const safeStart = startedAt ? new Date(startedAt) : new Date();
    const safeFinish = finishedAt ? new Date(finishedAt) : undefined;
    if (Number.isNaN(safeStart.getTime())) {
        return res.status(400).json({ error: "Invalid start date" });
    }
    try {
        const session = await withTransaction(async (client) => {
            await client.query(`
          INSERT INTO workout_sessions (id, user_id, template_id, template_name, started_at, finished_at, created_at, updated_at)
          VALUES ($1, $2, NULL, $3, $4, $5, NOW(), NOW())
        `, [
                sessionId,
                userId,
                templateName ?? null,
                safeStart.toISOString(),
                safeFinish?.toISOString() ?? null,
            ]);
            for (const [index, set] of sets.entries()) {
                if (!set.exerciseId)
                    continue;
                await client.query(`
            INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight, actual_reps, actual_weight, rpe)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
                    set.id ?? (0, id_1.generateId)(),
                    sessionId,
                    set.templateExerciseId ?? null,
                    set.exerciseId,
                    set.setIndex ?? index,
                    set.targetReps ?? null,
                    set.targetWeight ?? null,
                    set.actualReps ?? null,
                    set.actualWeight ?? null,
                    set.rpe ?? null,
                ]);
            }
            const setRows = (await client.query(`SELECT * FROM workout_sets WHERE session_id = $1`, [
                sessionId,
            ])).rows;
            const metaMap = await buildMetaMapFromSets(setRows);
            return mapSession({
                id: sessionId,
                user_id: userId,
                template_id: null,
                template_name: templateName ?? null,
                started_at: safeStart.toISOString(),
                finished_at: safeFinish?.toISOString() ?? null,
                created_at: safeStart.toISOString(),
                updated_at: safeFinish?.toISOString() ?? safeStart.toISOString(),
            }, setRows, { templateName }, metaMap);
        });
        return res.status(201).json(session);
    }
    catch (err) {
        console.error("Failed to create manual session", err);
        return res.status(500).json({ error: "Failed to create session" });
    }
});
router.post("/:id/duplicate", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const session = await fetchSessionById(req.params.id, userId);
        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }
        const newSessionId = (0, id_1.generateId)();
        const nowIso = new Date().toISOString();
        await withTransaction(async (client) => {
            await client.query(`
          INSERT INTO workout_sessions (id, user_id, template_id, template_name, started_at, finished_at, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        `, [
                newSessionId,
                userId,
                session.templateId ?? null,
                session.templateName ?? null,
                nowIso,
                session.finishedAt ?? null,
            ]);
            for (const set of session.sets) {
                await client.query(`
            INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, target_reps, target_weight, actual_reps, actual_weight, rpe)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [
                    (0, id_1.generateId)(),
                    newSessionId,
                    set.templateExerciseId ?? null,
                    set.exerciseId,
                    set.setIndex,
                    set.targetReps ?? null,
                    set.targetWeight ?? null,
                    set.actualReps ?? null,
                    set.actualWeight ?? null,
                    set.rpe ?? null,
                ]);
            }
        });
        const newSession = await fetchSessionById(newSessionId, userId);
        return res.status(201).json(newSession);
    }
    catch (err) {
        console.error("Failed to duplicate session", err);
        return res.status(500).json({ error: "Failed to duplicate session" });
    }
});
router.delete("/:id", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const result = await (0, db_1.query)(`DELETE FROM workout_sessions WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Session not found" });
        }
        return res.status(204).end();
    }
    catch (err) {
        console.error("Failed to delete session", err);
        return res.status(500).json({ error: "Failed to delete session" });
    }
});
exports.default = router;
