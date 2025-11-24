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

/**
 * OpenAI implementation of the AI provider
 * Uses GPT-4o for intelligent workout generation
 */
export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

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
      // Filter exercises based on available equipment if specified
      let filteredExercises = availableExercises;
      if (params.userProfile?.availableEquipment) {
        const equipment = params.userProfile.availableEquipment;
        // If user has gym access, include all equipment
        if (!equipment.includes("gym") && !equipment.includes("full_gym")) {
          filteredExercises = availableExercises.filter((ex) =>
            equipment.includes(ex.equipment)
          );
        }
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

      console.log(`[OpenAI] Generating workout for user ${params.userId}...`);
      console.log(`[OpenAI] Split: ${params.requestedSplit || "auto"}`);
      console.log(
        `[OpenAI] Available exercises: ${filteredExercises.length}`
      );

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
      const invalidExercises = generatedWorkout.exercises.filter(
        (ex) => !validExerciseIds.has(ex.exerciseId)
      );

      if (invalidExercises.length > 0) {
        console.warn(
          `[OpenAI] Warning: AI generated invalid exercise IDs:`,
          invalidExercises.map((ex) => ex.exerciseId)
        );
        // Filter out invalid exercises
        generatedWorkout.exercises = generatedWorkout.exercises.filter((ex) =>
          validExerciseIds.has(ex.exerciseId)
        );
      }

      if (generatedWorkout.exercises.length === 0) {
        throw new Error("No valid exercises generated");
      }

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

      console.log(
        `[OpenAI] Successfully generated workout: "${generatedWorkout.name}" with ${generatedWorkout.exercises.length} exercises`
      );

      return generatedWorkout;
    } catch (error) {
      console.error("[OpenAI] Error generating workout:", error);
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
      console.log(
        `[OpenAI] Exercise substitution requested for ${exercise.name}: ${reason}`
      );
      return null;
    } catch (error) {
      console.error("[OpenAI] Error suggesting substitution:", error);
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
      const prompt = buildSubstitutionPrompt(
        exerciseName,
        primaryMuscleGroup,
        reason,
        availableEquipment,
        availableExercises
      );

      console.log(`[OpenAI] Swapping exercise: ${exerciseName}`);
      console.log(`[OpenAI] Available alternatives: ${availableExercises.length}`);

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

      if (result.exerciseId) {
        console.log(`[OpenAI] Successfully swapped to: ${result.exerciseName}`);
      } else {
        console.log(`[OpenAI] No suitable alternative found`);
      }

      return result;
    } catch (error) {
      console.error("[OpenAI] Error swapping exercise:", error);
      throw new Error(
        `Failed to swap exercise: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
