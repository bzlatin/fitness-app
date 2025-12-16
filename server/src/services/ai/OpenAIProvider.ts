import OpenAI from "openai";
import {
  AIProvider,
  WorkoutGenerationParams,
  GeneratedWorkout,
  ExerciseSwapResult,
} from "./AIProvider.interface";
import { Exercise } from "../../types/workouts";
import {
  buildWorkoutGenerationPrompt,
  buildSubstitutionPrompt,
} from "./workoutPrompts";
import { createLogger } from "../../utils/logger";

/**
 * OpenAI implementation of the AI provider
 * Uses GPT-4o for intelligent workout generation
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;
  private log = createLogger("OpenAI");

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required. Please add it to your .env file."
      );
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || "gpt-4o"; // Use GPT-4o for best results
  }

  /**
   * Generate a personalized workout using OpenAI
   */
  async generateWorkout(
    params: WorkoutGenerationParams,
    availableExercises: Exercise[]
  ): Promise<GeneratedWorkout> {
    try {
      const normalizeToken = (value: string) => value.toLowerCase().trim();
      const normalizeEquipmentToken = (value: string) => {
        const token = normalizeToken(value);
        if (!token) return "";
        if (token.includes("gym")) return "gym";
        if (token.includes("body")) return "bodyweight";
        if (token.includes("dumbbell")) return "dumbbell";
        if (token.includes("barbell")) return "barbell";
        if (token.includes("kettlebell")) return "kettlebell";
        if (token.includes("cable")) return "cable";
        if (token.includes("machine")) return "machine";
        return token;
      };

      const normalizeNameKey = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const normalizeWord = (word: string) => {
        const raw = word.toLowerCase().trim();
        if (!raw) return "";
        if (raw === "squad" || raw === "squads") return "squat";
        if (raw.length > 3 && raw.endsWith("s") && !raw.endsWith("ss")) return raw.slice(0, -1);
        return raw;
      };
      const tokenize = (value: string) =>
        normalizeNameKey(value)
          .split(" ")
          .map(normalizeWord)
          .filter(Boolean);

      const excludedPatterns = (params.excludedExercises ?? [])
        .map((item) => tokenize(String(item)))
        .filter((tokens) => tokens.length > 0);

      const isExcluded = (value?: string) => {
        if (!value) return false;
        const candidateWords = tokenize(value);
        if (candidateWords.length === 0) return false;
        const candidateSet = new Set(candidateWords);
        return excludedPatterns.some((pattern) =>
          pattern.every((token) => candidateSet.has(token))
        );
      };

      // Filter exercises based on available equipment if specified
      let filteredExercises = availableExercises;
      if (params.userProfile?.availableEquipment) {
        const equipment = params.userProfile.availableEquipment
          .map(normalizeEquipmentToken)
          .filter(Boolean);

        const hasGymAccess = equipment.some((token) => token === "gym");
        if (!hasGymAccess) {
          const supported = new Set([
            "bodyweight",
            "machine",
            "cable",
            "dumbbell",
            "barbell",
            "kettlebell",
            "other",
          ]);
          const allowed = new Set(equipment.filter((token) => supported.has(token)));

          // If we can't confidently map equipment, don't filter the catalog.
          if (allowed.size > 0) {
            filteredExercises = availableExercises.filter((ex) =>
              allowed.has(normalizeEquipmentToken(ex.equipment))
            );
          }
        }
      }
      filteredExercises = filteredExercises.filter(
        (ex) => !isExcluded(ex.id) && !isExcluded(ex.name)
      );
      if (filteredExercises.length === 0) {
        filteredExercises = availableExercises.filter(
          (ex) => !isExcluded(ex.id) && !isExcluded(ex.name)
        );
      }
      if (filteredExercises.length === 0) {
        throw new Error("No available exercises after applying equipment and exclusion filters");
      }

      const prompt = buildWorkoutGenerationPrompt(
        params,
        filteredExercises.map((ex) => ({
          id: ex.id,
          name: ex.name,
          primaryMuscleGroup: ex.primaryMuscleGroup,
          equipment: ex.equipment,
        }))
      );

      this.log.debug("Generating workout", {
        userId: params.userId,
        split: params.requestedSplit || "auto",
        availableExercises: filteredExercises.length,
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "You are an expert strength and conditioning coach. Respond only with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7, // Some creativity but still structured
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("OpenAI returned empty response");
      }

      const generatedWorkout = JSON.parse(content) as GeneratedWorkout;

      // Validate that all exercise IDs exist in our database
      const validExerciseIds = new Set(filteredExercises.map((ex) => ex.id));
      const idToExercise = new Map(filteredExercises.map((ex) => [ex.id, ex]));
      const nameToId = new Map(
        filteredExercises.map((ex) => [normalizeNameKey(ex.name), ex.id])
      );

      const resolveByName = (exerciseName?: string) => {
        if (!exerciseName) return undefined;
        const key = normalizeNameKey(exerciseName);
        if (!key) return undefined;

        const direct = nameToId.get(key);
        if (direct) return direct;

        // Fuzzy: all words present (handles "Incline DB Press" vs "Incline Dumbbell Press")
        const words = key.split(" ").filter(Boolean);
        if (words.length === 0) return undefined;

        for (const [catalogKey, id] of nameToId.entries()) {
          if (words.every((w) => catalogKey.includes(w))) return id;
        }
        return undefined;
      };

      const invalidExercises = generatedWorkout.exercises.filter((ex) => !validExerciseIds.has(ex.exerciseId));

      if (invalidExercises.length > 0) {
        this.log.warn("AI generated invalid exercise IDs", {
          invalidExerciseIds: invalidExercises.map((ex) => ex.exerciseId),
        });
        let resolvedCount = 0;

        generatedWorkout.exercises = generatedWorkout.exercises
          .map((exercise) => {
            if (validExerciseIds.has(exercise.exerciseId)) return exercise;

            const resolvedId = resolveByName(exercise.exerciseName);
            if (!resolvedId) return null;

            const meta = idToExercise.get(resolvedId);
            resolvedCount += 1;

            return {
              ...exercise,
              exerciseId: resolvedId,
              exerciseName: meta?.name ?? exercise.exerciseName,
              primaryMuscleGroup: meta?.primaryMuscleGroup ?? exercise.primaryMuscleGroup,
            };
          })
          .filter(Boolean) as GeneratedWorkout["exercises"];

        if (resolvedCount > 0) {
          this.log.info("Resolved invalid exercise IDs by name", {
            resolvedCount,
            remainingInvalid: generatedWorkout.exercises.filter((ex) => !validExerciseIds.has(ex.exerciseId)).length,
          });
        }
      }

      const usedExerciseIds = new Set<string>();
      const pickReplacement = (primaryMuscleGroup?: string) => {
        const normalizedGroup = primaryMuscleGroup?.toLowerCase().trim();
        const candidates = filteredExercises.filter(
          (ex) =>
            !usedExerciseIds.has(ex.id) &&
            !isExcluded(ex.id) &&
            (!normalizedGroup || ex.primaryMuscleGroup === normalizedGroup)
        );
        if (candidates.length > 0) return candidates[0];
        return filteredExercises.find(
          (ex) => !usedExerciseIds.has(ex.id) && !isExcluded(ex.id)
        );
      };

      const cleanedExercises = generatedWorkout.exercises
        .map((exercise) => {
          const meta = idToExercise.get(exercise.exerciseId);
          const exerciseExcluded =
            isExcluded(exercise.exerciseId) ||
            isExcluded(exercise.exerciseName) ||
            (meta ? isExcluded(meta.name) : false);

          if (!meta || exerciseExcluded || usedExerciseIds.has(exercise.exerciseId)) {
            const replacement = pickReplacement(exercise.primaryMuscleGroup);
            if (!replacement) {
              this.log.warn("Dropping generated exercise with no valid replacement", {
                exerciseId: exercise.exerciseId,
                exerciseName: exercise.exerciseName,
              });
              return null;
            }

            usedExerciseIds.add(replacement.id);
            if (exerciseExcluded) {
              this.log.info("Replaced excluded exercise", {
                originalExercise: exercise.exerciseName || exercise.exerciseId,
                replacementId: replacement.id,
              });
            }
            return {
              ...exercise,
              exerciseId: replacement.id,
              exerciseName: replacement.name,
              primaryMuscleGroup: replacement.primaryMuscleGroup,
            };
          }

          usedExerciseIds.add(exercise.exerciseId);
          return {
            ...exercise,
            exerciseName: meta?.name ?? exercise.exerciseName,
            primaryMuscleGroup: meta?.primaryMuscleGroup ?? exercise.primaryMuscleGroup,
          };
        })
        .filter(Boolean) as GeneratedWorkout["exercises"];

      if (cleanedExercises.length === 0) {
        throw new Error("No valid exercises generated after applying exclusions");
      }

      generatedWorkout.exercises = cleanedExercises;

      // Enforce concise naming (max 3 words, no filler words)
      let workoutName = generatedWorkout.name;

      // Remove emojis and special characters except & and -
      workoutName = workoutName.replace(/[^a-zA-Z0-9\s&-]/g, "").trim();

      // Remove common filler words
      const fillerWords = [
        "workout", "training", "session", "day", "focused", "focus",
        "power", "volume", "fatigue", "baseline", "balanced", "optimal",
        "emphasis", "intensity", "based", "oriented", "style", "routine"
      ];
      const words = workoutName.split(/\s+/).filter(word => {
        const lowerWord = word.toLowerCase();
        return word && !fillerWords.includes(lowerWord);
      });

      // Limit to 3 words
      if (words.length > 3) {
        workoutName = words.slice(0, 3).join(" ");
      } else if (words.length > 0) {
        workoutName = words.join(" ");
      }

      // Fallback based on split type if name is empty or invalid
      if (!workoutName || workoutName.length < 2) {
        const splitFallbacks: Record<string, string> = {
          push: "Push",
          pull: "Pull",
          legs: "Legs",
          upper: "Upper",
          lower: "Lower",
          full_body: "Full Body",
          custom: "Custom"
        };
        const splitType = generatedWorkout.splitType || "custom";
        workoutName = splitFallbacks[splitType] || "Training";
      }

      generatedWorkout.name = workoutName;

      this.log.info("Successfully generated workout", {
        workoutName: generatedWorkout.name,
        exercisesCount: generatedWorkout.exercises.length,
      });

      return generatedWorkout;
    } catch (error) {
      this.log.error("Error generating workout", { error, userId: params.userId });
      throw new Error(
        `Failed to generate workout: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Suggest an exercise substitution
   */
  async suggestExerciseSubstitution(
    exercise: Exercise,
    reason: string,
    availableEquipment?: string[]
  ): Promise<Exercise | null> {
    try {
      // For now, return null - this can be implemented later
      // We'll need access to the full exercise database here
      this.log.debug("Exercise substitution requested", {
        exerciseName: exercise.name,
        reason,
        availableEquipment,
      });
      return null;
    } catch (error) {
      this.log.error("Error suggesting substitution", { error, exerciseName: exercise.name });
      return null;
    }
  }

  /**
   * Swap an exercise for an alternative using AI
   */
  async swapExercise(
    exerciseName: string,
    primaryMuscleGroup: string,
    reason: string,
    availableEquipment: string[],
    availableExercises: any[]
  ): Promise<ExerciseSwapResult> {
    try {
      const normalizeNameKey = (value: string) =>
        value
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const idToExercise = new Map(
        availableExercises.map((ex) => [ex.id, ex])
      );
      const nameToId = new Map(
        availableExercises.map((ex) => [normalizeNameKey(ex.name), ex.id])
      );
      const resolveByName = (name?: string) => {
        if (!name) return undefined;
        const key = normalizeNameKey(name);
        if (!key) return undefined;
        const direct = nameToId.get(key);
        if (direct) return direct;
        const words = key.split(" ").filter(Boolean);
        for (const [candidate, id] of nameToId.entries()) {
          if (words.every((w) => candidate.includes(w))) return id;
        }
        return undefined;
      };

      const prompt = buildSubstitutionPrompt(
        exerciseName,
        primaryMuscleGroup,
        reason,
        availableEquipment,
        availableExercises
      );

      this.log.debug("Swapping exercise", {
        exerciseName,
        primaryMuscleGroup,
        reason,
        availableAlternatives: availableExercises.length,
      });

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are an expert personal trainer. Respond only with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error("OpenAI returned empty response");
      }

      const result = JSON.parse(content) as ExerciseSwapResult;
      const resolvedId =
        (result.exerciseId && idToExercise.has(result.exerciseId)
          ? result.exerciseId
          : undefined) || resolveByName(result.exerciseName);
      const resolvedMeta = resolvedId ? idToExercise.get(resolvedId) : availableExercises[0];

      if (resolvedMeta) {
        result.exerciseId = resolvedMeta.id;
        result.exerciseName = resolvedMeta.name;
        result.primaryMuscleGroup = resolvedMeta.primaryMuscleGroup;
        result.gifUrl = resolvedMeta.gifUrl;
      } else {
        result.exerciseId = null;
      }

      if (result.exerciseId) {
        this.log.info("Successfully swapped exercise", {
          fromExerciseName: exerciseName,
          toExerciseName: result.exerciseName,
        });
      } else {
        this.log.info("No suitable alternative found", {
          exerciseName,
          primaryMuscleGroup,
        });
      }

      return result;
    } catch (error) {
      this.log.error("Error swapping exercise", { error, exerciseName, primaryMuscleGroup });
      throw new Error(
        `Failed to swap exercise: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
