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

export const fetchActiveSession = async () => {
  const res = await apiClient.get<{ session: WorkoutSession | null }>("/sessions/active/current");
  return res.data.session;
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

export const fetchWeeklyProgress = async () => {
  // Get start of current week (Monday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday (0) or other days
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() + diff);
  startOfWeek.setHours(0, 0, 0, 0);

  // Get end of week (Sunday)
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Fetch sessions for this week
  const res = await apiClient.get<WorkoutHistoryResponse>("/sessions/history/range", {
    params: {
      start: startOfWeek.toISOString(),
      end: endOfWeek.toISOString(),
    },
  });

  // Calculate workouts this week (completed sessions only)
  const workoutsThisWeek = res.data.days.reduce((count, day) => {
    const completedSessions = day.sessions.filter(
      (session) => session.finishedAt !== null
    );
    return count + completedSessions.length;
  }, 0);

  // Use the streak from stats if available
  const currentStreak = res.data.stats?.currentStreak || 0;

  return {
    workoutsThisWeek,
    currentStreak,
  };
};
