import { Router } from "express";
import { getAIProvider, MuscleFatigueData, WorkoutGenerationParams } from "../services/ai";
import { getFatigueScores, getRecentWorkouts, getTrainingRecommendations } from "../services/fatigue";
import { determineNextInCycle } from "../services/ai/workoutPrompts";
import { recommendSmartNextWorkout } from "../services/smartNextWorkout";
import { checkAiWorkoutGenerationLimit, requireProPlan } from "../middleware/planLimits";
import { query } from "../db";
import { generateId } from "../utils/id";
import { fetchExerciseCatalog, ExerciseMeta } from "../utils/exerciseCatalog";
import { loadExercisesJson } from "../utils/exerciseData";
import { createLogger } from "../utils/logger";
import { normalizeGymPreferences } from "../utils/gymPreferences";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { aiGenerateLimiter, aiRecommendLimiter, aiSwapLimiter } from "../middleware/rateLimit";

const router = Router();
const log = createLogger("AI");

const generateWorkoutBodySchema = z
  .object({
    requestedSplit: z.string().trim().min(1).max(80).optional(),
    specificRequest: z.string().trim().min(1).max(2000).optional(),
    overrides: z
      .object({
        sessionDuration: z.number().int().min(10).max(180).optional(),
        availableEquipment: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
        avoidMuscles: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
      })
      .strip()
      .optional(),
  })
  .strip();

const recommendNextWorkoutBodySchema = z
  .object({
    overrides: z
      .object({
        sessionDuration: z.number().int().min(10).max(180).optional(),
        availableEquipment: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
        avoidMuscles: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
      })
      .strip()
      .optional(),
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

const normalizeOnboardingEquipment = (
  raw?: unknown,
  custom?: unknown
): string[] | undefined => {
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  if (values.length === 0) return undefined;

  const customList = Array.isArray(custom)
    ? custom.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  const mapped = values
    .map((value) => String(value).toLowerCase().trim())
    .flatMap((value) => {
      if (value === "gym_full") return ["gym"];
      if (value === "home_limited") return ["dumbbell", "bodyweight"];
      if (value === "bodyweight") return ["bodyweight"];
      if (value === "custom") return customList.length > 0 ? customList : [];
      return [value];
    })
    .filter(Boolean);

  const unique = Array.from(new Set(mapped));
  return unique.length > 0 ? unique : undefined;
};

const normalizeEquipmentList = (raw?: unknown) => {
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  if (values.length === 0) return undefined;
  const normalized = values
    .map((value) => String(value).toLowerCase().trim())
    .filter(Boolean);
  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : undefined;
};

const readOnboardingField = <T,>(onboardingData: any, keys: string[]): T | undefined => {
  for (const key of keys) {
    const value = onboardingData?.[key];
    if (value !== undefined && value !== null) return value as T;
  }
  return undefined;
};

const normalizePreferredSplit = (value?: unknown): string | undefined => {
  if (!value) return undefined;
  const raw = String(value).toLowerCase().trim();
  if (!raw) return undefined;
  if (raw === "push_pull_legs") return "ppl";
  return raw;
};

const uniqStrings = (items: string[]) =>
  Array.from(
    new Set(items.map((item) => item.toLowerCase().trim()).filter((item) => item.length > 0))
  );

const normalizeExcludedExercises = (value?: unknown): string[] | undefined => {
  const normalizeWord = (word: string) => {
    const raw = word.toLowerCase().trim();
    if (!raw) return "";
    if (raw === "squad" || raw === "squads") return "squat";
    if (raw.length > 3 && raw.endsWith("s") && !raw.endsWith("ss")) return raw.slice(0, -1);
    return raw;
  };
  const normalizePhrase = (phrase: string) =>
    phrase
      .toLowerCase()
      .replace(/[_-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .map(normalizeWord)
      .filter(Boolean)
      .join(" ")
      .trim();

  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,;]+/)
      : [];

  const normalized = list
    .flatMap((item) =>
      typeof item === "string" && item.includes("/") ? item.split("/") : item
    )
    .map((item) => normalizePhrase(String(item || "")))
    .filter((item) => item.length > 0);

  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : undefined;
};

/**
 * POST /api/ai/generate-workout
 * Generate a personalized workout using AI
 * Requires Pro plan
 */
router.post(
  "/generate-workout",
  aiGenerateLimiter,
  validateBody(generateWorkoutBodySchema),
  checkAiWorkoutGenerationLimit,
  async (req, res) => {
  const userId = res.locals.userId;
  const reservedFreeGeneration = Boolean(
    res.locals.aiFreeWorkoutGenerationReserved
  );

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { requestedSplit, specificRequest, overrides } =
      req.body as z.infer<typeof generateWorkoutBodySchema>;

    // Get user profile data
    const userResult = await query<{
      onboarding_data: any;
      gym_preferences: unknown;
    }>(`SELECT onboarding_data, gym_preferences FROM users WHERE id = $1`, [userId]);

    const user = userResult.rows[0];
    const onboardingData = user?.onboarding_data || {};
    const gymPreferences = normalizeGymPreferences(user?.gym_preferences);

    const preferredSplit = normalizePreferredSplit(
      readOnboardingField<string>(onboardingData, ["preferredSplit", "preferred_split"])
    );
    const goals = readOnboardingField<string[]>(onboardingData, ["goals"]);
    const experienceLevel = readOnboardingField<string>(onboardingData, ["experienceLevel", "experience_level"]);
    const weeklyFrequency = readOnboardingField<number>(onboardingData, ["weeklyFrequency", "weekly_frequency"]);
    const baseSessionDuration = readOnboardingField<number>(onboardingData, ["sessionDuration", "session_duration"]);
    const injuryNotes = readOnboardingField<string>(onboardingData, ["injuryNotes", "injury_notes"]);
    const equipmentOverride = overrides?.availableEquipment
      ? normalizeOnboardingEquipment(overrides.availableEquipment)
      : undefined;
    const gymEquipment = gymPreferences.bodyweightOnly
      ? ["bodyweight"]
      : normalizeEquipmentList(gymPreferences.equipment);
    const equipment =
      equipmentOverride ??
      gymEquipment ??
      normalizeOnboardingEquipment(
        readOnboardingField(onboardingData, [
          "availableEquipment",
          "available_equipment",
        ]),
        readOnboardingField(onboardingData, [
          "customEquipment",
          "custom_equipment",
        ])
      );
    const inferredBodyweightOnly = Boolean(
      gymPreferences.bodyweightOnly ||
        (gymEquipment?.length === 1 && gymEquipment[0] === "bodyweight") ||
        (equipmentOverride?.length === 1 && equipmentOverride[0] === "bodyweight")
    );
    const excludedExercises =
      normalizeExcludedExercises(
        readOnboardingField(onboardingData, [
          "excludedExercises",
          "excluded_exercises",
          "avoidExercises",
          "avoid_exercises",
          "movementsToAvoid",
          "movements_to_avoid",
        ])
      ) ?? [];

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
        preferredSplit
      );
      if (nextInCycle) {
        finalRequestedSplit = nextInCycle;
        log.debug("Auto-detected next in cycle", { nextInCycle, userId });
      } else if (preferredSplit === "custom") {
        finalRequestedSplit = recommendSmartNextWorkout({
          preferredSplit,
          recentWorkouts,
          fatigue: fatigueResult,
          overrides: {
            sessionDuration: overrides?.sessionDuration ?? baseSessionDuration,
            avoidMuscles: overrides?.avoidMuscles,
          },
        }).selected.splitKey;
      }
    }

    const fatigueTargets = {
      prioritize: recommendations.targetMuscles,
      avoid: uniqStrings([
        ...fatigueResult.perMuscle.filter((m) => m.fatigued).map((m) => m.muscleGroup),
        ...(overrides?.avoidMuscles ?? []),
      ]),
    };

    const params: WorkoutGenerationParams = {
      userId,
      userProfile: {
        goals,
        experienceLevel,
        availableEquipment: equipment,
        weeklyFrequency,
        sessionDuration:
          overrides?.sessionDuration ??
          gymPreferences.sessionDuration ??
          baseSessionDuration,
        injuryNotes,
        preferredSplit: preferredSplit === "custom" ? "full_body" : preferredSplit,
        bodyweightOnly: inferredBodyweightOnly,
        cardioPreferences: gymPreferences.cardio,
      },
      recentWorkouts,
      muscleFatigue,
      fatigueTargets,
      requestedSplit: finalRequestedSplit,
      specificRequest,
      excludedExercises,
    };

    log.debug("Generating workout", {
      userId,
      requestedSplit: finalRequestedSplit ?? null,
      recentWorkoutsCount: recentWorkouts.length,
      hasFatigueData: Object.keys(muscleFatigue).length > 0,
      targetMuscles: fatigueTargets.prioritize,
      avoidMuscles: fatigueTargets.avoid,
      excludedExercises,
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
        generateId(),
        userId,
        "workout",
        JSON.stringify({ requestedSplit, specificRequest, overrides, excludedExercises }),
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

    if (reservedFreeGeneration) {
      query(
        `
          UPDATE users
          SET ai_generations_used_count = GREATEST(ai_generations_used_count - 1, 0)
          WHERE id = $1
        `,
        [userId]
      ).catch((rollbackError) => {
        log.warn("Failed to roll back reserved AI generation", {
          rollbackError,
          userId,
        });
      });
    }

    // Check if it's an OpenAI API error
    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return res.status(500).json({
        error: "Workout service not configured",
        message:
          "The smart workout generation service is not properly configured. Please contact support.",
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

    const { catalog: exerciseCatalog, lookup: exerciseLookup } = await buildExerciseLookup();

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
        message: "Could not find a suitable replacement for this exercise",
      });
    }

    // Track usage
    await query(
      `
      INSERT INTO ai_generations (id, user_id, generation_type, input_params, output_data, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `,
      [
        generateId(),
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

    const resolveExerciseMeta = (id?: string, name?: string) => {
      if (id) {
        const direct = exerciseLookup.get(id);
        if (direct) return direct;

        const normalizedId = id.toLowerCase();
        for (const [key, value] of exerciseLookup.entries()) {
          if (key.toLowerCase() === normalizedId) return value;
        }
      }

      if (name) {
        const normalizedName = name.toLowerCase().trim();
        for (const value of exerciseLookup.values()) {
          if (value.name.toLowerCase().trim() === normalizedName) return value;
        }
      }

      return null;
    };

    const resolvedMeta = resolveExerciseMeta(result.exerciseId ?? undefined, result.exerciseName);

    if (!resolvedMeta) {
      return res.status(404).json({
        error: "No alternatives found",
        message: "Could not resolve swapped exercise metadata",
      });
    }

    const resolvedExercise = {
      ...result,
      exerciseId: resolvedMeta.id,
      exerciseName: resolvedMeta.name,
      primaryMuscleGroup: resolvedMeta.primaryMuscleGroup,
      gifUrl: resolvedMeta.gifUrl,
    };

    if (resolvedExercise.exerciseId === exerciseId) {
      const fallback = similarExercises.find((ex) => ex.id !== exerciseId);
      if (fallback) {
        resolvedExercise.exerciseId = fallback.id;
        resolvedExercise.exerciseName = fallback.name;
        resolvedExercise.primaryMuscleGroup = fallback.primaryMuscleGroup;
        resolvedExercise.gifUrl = fallback.gifUrl;
      }
    }
    if (resolvedExercise.exerciseId === exerciseId) {
      return res.status(404).json({
        error: "No alternatives found",
        message: "Swap returned the original exercise; no change applied",
      });
    }

    return res.json({
      success: true,
      exercise: resolvedExercise,
    });
  } catch (error) {
    log.error("Error swapping exercise", { error, userId });

    if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
      return res.status(500).json({
        error: "Workout service not configured",
        message:
          "The smart exercise swap service is not properly configured. Please contact support.",
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

/**
 * POST /api/ai/recommend-next-workout
 * Recommend the next session in a user's split, adjusted by recovery/constraints.
 * Does not consume an AI generation.
 */
router.post(
  "/recommend-next-workout",
  aiRecommendLimiter,
  validateBody(recommendNextWorkoutBodySchema),
  async (req, res) => {
    const userId = res.locals.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { overrides } = req.body as z.infer<typeof recommendNextWorkoutBodySchema>;

      const userResult = await query<{ onboarding_data: any; gym_preferences: unknown }>(
        `SELECT onboarding_data, gym_preferences FROM users WHERE id = $1`,
        [userId]
      );
      const onboardingData = userResult.rows[0]?.onboarding_data || {};
      const gymPreferences = normalizeGymPreferences(
        userResult.rows[0]?.gym_preferences
      );

      const preferredSplit = normalizePreferredSplit(
        readOnboardingField<string>(onboardingData, ["preferredSplit", "preferred_split"])
      );
      const baseSessionDuration = readOnboardingField<number>(onboardingData, ["sessionDuration", "session_duration"]);

      const [recentWorkouts, fatigueResult] = await Promise.all([
        getRecentWorkouts(userId, 5),
        getFatigueScores(userId),
      ]);

      const recommendation = recommendSmartNextWorkout({
        preferredSplit,
        recentWorkouts,
        fatigue: fatigueResult,
        overrides: {
          sessionDuration:
            overrides?.sessionDuration ??
            gymPreferences.sessionDuration ??
            baseSessionDuration,
          avoidMuscles: overrides?.avoidMuscles,
        },
      });

      return res.json({ success: true, recommendation });
    } catch (error) {
      log.error("Error recommending next workout", { error, userId });
      return res.status(500).json({
        error: "Failed to recommend next workout",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  }
);

export default router;
