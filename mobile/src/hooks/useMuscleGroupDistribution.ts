import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { WorkoutTemplate, Exercise } from "../types/workouts";
import { fetchExercisesByIds } from "../api/exercises";
import {
  calculateMuscleGroupDistribution,
  MuscleGroupDistribution,
} from "../utils/muscleGroupCalculations";

const formatExerciseName = (id: string, fallbackName?: string) =>
  fallbackName ||
  id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

/**
 * Hook to calculate muscle group distribution for a workout template
 * Fetches exercise data and calculates the distribution based on sets
 */
export const useMuscleGroupDistribution = (
  template: WorkoutTemplate | null | undefined
) => {
  const hasEmbeddedMuscles = useMemo(
    () =>
      Boolean(
        template?.exercises?.length &&
          template.exercises.every((ex) => ex.primaryMuscleGroup)
      ),
    [template?.id, template?.exercises]
  );

  // Get unique exercise IDs from the template
  const exerciseIds = useMemo(() => {
    if (!template?.exercises) return [];
    return Array.from(
      new Set(
        template.exercises
          .map((ex) => ex.exerciseId)
          .filter((id): id is string => Boolean(id))
      )
    ).sort();
  }, [template?.id, template?.exercises]);

  // Fetch exercises by their IDs using the batch endpoint
  const embeddedExerciseMap = useMemo(() => {
    if (!template || !hasEmbeddedMuscles) return null;
    const map = new Map<string, Exercise>();
    template.exercises.forEach((ex) => {
      if (!ex.primaryMuscleGroup) return;
      map.set(ex.exerciseId, {
        id: ex.exerciseId,
        name: formatExerciseName(ex.exerciseId, ex.exerciseName),
        primaryMuscleGroup: ex.primaryMuscleGroup,
        equipment: "bodyweight",
        gifUrl: ex.exerciseImageUrl,
      });
    });
    return map;
  }, [hasEmbeddedMuscles, template]);

  const exerciseQueries = useQuery({
    queryKey: ["exercises", "batch", template?.id ?? "none", exerciseIds] as const,
    queryFn: async ({ queryKey }) => {
      const ids = queryKey[3] as string[];
      if (!ids || ids.length === 0) {
        return new Map<string, Exercise>();
      }
      const exercises = await fetchExercisesByIds(ids);
      const exerciseMap = new Map<string, Exercise>();
      exercises.forEach((ex) => {
        exerciseMap.set(ex.id, ex);
      });
      return exerciseMap;
    },
    enabled: Boolean(template && exerciseIds.length > 0 && !embeddedExerciseMap),
    staleTime: 1000 * 60 * 10, // 10 minutes - exercises don't change often
  });

  // Calculate distribution
  const distribution = useMemo<MuscleGroupDistribution[]>(() => {
    if (!template) return [];
    const sourceExercises = embeddedExerciseMap ?? exerciseQueries.data;
    if (!sourceExercises) return [];
    return calculateMuscleGroupDistribution(template, sourceExercises);
  }, [template, embeddedExerciseMap, exerciseQueries.data]);

  return {
    distribution,
    isLoading: !embeddedExerciseMap && exerciseQueries.isLoading,
    isError: !embeddedExerciseMap && exerciseQueries.isError,
    refetch: exerciseQueries.refetch,
  };
};
