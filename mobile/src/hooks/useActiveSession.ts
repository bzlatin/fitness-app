import { useQuery } from "@tanstack/react-query";
import { fetchActiveSession } from "../api/sessions";

export const useActiveSession = () => {
  return useQuery({
    queryKey: ["activeSession"],
    queryFn: fetchActiveSession,
    staleTime: 1000 * 30, // 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
