import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  fetchTemplates,
  updateTemplate,
  templateDetailQueryKey,
  templatesQueryKey,
} from "../api/templates";
import { WorkoutTemplate } from "../types/workouts";

export const templatesKey = templatesQueryKey;
export { templateDetailQueryKey };

export const useWorkoutTemplates = () =>
  useQuery<WorkoutTemplate[]>({
    queryKey: templatesQueryKey,
    queryFn: fetchTemplates,
  });

export const useCreateTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => client.invalidateQueries({ queryKey: templatesQueryKey }),
  });
};

export const useUpdateTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<WorkoutTemplate> }) =>
      updateTemplate(id, payload),
    onSuccess: (_data, variables) => {
      client.invalidateQueries({ queryKey: templatesQueryKey });
      if (variables?.id) {
        client.invalidateQueries({ queryKey: templateDetailQueryKey(variables.id) });
      }
    },
  });
};

export const useDuplicateTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: duplicateTemplate,
    onSuccess: () => client.invalidateQueries({ queryKey: templatesQueryKey }),
  });
};

export const useDeleteTemplate = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => client.invalidateQueries({ queryKey: templatesQueryKey }),
  });
};
