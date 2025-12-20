import { WorkoutTemplate } from '../types/workouts';

const DEFAULT_REST_SECONDS = 90;
const ESTIMATED_SET_SECONDS = 45;

export const estimateTemplateDurationMinutes = (template: WorkoutTemplate) => {
  if (!template.exercises.length) return 0;
  const totalSeconds = template.exercises.reduce((total, exercise) => {
    if (exercise.defaultDurationMinutes) {
      return total + exercise.defaultDurationMinutes * 60;
    }
    const sets = Math.max(1, exercise.defaultSets ?? 1);
    const restSeconds = exercise.defaultRestSeconds ?? DEFAULT_REST_SECONDS;
    const workSeconds = sets * ESTIMATED_SET_SECONDS;
    const rest = sets > 1 ? (sets - 1) * restSeconds : 0;
    return total + workSeconds + rest;
  }, 0);

  return Math.max(1, Math.round(totalSeconds / 60));
};
