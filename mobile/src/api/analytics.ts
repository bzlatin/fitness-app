import { apiClient } from "./client";
import {
  FatigueResult,
  TrainingRecommendation,
  AdvancedAnalytics,
  WeeklyVolumeData,
  MuscleGroupSummary,
  PushPullBalance,
  VolumePR,
  FrequencyHeatmapData,
  RecapSlice,
} from "../types/analytics";
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

// Advanced Analytics API calls (Pro feature)
export const fetchAdvancedAnalytics = async (weeks: number = 12): Promise<AdvancedAnalytics> => {
  const res = await apiClient.get<{ data: AdvancedAnalytics }>(
    `/analytics/muscle-analytics?weeks=${weeks}`
  );
  return res.data.data;
};

export const fetchWeeklyVolume = async (weeks: number = 12): Promise<WeeklyVolumeData[]> => {
  const res = await apiClient.get<{ data: WeeklyVolumeData[] }>(
    `/analytics/weekly-volume?weeks=${weeks}`
  );
  return res.data.data;
};

export const fetchMuscleGroupSummaries = async (weeks: number = 12): Promise<MuscleGroupSummary[]> => {
  const res = await apiClient.get<{ data: MuscleGroupSummary[] }>(
    `/analytics/muscle-summaries?weeks=${weeks}`
  );
  return res.data.data;
};

export const fetchPushPullBalance = async (weeks: number = 12): Promise<PushPullBalance> => {
  const res = await apiClient.get<{ data: PushPullBalance }>(
    `/analytics/push-pull-balance?weeks=${weeks}`
  );
  return res.data.data;
};

export const fetchVolumePRs = async (weeks: number = 52): Promise<VolumePR[]> => {
  const res = await apiClient.get<{ data: VolumePR[] }>(
    `/analytics/volume-prs?weeks=${weeks}`
  );
  return res.data.data;
};

export const fetchFrequencyHeatmap = async (weeks: number = 12): Promise<FrequencyHeatmapData[]> => {
  const res = await apiClient.get<{ data: FrequencyHeatmapData[] }>(
    `/analytics/frequency-heatmap?weeks=${weeks}`
  );
  return res.data.data;
};

export const fetchRecap = async (): Promise<RecapSlice> => {
  const res = await apiClient.get<{ data: RecapSlice }>(`/analytics/recap`);
  return res.data.data;
};
