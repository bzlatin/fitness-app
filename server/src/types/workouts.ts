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
  | "other";

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "other";

export type WorkoutSource = "manual" | "ai" | "apple_health";

export type SetDifficultyRating = "too_easy" | "just_right" | "too_hard";

export type CardioData = {
  type?: "LISS" | "HIIT" | "MIXED";
  duration?: number;
  notes?: string;
  timing?: "before" | "after" | "separate";
};

export interface Exercise {
  id: string;
  name: string;
  primaryMuscleGroup: MuscleGroup;
  equipment: EquipmentType;
  gifUrl?: string;
}

export interface WorkoutTemplateExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  exerciseName?: string;
  primaryMuscleGroup?: string;
  exerciseImageUrl?: string;
  equipment?: string;
  defaultSets: number;
  defaultReps: number;
  defaultRepsMin?: number;
  defaultRepsMax?: number;
  defaultRestSeconds?: number;
  defaultWeight?: number;
  defaultIncline?: number;
  defaultDistance?: number;
  defaultDurationMinutes?: number;
  notes?: string;
}

export interface WorkoutTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  splitType?:
    | "push"
    | "pull"
    | "legs"
    | "upper"
    | "lower"
    | "full_body"
    | "chest_back"
    | "arms_shoulders"
    | "custom";
  isFavorite: boolean;
  sharingDisabled?: boolean;
  exercises: WorkoutTemplateExercise[];
  createdAt: string;
  updatedAt: string;
}

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
  targetRepsMin?: number;
  targetRepsMax?: number;
  targetWeight?: number;
  actualReps?: number;
  actualWeight?: number;
  rir?: number;
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
  userId: string;
  templateId?: string;
  templateName?: string;
  source?: WorkoutSource;
  startedAt: string;
  finishedAt?: string;
  endedReason?: string;
  autoEndedAt?: string;
  durationSeconds?: number;
  totalEnergyBurned?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  importMetadata?: Record<string, unknown>;
  cardioData?: CardioData;
  sets: WorkoutSet[];
}

export const DEMO_USER_ID = "demo-user";
