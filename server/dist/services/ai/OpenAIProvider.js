"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
const workoutPrompts_1 = require("./workoutPrompts");
const logger_1 = require("../../utils/logger");
/**
 * OpenAI implementation of the AI provider
 * Uses GPT-4o for intelligent workout generation
 */
class OpenAIProvider {
    constructor() {
        this.log = (0, logger_1.createLogger)("OpenAI");
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY environment variable is required. Please add it to your .env file.");
        }
        this.client = new openai_1.default({ apiKey });
        this.model = process.env.OPENAI_MODEL || "gpt-4o"; // Use GPT-4o for best results
    }
    /**
     * Generate a personalized workout using OpenAI
     */
    async generateWorkout(params, availableExercises) {
        try {
            // Filter exercises based on available equipment if specified
            let filteredExercises = availableExercises;
            if (params.userProfile?.availableEquipment) {
                const equipment = params.userProfile.availableEquipment;
                // If user has gym access, include all equipment
                if (!equipment.includes("gym") && !equipment.includes("full_gym")) {
                    filteredExercises = availableExercises.filter((ex) => equipment.includes(ex.equipment));
                }
            }
            const prompt = (0, workoutPrompts_1.buildWorkoutGenerationPrompt)(params, filteredExercises.map((ex) => ({
                id: ex.id,
                name: ex.name,
                primaryMuscleGroup: ex.primaryMuscleGroup,
                equipment: ex.equipment,
            })));
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
                        content: "You are an expert strength and conditioning coach. Respond only with valid JSON.",
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
            const generatedWorkout = JSON.parse(content);
            // Validate that all exercise IDs exist in our database
            const validExerciseIds = new Set(filteredExercises.map((ex) => ex.id));
            const invalidExercises = generatedWorkout.exercises.filter((ex) => !validExerciseIds.has(ex.exerciseId));
            if (invalidExercises.length > 0) {
                this.log.warn("AI generated invalid exercise IDs", {
                    invalidExerciseIds: invalidExercises.map((ex) => ex.exerciseId),
                });
                // Filter out invalid exercises
                generatedWorkout.exercises = generatedWorkout.exercises.filter((ex) => validExerciseIds.has(ex.exerciseId));
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
            }
            else if (words.length > 0) {
                workoutName = words.join(" ");
            }
            // Fallback based on split type if name is empty or invalid
            if (!workoutName || workoutName.length < 2) {
                const splitFallbacks = {
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
        }
        catch (error) {
            this.log.error("Error generating workout", { error, userId: params.userId });
            throw new Error(`Failed to generate workout: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Suggest an exercise substitution
     */
    async suggestExerciseSubstitution(exercise, reason, availableEquipment) {
        try {
            // For now, return null - this can be implemented later
            // We'll need access to the full exercise database here
            this.log.debug("Exercise substitution requested", {
                exerciseName: exercise.name,
                reason,
                availableEquipment,
            });
            return null;
        }
        catch (error) {
            this.log.error("Error suggesting substitution", { error, exerciseName: exercise.name });
            return null;
        }
    }
    /**
     * Swap an exercise for an alternative using AI
     */
    async swapExercise(exerciseName, primaryMuscleGroup, reason, availableEquipment, availableExercises) {
        try {
            const prompt = (0, workoutPrompts_1.buildSubstitutionPrompt)(exerciseName, primaryMuscleGroup, reason, availableEquipment, availableExercises);
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
            const result = JSON.parse(content);
            if (result.exerciseId) {
                this.log.info("Successfully swapped exercise", {
                    fromExerciseName: exerciseName,
                    toExerciseName: result.exerciseName,
                });
            }
            else {
                this.log.info("No suitable alternative found", {
                    exerciseName,
                    primaryMuscleGroup,
                });
            }
            return result;
        }
        catch (error) {
            this.log.error("Error swapping exercise", { error, exerciseName, primaryMuscleGroup });
            throw new Error(`Failed to swap exercise: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
}
exports.OpenAIProvider = OpenAIProvider;
