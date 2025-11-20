import { useQuery } from "@tanstack/react-query";
import { getSquadFeed, SquadFeedResponse } from "../api/social";

export const squadFeedKey = ["social", "squad-feed"];

export const useSquadFeed = () =>
  useQuery<SquadFeedResponse>({
    queryKey: squadFeedKey,
    queryFn: getSquadFeed,
    refetchInterval: 30000,
    retry: false,
    initialData: { activeStatuses: [], recentShares: [] },
  });
