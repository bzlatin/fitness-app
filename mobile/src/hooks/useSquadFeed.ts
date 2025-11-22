import { UseQueryOptions, useQuery } from "@tanstack/react-query";
import { getSquadFeed, SquadFeedResponse } from "../api/social";

export const squadFeedKey = ["social", "squad-feed"];

export const useSquadFeed = (
  squadId?: string,
  options?: UseQueryOptions<SquadFeedResponse, unknown>
) =>
  useQuery<SquadFeedResponse>({
    queryKey: squadId ? [...squadFeedKey, squadId] : squadFeedKey,
    queryFn: () => getSquadFeed(squadId),
    refetchInterval: 30000,
    retry: false,
    ...options,
  });
