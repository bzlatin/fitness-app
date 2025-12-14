"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecentWorkouts = exports.calculateMuscleFatigue = exports.getTrainingRecommendations = exports.getFatigueScores = void 0;
const db_1 = require("../db");
const BODYWEIGHT_FALLBACK_LBS = 100;
const TRACKED_MUSCLES = [
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "legs",
    "glutes",
    "core",
];
const muscleGroupExpr = `LOWER(COALESCE(ue.primary_muscle_group, e.primary_muscle_group, 'other'))`;
const statusColorMap = {
    "under-trained": "green",
    optimal: "blue",
    "moderate-fatigue": "yellow",
    "high-fatigue": "red",
    "no-data": "gray",
};
const statusOrder = {
    "high-fatigue": 0,
    "moderate-fatigue": 1,
    optimal: 2,
    "under-trained": 3,
    "no-data": 4,
};
const safeDivide = (numerator, denominator) => {
    if (!denominator || denominator === 0)
        return 0;
    return numerator / denominator;
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hoursBetween = (from, to) => (to.getTime() - from.getTime()) / (1000 * 60 * 60);
const parseNumber = (value) => {
    if (typeof value === "number")
        return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};
const estimateCardioMet = (params) => {
    const minutes = Math.max(0, params.minutes);
    if (minutes <= 0)
        return null;
    const inclinePercent = clamp(params.inclinePercent, 0, 25);
    const grade = inclinePercent / 100;
    const distanceRaw = Math.max(0, params.distance);
    if (distanceRaw <= 0) {
        // Default to a moderate walk when distance isn't available.
        return 3.5;
    }
    const hours = minutes / 60;
    let mph = distanceRaw / hours;
    // Heuristic: if mph is unrealistic, distance is likely in km.
    if (mph > 12) {
        mph = (distanceRaw * 0.621371) / hours;
    }
    const mPerMin = mph * 26.8224;
    if (!Number.isFinite(mPerMin) || mPerMin <= 0)
        return 3.5;
    const isRunning = mph >= 5;
    const vo2 = isRunning
        ? 0.2 * mPerMin + 0.9 * mPerMin * grade + 3.5
        : 0.1 * mPerMin + 1.8 * mPerMin * grade + 3.5;
    const met = vo2 / 3.5;
    return Number.isFinite(met) ? clamp(met, 1, 18) : 3.5;
};
const statusFromScore = (score, hasData) => {
    if (!hasData)
        return "no-data";
    if (score < 70)
        return "under-trained";
    if (score < 110)
        return "optimal";
    if (score < 130)
        return "moderate-fatigue";
    return "high-fatigue";
};
const subtractDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() - days);
    return copy;
};
const fetchVolumeByMuscle = async (userId, start, end) => {
    const result = await (0, db_1.query)(`
      SELECT
        ${muscleGroupExpr} as muscle_group,
        SUM(
          COALESCE(ws.actual_reps, ws.target_reps, 0) *
          COALESCE(
            ws.actual_weight,
            ws.target_weight,
            CASE
              WHEN LOWER(COALESCE(ue.equipment, e.equipment, 'bodyweight')) = 'bodyweight' THEN $4
              ELSE 1
            END
          )
        ) as volume
      FROM workout_sets ws
      JOIN workout_sessions s ON s.id = ws.session_id
      LEFT JOIN exercises e ON e.id = ws.exercise_id
      LEFT JOIN user_exercises ue ON ue.id = ws.exercise_id AND ue.deleted_at IS NULL
      WHERE s.user_id = $1
        AND s.finished_at IS NOT NULL
        AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
        AND COALESCE(LOWER(e.category), '') <> 'cardio'
        AND s.finished_at >= $2
        AND s.finished_at < $3
      GROUP BY ${muscleGroupExpr}
    `, [userId, start.toISOString(), end.toISOString(), BODYWEIGHT_FALLBACK_LBS]);
    const volumes = new Map();
    result.rows.forEach((row) => {
        volumes.set(row.muscle_group ?? "other", Number(row.volume) || 0);
    });
    return volumes;
};
const fetchLastSessionByMuscle = async (userId) => {
    const result = await (0, db_1.query)(`
      WITH per_session AS (
        SELECT
          s.id as session_id,
          s.finished_at,
          ${muscleGroupExpr} as muscle_group,
          COUNT(*) FILTER (WHERE COALESCE(ws.actual_reps, ws.target_reps, 0) > 0) as session_sets,
          SUM(COALESCE(ws.actual_reps, ws.target_reps, 0)) as session_reps,
          SUM(
            COALESCE(ws.actual_reps, ws.target_reps, 0) *
            COALESCE(
              ws.actual_weight,
              ws.target_weight,
              CASE
                WHEN LOWER(COALESCE(ue.equipment, e.equipment, 'bodyweight')) = 'bodyweight' THEN $2
                ELSE 1
              END
            )
          ) as session_volume
        FROM workout_sets ws
        JOIN workout_sessions s ON s.id = ws.session_id
        LEFT JOIN exercises e ON e.id = ws.exercise_id
        LEFT JOIN user_exercises ue ON ue.id = ws.exercise_id AND ue.deleted_at IS NULL
        WHERE s.user_id = $1
          AND s.finished_at IS NOT NULL
          AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
        GROUP BY s.id, s.finished_at, ${muscleGroupExpr}
      ),
      ranked AS (
        SELECT
          muscle_group,
          finished_at,
          session_sets,
          session_reps,
          session_volume,
          ROW_NUMBER() OVER (PARTITION BY muscle_group ORDER BY finished_at DESC) as rn
        FROM per_session
        WHERE muscle_group IS NOT NULL
      )
      SELECT
        muscle_group,
        finished_at,
        COALESCE(session_sets, 0)::text as session_sets,
        COALESCE(session_reps, 0)::text as session_reps,
        COALESCE(session_volume, 0)::text as session_volume
      FROM ranked
      WHERE rn = 1
    `, [userId, BODYWEIGHT_FALLBACK_LBS]);
    const map = new Map();
    result.rows.forEach((row) => {
        map.set(row.muscle_group ?? "other", {
            lastTrainedAt: row.finished_at ?? null,
            lastSessionSets: Number(row.session_sets) || 0,
            lastSessionReps: Number(row.session_reps) || 0,
            lastSessionVolume: Number(row.session_volume) || 0,
        });
    });
    return map;
};
const fetchStimulusRows = async (userId, start) => {
    const result = await (0, db_1.query)(`
      SELECT
        ${muscleGroupExpr} as muscle_group,
        s.finished_at,
        COUNT(*) FILTER (
          WHERE COALESCE(LOWER(e.category), '') <> 'cardio'
            AND COALESCE(ws.actual_reps, ws.target_reps, 0) > 0
        ) as strength_sets,
        SUM(
          CASE WHEN COALESCE(LOWER(e.category), '') <> 'cardio'
            THEN COALESCE(ws.actual_reps, ws.target_reps, 0)
            ELSE 0
          END
        ) as strength_reps,
        SUM(
          CASE WHEN COALESCE(LOWER(e.category), '') <> 'cardio'
            THEN COALESCE(ws.actual_reps, ws.target_reps, 0) *
              COALESCE(
                ws.actual_weight,
                ws.target_weight,
                CASE
                  WHEN LOWER(COALESCE(ue.equipment, e.equipment, 'bodyweight')) = 'bodyweight' THEN $3
                  ELSE 1
                END
              )
            ELSE 0
          END
        ) as strength_volume,
        SUM(
          CASE WHEN COALESCE(LOWER(e.category), '') = 'cardio'
            THEN COALESCE(ws.actual_duration_minutes, ws.target_duration_minutes, 0)
            ELSE 0
          END
        ) as cardio_minutes,
        SUM(
          CASE WHEN COALESCE(LOWER(e.category), '') = 'cardio'
            THEN COALESCE(ws.actual_distance, ws.target_distance, 0)
            ELSE 0
          END
        ) as cardio_distance,
        SUM(
          CASE WHEN COALESCE(LOWER(e.category), '') = 'cardio'
            THEN COALESCE(ws.actual_incline, ws.target_incline, 0) *
              COALESCE(ws.actual_duration_minutes, ws.target_duration_minutes, 0)
            ELSE 0
          END
        ) as cardio_incline_minutes,
        SUM(
          CASE WHEN COALESCE(LOWER(e.category), '') = 'cardio'
            THEN COALESCE(ws.actual_duration_minutes, ws.target_duration_minutes, 0)
            ELSE 0
          END
        ) as cardio_minutes_for_avg
      FROM workout_sets ws
      JOIN workout_sessions s ON s.id = ws.session_id
      LEFT JOIN exercises e ON e.id = ws.exercise_id
      LEFT JOIN user_exercises ue ON ue.id = ws.exercise_id AND ue.deleted_at IS NULL
      WHERE s.user_id = $1
        AND s.finished_at IS NOT NULL
        AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
        AND s.finished_at >= $2
      GROUP BY ${muscleGroupExpr}, s.finished_at
    `, [userId, start.toISOString(), BODYWEIGHT_FALLBACK_LBS]);
    return result.rows;
};
const sortMuscles = (items) => [...items].sort((a, b) => {
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0)
        return statusDiff;
    if (a.status === "under-trained") {
        return a.fatigueScore - b.fatigueScore;
    }
    return b.fatigueScore - a.fatigueScore;
});
const getFatigueScores = async (userId) => {
    const now = new Date();
    // Set time to start of day to avoid timezone/time-of-day issues
    const nowStart = new Date(now);
    nowStart.setHours(23, 59, 59, 999);
    const last7Start = subtractDays(nowStart, 7);
    last7Start.setHours(0, 0, 0, 0);
    const baselineStart = subtractDays(nowStart, 35);
    baselineStart.setHours(0, 0, 0, 0);
    const baselineEnd = subtractDays(nowStart, 7);
    baselineEnd.setHours(0, 0, 0, 0);
    const stimulusStart = subtractDays(nowStart, 7);
    stimulusStart.setHours(0, 0, 0, 0);
    const [last7Volumes, baselineVolumes, lastSessionByMuscle, stimulusRows] = await Promise.all([
        fetchVolumeByMuscle(userId, last7Start, nowStart),
        fetchVolumeByMuscle(userId, baselineStart, baselineEnd),
        fetchLastSessionByMuscle(userId),
        fetchStimulusRows(userId, stimulusStart),
    ]);
    const baselineWeeklyByMuscle = new Map();
    baselineVolumes.forEach((value, key) => {
        baselineWeeklyByMuscle.set(key, value / 4);
    });
    const recoveryLoadByMuscle = new Map();
    const recoveryHalfLifeHours = 36;
    const maxStrengthSetsForStimulus = 8;
    const baselineVolumeScale = 0.6;
    const cardioStimulusDivisor = 240;
    stimulusRows.forEach((row) => {
        const muscle = (row.muscle_group ?? "other").toLowerCase();
        if (!muscle)
            return;
        const finishedAt = new Date(row.finished_at);
        if (Number.isNaN(finishedAt.getTime()))
            return;
        const ageHours = Math.max(0, hoursBetween(finishedAt, now));
        const decay = Math.pow(0.5, ageHours / recoveryHalfLifeHours);
        const strengthSets = parseNumber(row.strength_sets);
        const strengthVolume = parseNumber(row.strength_volume);
        const baselineWeekly = baselineWeeklyByMuscle.get(muscle) ?? 0;
        const strengthFromSets = clamp(strengthSets / maxStrengthSetsForStimulus, 0, 1);
        const strengthFromVolume = baselineWeekly > 0
            ? clamp(strengthVolume / (baselineWeekly * baselineVolumeScale), 0, 1.5)
            : clamp(strengthVolume / 8000, 0, 1.5);
        const strengthStimulus = Math.max(strengthFromSets, strengthFromVolume);
        const cardioMinutes = parseNumber(row.cardio_minutes);
        const cardioDistance = parseNumber(row.cardio_distance);
        const cardioMinutesForAvg = parseNumber(row.cardio_minutes_for_avg);
        const inclineAvg = cardioMinutesForAvg > 0
            ? parseNumber(row.cardio_incline_minutes) / cardioMinutesForAvg
            : 0;
        const met = estimateCardioMet({
            minutes: cardioMinutes,
            distance: cardioDistance,
            inclinePercent: inclineAvg,
        });
        const cardioStimulus = met && cardioMinutes > 0
            ? clamp(((met - 1) * cardioMinutes) / cardioStimulusDivisor, 0, 0.9)
            : 0;
        const sessionStimulus = strengthStimulus + cardioStimulus;
        if (sessionStimulus <= 0)
            return;
        recoveryLoadByMuscle.set(muscle, (recoveryLoadByMuscle.get(muscle) ?? 0) + sessionStimulus * decay);
    });
    const muscles = new Set([
        ...TRACKED_MUSCLES,
        ...last7Volumes.keys(),
        ...baselineVolumes.keys(),
        ...lastSessionByMuscle.keys(),
        ...recoveryLoadByMuscle.keys(),
    ]);
    const perMuscle = [];
    let last7Total = 0;
    let baselineTotalWeekly = 0;
    muscles.forEach((muscle) => {
        const last7 = last7Volumes.get(muscle) ?? 0;
        const baselineWeekly = (baselineVolumes.get(muscle) ?? 0) / 4;
        const baselineMissing = baselineWeekly === 0;
        const hasAnyData = last7 > 0 || !baselineMissing;
        const lastSession = lastSessionByMuscle.get(muscle);
        // Calculate fatigue score
        // Key insight: fatigueScore represents training load as a % of baseline
        // - 0-70%: under-trained (low recent volume = fresh/recovered)
        // - 70-110%: optimal (near baseline = good training)
        // - 110-130%: moderate fatigue (above baseline = needs monitoring)
        // - 130%+: high fatigue (way above baseline = needs rest)
        //
        // When last7 = 0 and baseline exists, muscle is FULLY RECOVERED (score = 0)
        const fatigueScore = baselineMissing
            ? last7 > 0
                ? 100 // Has recent data but no baseline: assume optimal
                : 0 // No recent data, no baseline: no-data
            : safeDivide(last7, baselineWeekly) * 100;
        const status = !hasAnyData && baselineMissing
            ? "no-data"
            : statusFromScore(fatigueScore, hasAnyData);
        const entry = {
            muscleGroup: muscle,
            last7DaysVolume: last7,
            baselineVolume: baselineMissing ? null : baselineWeekly,
            fatigueScore,
            lastTrainedAt: lastSession?.lastTrainedAt ?? null,
            lastSessionSets: lastSession?.lastSessionSets ?? 0,
            lastSessionReps: lastSession?.lastSessionReps ?? 0,
            lastSessionVolume: lastSession?.lastSessionVolume ?? 0,
            recoveryLoad: recoveryLoadByMuscle.get(muscle) ?? 0,
            status,
            color: statusColorMap[status],
            fatigued: fatigueScore > 130,
            underTrained: fatigueScore > 0 && fatigueScore < 70,
            baselineMissing,
        };
        last7Total += last7;
        baselineTotalWeekly += baselineWeekly;
        perMuscle.push(entry);
    });
    const totalsBaseline = baselineTotalWeekly > 0 ? baselineTotalWeekly : null;
    const totalFatigueScore = totalsBaseline === null
        ? last7Total > 0
            ? 100
            : 0
        : safeDivide(last7Total, totalsBaseline) * 100;
    const readinessScore = clamp(150 - totalFatigueScore, 0, 100);
    const freshMuscles = perMuscle
        .filter((m) => m.status === "under-trained" || m.fatigueScore <= 90)
        .map((m) => m.muscleGroup);
    const lastWorkoutRow = await (0, db_1.query)(`
      SELECT finished_at
      FROM workout_sessions
      WHERE user_id = $1
        AND finished_at IS NOT NULL
        AND ended_reason IS DISTINCT FROM 'auto_inactivity'
      ORDER BY finished_at DESC
      LIMIT 1
    `, [userId]);
    return {
        generatedAt: now.toISOString(),
        windowDays: 7,
        baselineWeeks: 4,
        perMuscle: sortMuscles(perMuscle),
        deloadWeekDetected: totalsBaseline !== null ? last7Total < totalsBaseline * 0.5 : false,
        readinessScore,
        freshMuscles,
        lastWorkoutAt: lastWorkoutRow.rows[0]?.finished_at || null,
        totals: {
            last7DaysVolume: last7Total,
            baselineVolume: totalsBaseline,
            fatigueScore: totalFatigueScore,
        },
    };
};
exports.getFatigueScores = getFatigueScores;
const fetchTemplatesWithMuscles = async (userId) => {
    const result = await (0, db_1.query)(`
      SELECT
        t.id,
        t.name,
        t.split_type,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT ${muscleGroupExpr}),
          NULL
        ) as muscle_groups
      FROM workout_templates t
      LEFT JOIN workout_template_exercises te ON te.template_id = t.id
      LEFT JOIN exercises e ON e.id = te.exercise_id
      LEFT JOIN user_exercises ue ON ue.id = te.exercise_id AND ue.deleted_at IS NULL
      WHERE t.user_id = $1
        AND COALESCE(LOWER(e.category), '') <> 'cardio'
      GROUP BY t.id
    `, [userId]);
    return result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        splitType: row.split_type ?? undefined,
        muscleGroups: (row.muscle_groups ?? []).filter(Boolean),
    }));
};
const getTrainingRecommendations = async (userId, existingFatigue) => {
    const fatigue = existingFatigue ?? (await (0, exports.getFatigueScores)(userId));
    const fatigueList = fatigue.perMuscle;
    const underTrained = fatigueList.filter((m) => m.underTrained);
    const fatigued = fatigueList.filter((m) => m.fatigued);
    const optimal = fatigueList.filter((m) => m.status === "optimal");
    const targetMuscles = underTrained.length > 0
        ? underTrained.map((m) => m.muscleGroup)
        : optimal
            .filter((m) => !fatigued.some((f) => f.muscleGroup === m.muscleGroup))
            .map((m) => m.muscleGroup);
    const avoidMuscles = new Set(fatigued.map((m) => m.muscleGroup));
    const targetSet = new Set(targetMuscles);
    const templatesWithFlags = (await fetchTemplatesWithMuscles(userId)).map((tpl) => ({
        ...tpl,
        hitsTarget: tpl.muscleGroups.some((g) => targetSet.has(g)),
        hitsAvoid: tpl.muscleGroups.some((g) => avoidMuscles.has(g)),
    }));
    const actionableTemplates = templatesWithFlags.filter((tpl) => tpl.hitsTarget && !tpl.hitsAvoid);
    const rankedTemplates = actionableTemplates.length > 0
        ? actionableTemplates
        : templatesWithFlags.filter((tpl) => !tpl.hitsAvoid);
    const recommendations = rankedTemplates.slice(0, 3).map((tpl) => ({
        id: tpl.id,
        name: tpl.name,
        muscleGroups: tpl.muscleGroups,
        reason: tpl.hitsTarget
            ? `Targets ${tpl.muscleGroups.filter((g) => targetSet.has(g)).join(", ")}`
            : "Balanced option while avoiding fatigued muscles",
    }));
    if (recommendations.length === 0) {
        return {
            targetMuscles: targetMuscles.slice(0, 3),
            recommendedWorkouts: [
                {
                    id: "fallback-full-body",
                    name: "Full Body / Mobility",
                    muscleGroups: ["full_body"],
                    reason: "Light full-body or mobility session recommended while data is limited",
                },
            ],
        };
    }
    return {
        targetMuscles: targetMuscles.slice(0, 3),
        recommendedWorkouts: recommendations,
    };
};
exports.getTrainingRecommendations = getTrainingRecommendations;
/**
 * Legacy helper retained for AI prompt compatibility.
 * Returns a map of muscle group -> fatigue score (0-200+).
 */
const calculateMuscleFatigue = async (userId) => {
    const result = await (0, exports.getFatigueScores)(userId);
    return result.perMuscle.reduce((acc, item) => {
        acc[item.muscleGroup] = Math.round(item.fatigueScore);
        return acc;
    }, {});
};
exports.calculateMuscleFatigue = calculateMuscleFatigue;
/**
 * Fetch recent workout history for AI context
 */
const getRecentWorkouts = async (userId, limit = 5) => {
    try {
        const sessionsResult = await (0, db_1.query)(`
      SELECT
        ws.id as session_id,
        COALESCE(wt.name, 'Unnamed Workout') as template_name,
        wt.split_type,
        ws.finished_at
      FROM workout_sessions ws
      LEFT JOIN workout_templates wt ON ws.template_id = wt.id
      WHERE ws.user_id = $1
        AND ws.finished_at IS NOT NULL
        AND ws.ended_reason IS DISTINCT FROM 'auto_inactivity'
      ORDER BY ws.finished_at DESC
      LIMIT $2
    `, [userId, limit]);
        const workouts = [];
        for (const session of sessionsResult.rows) {
            const exercisesResult = await (0, db_1.query)(`
        SELECT
          ws.exercise_id,
          MAX(ws.exercise_name) as exercise_name,
          COUNT(*) as total_sets,
          AVG(ws.actual_reps) as avg_reps,
          AVG(ws.actual_weight) as avg_weight
        FROM workout_sets ws
        WHERE ws.session_id = $1
          AND ws.actual_reps IS NOT NULL
        GROUP BY ws.exercise_id
        ORDER BY MIN(ws.set_index)
      `, [session.session_id]);
            workouts.push({
                templateName: session.template_name,
                splitType: session.split_type,
                completedAt: new Date(session.finished_at).toISOString().split("T")[0],
                exercises: exercisesResult.rows.map((ex) => ({
                    exerciseId: ex.exercise_id,
                    exerciseName: ex.exercise_name || "Unknown",
                    sets: parseInt(ex.total_sets),
                    avgReps: Math.round(parseFloat(ex.avg_reps)),
                    avgWeight: ex.avg_weight ? Math.round(parseFloat(ex.avg_weight)) : undefined,
                })),
            });
        }
        return workouts;
    }
    catch (error) {
        console.error("[Fatigue] Error fetching recent workouts:", error);
        return [];
    }
};
exports.getRecentWorkouts = getRecentWorkouts;
