import { Exercise, WorkoutTemplate, WorkoutTemplateExercise } from "../types/workouts";

export type MuscleGroupDistribution = {
  muscleGroup: string;
  setCount: number;
  percentage: number;
};

/**
 * Calculate muscle group distribution from a workout template
 * @param template - The workout template
 * @param exercisesMap - Map of exerciseId to Exercise data
 * @returns Array of muscle groups with their set counts and percentages
 */
export const calculateMuscleGroupDistribution = (
  template: WorkoutTemplate,
  exercisesMap: Map<string, Exercise>
): MuscleGroupDistribution[] => {
  if (!template.exercises || template.exercises.length === 0) {
    return [];
  }

  // Count sets per muscle group
  const muscleGroupCounts = new Map<string, number>();
  let totalSets = 0;

  template.exercises.forEach((templateExercise) => {
    const exercise = exercisesMap.get(templateExercise.exerciseId);
    const muscleGroup =
      templateExercise.primaryMuscleGroup ??
      (exercise
        ? exercise.category?.toLowerCase() === "cardio"
          ? "cardio"
          : exercise.primaryMuscleGroup
        : undefined);
    if (!muscleGroup) return;

    const sets = templateExercise.defaultSets;

    muscleGroupCounts.set(
      muscleGroup,
      (muscleGroupCounts.get(muscleGroup) || 0) + sets
    );
    totalSets += sets;
  });

  // Convert to array with percentages
  const distribution: MuscleGroupDistribution[] = Array.from(
    muscleGroupCounts.entries()
  ).map(([muscleGroup, setCount]) => ({
    muscleGroup,
    setCount,
    percentage: totalSets > 0 ? Math.round((setCount / totalSets) * 100) : 0,
  }));

  // Sort by set count (descending)
  distribution.sort((a, b) => b.setCount - a.setCount);

  return distribution;
};

/**
 * Format muscle group name for display
 * @param muscleGroup - The raw muscle group string
 * @returns Formatted muscle group name
 */
export const formatMuscleGroup = (muscleGroup: string): string => {
  // Handle special cases
  const specialCases: Record<string, string> = {
    abdominals: "Abs",
    lats: "Lats",
    traps: "Traps",
    calves: "Calves",
    glutes: "Glutes",
    quadriceps: "Quads",
    hamstrings: "Hamstrings",
    cardio: "Cardio",
  };

  if (specialCases[muscleGroup.toLowerCase()]) {
    return specialCases[muscleGroup.toLowerCase()];
  }

  // Default: capitalize first letter of each word
  return muscleGroup
    .split(/[\s_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

/**
 * Get the top N muscle groups by set count
 * @param distribution - The full muscle group distribution
 * @param count - Number of top muscle groups to return
 * @returns Top N muscle groups
 */
export const getTopMuscleGroups = (
  distribution: MuscleGroupDistribution[],
  count: number = 3
): MuscleGroupDistribution[] => {
  return distribution.slice(0, count);
};
