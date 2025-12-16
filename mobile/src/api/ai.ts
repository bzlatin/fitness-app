import { apiClient } from "./client";

export interface GenerateWorkoutRequest {
  requestedSplit?: string;
  specificRequest?: string;
  overrides?: {
    sessionDuration?: number;
    availableEquipment?: string[];
    avoidMuscles?: string[];
  };
}

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

export interface GeneratedWorkout {
  name: string;
  splitType?: string;
  exercises: GeneratedExercise[];
  reasoning: string;
  estimatedDurationMinutes: number;
}

export interface GenerateWorkoutResponse {
  success: boolean;
  workout: GeneratedWorkout;
}

export interface SmartNextWorkoutCandidate {
  splitKey: string;
  label: string;
  tags: string[];
  reason: string;
  score: number;
}

export interface SmartNextWorkoutRecommendation {
  preferredSplit: string;
  selected: SmartNextWorkoutCandidate;
  alternates: SmartNextWorkoutCandidate[];
}

export interface RecommendNextWorkoutRequest {
  overrides?: {
    sessionDuration?: number;
    availableEquipment?: string[];
    avoidMuscles?: string[];
  };
}

export interface RecommendNextWorkoutResponse {
  success: boolean;
  recommendation: SmartNextWorkoutRecommendation;
}

export interface AIUsageResponse {
  totalGenerations: number;
  lastGeneratedAt: string | null;
}

export interface SwapExerciseRequest {
  exerciseId: string;
  exerciseName: string;
  primaryMuscleGroup: string;
  reason?: string;
}

export interface SwappedExercise {
  exerciseId: string | null;
  exerciseName?: string;
  reasoning?: string;
  primaryMuscleGroup?: string;
  gifUrl?: string;
}

export interface SwapExerciseResponse {
  success: boolean;
  exercise: SwappedExercise;
}

/**
 * Generate a workout using AI
 */
export const generateWorkout = async (
  params: GenerateWorkoutRequest
): Promise<GeneratedWorkout> => {
  const response = await apiClient.post<GenerateWorkoutResponse>(
    "ai/generate-workout",
    params
  );
  return response.data.workout;
};

/**
 * Recommend the next workout in the user's split cycle, adjusted for recovery/constraints.
 * Does not consume an AI generation.
 */
export const recommendNextWorkout = async (
  params: RecommendNextWorkoutRequest
): Promise<SmartNextWorkoutRecommendation> => {
  const response = await apiClient.post<RecommendNextWorkoutResponse>(
    "ai/recommend-next-workout",
    params
  );
  return response.data.recommendation;
};

/**
 * Swap an exercise for an alternative using AI
 */
export const swapExercise = async (
  params: SwapExerciseRequest
): Promise<SwappedExercise> => {
  const response = await apiClient.post<SwapExerciseResponse>(
    "ai/swap-exercise",
    params
  );
  return response.data.exercise;
};

/**
 * Get AI usage statistics
 */
export const getAIUsage = async (): Promise<AIUsageResponse> => {
  const response = await apiClient.get<AIUsageResponse>("ai/usage");
  return response.data;
};
