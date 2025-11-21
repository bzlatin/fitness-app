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
