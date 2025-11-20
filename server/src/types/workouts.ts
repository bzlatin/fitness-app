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

export interface Exercise {
  id: string;
  name: string;
  primaryMuscleGroup: MuscleGroup;
  equipment: EquipmentType;
}

export interface WorkoutTemplateExercise {
  id: string;
  exerciseId: string;
  orderIndex: number;
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds?: number;
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
    | "custom";
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
  setIndex: number;
  targetReps?: number;
  targetWeight?: number;
  actualReps?: number;
  actualWeight?: number;
  rpe?: number;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  templateId?: string;
  startedAt: string;
  finishedAt?: string;
  sets: WorkoutSet[];
}

export const DEMO_USER_ID = "demo-user";
