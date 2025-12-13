import { apiClient } from "./client";
import { WorkoutTemplate } from "../types/workouts";

export type TemplateShareLink = {
  shareCode: string;
  webUrl: string;
  deepLinkUrl: string;
  createdAt?: string;
  expiresAt?: string | null;
  isRevoked?: boolean;
};

export type SharedTemplatePreview = {
  shareCode: string;
  webUrl: string;
  deepLinkUrl: string;
  expiresAt?: string | null;
  template: WorkoutTemplate;
  creator: {
    handle: string | null;
    name: string | null;
    avatarUrl: string | null;
  };
  stats: {
    viewsCount: number;
    copiesCount: number;
  };
};

export type CopySharedTemplateResponse = {
  template: WorkoutTemplate;
  wasAlreadyCopied: boolean;
};

export type TemplateShareStats = {
  shareCode: string;
  webUrl: string;
  deepLinkUrl: string;
  createdAt: string;
  expiresAt: string | null;
  isRevoked: boolean;
  stats: {
    viewsCount: number;
    copiesCount: number;
    signupsCount: number;
    copyRate: number;
    signupRate: number;
  };
};

export const fetchTemplates = async () => {
  const res = await apiClient.get<WorkoutTemplate[]>("/templates");
  return res.data;
};

export const fetchTemplate = async (id: string) => {
  const res = await apiClient.get<WorkoutTemplate>(`/templates/${id}`);
  return res.data;
};

export const createTemplate = async (
  payload: Pick<WorkoutTemplate, "name" | "description" | "splitType"> & {
    exercises: {
      exerciseId: string;
      defaultSets: number;
      defaultReps: number;
      defaultWeight?: number;
      defaultRestSeconds?: number;
      notes?: string;
    }[];
  }
) => {
  const res = await apiClient.post<WorkoutTemplate>("/templates", payload);
  return res.data;
};

export const updateTemplate = async (
  id: string,
  payload: Partial<WorkoutTemplate> & {
    exercises?: {
      exerciseId: string;
      defaultSets: number;
      defaultReps: number;
      defaultWeight?: number;
      defaultRestSeconds?: number;
      notes?: string;
    }[];
  }
) => {
  const res = await apiClient.put<WorkoutTemplate>(`/templates/${id}`, payload);
  return res.data;
};

export const duplicateTemplate = async (id: string) => {
  const res = await apiClient.post<WorkoutTemplate>(`/templates/${id}/duplicate`);
  return res.data;
};

export const deleteTemplate = async (id: string) => {
  await apiClient.delete<void>(`/templates/${id}`);
};

export const createTemplateShare = async (templateId: string, expiresAt?: string | null) => {
  const res = await apiClient.post<TemplateShareLink>(`/templates/${templateId}/share`, {
    expiresAt: expiresAt ?? null,
  });
  return res.data;
};

export const revokeTemplateShare = async (templateId: string) => {
  await apiClient.delete<void>(`/templates/${templateId}/share`);
};

export const fetchTemplateShareStats = async (templateId: string) => {
  const res = await apiClient.get<TemplateShareStats>(`/templates/${templateId}/share/stats`);
  return res.data;
};

export const fetchSharedTemplatePreview = async (code: string) => {
  const res = await apiClient.get<SharedTemplatePreview>(`/templates/share/${code}`);
  return res.data;
};

export const copySharedTemplate = async (code: string) => {
  const res = await apiClient.post<CopySharedTemplateResponse>(`/templates/share/${code}/copy`);
  return res.data;
};
