"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyProgressionSuggestions = exports.getProgressionSuggestions = void 0;
const db_1 = require("../db");
const COMPOUND_EXERCISES = [
    "bench_press",
    "squat",
    "deadlift",
    "overhead_press",
    "barbell_row",
    "pull_up",
    "chin_up",
    "dip",
    "front_squat",
    "romanian_deadlift",
];
const BODYWEIGHT_EXERCISES = [
    "pull_up",
    "chin_up",
    "push_up",
    "dip",
    "bodyweight_squat",
    "lunge",
    "plank",
];
/**
 * Categorize exercise based on ID
 */
const categorizeExercise = (exerciseId) => {
    if (BODYWEIGHT_EXERCISES.some((bw) => exerciseId.toLowerCase().includes(bw))) {
        return "bodyweight";
    }
    if (COMPOUND_EXERCISES.some((comp) => exerciseId.toLowerCase().includes(comp))) {
        return "compound";
    }
    return "isolation";
};
/**
 * Calculate smart weight increment using hybrid approach:
 * - Exercise type (compound vs isolation vs bodyweight)
 * - Current weight being lifted
 */
const calculateIncrement = (exerciseId, currentWeight) => {
    const category = categorizeExercise(exerciseId);
    // Bodyweight exercises: suggest adding reps instead (return 0 for weight)
    if (category === "bodyweight") {
        return 0; // We'll suggest rep progression instead
    }
    // For weighted exercises, combine both approaches
    let increment = 2.5; // Default minimum
    // Approach A: Exercise type based
    if (category === "compound") {
        increment = Math.max(increment, 5);
    }
    else {
        increment = Math.max(increment, 2.5);
    }
    // Approach B: Current weight based
    if (currentWeight >= 150) {
        increment = Math.max(increment, 10);
    }
    else if (currentWeight >= 50) {
        increment = Math.max(increment, 5);
    }
    else {
        increment = Math.max(increment, 2.5);
    }
    return increment;
};
/**
 * Analyze last 3 sessions for an exercise and determine progression readiness
 */
const analyzeExerciseProgression = async (userId, exerciseId, templateId) => {
    // Fetch last 3 sessions with this exercise
    const result = await (0, db_1.query)(`
      SELECT
        s.id as session_id,
        s.finished_at,
        ws.exercise_id,
        MAX(ws.exercise_name) as exercise_name,
        COUNT(*) as sets,
        AVG(ws.actual_reps) as avg_reps,
        AVG(ws.actual_weight) as avg_weight,
        AVG(ws.target_reps) as target_reps,
        AVG(ws.target_weight) as target_weight,
        COUNT(CASE
          WHEN ws.actual_reps >= ws.target_reps
          AND ws.actual_weight >= ws.target_weight
          THEN 1
        END) as hit_target_count
      FROM workout_sessions s
      JOIN workout_sets ws ON ws.session_id = s.id
      WHERE s.user_id = $1
        AND ws.exercise_id = $2
        AND s.finished_at IS NOT NULL
        AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
        ${templateId ? "AND s.template_id = $3" : ""}
      GROUP BY s.id, ws.exercise_id
      ORDER BY s.finished_at DESC
      LIMIT 3
    `, templateId ? [userId, exerciseId, templateId] : [userId, exerciseId]);
    const sessions = result.rows;
    // Need at least 3 sessions for significant data
    if (sessions.length < 3) {
        return null;
    }
    const exerciseName = sessions[0]?.exercise_name || exerciseId;
    const category = categorizeExercise(exerciseId);
    // Transform session data
    const sessionData = sessions.map((s) => ({
        date: s.finished_at,
        sets: parseInt(s.sets),
        avgReps: Math.round(parseFloat(s.avg_reps)),
        avgWeight: Math.round(parseFloat(s.avg_weight) || 0),
        targetReps: Math.round(parseFloat(s.target_reps)),
        hitTarget: parseInt(s.hit_target_count) >= parseInt(s.sets) * 0.75, // 75% of sets hit target
    }));
    const latestSession = sessionData[0];
    const currentWeight = latestSession?.avgWeight || 0;
    // Check progression criteria
    const last2Sessions = sessionData.slice(0, 2);
    const allHitTarget = last2Sessions.every((s) => s.hitTarget);
    const allExceededReps = last2Sessions.every((s) => s.avgReps > s.targetReps + 1);
    // Bodyweight progression logic
    if (category === "bodyweight") {
        if (allHitTarget) {
            return {
                exerciseId,
                exerciseName,
                currentWeight: 0,
                suggestedWeight: 0,
                increment: 0,
                reason: `Hit target reps for 2 sessions. Try adding 2-3 more reps per set.`,
                confidence: "high",
                lastSessionsData: sessionData,
            };
        }
        return null;
    }
    // Weighted exercise progression logic
    let suggestion = null;
    if (allHitTarget && allExceededReps) {
        // Strong progression: exceeded reps for 2+ sessions
        const increment = calculateIncrement(exerciseId, currentWeight);
        suggestion = {
            exerciseId,
            exerciseName,
            currentWeight,
            suggestedWeight: currentWeight + increment,
            increment,
            reason: `Exceeded target reps for 2 consecutive sessions`,
            confidence: "high",
            lastSessionsData: sessionData,
        };
    }
    else if (allHitTarget) {
        // Moderate progression: hit target for 2+ sessions
        const increment = calculateIncrement(exerciseId, currentWeight);
        suggestion = {
            exerciseId,
            exerciseName,
            currentWeight,
            suggestedWeight: currentWeight + increment,
            increment,
            reason: `Consistently hit target reps for 2 sessions`,
            confidence: "medium",
            lastSessionsData: sessionData,
        };
    }
    return suggestion;
};
/**
 * Get progression suggestions for a template
 */
const getProgressionSuggestions = async (userId, templateId) => {
    // Get template info and exercises
    const templateResult = await (0, db_1.query)(`
      SELECT
        t.id,
        t.name,
        te.exercise_id
      FROM workout_templates t
      LEFT JOIN workout_template_exercises te ON te.template_id = t.id
      WHERE t.id = $1 AND t.user_id = $2
      ORDER BY te.order_index
    `, [templateId, userId]);
    if (templateResult.rows.length === 0) {
        return {
            templateId,
            templateName: "Unknown Template",
            hasSignificantData: false,
            suggestions: [],
            readyForProgression: false,
        };
    }
    const templateName = templateResult.rows[0]?.name || "Unknown Template";
    const exerciseIds = templateResult.rows
        .map((r) => r.exercise_id)
        .filter(Boolean);
    // Analyze each exercise
    const suggestions = [];
    for (const exerciseId of exerciseIds) {
        const suggestion = await analyzeExerciseProgression(userId, exerciseId, templateId);
        if (suggestion) {
            suggestions.push(suggestion);
        }
    }
    // Check if we have significant data (at least 3 sessions per exercise)
    const sessionCountResult = await (0, db_1.query)(`
      SELECT COUNT(DISTINCT s.id) as session_count
      FROM workout_sessions s
      WHERE s.user_id = $1
        AND s.template_id = $2
        AND s.finished_at IS NOT NULL
        AND s.ended_reason IS DISTINCT FROM 'auto_inactivity'
    `, [userId, templateId]);
    const sessionCount = parseInt(sessionCountResult.rows[0]?.session_count || "0");
    const hasSignificantData = sessionCount >= 3;
    return {
        templateId,
        templateName,
        hasSignificantData,
        suggestions,
        readyForProgression: suggestions.length > 0,
    };
};
exports.getProgressionSuggestions = getProgressionSuggestions;
/**
 * Auto-apply progression suggestions to a template
 */
const applyProgressionSuggestions = async (userId, templateId, exerciseIds // Optional: only apply to specific exercises
) => {
    const progression = await (0, exports.getProgressionSuggestions)(userId, templateId);
    if (!progression.readyForProgression) {
        return { updated: 0 };
    }
    let updated = 0;
    for (const suggestion of progression.suggestions) {
        // Skip if exerciseIds filter is provided and this exercise isn't in it
        if (exerciseIds && !exerciseIds.includes(suggestion.exerciseId)) {
            continue;
        }
        // Skip bodyweight exercises (no weight to update)
        if (suggestion.increment === 0) {
            continue;
        }
        // Update the template exercise default weight
        await (0, db_1.query)(`
        UPDATE workout_template_exercises
        SET default_weight = $1
        WHERE template_id = $2
          AND exercise_id = $3
      `, [suggestion.suggestedWeight, templateId, suggestion.exerciseId]);
        updated++;
    }
    return { updated };
};
exports.applyProgressionSuggestions = applyProgressionSuggestions;
