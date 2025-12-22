"use strict";
/**
 * Up Next Intelligence Service
 *
 * Analyzes user's workout history, split preferences, and fatigue data
 * to recommend the next workout - either from saved templates or AI generation.
 *
 * Key features:
 * - Determines next split type based on recent workouts and user's preferred split
 * - Matches saved templates to the recommended split type
 * - Considers fatigue/recovery status
 * - Provides reasoning for the recommendation
 * - Handles both Pro and Free users (Pro gets more detailed recovery analysis)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUpNextRecommendation = void 0;
const db_1 = require("../db");
const fatigue_1 = require("./fatigue");
const fatigue_2 = require("./fatigue");
const smartNextWorkout_1 = require("./smartNextWorkout");
const logger_1 = require("../utils/logger");
const log = (0, logger_1.createLogger)("UpNextIntelligence");
const formatSplitLabel = (splitKey, fallback) => {
    if (!splitKey && fallback)
        return fallback;
    const key = (splitKey ?? "").toLowerCase();
    const map = {
        push: "Push",
        pull: "Pull",
        legs: "Legs",
        upper: "Upper",
        lower: "Lower",
        full_body: "Full Body",
        chest: "Chest",
        back: "Back",
        shoulders: "Shoulders",
        arms: "Arms",
    };
    if (!key)
        return fallback ?? "Training";
    return (map[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
};
/**
 * Fetch user's saved templates with metadata
 */
const fetchUserTemplates = async (userId) => {
    const result = await (0, db_1.query)(`
    WITH template_muscles AS (
      SELECT
        t.id,
        t.name,
        t.split_type,
        COUNT(DISTINCT te.id) as exercise_count,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT LOWER(COALESCE(ue.primary_muscle_group, e.primary_muscle_group, 'other'))),
          NULL
        ) as muscle_groups
      FROM workout_templates t
      LEFT JOIN workout_template_exercises te ON te.template_id = t.id
      LEFT JOIN exercises e ON e.id = te.exercise_id
      LEFT JOIN user_exercises ue ON ue.id = te.exercise_id AND ue.deleted_at IS NULL
      WHERE t.user_id = $1
      GROUP BY t.id
    ),
    last_usage AS (
      SELECT
        ws.template_id,
        MAX(ws.finished_at) as last_used_at
      FROM workout_sessions ws
      WHERE ws.user_id = $1
        AND ws.finished_at IS NOT NULL
        AND ws.ended_reason IS DISTINCT FROM 'auto_inactivity'
      GROUP BY ws.template_id
    )
    SELECT
      tm.id,
      tm.name,
      tm.split_type,
      tm.exercise_count::text,
      tm.muscle_groups,
      lu.last_used_at::text
    FROM template_muscles tm
    LEFT JOIN last_usage lu ON lu.template_id = tm.id
    ORDER BY lu.last_used_at DESC NULLS LAST, tm.name
    `, [userId]);
    return result.rows;
};
/**
 * Get days since last workout of a specific split type
 */
const getDaysSinceLastSplit = async (userId, splitKey) => {
    const result = await (0, db_1.query)(`
    SELECT ws.finished_at
    FROM workout_sessions ws
    LEFT JOIN workout_templates wt ON ws.template_id = wt.id
    WHERE ws.user_id = $1
      AND ws.finished_at IS NOT NULL
      AND ws.ended_reason IS DISTINCT FROM 'auto_inactivity'
      AND (
        LOWER(COALESCE(wt.split_type, '')) LIKE $2
        OR LOWER(COALESCE(ws.template_name, '')) LIKE $2
      )
    ORDER BY ws.finished_at DESC
    LIMIT 1
    `, [userId, `%${splitKey}%`]);
    if (result.rows.length === 0)
        return null;
    const lastFinished = new Date(result.rows[0].finished_at);
    const now = new Date();
    const diffMs = now.getTime() - lastFinished.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};
/**
 * Score how well a template matches the recommended split
 *
 * Scoring thresholds:
 * - 100: Perfect split type match (e.g., template is "push" and we recommend "push")
 * - 90: Template name contains the split keyword (e.g., "Pull Day A" for "pull" split)
 * - 85: 80%+ muscle group overlap
 * - 0: Everything else (we only want strong matches)
 */
const scoreTemplateMatch = (template, recommendedSplit, fatigue) => {
    const templateSplit = (0, smartNextWorkout_1.normalizeSplitKey)(template.split_type);
    const templateNameLower = template.name.toLowerCase();
    const muscles = template.muscle_groups ?? [];
    // Perfect match on split type metadata
    if (templateSplit === recommendedSplit) {
        return { score: 100, reason: "Perfect match for your split" };
    }
    // Check if template name contains the split keyword
    // e.g., "Pull Day A" matches "pull", "Leg Day" matches "legs"
    const splitKeywords = getSplitKeywords(recommendedSplit);
    const nameContainsSplit = splitKeywords.some((keyword) => templateNameLower.includes(keyword));
    if (nameContainsSplit) {
        return { score: 90, reason: "Matches your split" };
    }
    // Match based on muscle groups - require high overlap
    const splitMuscles = getSplitMuscles(recommendedSplit);
    const matchingMuscles = muscles.filter((m) => splitMuscles.includes(m));
    const matchPercent = splitMuscles.length > 0
        ? (matchingMuscles.length / splitMuscles.length) * 100
        : 0;
    // Also check reverse: what percent of template muscles are in the split
    const templateMuscleMatchPercent = muscles.length > 0 ? (matchingMuscles.length / muscles.length) * 100 : 0;
    // Require BOTH high overlap: template hits most split muscles AND template is focused on split muscles
    if (matchPercent >= 80 && templateMuscleMatchPercent >= 60) {
        return { score: 85, reason: "Hits the right muscle groups" };
    }
    // No good match - return 0 so this template won't be shown as "matched"
    return { score: 0, reason: "Alternative option" };
};
/**
 * Get keywords to search for in template names
 */
const getSplitKeywords = (splitKey) => {
    switch (splitKey) {
        case "push":
            return ["push"];
        case "pull":
            return ["pull"];
        case "legs":
            return ["leg", "lower"];
        case "lower":
            return ["lower", "leg"];
        case "upper":
            return ["upper"];
        case "full_body":
            return ["full body", "full-body", "fullbody", "total body"];
        case "chest":
            return ["chest"];
        case "back":
            return ["back"];
        case "shoulders":
            return ["shoulder", "delt"];
        case "arms":
            return ["arm", "bicep", "tricep"];
        default:
            return [splitKey];
    }
};
/**
 * Get primary muscles for a split type
 */
const getSplitMuscles = (splitKey) => {
    switch (splitKey) {
        case "push":
            return ["chest", "shoulders", "triceps"];
        case "pull":
            return ["back", "biceps"];
        case "legs":
        case "lower":
            return ["legs", "glutes", "core"];
        case "upper":
            return ["chest", "back", "shoulders", "biceps", "triceps"];
        case "full_body":
            return [
                "chest",
                "back",
                "shoulders",
                "biceps",
                "triceps",
                "legs",
                "glutes",
                "core",
            ];
        case "chest":
            return ["chest", "triceps"];
        case "back":
            return ["back", "biceps"];
        case "shoulders":
            return ["shoulders"];
        case "arms":
            return ["biceps", "triceps"];
        default:
            return [];
    }
};
/**
 * Determine fatigue status for a split
 */
const getFatigueStatusForSplit = (fatigue, splitKey) => {
    if (!fatigue)
        return "no-data";
    const splitMuscles = getSplitMuscles(splitKey);
    if (splitMuscles.length === 0)
        return "ready";
    const muscleScores = fatigue.perMuscle
        .filter((m) => splitMuscles.includes(m.muscleGroup))
        .map((m) => m.fatigueScore);
    if (muscleScores.length === 0)
        return "no-data";
    const avgScore = muscleScores.reduce((a, b) => a + b, 0) / muscleScores.length;
    if (avgScore > 130)
        return "high-fatigue";
    if (avgScore > 110)
        return "moderate-fatigue";
    if (avgScore < 70)
        return "fresh";
    return "ready";
};
/**
 * Generate human-readable reasoning
 * Keep it concise - don't repeat info already shown in the UI (fatigue status, template name)
 */
const generateReasoning = (recommendation, matchedTemplate, daysSinceLastSplit, fatigueStatus, hasProAccess) => {
    const parts = [];
    const splitLabel = recommendation.selected.label;
    const preferredSplitLabel = formatSplitLabel(recommendation.preferredSplit, splitLabel);
    // Split rotation reason - this is the key info
    if (recommendation.selected.tags.includes("On-cycle")) {
        if (preferredSplitLabel === "Ppl") {
            parts.push(`Next in your ${preferredSplitLabel.toUpperCase()} rotation`);
        }
        else {
            parts.push(`Next in your ${preferredSplitLabel} rotation`);
        }
    }
    else {
        parts.push(`${splitLabel} fits your training balance`);
    }
    // Days since this split (only if not already shown elsewhere and meaningful)
    if (daysSinceLastSplit !== null && daysSinceLastSplit >= 3) {
        parts.push(`${daysSinceLastSplit} days since last ${splitLabel.toLowerCase()}`);
    }
    // Only mention fatigue if it's notable (high fatigue warning)
    if (fatigueStatus === "moderate-fatigue" ||
        fatigueStatus === "high-fatigue") {
        parts.push("consider lighter volume today");
    }
    // Don't repeat template name - it's shown in the card already
    // Don't mention AI generation - buttons are shown
    return parts.join(". ") + ".";
};
/**
 * Main function: Get the Up Next recommendation for a user
 */
const getUpNextRecommendation = async (userId, hasProAccess) => {
    try {
        // Fetch all required data in parallel
        const [templates, recentWorkouts, fatigue, userResult] = await Promise.all([
            fetchUserTemplates(userId),
            (0, fatigue_2.getRecentWorkouts)(userId, 7),
            (0, fatigue_1.getFatigueScores)(userId),
            (0, db_1.query)(`SELECT onboarding_data, plan, plan_expires_at, ai_generations_used_count FROM users WHERE id = $1`, [
                userId,
            ]),
        ]);
        const userRecord = userResult.rows[0];
        const onboardingData = userRecord?.onboarding_data ?? {};
        const preferredSplit = onboardingData.preferredSplit || onboardingData.preferred_split;
        const plan = String(userRecord?.plan ?? "free").toLowerCase();
        const expiresAt = userRecord?.plan_expires_at
            ? new Date(userRecord.plan_expires_at)
            : null;
        const isExpired = Boolean(expiresAt && expiresAt < new Date());
        const aiUsed = Math.max(0, Number(userRecord?.ai_generations_used_count ?? 0));
        const FREE_AI_GENERATION_LIMIT = 1;
        const canGenerateAi = hasProAccess ||
            plan === "lifetime" ||
            (!isExpired && plan !== "pro" && plan !== "lifetime" && aiUsed < FREE_AI_GENERATION_LIMIT);
        // Get the smart next workout recommendation (split type)
        const splitRecommendation = (0, smartNextWorkout_1.recommendSmartNextWorkout)({
            preferredSplit,
            recentWorkouts,
            fatigue,
        });
        const recommendedSplitKey = splitRecommendation.selected.splitKey;
        // Find matching templates
        const scoredTemplates = templates
            .map((template) => {
            const { score, reason } = scoreTemplateMatch(template, recommendedSplitKey, fatigue);
            return {
                templateId: template.id,
                templateName: template.name,
                splitType: template.split_type,
                exerciseCount: parseInt(template.exercise_count) || 0,
                muscleGroups: template.muscle_groups ?? [],
                lastUsedAt: template.last_used_at,
                matchScore: score,
                matchReason: reason,
            };
        })
            .sort((a, b) => {
            // Sort by match score first, then by last used (prefer less recently used to add variety)
            if (b.matchScore !== a.matchScore) {
                return b.matchScore - a.matchScore;
            }
            // If never used, prioritize it
            if (!a.lastUsedAt && b.lastUsedAt)
                return -1;
            if (a.lastUsedAt && !b.lastUsedAt)
                return 1;
            if (!a.lastUsedAt && !b.lastUsedAt)
                return 0;
            // Prefer less recently used for variety
            return (new Date(a.lastUsedAt).getTime() - new Date(b.lastUsedAt).getTime());
        });
        // Best match needs at least 85 score to be considered a true match
        // This ensures we only show templates that actually match the recommended split
        const matchedTemplate = scoredTemplates.find((t) => t.matchScore >= 85) ?? null;
        const alternateTemplates = scoredTemplates
            .filter((t) => t.templateId !== matchedTemplate?.templateId && t.matchScore >= 85)
            .slice(0, 3);
        // Get fatigue status for the recommended split
        const fatigueStatus = getFatigueStatusForSplit(fatigue, recommendedSplitKey);
        // Get days since last workout of this split type
        const daysSinceLastSplit = await getDaysSinceLastSplit(userId, recommendedSplitKey);
        // Generate reasoning
        const reasoning = generateReasoning(splitRecommendation, matchedTemplate, daysSinceLastSplit, fatigueStatus, hasProAccess);
        log.debug("Generated Up Next recommendation", {
            userId,
            recommendedSplit: recommendedSplitKey,
            matchedTemplateId: matchedTemplate?.templateId ?? null,
            fatigueStatus,
            daysSinceLastSplit,
        });
        return {
            recommendedSplit: {
                splitKey: splitRecommendation.selected.splitKey,
                label: splitRecommendation.selected.label,
                reason: splitRecommendation.selected.reason,
                tags: splitRecommendation.selected.tags,
            },
            alternateSplits: splitRecommendation.alternates.map((alt) => ({
                splitKey: alt.splitKey,
                label: alt.label,
                reason: alt.reason,
            })),
            matchedTemplate,
            alternateTemplates,
            fatigueStatus,
            readinessScore: fatigue?.readinessScore ?? 80,
            canGenerateAI: canGenerateAi,
            reasoning,
            lastWorkoutAt: fatigue?.lastWorkoutAt ?? null,
            daysSinceLastSplit,
        };
    }
    catch (error) {
        log.error("Error generating Up Next recommendation", { error, userId });
        throw error;
    }
};
exports.getUpNextRecommendation = getUpNextRecommendation;
