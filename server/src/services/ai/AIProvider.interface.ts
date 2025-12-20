import { Exercise } from "../../types/workouts";

/**
 * User profile data from onboarding
 */
export interface UserProfile {
  goals?: string[];
  experienceLevel?: string;
  availableEquipment?: string[];
  weeklyFrequency?: number;
  sessionDuration?: number;
  injuryNotes?: string;
  preferredSplit?: string;
  bodyweightOnly?: boolean;
  cardioPreferences?: {
    enabled?: boolean;
    timing?: "before" | "after" | "separate";
    type?: "liss" | "hiit" | "mixed";
    duration?: number;
    frequency?: number;
  };
}

/**
 * Recent workout history for context
 */
export interface RecentWorkout {
  templateName: string;
  splitType?: string;
  completedAt: string;
  exercises: {
    exerciseId: string;
    exerciseName: string;
    sets: number;
    avgReps: number;
    avgWeight?: number;
  }[];
}

/**
 * Muscle group fatigue scores (0-200+)
 * - 0-70: Under-trained
 * - 70-110: Optimal
 * - 110-130: Moderate fatigue
 * - 130+: High fatigue
 */
export interface MuscleFatigueData {
  chest?: number;
  back?: number;
  shoulders?: number;
  biceps?: number;
  triceps?: number;
  legs?: number;
  glutes?: number;
  core?: number;
}

export interface FatigueTargets {
  prioritize?: string[];
  avoid?: string[];
}

/**
 * Parameters for generating a workout
 */
export interface WorkoutGenerationParams {
  userId: string;
  userProfile?: UserProfile;
  recentWorkouts?: RecentWorkout[];
  muscleFatigue?: MuscleFatigueData;
  fatigueTargets?: FatigueTargets;
  requestedSplit?: string; // e.g., "upper", "push", "legs", "full_body"
  specificRequest?: string; // Optional: "focus on chest", "leg day with glutes"
  excludedExercises?: string[];
}

/**
 * Generated exercise from AI
 */
export interface GeneratedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  restSeconds: number;
  notes?: string;
  orderIndex: number;
  primaryMuscleGroup?: string;
  gifUrl?: string;
}

/**
 * Generated workout template from AI
 */
export interface GeneratedWorkout {
  name: string;
  splitType?: string;
  exercises: GeneratedExercise[];
  reasoning: string;
  estimatedDurationMinutes: number;
}

/**
 * Exercise swap result from AI
 */
export interface ExerciseSwapResult {
  exerciseId: string | null;
  exerciseName?: string;
  reasoning?: string;
  primaryMuscleGroup?: string;
  gifUrl?: string;
}

/**
 * Model-agnostic AI provider interface
 * Allows easy swapping between OpenAI, Anthropic, or other providers
 */
export interface AIProvider {
  /**
   * Generate a personalized workout based on user data and history
   */
  generateWorkout(params: WorkoutGenerationParams, availableExercises: any[]): Promise<GeneratedWorkout>;

  /**
   * Suggest an alternative exercise based on a reason (injury, equipment, preference)
   */
  suggestExerciseSubstitution(
    exercise: Exercise,
    reason: string,
    availableEquipment?: string[]
  ): Promise<Exercise | null>;

  /**
   * Swap an exercise for an alternative
   */
  swapExercise(
    exerciseName: string,
    primaryMuscleGroup: string,
    reason: string,
    availableEquipment: string[],
    availableExercises: any[]
  ): Promise<ExerciseSwapResult>;
}
