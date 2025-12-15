"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStartingSuggestion = void 0;
const db_1 = require("../db");
const exerciseCatalog_1 = require("../utils/exerciseCatalog");
const roundToIncrement = (value, increment) => {
    if (!Number.isFinite(value))
        return value;
    if (!Number.isFinite(increment) || increment <= 0)
        return value;
    return Math.round(value / increment) * increment;
};
const median = (values) => {
    if (values.length === 0)
        return undefined;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
};
const getStartingSuggestion = async (userId, exerciseId) => {
    const metaMap = await (0, exerciseCatalog_1.fetchExerciseMetaByIds)([exerciseId]);
    const meta = metaMap.get(exerciseId);
    if (!meta)
        return null;
    const latestSame = await (0, db_1.query)(`
      SELECT ws.actual_weight, ws.actual_reps, ws.difficulty_rating
      FROM workout_sets ws
      JOIN workout_sessions s ON s.id = ws.session_id
      WHERE s.user_id = $1
        AND s.finished_at IS NOT NULL
        AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
        AND ws.exercise_id = $2
        AND (ws.set_kind IS NULL OR ws.set_kind = 'working')
        AND ws.actual_reps IS NOT NULL
        AND ws.actual_reps > 0
        AND ws.actual_weight IS NOT NULL
        AND ws.actual_weight::numeric > 0
      ORDER BY s.finished_at DESC, ws.set_index ASC
      LIMIT 1
    `, [userId, exerciseId]);
    const sameRow = latestSame.rows[0];
    if (sameRow) {
        const weight = sameRow.actual_weight === null ? undefined : Number(sameRow.actual_weight);
        const reps = typeof sameRow.actual_reps === "number" && Number.isFinite(sameRow.actual_reps)
            ? Math.round(sameRow.actual_reps)
            : undefined;
        if (typeof weight === "number" && Number.isFinite(weight) && weight > 0) {
            const difficulty = sameRow.difficulty_rating === "too_easy" ||
                sameRow.difficulty_rating === "just_right" ||
                sameRow.difficulty_rating === "too_hard"
                ? sameRow.difficulty_rating
                : null;
            const baseWeight = roundToIncrement(weight, 2.5);
            const adjustedWeight = difficulty === "too_easy"
                ? roundToIncrement(baseWeight + 2.5, 2.5)
                : difficulty === "too_hard"
                    ? roundToIncrement(Math.max(2.5, baseWeight - 2.5), 2.5)
                    : baseWeight;
            return {
                exerciseId,
                suggestedWeight: adjustedWeight,
                suggestedReps: reps ? Math.max(1, reps) : undefined,
                reason: difficulty === "too_easy"
                    ? "Based on last time (you said it felt too easy)"
                    : difficulty === "too_hard"
                        ? "Based on last time (you said it felt too hard)"
                        : "Based on your last time doing this exercise",
                confidence: "high",
            };
        }
    }
    const similar = await (0, db_1.query)(`
      SELECT ws.actual_weight, ws.actual_reps
      FROM workout_sets ws
      JOIN workout_sessions s ON s.id = ws.session_id
      JOIN exercises e ON e.id = ws.exercise_id
      WHERE s.user_id = $1
        AND s.finished_at IS NOT NULL
        AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
        AND (ws.set_kind IS NULL OR ws.set_kind = 'working')
        AND ws.exercise_id <> $2
        AND e.primary_muscle_group = $3
        AND e.equipment = $4
        AND ws.actual_reps IS NOT NULL
        AND ws.actual_reps > 0
        AND ws.actual_weight IS NOT NULL
        AND ws.actual_weight::numeric > 0
      ORDER BY s.finished_at DESC
      LIMIT 60
    `, [userId, exerciseId, meta.primaryMuscleGroup, meta.equipment]);
    if (similar.rows.length === 0) {
        return {
            exerciseId,
            suggestedReps: 10,
            reason: "No similar exercise history yet",
            confidence: "low",
        };
    }
    const weights = similar.rows.map((row) => Number(row.actual_weight)).filter((n) => n > 0);
    const reps = similar.rows.map((row) => row.actual_reps).filter((n) => n > 0);
    const weightMedian = median(weights);
    const repsMedian = median(reps);
    const suggestedWeight = typeof weightMedian === "number" && Number.isFinite(weightMedian)
        ? roundToIncrement(weightMedian * 0.9, 2.5)
        : undefined;
    const suggestedReps = typeof repsMedian === "number" && Number.isFinite(repsMedian)
        ? Math.max(6, Math.min(12, Math.round(repsMedian)))
        : 10;
    return {
        exerciseId,
        suggestedWeight: suggestedWeight && suggestedWeight > 0 ? suggestedWeight : undefined,
        suggestedReps,
        reason: `Based on similar ${meta.primaryMuscleGroup} / ${meta.equipment} lifts`,
        confidence: "medium",
    };
};
exports.getStartingSuggestion = getStartingSuggestion;
