import { apiClient } from "./client";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export type FeedbackCategory =
  | "feature_request"
  | "bug_report"
  | "ui_ux_improvement"
  | "performance"
  | "social_features";

export type FeedbackImpact =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "must_have"
  | "nice_to_have";

export type FeedbackStatus =
  | "submitted"
  | "under_review"
  | "planned"
  | "in_progress"
  | "shipped"
  | "wont_fix"
  | "duplicate";

export type FeedbackItem = {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: FeedbackCategory;
  impact: FeedbackImpact;
  status: FeedbackStatus;
  voteCount: number;
  isHidden: boolean;
  autoHiddenAt: string | null;
  createdAt: string;
  updatedAt: string;
  statusUpdatedAt: string | null;
  statusUpdatedBy: string | null;
  user: {
    name: string;
    handle: string | null;
    avatarUrl: string | null;
  };
  userHasVoted: boolean;
  reportCount: number;
};

export type FeedbackListParams = {
  sort?: "trending" | "top" | "recent";
  status?: FeedbackStatus;
  category?: FeedbackCategory;
  showHidden?: boolean;
};

export type CreateFeedbackParams = {
  title: string;
  description: string;
  category: FeedbackCategory;
  impact: FeedbackImpact;
};

export type UpdateFeedbackStatusParams = {
  id: string;
  status: FeedbackStatus;
};

export type ReportFeedbackParams = {
  id: string;
  reason: string;
};

// API Functions

const getFeedbackItems = async (
  params: FeedbackListParams = {}
): Promise<{ items: FeedbackItem[] }> => {
  const { data } = await apiClient.get<{ items: FeedbackItem[] }>("feedback", {
    params: {
      sort: params.sort,
      status: params.status,
      category: params.category,
      showHidden: params.showHidden ? "true" : "false",
    },
  });
  return data;
};

const getNewShippedCount = async (): Promise<{ count: number }> => {
  const { data } = await apiClient.get<{ count: number }>("feedback/new-shipped-count");
  return data;
};

const createFeedback = async (
  params: CreateFeedbackParams
): Promise<{ item: FeedbackItem }> => {
  const { data } = await apiClient.post<{ item: FeedbackItem }>("feedback", params);
  return data;
};

const toggleVote = async (id: string): Promise<{ voted: boolean }> => {
  const { data } = await apiClient.post<{ voted: boolean }>(`feedback/${id}/vote`);
  return data;
};

const updateFeedbackStatus = async (
  params: UpdateFeedbackStatusParams
): Promise<{ item: FeedbackItem }> => {
  const { data } = await apiClient.put<{ item: FeedbackItem }>(
    `feedback/${params.id}/status`,
    { status: params.status }
  );
  return data;
};

const reportFeedback = async (
  params: ReportFeedbackParams
): Promise<{ success: boolean; message: string; reportCount: number }> => {
  const { data } = await apiClient.post<{
    success: boolean;
    message: string;
    reportCount: number;
  }>(`feedback/${params.id}/report`, { reason: params.reason });
  return data;
};

const checkAdminStatus = async (): Promise<{ isAdmin: boolean }> => {
  const { data } = await apiClient.get<{ isAdmin: boolean }>("feedback/admin-check");
  return data;
};

const deleteFeedback = async (id: string): Promise<{ success: boolean; message: string }> => {
  const { data } = await apiClient.delete<{ success: boolean; message: string }>(`feedback/${id}`);
  return data;
};

// React Query Hooks

export const useFeedbackItems = (
  params: FeedbackListParams = {}
) => {
  return useQuery({
    queryKey: ["feedback", "items", params],
    queryFn: () => getFeedbackItems(params),
  });
};

export const useNewShippedCount = () => {
  return useQuery({
    queryKey: ["feedback", "new-shipped-count"],
    queryFn: getNewShippedCount,
  });
};

export const useCreateFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFeedback,
    onSuccess: () => {
      // Invalidate all feedback queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["feedback", "items"] });
    },
  });
};

export const useToggleVote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleVote,
    onMutate: async (id: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["feedback", "items"] });

      // Snapshot the previous value
      const previousQueries = queryClient.getQueriesData({ queryKey: ["feedback", "items"] });

      // Optimistically update the cache
      queryClient.setQueriesData<{ items: FeedbackItem[] }>(
        { queryKey: ["feedback", "items"] },
        (old) => {
          if (!old) return old;

          return {
            items: old.items.map((item) =>
              item.id === id
                ? {
                    ...item,
                    userHasVoted: !item.userHasVoted,
                    voteCount: item.userHasVoted ? item.voteCount - 1 : item.voteCount + 1,
                  }
                : item
            ),
          };
        }
      );

      return { previousQueries };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ["feedback", "items"] });
    },
  });
};

export const useUpdateFeedbackStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateFeedbackStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback", "items"] });
    },
  });
};

export const useReportFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reportFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback", "items"] });
    },
  });
};

export const useAdminStatus = () => {
  return useQuery({
    queryKey: ["feedback", "admin-check"],
    queryFn: checkAdminStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes - admin status doesn't change often
  });
};

export const useDeleteFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback", "items"] });
    },
  });
};

// Helper function to get category display name
export const getCategoryDisplayName = (category: FeedbackCategory): string => {
  switch (category) {
    case "feature_request":
      return "Feature Request";
    case "bug_report":
      return "Bug Report";
    case "ui_ux_improvement":
      return "UI/UX Improvement";
    case "performance":
      return "Performance";
    case "social_features":
      return "Social Features";
    default:
      return category;
  }
};

// Helper function to get impact display name
export const getImpactDisplayName = (impact: FeedbackImpact): string => {
  switch (impact) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "must_have":
      return "Must Have";
    case "nice_to_have":
      return "Nice to Have";
    default:
      return impact;
  }
};

// Helper function to get status display info
export const getStatusInfo = (
  status: FeedbackStatus
): { label: string; color: string; bgColor: string } => {
  switch (status) {
    case "submitted":
      return { label: "Submitted", color: "#94A3B8", bgColor: "#1E293B" };
    case "under_review":
      return { label: "Under Review", color: "#38BDF8", bgColor: "#0C4A6E" };
    case "planned":
      return { label: "Planned", color: "#A78BFA", bgColor: "#4C1D95" };
    case "in_progress":
      return { label: "In Progress", color: "#FBBF24", bgColor: "#78350F" };
    case "shipped":
      return { label: "Shipped", color: "#22C55E", bgColor: "#14532D" };
    case "wont_fix":
      return { label: "Won't Fix", color: "#EF4444", bgColor: "#7F1D1D" };
    case "duplicate":
      return { label: "Duplicate", color: "#9CA3AF", bgColor: "#1F2937" };
    default:
      return { label: status, color: "#94A3B8", bgColor: "#1E293B" };
  }
};
