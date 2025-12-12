import { useQuery } from "@tanstack/react-query";
import { fetchActiveSession } from "../api/sessions";
import { ActiveSessionResponse } from "../types/workouts";

export const useActiveSession = () => {
  return useQuery<ActiveSessionResponse>({
    queryKey: ["activeSession"],
    queryFn: fetchActiveSession,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
