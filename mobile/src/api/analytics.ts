import { apiClient } from "./client";
import { FatigueResult, TrainingRecommendation } from "../types/analytics";

export const fetchFatigue = async (): Promise<FatigueResult> => {
  const res = await apiClient.get<{ data: FatigueResult }>("/analytics/fatigue");
  return res.data.data;
};

export const fetchRecommendations = async (): Promise<TrainingRecommendation> => {
  const res = await apiClient.get<{ data: TrainingRecommendation }>(
    "/analytics/recommendations"
  );
  return res.data.data;
};
