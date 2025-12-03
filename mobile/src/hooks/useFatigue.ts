import { useQuery } from "@tanstack/react-query";
import { fetchFatigue, fetchRecommendations } from "../api/analytics";
import type { ApiClientError } from "../api/client";
import { FatigueResult, TrainingRecommendation } from "../types/analytics";

export const fatigueQueryKey = ["analytics", "fatigue"];
export const recommendationsQueryKey = ["analytics", "recommendations"];

export const useFatigue = (enabled: boolean = true) =>
  useQuery<FatigueResult, ApiClientError>({
    queryKey: fatigueQueryKey,
    queryFn: fetchFatigue,
    enabled,
  });

export const useTrainingRecommendations = (enabled: boolean) =>
  useQuery<TrainingRecommendation, ApiClientError>({
    queryKey: recommendationsQueryKey,
    queryFn: fetchRecommendations,
    enabled,
  });
