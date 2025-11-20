export type SplitType =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "custom";

export interface WorkoutTemplateExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
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
  setIndex: number;
  targetReps?: number;
  targetWeight?: number;
  targetRestSeconds?: number;
  actualReps?: number;
  actualWeight?: number;
  rpe?: number;
}

export interface WorkoutSession {
  id: string;
  templateId?: string;
  templateName?: string;
  startedAt: string;
  finishedAt?: string;
  sets: WorkoutSet[];
}

export interface Exercise {
  id: string;
  name: string;
  primaryMuscleGroup: string;
  equipment: string;
  category?: string;
  gifUrl?: string;
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
