export type SplitType =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "custom";

export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "legs"
  | "glutes"
  | "core"
  | "full_body"
  | "cardio"
  | "custom"
  | "other";

export interface WorkoutTemplateExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  exerciseName?: string;
  primaryMuscleGroup?: MuscleGroup | string;
  exerciseImageUrl?: string;
  equipment?: string;
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds?: number;
  defaultWeight?: number;
  defaultIncline?: number;
  defaultDistance?: number;
  defaultDurationMinutes?: number;
  notes?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  splitType?: SplitType;
  isFavorite: boolean;
  sharingDisabled?: boolean;
  exercises: WorkoutTemplateExercise[];
  createdAt: string;
  updatedAt: string;
  progressiveOverloadEnabled?: boolean;
}

export type SetDifficultyRating = "too_easy" | "just_right" | "too_hard";

export interface WorkoutSet {
  id: string;
  sessionId: string;
  templateExerciseId?: string;
  exerciseId: string;
  exerciseName?: string;
  exerciseImageUrl?: string;
  setKind?: "warmup" | "working";
  setIndex: number;
  targetReps?: number;
  targetWeight?: number;
  targetRestSeconds?: number;
  actualReps?: number;
  actualWeight?: number;
  rpe?: number;
  difficultyRating?: SetDifficultyRating;
  // Cardio-specific fields
  targetDistance?: number;
  actualDistance?: number;
  targetIncline?: number;
  actualIncline?: number;
  targetDurationMinutes?: number;
  actualDurationMinutes?: number;
}

export interface WorkoutSession {
  id: string;
  templateId?: string;
  templateName?: string;
  source?: "manual" | "ai" | "apple_health";
  startedAt: string;
  finishedAt?: string;
  endedReason?: string;
  autoEndedAt?: string;
  durationSeconds?: number;
  totalEnergyBurned?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  sets: WorkoutSet[];
}

export interface WorkoutHistorySession {
  id: string;
  startedAt: string;
  finishedAt?: string;
  templateName?: string;
  source?: "manual" | "ai" | "apple_health";
  durationSeconds?: number;
  totalVolumeLbs: number;
  estimatedCalories: number;
  totalEnergyBurned?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  exercises: {
    exerciseId: string;
    name: string;
    sets: number;
    volumeLbs: number;
  }[];
}

export interface WorkoutHistoryDay {
  date: string;
  sessions: WorkoutHistorySession[];
  totalVolumeLbs: number;
  estimatedCalories: number;
}

export interface WorkoutHistoryStats {
  totalWorkouts: number;
  weeklyGoal: number;
  weeklyCompleted: number;
  currentStreak: number;
}

export interface WorkoutHistoryResponse {
  days: WorkoutHistoryDay[];
  stats: WorkoutHistoryStats;
}

export interface ActiveSessionResponse {
  session: WorkoutSession | null;
  autoEndedSession?: WorkoutSession | null;
}

export interface Exercise {
  id: string;
  name: string;
  primaryMuscleGroup: MuscleGroup | string;
  equipment: string;
  category?: string;
  gifUrl?: string;
  isCustom?: boolean;
  createdBy?: string;
}

export interface ExerciseDetails extends Exercise {
  instructions: string[];
  level?: string;
  force?: string;
  mechanic?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
}

export interface CustomExercise {
  id: string;
  userId: string;
  name: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups?: string[];
  equipment?: string;
  notes?: string;
  imageUrl?: string;
  scope: 'personal' | 'squad';
  squadId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateCustomExerciseInput {
  name: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups?: string[];
  equipment?: string;
  notes?: string;
  imageUrl?: string;
  scope?: 'personal' | 'squad';
  squadId?: string;
}

export interface UpdateCustomExerciseInput {
  name?: string;
  primaryMuscleGroup?: string;
  secondaryMuscleGroups?: string[];
  equipment?: string;
  notes?: string;
  imageUrl?: string;
}

export type TemplateExerciseForm = {
  formId: string;
  exercise: Exercise;
  sets: number;
  reps: number;
  restSeconds?: number;
  weight?: string;
  incline?: string;
  distance?: string;
  durationMinutes?: string;
  notes?: string;
};
