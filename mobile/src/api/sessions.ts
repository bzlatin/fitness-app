import { apiClient } from "./client";
import { WorkoutSession } from "../types/workouts";

export const startSessionFromTemplate = async (templateId: string) => {
  const res = await apiClient.post<WorkoutSession>(
    `/sessions/from-template/${templateId}`
  );
  return res.data;
};

export const fetchSession = async (id: string) => {
  const res = await apiClient.get<WorkoutSession>(`/sessions/${id}`);
  return res.data;
};

export const completeSession = async (id: string, sets: WorkoutSession["sets"]) => {
  const res = await apiClient.patch<WorkoutSession>(`/sessions/${id}`, {
    sets,
    finishedAt: new Date().toISOString(),
  });
  return res.data;
};
