import { Exercise } from "../types/workouts";

const cardioKeywords = [
  "treadmill",
  "jog",
  "run",
  "walk",
  "rowing",
  "rower",
  "bike",
  "cycling",
  "elliptical",
  "ski",
  "stair",
  "rider",
];

export const isCardioExercise = (exercise: Exercise) => {
  const category = exercise.category?.toLowerCase();
  if (category && (category.includes("cardio") || category.includes("aerobic"))) {
    return true;
  }

  const name = exercise.name.toLowerCase();
  return cardioKeywords.some((keyword) => name.includes(keyword));
};
