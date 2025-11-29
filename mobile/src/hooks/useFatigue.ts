import { useQuery } from "@tanstack/react-query";
import { fetchFatigue, fetchRecommendations } from "../api/analytics";
import { FatigueResult, TrainingRecommendation } from "../types/analytics";

export const fatigueQueryKey = ["analytics", "fatigue"];
export const recommendationsQueryKey = ["analytics", "recommendations"];

export const useFatigue = (enabled: boolean = true) =>
  useQuery<FatigueResult>({
    queryKey: fatigueQueryKey,
    queryFn: fetchFatigue,
    enabled,
  });

export const useTrainingRecommendations = (enabled: boolean) =>
  useQuery<TrainingRecommendation>({
    queryKey: recommendationsQueryKey,
    queryFn: fetchRecommendations,
    enabled,
  });
