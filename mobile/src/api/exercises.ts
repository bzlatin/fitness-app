import { apiClient } from "./client";
import { Exercise } from "../types/workouts";

export type SearchExercisesParams = {
  query?: string;
  muscleGroup?: string;
};

export const searchExercises = async ({
  query,
  muscleGroup,
}: SearchExercisesParams) => {
  const res = await apiClient.get<Exercise[]>("/exercises/search", {
    params: { query, muscleGroup },
  });
  return res.data;
};

export const fetchExercisesByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const res = await apiClient.get<Exercise[]>("/exercises/batch", {
    params: { ids: ids.join(",") },
  });
  return res.data;
};
