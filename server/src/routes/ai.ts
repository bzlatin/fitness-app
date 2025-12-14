import { Router } from "express";
import { getAIProvider, MuscleFatigueData, WorkoutGenerationParams } from "../services/ai";
import { getFatigueScores, getRecentWorkouts, getTrainingRecommendations } from "../services/fatigue";
import { determineNextInCycle } from "../services/ai/workoutPrompts";
import { requireProPlan } from "../middleware/planLimits";
import { query } from "../db";
import { nanoid } from "nanoid";
import { fetchExerciseCatalog, ExerciseMeta } from "../utils/exerciseCatalog";
import { loadExercisesJson } from "../utils/exerciseData";
import { createLogger } from "../utils/logger";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { aiGenerateLimiter, aiSwapLimiter } from "../middleware/rateLimit";

const router = Router();
const log = createLogger("AI");

const generateWorkoutBodySchema = z
  .object({
    requestedSplit: z.string().trim().min(1).max(80).optional(),
    specificRequest: z.string().trim().min(1).max(2000).optional(),
  })
  .strip();

const swapExerciseBodySchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(200),
    exerciseName: z.string().trim().min(1).max(200),
    primaryMuscleGroup: z.string().trim().min(1).max(50),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strip();

type LocalExercise = {
  id?: string;
  name: string;
  primaryMuscles?: string[];
  primaryMuscleGroup?: string | string[];
  equipment?: string | string[];
  equipments?: string | string[];
  images?: string[];
};

const formatExerciseName = (value: string) =>
  value
    .replace(/^ex[-_]/i, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const normalizeEquipment = (value?: string | string[] | null) => {
  const raw =
    Array.isArray(value) && value.length > 0
      ? value[0].toLowerCase()
      : (value as string | null | undefined)?.toLowerCase() ?? "";
  if (raw.includes("body")) return "bodyweight";
  if (raw.includes("machine")) return "machine";
  if (raw.includes("cable")) return "cable";
  if (raw.includes("dumbbell")) return "dumbbell";
  if (raw.includes("barbell")) return "barbell";
  if (raw.includes("kettlebell")) return "kettlebell";
  return raw || "other";
};

const normalizeExercise = (item: LocalExercise): ExerciseMeta => {
  const primary =
    item.primaryMuscles?.[0] ||
    (Array.isArray(item.primaryMuscleGroup)
      ? item.primaryMuscleGroup[0]
      : item.primaryMuscleGroup) ||
    "other";
  const equipment = normalizeEquipment(
    item.equipment || item.equipments || "bodyweight"
  );
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

let exerciseCatalogCache: ExerciseMeta[] | null = null;

const loadExerciseCatalog = async (): Promise<ExerciseMeta[]> => {
  if (exerciseCatalogCache) return exerciseCatalogCache;

  const dbExercises = await fetchExerciseCatalog();
  if (dbExercises.length) {
    exerciseCatalogCache = dbExercises;
    return exerciseCatalogCache;
  }

  const fallback = loadExercisesJson<LocalExercise>();
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

const deriveFocusName = (specificRequest?: string) => {
  if (!specificRequest) return null;

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

  if (!normalized) return null;

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

  if (parts.length === 0) return null;

  // Limit to max 3 muscle groups to keep names concise
  const limitedParts = parts.slice(0, 3);

  return limitedParts.join(" & ");
};

/**
 * POST /api/ai/generate-workout
 * Generate a personalized workout using AI
 * Requires Pro plan
 */
router.post(
  "/generate-workout",
  requireProPlan,
  aiGenerateLimiter,
  validateBody(generateWorkoutBodySchema),
  async (req, res) => {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { requestedSplit, specificRequest } =
      req.body as z.infer<typeof generateWorkoutBodySchema>;

    // Get user profile data
    const userResult = await query<{
      onboarding_data: any;
    }>(`SELECT onboarding_data FROM users WHERE id = $1`, [userId]);

    const user = userResult.rows[0];
    const onboardingData = user?.onboarding_data || {};

    // Fetch recent workout history and muscle fatigue
    const [recentWorkouts, fatigueResult] = await Promise.all([
      getRecentWorkouts(userId, 5),
      getFatigueScores(userId),
    ]);
    const recommendations = await getTrainingRecommendations(userId, fatigueResult);

    const muscleFatigue = fatigueResult.perMuscle.reduce<MuscleFatigueData>(
      (acc, item) => {
        acc[item.muscleGroup as keyof MuscleFatigueData] = Math.round(item.fatigueScore);
        return acc;
      },
      {}
    );

    // Determine the next workout in cycle if no specific split requested
    let finalRequestedSplit = requestedSplit;
    if (!requestedSplit && !specificRequest) {
      const nextInCycle = determineNextInCycle(
        recentWorkouts,
        onboardingData.preferred_split
      );
      if (nextInCycle) {
        finalRequestedSplit = nextInCycle;
        log.debug("Auto-detected next in cycle", { nextInCycle, userId });
      }
    }

    const fatigueTargets = {
      prioritize: recommendations.targetMuscles,
      avoid: fatigueResult.perMuscle.filter((m) => m.fatigued).map((m) => m.muscleGroup),
    };

    const params: WorkoutGenerationParams = {
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

    log.debug("Generating workout", {
      userId,
      requestedSplit: finalRequestedSplit ?? null,
      recentWorkoutsCount: recentWorkouts.length,
      hasFatigueData: Object.keys(muscleFatigue).length > 0,
      targetMuscles: fatigueTargets.prioritize,
      avoidMuscles: fatigueTargets.avoid,
    });

    const { catalog: exerciseCatalog, lookup: exerciseLookup } = await buildExerciseLookup();
    const aiProvider = getAIProvider();
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
          log.debug("No metadata found for exercise", {
            exerciseId: ex.exerciseId,
            exerciseName: ex.exerciseName,
          });
        } else if (!meta.gifUrl) {
          log.debug("Exercise found but has no image", { exerciseId: meta.id, exerciseName: meta.name });
        }

        const resolvedName =
          meta?.name ?? formatExerciseName(ex.exerciseName || ex.exerciseId);
        return {
          ...ex,
          exerciseName: resolvedName,
          primaryMuscleGroup: meta?.primaryMuscleGroup ?? ex.primaryMuscleGroup,
          gifUrl: meta?.gifUrl ?? ex.gifUrl,
        };
      }),
    };

    // Track AI usage
    await query(
      `
      INSERT INTO ai_generations (id, user_id, generation_type, input_params, output_data, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `,
      [
        nanoid(),
        userId,
        "workout",
        JSON.stringify({ requestedSplit, specificRequest }),
        JSON.stringify(enrichedWorkout),
      ]
    );

    log.info("Successfully generated workout", {
      workoutName: enrichedWorkout.name,
      exercisesCount: enrichedWorkout.exercises.length,
    });

    return res.json({
      success: true,
      workout: enrichedWorkout,
    });
  } catch (error) {
    log.error("Error generating workout", { error, userId });

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
  }
);

/**
 * POST /api/ai/swap-exercise
 * Swap an exercise for an alternative using AI
 * Requires Pro plan
 */
router.post(
  "/swap-exercise",
  requireProPlan,
  aiSwapLimiter,
  validateBody(swapExerciseBodySchema),
  async (req, res) => {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { exerciseId, exerciseName, primaryMuscleGroup, reason } =
      req.body as z.infer<typeof swapExerciseBodySchema>;

    // Get user profile for equipment
    const userResult = await query<{
      onboarding_data: any;
    }>(`SELECT onboarding_data FROM users WHERE id = $1`, [userId]);

    const user = userResult.rows[0];
    const onboardingData = user?.onboarding_data || {};
    const availableEquipment = onboardingData.available_equipment || ["barbell", "dumbbell", "machine"];

    const { catalog: exerciseCatalog } = await buildExerciseLookup();

    // Filter exercises by same muscle group
    const similarExercises = exerciseCatalog.filter(
      (ex) => ex.primaryMuscleGroup === primaryMuscleGroup.toLowerCase() && ex.id !== exerciseId
    );

    if (similarExercises.length === 0) {
      return res.status(404).json({
        error: "No alternatives found",
        message: "No alternative exercises available for this muscle group",
      });
    }

    const aiProvider = getAIProvider();
    const swapReason = reason || "User requested swap";

    log.debug("Swapping exercise", { userId, exerciseId, exerciseName, primaryMuscleGroup });

    const result = await aiProvider.swapExercise(
      exerciseName,
      primaryMuscleGroup,
      swapReason,
      availableEquipment,
      similarExercises
    );

    if (!result || !result.exerciseId) {
      return res.status(404).json({
        error: "No suitable alternative found",
        message: "AI could not find a suitable replacement for this exercise",
      });
    }

    // Track usage
    await query(
      `
      INSERT INTO ai_generations (id, user_id, generation_type, input_params, output_data, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `,
      [
        nanoid(),
        userId,
        "exercise_swap",
        JSON.stringify({ exerciseId, exerciseName, reason }),
        JSON.stringify(result),
      ]
    );

    log.info("Successfully swapped exercise", {
      fromExerciseName: exerciseName,
      toExerciseName: result.exerciseName,
    });

    return res.json({
      success: true,
      exercise: result,
    });
  } catch (error) {
    log.error("Error swapping exercise", { error, userId });

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
  }
);

/**
 * GET /api/ai/usage
 * Get AI usage stats for the current user
 */
router.get("/usage", requireProPlan, async (req, res) => {
  const userId = res.locals.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await query<{
      total_generations: string;
      last_generated_at: string;
    }>(
      `
      SELECT
        COUNT(*) as total_generations,
        MAX(created_at) as last_generated_at
      FROM ai_generations
      WHERE user_id = $1
    `,
      [userId]
    );

    const stats = result.rows[0];

    return res.json({
      totalGenerations: parseInt(stats?.total_generations || "0"),
      lastGeneratedAt: stats?.last_generated_at || null,
    });
  } catch (error) {
    log.error("Error fetching usage", { error, userId });
    return res.status(500).json({ error: "Failed to fetch usage stats" });
  }
});

export default router;
