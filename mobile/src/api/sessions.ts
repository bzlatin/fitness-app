import { apiClient } from "./client";
import {
  WorkoutHistoryResponse,
  WorkoutSession,
  WorkoutSet,
} from "../types/workouts";

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

export const updateSession = async (
  id: string,
  payload: Partial<WorkoutSession> & { sets?: WorkoutSet[] }
) => {
  const res = await apiClient.patch<WorkoutSession>(`/sessions/${id}`, payload);
  return res.data;
};

export const fetchHistoryRange = async (start: string, end: string) => {
  const res = await apiClient.get<WorkoutHistoryResponse>("/sessions/history/range", {
    params: { start, end },
  });
  return res.data;
};

export const createManualSession = async (payload: {
  startedAt: string;
  finishedAt?: string;
  templateName?: string;
  sets: Array<
    Pick<
      WorkoutSet,
      "exerciseId" | "actualReps" | "actualWeight" | "targetReps" | "targetWeight" | "setIndex" | "templateExerciseId"
    >
  >;
}) => {
  const res = await apiClient.post<WorkoutSession>("/sessions/manual", payload);
  return res.data;
};

export const duplicateSession = async (id: string) => {
  const res = await apiClient.post<WorkoutSession>(`/sessions/${id}/duplicate`);
  return res.data;
};

export const deleteSession = async (id: string) => {
  await apiClient.delete<void>(`/sessions/${id}`);
};
