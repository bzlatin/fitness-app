import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createManualSession,
  deleteSession,
  duplicateSession,
  fetchHistoryRange,
  updateSession,
} from "../api/sessions";
import { WorkoutHistoryResponse, WorkoutSet } from "../types/workouts";

const historyKey = (startIso: string, endIso: string) => ["history", startIso, endIso];

export const useWorkoutHistory = (start: Date, end: Date) => {
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  return useQuery<WorkoutHistoryResponse>({
    queryKey: historyKey(startIso, endIso),
    queryFn: () => fetchHistoryRange(startIso, endIso),
    select: (data) => {
      const uniqueSessionIds = new Set<string>();
      const filteredDays = data.days
        .map((day) => {
          const uniqueSessions = day.sessions.filter((session) => {
            if (session.finishedAt && !uniqueSessionIds.has(session.id)) {
              uniqueSessionIds.add(session.id);
              return true;
            }
            return false;
          });
          return { ...day, sessions: uniqueSessions };
        })
        .filter((day) => day.sessions.length > 0);

      const newStats = { ...data.stats, totalWorkouts: uniqueSessionIds.size };

      return {
        days: filteredDays,
        stats: newStats,
      };
    },
  });
};

export const useCreateManualSession = (rangeStart: Date, rangeEnd: Date) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createManualSession,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: historyKey(rangeStart.toISOString(), rangeEnd.toISOString()),
      }),
  });
};

export const useDuplicateSession = (rangeStart: Date, rangeEnd: Date) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: duplicateSession,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: historyKey(rangeStart.toISOString(), rangeEnd.toISOString()),
      }),
  });
};

export const useDeleteSession = (rangeStart: Date, rangeEnd: Date) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteSession,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: historyKey(rangeStart.toISOString(), rangeEnd.toISOString()),
      }),
  });
};

export const useUpdateSession = (rangeStart: Date, rangeEnd: Date) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{ startedAt: string; finishedAt: string; sets: WorkoutSet[] }>;
    }) => updateSession(id, payload),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: historyKey(rangeStart.toISOString(), rangeEnd.toISOString()),
      }),
  });
};
