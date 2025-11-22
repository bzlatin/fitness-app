import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WorkoutTemplate, Exercise } from "../types/workouts";
import { fetchExercisesByIds } from "../api/exercises";
import {
  calculateMuscleGroupDistribution,
  MuscleGroupDistribution,
} from "../utils/muscleGroupCalculations";

/**
 * Hook to calculate muscle group distribution for a workout template
 * Fetches exercise data and calculates the distribution based on sets
 */
export const useMuscleGroupDistribution = (
  template: WorkoutTemplate | null | undefined
) => {
  // Get unique exercise IDs from the template
  const exerciseIds = useMemo(() => {
    if (!template?.exercises) return [];
    return Array.from(new Set(template.exercises.map((ex) => ex.exerciseId)));
  }, [template]);

  // Fetch exercises by their IDs using the batch endpoint
  const exerciseQueries = useQuery({
    queryKey: ["exercises", "batch", exerciseIds.join(",")],
    queryFn: async () => {
      const exercises = await fetchExercisesByIds(exerciseIds);
      const exerciseMap = new Map<string, Exercise>();
      exercises.forEach((ex) => {
        exerciseMap.set(ex.id, ex);
      });
      return exerciseMap;
    },
    enabled: exerciseIds.length > 0,
    staleTime: 1000 * 60 * 10, // 10 minutes - exercises don't change often
  });

  // Calculate distribution
  const distribution = useMemo<MuscleGroupDistribution[]>(() => {
    if (!template || !exerciseQueries.data) return [];
    return calculateMuscleGroupDistribution(template, exerciseQueries.data);
  }, [template, exerciseQueries.data]);

  return {
    distribution,
    isLoading: exerciseQueries.isLoading,
    isError: exerciseQueries.isError,
  };
};
