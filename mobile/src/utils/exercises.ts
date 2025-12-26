import { Exercise } from "../types/workouts";

const cardioKeywords = [
  "treadmill",
  "jogging",
  "running",
  "walking",
  "rowing",
  "rower",
  "bike",
  "bicycle",
  "cycling",
  "elliptical",
  "stairmaster",
  "stair climber",
  "stepper",
  "ski",
  "air bike",
  "assault bike",
  "jump rope",
  "jumping rope",
  "swimming",
  "swim",
];

export const isCardioExerciseName = (name?: string) => {
  if (!name) return false;
  const normalized = name.toLowerCase();
  return cardioKeywords.some((keyword) => normalized.includes(keyword));
};

export const isCardioExercise = (exercise: Exercise) => {
  const category = exercise.category?.toLowerCase();
  const primaryMuscleGroup =
    typeof exercise.primaryMuscleGroup === "string"
      ? exercise.primaryMuscleGroup.toLowerCase()
      : undefined;

  if (category) {
    if (category.includes("cardio") || category.includes("aerobic")) {
      return true;
    }
    return primaryMuscleGroup?.includes("cardio") ?? false;
  }

  if (primaryMuscleGroup?.includes("cardio")) {
    return true;
  }

  return isCardioExerciseName(exercise.name);
};
