import { apiClient } from "./client";
import { WorkoutTemplate } from "../types/workouts";

export const fetchTemplates = async () => {
  const res = await apiClient.get<WorkoutTemplate[]>("/templates");
  return res.data;
};

export const fetchTemplate = async (id: string) => {
  const res = await apiClient.get<WorkoutTemplate>(`/templates/${id}`);
  return res.data;
};

export const createTemplate = async (
  payload: Pick<WorkoutTemplate, "name" | "description" | "splitType"> & {
    exercises: {
      exerciseId: string;
      defaultSets: number;
      defaultReps: number;
      defaultRestSeconds?: number;
      notes?: string;
    }[];
  }
) => {
  const res = await apiClient.post<WorkoutTemplate>("/templates", payload);
  return res.data;
};

export const updateTemplate = async (
  id: string,
  payload: Partial<WorkoutTemplate> & {
    exercises?: {
      exerciseId: string;
      defaultSets: number;
      defaultReps: number;
      defaultRestSeconds?: number;
      notes?: string;
    }[];
  }
) => {
  const res = await apiClient.put<WorkoutTemplate>(`/templates/${id}`, payload);
  return res.data;
};

export const duplicateTemplate = async (id: string) => {
  const res = await apiClient.post<WorkoutTemplate>(`/templates/${id}/duplicate`);
  return res.data;
};
