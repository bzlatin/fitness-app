import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createManualSession,
  deleteSession,
  duplicateSession,
  fetchHistoryRange,
  updateSession,
} from "../api/sessions";
import { WorkoutHistoryResponse, WorkoutSet } from "../types/workouts";

const historyKey = (startIso: string, endIso: string, tzOffsetMinutes: number) => [
  "history",
  startIso,
  endIso,
  tzOffsetMinutes,
];

export const useWorkoutHistory = (start: Date, end: Date) => {
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const tzOffsetMinutes = new Date().getTimezoneOffset();
  return useQuery<WorkoutHistoryResponse>({
    queryKey: historyKey(startIso, endIso, tzOffsetMinutes),
    queryFn: () => fetchHistoryRange(startIso, endIso, tzOffsetMinutes),
    select: (data) => {
      const uniqueSessionIds = new Set<string>();
      // CRITICAL: Only show sessions that have been completed (finishedAt is set)
      // This prevents in-progress sessions from appearing in history before they're done
      const filteredDays = data.days
        .map((day) => {
          const uniqueSessions = day.sessions.filter((session) => {
            // Must have finishedAt AND be unique
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
        queryKey: historyKey(
          rangeStart.toISOString(),
          rangeEnd.toISOString(),
          new Date().getTimezoneOffset()
        ),
      }),
  });
};

export const useDuplicateSession = (rangeStart: Date, rangeEnd: Date) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: duplicateSession,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: historyKey(
          rangeStart.toISOString(),
          rangeEnd.toISOString(),
          new Date().getTimezoneOffset()
        ),
      }),
  });
};

export const useDeleteSession = (rangeStart: Date, rangeEnd: Date) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteSession,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: historyKey(
          rangeStart.toISOString(),
          rangeEnd.toISOString(),
          new Date().getTimezoneOffset()
        ),
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
        queryKey: historyKey(
          rangeStart.toISOString(),
          rangeEnd.toISOString(),
          new Date().getTimezoneOffset()
        ),
      }),
  });
};
