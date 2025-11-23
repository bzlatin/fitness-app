import { apiClient } from "./client";

export interface GenerateWorkoutRequest {
  requestedSplit?: string;
  specificRequest?: string;
}

export interface GeneratedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  restSeconds: number;
  notes?: string;
  orderIndex: number;
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

export interface AIUsageResponse {
  totalGenerations: number;
  lastGeneratedAt: string | null;
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
 * Get AI usage statistics
 */
export const getAIUsage = async (): Promise<AIUsageResponse> => {
  const response = await apiClient.get<AIUsageResponse>("ai/usage");
  return response.data;
};
