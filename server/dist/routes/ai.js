"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_1 = require("../services/ai");
const fatigue_1 = require("../services/fatigue");
const workoutPrompts_1 = require("../services/ai/workoutPrompts");
const planLimits_1 = require("../middleware/planLimits");
const db_1 = require("../db");
const nanoid_1 = require("nanoid");
const exerciseCatalog_1 = require("../utils/exerciseCatalog");
const exerciseData_1 = require("../utils/exerciseData");
const router = (0, express_1.Router)();
const formatExerciseName = (value) => value
    .replace(/^ex[-_]/i, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
const normalizeEquipment = (value) => {
    const raw = Array.isArray(value) && value.length > 0
        ? value[0].toLowerCase()
        : value?.toLowerCase() ?? "";
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
    const primary = item.primaryMuscles?.[0] ||
        (Array.isArray(item.primaryMuscleGroup)
            ? item.primaryMuscleGroup[0]
            : item.primaryMuscleGroup) ||
        "other";
    const equipment = normalizeEquipment(item.equipment || item.equipments || "bodyweight");
    const imagePath = item.images?.[0];
    const normalizedId = (item.id || item.name.replace(/\s+/g, "_")).trim();
    const displayName = formatExerciseName(item.name || normalizedId);
    return {
        id: normalizedId,
        name: displayName,
        primaryMuscleGroup: primary.toLowerCase(),
        equipment: equipment.toLowerCase(),
        gifUrl: imagePath ? `/api/exercises/assets/${imagePath}` : undefined,
    };
};
let exerciseCatalogCache = null;
const loadExerciseCatalog = async () => {
    if (exerciseCatalogCache)
        return exerciseCatalogCache;
    const dbExercises = await (0, exerciseCatalog_1.fetchExerciseCatalog)();
    if (dbExercises.length) {
        exerciseCatalogCache = dbExercises;
        return exerciseCatalogCache;
    }
    const fallback = (0, exerciseData_1.loadExercisesJson)();
    if (fallback.length) {
        exerciseCatalogCache = fallback.map(normalizeExercise);
        return exerciseCatalogCache;
    }
    exerciseCatalogCache = [];
    return exerciseCatalogCache;
};
const buildExerciseLookup = async () => {
    const catalog = await loadExerciseCatalog();
    return {
        catalog,
        lookup: new Map(catalog.map((item) => [item.id, item])),
    };
};
// Simple in-memory rate limiter (can be replaced with Redis in production)
const rateLimitMap = new Map();
const checkRateLimit = (userId, maxRequests = 10, windowMs = 60000) => {
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);
    if (!userLimit || now > userLimit.resetAt) {
        // New window
        rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (userLimit.count >= maxRequests) {
        return false;
    }
    userLimit.count++;
    return true;
};
const deriveFocusName = (specificRequest) => {
    if (!specificRequest)
        return null;
    // Check if this is a fatigue-aware request with instruction format
    // Example: "Prioritize: chest, back | Limit volume for: biceps | Stay near recent baseline volume"
    const prioritizeMatch = specificRequest.match(/Prioritize:\s*([^|]+)/i);
    if (prioritizeMatch) {
        // Extract just the prioritized muscles for the name
        const muscles = prioritizeMatch[1]
            .split(/,|and/)
            .map((m) => m.trim())
            .filter(Boolean)
            .slice(0, 3); // Limit to 3
        if (muscles.length > 0) {
            return muscles.join(" & ");
        }
    }
    // Fallback: handle simple "focus on X" format
    const normalized = specificRequest
        .replace(/focus on|target|emphasize|work on|workout for|prioritize|limit volume for|stay near.*$/gi, "")
        .replace(/[^a-z,&/ ]/gi, " ")
        .replace(/\sand\s/gi, " & ")
        .replace(/\s+/g, " ")
        .trim();
    if (!normalized)
        return null;
    // Split by delimiters and capitalize
    const parts = normalized
        .split(/[,/&|]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
        const words = part.split(" ").filter(Boolean);
        return words
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    });
    if (parts.length === 0)
        return null;
    // Limit to max 3 muscle groups to keep names concise
    const limitedParts = parts.slice(0, 3);
    return limitedParts.join(" & ");
};
/**
 * POST /api/ai/generate-workout
 * Generate a personalized workout using AI
 * Requires Pro plan
 */
router.post("/generate-workout", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    // Rate limiting: 10 requests per minute
    if (!checkRateLimit(userId, 10, 60000)) {
        return res.status(429).json({
            error: "Rate limit exceeded",
            message: "Too many workout generation requests. Please wait a minute and try again.",
        });
    }
    try {
        const { requestedSplit, specificRequest } = req.body;
        // Get user profile data
        const userResult = await (0, db_1.query)(`SELECT onboarding_data FROM users WHERE id = $1`, [userId]);
        const user = userResult.rows[0];
        const onboardingData = user?.onboarding_data || {};
        // Fetch recent workout history and muscle fatigue
        const [recentWorkouts, fatigueResult] = await Promise.all([
            (0, fatigue_1.getRecentWorkouts)(userId, 5),
            (0, fatigue_1.getFatigueScores)(userId),
        ]);
        const recommendations = await (0, fatigue_1.getTrainingRecommendations)(userId, fatigueResult);
        const muscleFatigue = fatigueResult.perMuscle.reduce((acc, item) => {
            acc[item.muscleGroup] = Math.round(item.fatigueScore);
            return acc;
        }, {});
        // Determine the next workout in cycle if no specific split requested
        let finalRequestedSplit = requestedSplit;
        if (!requestedSplit && !specificRequest) {
            const nextInCycle = (0, workoutPrompts_1.determineNextInCycle)(recentWorkouts, onboardingData.preferred_split);
            if (nextInCycle) {
                finalRequestedSplit = nextInCycle;
                console.log(`[AI] Auto-detected next in cycle: ${nextInCycle}`);
            }
        }
        const fatigueTargets = {
            prioritize: recommendations.targetMuscles,
            avoid: fatigueResult.perMuscle.filter((m) => m.fatigued).map((m) => m.muscleGroup),
        };
        const params = {
            userId,
            userProfile: {
                goals: onboardingData.goals,
                experienceLevel: onboardingData.experience_level,
                availableEquipment: onboardingData.available_equipment,
                weeklyFrequency: onboardingData.weekly_frequency,
                sessionDuration: onboardingData.session_duration,
                injuryNotes: onboardingData.injury_notes,
                preferredSplit: onboardingData.preferred_split,
            },
            recentWorkouts,
            muscleFatigue,
            fatigueTargets,
            requestedSplit: finalRequestedSplit,
            specificRequest,
        };
        console.log(`[AI] Generating workout for user ${userId}`);
        console.log(`[AI] Recent workouts: ${recentWorkouts.length}, Fatigue data available: ${Object.keys(muscleFatigue).length > 0}`);
        console.log(`[AI] Targeting muscles: ${fatigueTargets.prioritize.join(", ") || "auto"} | Avoid: ${fatigueTargets.avoid.join(", ") || "none"}`);
        const { catalog: exerciseCatalog, lookup: exerciseLookup } = await buildExerciseLookup();
        const aiProvider = (0, ai_1.getAIProvider)();
        const generatedWorkout = await aiProvider.generateWorkout(params, exerciseCatalog);
        const focusName = deriveFocusName(specificRequest);
        if (focusName && !requestedSplit) {
            generatedWorkout.name = focusName;
            generatedWorkout.splitType = "custom";
        }
        const enrichedWorkout = {
            ...generatedWorkout,
            exercises: generatedWorkout.exercises.map((ex) => {
                // First try direct lookup
                let meta = exerciseLookup.get(ex.exerciseId);
                // If not found, try case-insensitive lookup
                if (!meta) {
                    const normalizedId = ex.exerciseId.toLowerCase();
                    for (const [key, value] of exerciseLookup.entries()) {
                        if (key.toLowerCase() === normalizedId) {
                            meta = value;
                            break;
                        }
                    }
                }
                // If still not found, try matching by name (exact match)
                if (!meta && ex.exerciseName) {
                    const normalizedName = ex.exerciseName.toLowerCase().trim();
                    for (const [_, value] of exerciseLookup.entries()) {
                        if (value.name.toLowerCase().trim() === normalizedName) {
                            meta = value;
                            break;
                        }
                    }
                }
                // If still not found, try fuzzy matching by removing prefixes and special chars
                if (!meta) {
                    // Remove common prefixes like 'ex-', 'exercise-', etc and normalize
                    const cleanId = ex.exerciseId
                        .replace(/^ex[-_]/i, '')
                        .replace(/[-_]/g, ' ')
                        .toLowerCase()
                        .trim();
                    const cleanName = ex.exerciseName
                        ?.replace(/^ex[-_]/i, '')
                        .replace(/[-_]/g, ' ')
                        .toLowerCase()
                        .trim();
                    // First try to find exact word matches (all words present)
                    if (cleanName) {
                        const searchWords = cleanName.split(/\s+/).filter(Boolean);
                        for (const [_, value] of exerciseLookup.entries()) {
                            const dbName = value.name.toLowerCase().trim();
                            // Check if all search words are in the database name
                            if (searchWords.every(word => dbName.includes(word))) {
                                meta = value;
                                break;
                            }
                        }
                    }
                    // If still not found, try partial matching
                    if (!meta) {
                        for (const [_, value] of exerciseLookup.entries()) {
                            const dbName = value.name.toLowerCase().trim();
                            const dbId = value.id.replace(/[-_]/g, ' ').toLowerCase().trim();
                            // Check if database name/id contains the cleaned search term
                            if (cleanName && dbName.includes(cleanName)) {
                                meta = value;
                                break;
                            }
                            if (cleanId && dbName.includes(cleanId)) {
                                meta = value;
                                break;
                            }
                            // Also check reverse - if search term contains db name (for generic terms)
                            if (cleanName && cleanName.includes(dbName)) {
                                meta = value;
                                break;
                            }
                            if (cleanId && cleanId.includes(dbId)) {
                                meta = value;
                                break;
                            }
                        }
                    }
                }
                // Log if we couldn't find metadata or image
                if (!meta) {
                    console.warn(`[AI] No metadata found for exercise: ${ex.exerciseId} (${ex.exerciseName})`);
                }
                else if (!meta.gifUrl) {
                    console.warn(`[AI] Exercise found but has no image: ${meta.id} (${meta.name})`);
                }
                const resolvedName = meta?.name ?? formatExerciseName(ex.exerciseName || ex.exerciseId);
                return {
                    ...ex,
                    exerciseName: resolvedName,
                    primaryMuscleGroup: meta?.primaryMuscleGroup ?? ex.primaryMuscleGroup,
                    gifUrl: meta?.gifUrl ?? ex.gifUrl,
                };
            }),
        };
        // Track AI usage
        await (0, db_1.query)(`
      INSERT INTO ai_generations (id, user_id, generation_type, input_params, output_data, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
            (0, nanoid_1.nanoid)(),
            userId,
            "workout",
            JSON.stringify({ requestedSplit, specificRequest }),
            JSON.stringify(enrichedWorkout),
        ]);
        console.log(`[AI] Successfully generated workout: "${enrichedWorkout.name}"`);
        return res.json({
            success: true,
            workout: enrichedWorkout,
        });
    }
    catch (error) {
        console.error("[AI] Error generating workout:", error);
        // Check if it's an OpenAI API error
        if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
            return res.status(500).json({
                error: "AI service not configured",
                message: "The AI workout generation service is not properly configured. Please contact support.",
            });
        }
        return res.status(500).json({
            error: "Failed to generate workout",
            message: error instanceof Error ? error.message : "An unexpected error occurred",
        });
    }
});
/**
 * POST /api/ai/swap-exercise
 * Swap an exercise for an alternative using AI
 * Requires Pro plan
 */
router.post("/swap-exercise", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    // Rate limiting: 20 swaps per minute
    if (!checkRateLimit(userId, 20, 60000)) {
        return res.status(429).json({
            error: "Rate limit exceeded",
            message: "Too many swap requests. Please wait a minute and try again.",
        });
    }
    try {
        const { exerciseId, exerciseName, primaryMuscleGroup, reason } = req.body;
        if (!exerciseId || !exerciseName || !primaryMuscleGroup) {
            return res.status(400).json({
                error: "Missing required fields",
                message: "exerciseId, exerciseName, and primaryMuscleGroup are required",
            });
        }
        // Get user profile for equipment
        const userResult = await (0, db_1.query)(`SELECT onboarding_data FROM users WHERE id = $1`, [userId]);
        const user = userResult.rows[0];
        const onboardingData = user?.onboarding_data || {};
        const availableEquipment = onboardingData.available_equipment || ["barbell", "dumbbell", "machine"];
        const { catalog: exerciseCatalog } = await buildExerciseLookup();
        // Filter exercises by same muscle group
        const similarExercises = exerciseCatalog.filter((ex) => ex.primaryMuscleGroup === primaryMuscleGroup.toLowerCase() && ex.id !== exerciseId);
        if (similarExercises.length === 0) {
            return res.status(404).json({
                error: "No alternatives found",
                message: "No alternative exercises available for this muscle group",
            });
        }
        const aiProvider = (0, ai_1.getAIProvider)();
        const swapReason = reason || "User requested swap";
        console.log(`[AI] Swapping exercise ${exerciseName} for user ${userId}`);
        const result = await aiProvider.swapExercise(exerciseName, primaryMuscleGroup, swapReason, availableEquipment, similarExercises);
        if (!result || !result.exerciseId) {
            return res.status(404).json({
                error: "No suitable alternative found",
                message: "AI could not find a suitable replacement for this exercise",
            });
        }
        // Track usage
        await (0, db_1.query)(`
      INSERT INTO ai_generations (id, user_id, generation_type, input_params, output_data, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
            (0, nanoid_1.nanoid)(),
            userId,
            "exercise_swap",
            JSON.stringify({ exerciseId, exerciseName, reason }),
            JSON.stringify(result),
        ]);
        console.log(`[AI] Successfully swapped to: ${result.exerciseName}`);
        return res.json({
            success: true,
            exercise: result,
        });
    }
    catch (error) {
        console.error("[AI] Error swapping exercise:", error);
        if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
            return res.status(500).json({
                error: "AI service not configured",
                message: "The AI exercise swap service is not properly configured. Please contact support.",
            });
        }
        return res.status(500).json({
            error: "Failed to swap exercise",
            message: error instanceof Error ? error.message : "An unexpected error occurred",
        });
    }
});
/**
 * GET /api/ai/usage
 * Get AI usage stats for the current user
 */
router.get("/usage", planLimits_1.requireProPlan, async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const result = await (0, db_1.query)(`
      SELECT
        COUNT(*) as total_generations,
        MAX(created_at) as last_generated_at
      FROM ai_generations
      WHERE user_id = $1
    `, [userId]);
        const stats = result.rows[0];
        return res.json({
            totalGenerations: parseInt(stats?.total_generations || "0"),
            lastGeneratedAt: stats?.last_generated_at || null,
        });
    }
    catch (error) {
        console.error("[AI] Error fetching usage:", error);
        return res.status(500).json({ error: "Failed to fetch usage stats" });
    }
});
exports.default = router;
