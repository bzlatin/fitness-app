"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const id_1 = require("../utils/id");
const exerciseCatalog_1 = require("../utils/exerciseCatalog");
const router = (0, express_1.Router)();
const AUTO_END_LIMIT_MS = 1000 * 60 * 60 * 4; // 4 hours
const formatExerciseId = (id) => id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
const normalizeSetKind = (value) => value === "warmup" ? "warmup" : "working";
const roundToIncrement = (value, increment) => {
    if (!Number.isFinite(value))
        return value;
    if (!Number.isFinite(increment) || increment <= 0)
        return value;
    return Math.round(value / increment) * increment;
};
const suggestWarmupSetSpecs = (workingWeight, workingReps) => {
    if (!Number.isFinite(workingWeight) || workingWeight <= 0)
        return [];
    const normalizedWorkingReps = typeof workingReps === "number" && Number.isFinite(workingReps) && workingReps > 0
        ? Math.round(workingReps)
        : undefined;
    const increments = 2.5;
    const progressions = [
        { percent: 0.5, reps: normalizedWorkingReps ? Math.min(8, normalizedWorkingReps) : 8 },
        { percent: 0.75, reps: normalizedWorkingReps ? Math.min(5, Math.max(3, normalizedWorkingReps - 3)) : 5 },
        { percent: 0.9, reps: 2 },
    ];
    const seen = new Set();
    const specs = [];
    for (const item of progressions) {
        const rawWeight = workingWeight * item.percent;
        const rounded = roundToIncrement(rawWeight, increments);
        const targetWeight = Math.max(increments, Math.min(rounded, workingWeight - increments));
        if (targetWeight >= workingWeight)
            continue;
        if (seen.has(targetWeight))
            continue;
        seen.add(targetWeight);
        specs.push({ targetWeight, targetReps: item.reps });
    }
    return specs;
};
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
        setKind: normalizeSetKind(row.set_kind),
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
const mapSession = (row, setRows, meta, metaMap) => {
    const finished = row.finished_at ? new Date(row.finished_at) : null;
    const started = new Date(row.started_at);
    const derivedDuration = row.duration_seconds ??
        (finished ? Math.max(0, Math.round((finished.getTime() - started.getTime()) / 1000)) : undefined);
    return {
        id: row.id,
        userId: row.user_id,
        templateId: row.template_id ?? undefined,
        templateName: meta?.templateName ?? row.template_name ?? undefined,
        source: row.source ?? "manual",
        startedAt: row.started_at,
        finishedAt: row.finished_at ?? undefined,
        endedReason: row.ended_reason ?? undefined,
        autoEndedAt: row.auto_ended_at ?? undefined,
        durationSeconds: derivedDuration,
        totalEnergyBurned: row.total_energy_burned === null ? undefined : Number(row.total_energy_burned),
        avgHeartRate: row.avg_heart_rate === null ? undefined : Number(row.avg_heart_rate),
        maxHeartRate: row.max_heart_rate === null ? undefined : Number(row.max_heart_rate),
        importMetadata: row.import_metadata ?? undefined,
        sets: setRows
            .filter((set) => set.session_id === row.id)
            .sort((a, b) => a.set_index - b.set_index)
            .map((set) => mapSet(set, metaMap)),
    };
};
const startOfDayUtc = (date) => {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
};
const pad2 = (n) => String(n).padStart(2, "0");
const shiftDateByOffsetMinutes = (date, tzOffsetMinutes) => new Date(date.getTime() - tzOffsetMinutes * 60 * 1000);
const formatDateKeyForTzOffset = (date, tzOffsetMinutes) => {
    const shifted = shiftDateByOffsetMinutes(date, tzOffsetMinutes);
    return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
};
const formatDateKeyUtc = (date) => `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
const startOfWeekUtc = (date) => {
    const day = date.getUTCDay(); // 0 is Sunday
    const diff = day === 0 ? -6 : 1 - day; // start on Monday
    const start = new Date(date);
    start.setUTCDate(date.getUTCDate() + diff);
    start.setUTCHours(0, 0, 0, 0);
    return start;
};
const computeSetVolume = (set) => {
    const weight = set.actualWeight ?? 0;
    const reps = set.actualReps ?? 0;
    return weight * reps;
};
const computeSessionVolume = (sets) => sets.reduce((total, current) => total + computeSetVolume(current), 0);
const isSetLogged = (set) => {
    const hasStrengthReps = typeof set.actualReps === "number" && Number.isFinite(set.actualReps) && set.actualReps > 0;
    const hasCardioMinutes = typeof set.actualDurationMinutes === "number" &&
        Number.isFinite(set.actualDurationMinutes) &&
        set.actualDurationMinutes > 0;
    const hasCardioDistance = typeof set.actualDistance === "number" &&
        Number.isFinite(set.actualDistance) &&
        set.actualDistance > 0;
    return hasStrengthReps || hasCardioMinutes || hasCardioDistance;
};
const computeStreak = (dates, today, tzOffsetMinutes) => {
    const dateSet = new Set(dates);
    let streak = 0;
    let cursor = startOfDayUtc(shiftDateByOffsetMinutes(today, tzOffsetMinutes));
    while (dateSet.has(formatDateKeyUtc(cursor))) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
};
const autoEndSessionsForUser = async (userId, sessions) => {
    const now = Date.now();
    const staleSessions = sessions.filter((session) => {
        const startedAt = new Date(session.started_at).getTime();
        if (Number.isNaN(startedAt))
            return false;
        return now - startedAt > AUTO_END_LIMIT_MS;
    });
    if (!staleSessions.length) {
        return { autoEndedSession: null, autoEndedIds: [] };
    }
    // End all stale sessions to keep data clean; the most recent one is returned for UI context
    const mostRecentStale = staleSessions.reduce((latest, current) => {
        const latestStart = new Date(latest.started_at).getTime();
        const currentStart = new Date(current.started_at).getTime();
        return currentStart > latestStart ? current : latest;
    });
    await withTransaction(async (client) => {
        for (const stale of staleSessions) {
            const startedAt = new Date(stale.started_at).getTime();
            const cutoff = new Date(startedAt + AUTO_END_LIMIT_MS).toISOString();
            await client.query(`
          UPDATE workout_sessions
          SET
            finished_at = $1,
            auto_ended_at = $1,
            ended_reason = 'auto_inactivity',
            updated_at = NOW()
          WHERE id = $2 AND user_id = $3
        `, [cutoff, stale.id, userId]);
            await client.query(`
          UPDATE active_workout_statuses
          SET is_active = false, updated_at = NOW()
          WHERE session_id = $1 AND user_id = $2
        `, [stale.id, userId]);
        }
    });
    const autoEndedSession = await fetchSessionById(mostRecentStale.id, userId);
    return { autoEndedSession, autoEndedIds: staleSessions.map((session) => session.id) };
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
                const workingWeight = templateExercise.default_weight === null
                    ? undefined
                    : Number(templateExercise.default_weight);
                const warmupSpecs = typeof workingWeight === "number" && Number.isFinite(workingWeight) && workingWeight > 0
                    ? suggestWarmupSetSpecs(workingWeight, templateExercise.default_reps)
                    : [];
                for (const warmup of warmupSpecs) {
                    await client.query(`
              INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, set_kind, target_reps, target_weight)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                        (0, id_1.generateId)(),
                        sessionId,
                        templateExercise.id,
                        templateExercise.exercise_id,
                        setIndex,
                        "warmup",
                        warmup.targetReps,
                        warmup.targetWeight,
                    ]);
                    setIndex += 1;
                }
                for (let index = 0; index < templateExercise.default_sets; index += 1) {
                    await client.query(`
              INSERT INTO workout_sets (id, session_id, template_exercise_id, exercise_id, set_index, set_kind, target_reps, target_weight)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                        (0, id_1.generateId)(),
                        sessionId,
                        templateExercise.id,
                        templateExercise.exercise_id,
                        setIndex,
                        "working",
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
                ended_reason: null,
                auto_ended_at: null,
                duration_seconds: null,
                source: "manual",
                external_id: null,
                import_metadata: null,
                total_energy_burned: null,
                avg_heart_rate: null,
                max_heart_rate: null,
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
    const tzOffsetMinutesRaw = Number(req.query.tzOffsetMinutes ?? 0);
    const tzOffsetMinutes = Number.isFinite(tzOffsetMinutesRaw)
        ? Math.max(-14 * 60, Math.min(14 * 60, Math.trunc(tzOffsetMinutesRaw)))
        : 0;
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
          AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
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
            const loggedSets = sets.filter(isSetLogged);
            const totalVolume = computeSessionVolume(loggedSets);
            const durationSeconds = row.duration_seconds ??
                (row.finished_at
                    ? Math.max(0, Math.round((new Date(row.finished_at).getTime() -
                        new Date(row.started_at).getTime()) /
                        1000))
                    : undefined);
            const energyBurned = row.total_energy_burned === null
                ? undefined
                : Number(row.total_energy_burned);
            const avgHeartRate = row.avg_heart_rate === null ? undefined : Number(row.avg_heart_rate);
            const maxHeartRate = row.max_heart_rate === null ? undefined : Number(row.max_heart_rate);
            const estimatedCalories = energyBurned !== undefined ? Math.round(energyBurned) : Math.round(totalVolume * 0.03);
            const exerciseMap = new Map();
            loggedSets.forEach((set) => {
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
                source: row.source ?? "manual",
                durationSeconds,
                totalVolumeLbs: totalVolume,
                estimatedCalories,
                totalEnergyBurned: energyBurned,
                avgHeartRate,
                maxHeartRate,
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
            const key = formatDateKeyForTzOffset(new Date(summary.startedAt), tzOffsetMinutes);
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
        WHERE user_id = $1
          AND finished_at IS NOT NULL
          AND ended_reason IS DISTINCT FROM 'auto_inactivity'
        ORDER BY started_at DESC
      `, [userId]);
        const allDates = streakRows.rows.map((row) => formatDateKeyForTzOffset(new Date(row.started_at), tzOffsetMinutes));
        const uniqueDates = Array.from(new Set(allDates));
        const shiftedToday = shiftDateByOffsetMinutes(today, tzOffsetMinutes);
        const currentWeekStart = startOfWeekUtc(shiftedToday);
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setUTCDate(currentWeekEnd.getUTCDate() + 7);
        // Count unique workout DAYS in the current week, not total sessions
        const uniqueWorkoutDaysThisWeek = new Set(summaries
            .filter((summary) => {
            const started = new Date(summary.startedAt);
            const startedShifted = shiftDateByOffsetMinutes(started, tzOffsetMinutes);
            return startedShifted >= currentWeekStart && startedShifted < currentWeekEnd;
        })
            .map((summary) => formatDateKeyForTzOffset(new Date(summary.startedAt), tzOffsetMinutes))).size;
        const weeklyCompleted = uniqueWorkoutDaysThisWeek;
        const userResult = await (0, db_1.query)(`SELECT weekly_goal FROM users WHERE id = $1 LIMIT 1`, [userId]);
        const weeklyGoal = userResult.rows[0]?.weekly_goal ?? 4;
        const stats = {
            totalWorkouts: summaries.length,
            weeklyGoal,
            weeklyCompleted,
            currentStreak: computeStreak(uniqueDates, today, tzOffsetMinutes),
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
        // Fetch all uncompleted sessions to evaluate stale timeouts
        const sessionResult = await (0, db_1.query)(`SELECT * FROM workout_sessions
       WHERE user_id = $1
         AND finished_at IS NULL
         AND ended_reason IS NULL
       ORDER BY started_at DESC`, [userId]);
        if (sessionResult.rows.length === 0) {
            return res.json({ session: null, autoEndedSession: null });
        }
        const { autoEndedSession, autoEndedIds } = await autoEndSessionsForUser(userId, sessionResult.rows);
        // Find the most recent still-active session (one that was not auto-ended)
        const activeRow = sessionResult.rows.find((row) => !autoEndedIds.includes(row.id));
        if (!activeRow) {
            return res.json({ session: null, autoEndedSession });
        }
        // Fetch sets for this session
        const setsResult = await (0, db_1.query)(`SELECT * FROM workout_sets WHERE session_id = $1 ORDER BY set_index ASC`, [activeRow.id]);
        // Build meta map for exercise names and images
        const metaMap = await buildMetaMapFromSets(setsResult.rows);
        // Get template name if exists
        let templateName;
        if (activeRow.template_id) {
            const templateResult = await (0, db_1.query)(`SELECT name FROM workout_templates WHERE id = $1`, [activeRow.template_id]);
            templateName = templateResult.rows[0]?.name;
        }
        const session = mapSession(activeRow, setsResult.rows, { templateName }, metaMap);
        return res.json({ session, autoEndedSession });
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
    const { sets, startedAt, finishedAt, endedReason, autoEndedAt } = req.body;
    const finishedAtProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, "finishedAt");
    const endedReasonProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, "endedReason");
    const autoEndedAtProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, "autoEndedAt");
    const shouldUpdateDuration = startedAt !== undefined || finishedAt !== undefined;
    try {
        const sessionExists = await (0, db_1.query)(`SELECT 1 FROM workout_sessions WHERE id = $1 AND user_id = $2`, [req.params.id, userId]);
        if (!sessionExists.rowCount) {
            return res.status(404).json({ error: "Session not found" });
        }
        await withTransaction(async (client) => {
            if (sets) {
                await client.query(`DELETE FROM workout_sets WHERE session_id = $1`, [req.params.id]);
                for (const set of sets) {
                    const setKind = normalizeSetKind(set.setKind);
                    await client.query(`
              INSERT INTO workout_sets (
                id,
                session_id,
                template_exercise_id,
                exercise_id,
                set_index,
                set_kind,
                target_reps,
                target_weight,
                actual_reps,
                actual_weight,
                rpe,
                target_distance,
                actual_distance,
                target_incline,
                actual_incline,
                target_duration_minutes,
                actual_duration_minutes
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            `, [
                        set.id ?? (0, id_1.generateId)(),
                        req.params.id,
                        set.templateExerciseId ?? null,
                        set.exerciseId,
                        set.setIndex,
                        setKind,
                        set.targetReps ?? null,
                        set.targetWeight ?? null,
                        set.actualReps ?? null,
                        set.actualWeight ?? null,
                        set.rpe ?? null,
                        set.targetDistance ?? null,
                        set.actualDistance ?? null,
                        set.targetIncline ?? null,
                        set.actualIncline ?? null,
                        set.targetDurationMinutes ?? null,
                        set.actualDurationMinutes ?? null,
                    ]);
                }
            }
            if (startedAt !== undefined ||
                finishedAt !== undefined ||
                endedReasonProvided ||
                autoEndedAtProvided) {
                const updateFragments = [];
                const values = [];
                if (startedAt !== undefined) {
                    updateFragments.push(`started_at = COALESCE($${values.length + 1}, started_at)`);
                    values.push(startedAt ?? null);
                }
                if (finishedAt !== undefined) {
                    updateFragments.push(`finished_at = COALESCE($${values.length + 1}, finished_at)`);
                    values.push(finishedAt ?? null);
                }
                // If a client marks the session finished but doesn't specify a reason, treat it as a user-completed workout.
                // This lets us safely exclude auto-ended sessions from history/stats without breaking older clients.
                if (finishedAtProvided && !endedReasonProvided && finishedAt) {
                    updateFragments.push(`ended_reason = COALESCE(ended_reason, 'user_finished')`);
                }
                if (endedReasonProvided) {
                    updateFragments.push(`ended_reason = $${values.length + 1}`);
                    values.push(endedReason ?? null);
                }
                if (autoEndedAtProvided) {
                    updateFragments.push(`auto_ended_at = $${values.length + 1}`);
                    values.push(autoEndedAt ?? null);
                }
                updateFragments.push("updated_at = NOW()");
                const queryText = `
          UPDATE workout_sessions
          SET ${updateFragments.join(", ")}
          WHERE id = $${values.length + 1}
        `;
                await client.query(queryText, [...values, req.params.id]);
                if (shouldUpdateDuration) {
                    await client.query(`
              UPDATE workout_sessions
              SET duration_seconds = CASE
                WHEN finished_at IS NULL THEN duration_seconds
                ELSE GREATEST(0, EXTRACT(EPOCH FROM (finished_at - started_at)))::int
              END
              WHERE id = $1 AND user_id = $2
            `, [req.params.id, userId]);
                }
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
router.post("/:id/undo-auto-end", async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const sessionResult = await (0, db_1.query)(`SELECT * FROM workout_sessions WHERE id = $1 AND user_id = $2 LIMIT 1`, [req.params.id, userId]);
        if (!sessionResult.rowCount) {
            return res.status(404).json({ error: "Session not found" });
        }
        const sessionRow = sessionResult.rows[0];
        if (sessionRow.finished_at === null) {
            return res.status(400).json({ error: "Session is already active" });
        }
        if (sessionRow.ended_reason !== "auto_inactivity") {
            return res
                .status(400)
                .json({ error: "Session was not auto-ended and cannot be resumed automatically" });
        }
        // When resuming, start a fresh timer window so we don't immediately auto-end again
        const resumeStart = new Date().toISOString();
        await withTransaction(async (client) => {
            await client.query(`
          UPDATE workout_sessions
          SET
            started_at = $1,
            finished_at = NULL,
            ended_reason = NULL,
            auto_ended_at = NULL,
            updated_at = NOW()
          WHERE id = $2 AND user_id = $3
        `, [resumeStart, req.params.id, userId]);
            await client.query(`
          INSERT INTO active_workout_statuses (session_id, user_id, template_id, template_name, started_at, visibility, current_exercise_name, is_active)
          VALUES ($1, $2, $3, $4, $5, 'private', NULL, true)
          ON CONFLICT (session_id) DO UPDATE
          SET
            started_at = EXCLUDED.started_at,
            template_id = EXCLUDED.template_id,
            template_name = EXCLUDED.template_name,
            is_active = true,
            updated_at = NOW()
        `, [
                sessionRow.id,
                userId,
                sessionRow.template_id,
                sessionRow.template_name ?? null,
                resumeStart,
            ]);
        });
        const session = await fetchSessionById(req.params.id, userId);
        return res.json(session);
    }
    catch (err) {
        console.error("Failed to undo auto-end", err);
        return res.status(500).json({ error: "Failed to undo auto-end" });
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
    const durationSeconds = safeFinish
        ? Math.max(0, Math.round((safeFinish.getTime() - safeStart.getTime()) / 1000))
        : null;
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
                const setKind = normalizeSetKind(set.setKind);
                await client.query(`
            INSERT INTO workout_sets (
              id,
              session_id,
              template_exercise_id,
              exercise_id,
              set_index,
              set_kind,
              target_reps,
              target_weight,
              actual_reps,
              actual_weight,
              rpe,
              target_distance,
              actual_distance,
              target_incline,
              actual_incline,
              target_duration_minutes,
              actual_duration_minutes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `, [
                    set.id ?? (0, id_1.generateId)(),
                    sessionId,
                    set.templateExerciseId ?? null,
                    set.exerciseId,
                    set.setIndex ?? index,
                    setKind,
                    set.targetReps ?? null,
                    set.targetWeight ?? null,
                    set.actualReps ?? null,
                    set.actualWeight ?? null,
                    set.rpe ?? null,
                    set.targetDistance ?? null,
                    set.actualDistance ?? null,
                    set.targetIncline ?? null,
                    set.actualIncline ?? null,
                    set.targetDurationMinutes ?? null,
                    set.actualDurationMinutes ?? null,
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
                ended_reason: null,
                auto_ended_at: null,
                duration_seconds: durationSeconds,
                source: "manual",
                external_id: null,
                import_metadata: null,
                total_energy_burned: null,
                avg_heart_rate: null,
                max_heart_rate: null,
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
                const setKind = normalizeSetKind(set.setKind);
                await client.query(`
            INSERT INTO workout_sets (
              id,
              session_id,
              template_exercise_id,
              exercise_id,
              set_index,
              set_kind,
              target_reps,
              target_weight,
              actual_reps,
              actual_weight,
              rpe,
              target_distance,
              actual_distance,
              target_incline,
              actual_incline,
              target_duration_minutes,
              actual_duration_minutes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          `, [
                    (0, id_1.generateId)(),
                    newSessionId,
                    set.templateExerciseId ?? null,
                    set.exerciseId,
                    set.setIndex,
                    setKind,
                    set.targetReps ?? null,
                    set.targetWeight ?? null,
                    set.actualReps ?? null,
                    set.actualWeight ?? null,
                    set.rpe ?? null,
                    set.targetDistance ?? null,
                    set.actualDistance ?? null,
                    set.targetIncline ?? null,
                    set.actualIncline ?? null,
                    set.targetDurationMinutes ?? null,
                    set.actualDurationMinutes ?? null,
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
        const sessionId = req.params.id;
        const client = await db_1.pool.connect();
        try {
            await client.query("BEGIN");
            const existing = await client.query(`
          SELECT
            id,
            source,
            external_id,
            started_at,
            duration_seconds,
            import_metadata->>'workoutType' AS workout_type
          FROM workout_sessions
          WHERE id = $1 AND user_id = $2
        `, [sessionId, userId]);
            const row = existing.rows[0];
            if (!row) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Session not found" });
            }
            if (row.source === "apple_health") {
                await client.query(`
            INSERT INTO apple_health_ignored_workouts (
              id, user_id, external_id, started_at, duration_seconds, workout_type
            )
            SELECT $1, $2, $3, $4, $5, $6
            WHERE
              $3::text IS NULL
              OR NOT EXISTS (
                SELECT 1
                FROM apple_health_ignored_workouts
                WHERE user_id = $2 AND external_id = $3
              )
          `, [
                    (0, id_1.generateId)(),
                    userId,
                    row.external_id,
                    row.started_at,
                    row.duration_seconds,
                    row.workout_type,
                ]);
            }
            const result = await client.query(`DELETE FROM workout_sessions WHERE id = $1 AND user_id = $2`, [sessionId, userId]);
            if (result.rowCount === 0) {
                await client.query("ROLLBACK");
                return res.status(404).json({ error: "Session not found" });
            }
            await client.query("COMMIT");
            return res.status(204).end();
        }
        catch (err) {
            await client.query("ROLLBACK");
            throw err;
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        console.error("Failed to delete session", err);
        return res.status(500).json({ error: "Failed to delete session" });
    }
});
exports.default = router;
