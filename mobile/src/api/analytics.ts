import { apiClient } from "./client";
import { FatigueResult, TrainingRecommendation } from "../types/analytics";
import { ProgressionData } from "../components/ProgressionSuggestion";

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

export const fetchProgressionSuggestions = async (
  templateId: string
): Promise<ProgressionData> => {
  const res = await apiClient.get<{ data: ProgressionData }>(
    `/analytics/progression/${templateId}`
  );
  return res.data.data;
};

export const applyProgressionSuggestions = async (
  templateId: string,
  exerciseIds?: string[]
): Promise<{ updated: number }> => {
  const res = await apiClient.post<{ data: { updated: number } }>(
    `/analytics/progression/${templateId}/apply`,
    { exerciseIds }
  );
  return res.data.data;
};
