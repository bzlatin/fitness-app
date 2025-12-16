import { useQuery } from "@tanstack/react-query";
import { fetchUpNextRecommendation } from "../api/analytics";
import { UpNextRecommendation } from "../types/analytics";

export const upNextQueryKey = ["analytics", "up-next"];

/**
 * Hook to fetch intelligent "Up Next" workout recommendation
 *
 * Returns:
 * - recommendedSplit: The next split type in the user's rotation
 * - matchedTemplate: Best matching saved template (if any)
 * - alternateTemplates: Other templates that could work
 * - fatigueStatus: Recovery status for the recommended split
 * - canGenerateAI: Whether user can generate with AI (Pro only)
 * - reasoning: Human-readable explanation
 */
export const useUpNextRecommendation = (enabled: boolean = true) =>
  useQuery<UpNextRecommendation>({
    queryKey: upNextQueryKey,
    queryFn: fetchUpNextRecommendation,
    enabled,
  });
