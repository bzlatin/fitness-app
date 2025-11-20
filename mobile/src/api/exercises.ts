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
