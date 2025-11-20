import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTemplate,
  duplicateTemplate,
  fetchTemplates,
  updateTemplate,
} from "../api/templates";
import { WorkoutTemplate } from "../types/workouts";

export const templatesKey = ["templates"];

export const useWorkoutTemplates = () =>
  useQuery<WorkoutTemplate[]>({
    queryKey: templatesKey,
    queryFn: fetchTemplates,
  });

export const useCreateTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => client.invalidateQueries({ queryKey: templatesKey }),
  });
};

export const useUpdateTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<WorkoutTemplate> }) =>
      updateTemplate(id, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: templatesKey }),
  });
};

export const useDuplicateTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: () => client.invalidateQueries({ queryKey: templatesKey }),
  });
};
