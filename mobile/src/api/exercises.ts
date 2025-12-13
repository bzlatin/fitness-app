import { apiClient } from "./client";
import {
  Exercise,
  CustomExercise,
  CreateCustomExerciseInput,
  UpdateCustomExerciseInput,
} from "../types/workouts";

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

// ==================== CUSTOM EXERCISES ====================

/**
 * Search both library and custom exercises
 */
export const searchAllExercises = async ({
  query,
  muscleGroup,
}: SearchExercisesParams) => {
  const res = await apiClient.get<{
    library: Exercise[];
    custom: Exercise[];
    total: number;
  }>("/exercises/search-all", {
    params: { query, muscleGroup },
  });
  return res.data;
};

/**
 * Get all custom exercises for the authenticated user
 */
export const getCustomExercises = async () => {
  const res = await apiClient.get<CustomExercise[]>("/exercises/custom");
  return res.data;
};

/**
 * Create a new custom exercise
 */
export const createCustomExercise = async (input: CreateCustomExerciseInput) => {
  const res = await apiClient.post<CustomExercise>("/exercises/custom", input);
  return res.data;
};

/**
 * Update a custom exercise
 */
export const updateCustomExercise = async (
  id: string,
  input: UpdateCustomExerciseInput
) => {
  const res = await apiClient.patch<CustomExercise>(`/exercises/custom/${id}`, input);
  return res.data;
};

/**
 * Delete a custom exercise (soft delete)
 */
export const deleteCustomExercise = async (id: string) => {
  await apiClient.delete(`/exercises/custom/${id}`);
};

/**
 * Upload image for a custom exercise
 */
export const uploadCustomExerciseImage = async (id: string, imageUri: string) => {
  // Create form data
  const formData = new FormData();

  // Extract filename from URI
  const filename = imageUri.split('/').pop() || 'image.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  formData.append('image', {
    uri: imageUri,
    name: filename,
    type,
  } as any);

  // Don't set Content-Type header - let axios/fetch set it with the boundary
  const res = await apiClient.post<{
    imageUrl: string;
    thumbnailUrl?: string;
  }>(`/exercises/custom/${id}/upload-image`, formData);

  return res.data;
};
