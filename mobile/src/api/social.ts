import { apiClient } from "./client";
import {
  ActiveWorkoutStatus,
  SocialProfile,
  Visibility,
  WorkoutSummaryShare,
  SocialUserSummary,
} from "../types/social";
import { User, UserProfile } from "../types/user";

export type SquadFeedResponse = {
  activeStatuses: ActiveWorkoutStatus[];
  recentShares: WorkoutSummaryShare[];
};

const isNotFound = (err: unknown) =>
  err instanceof Error && err.message.includes("404");

const fallbackUser: SocialUserSummary = {
  id: "unknown",
  name: "Athlete",
};

export const getSquadFeed = async (): Promise<SquadFeedResponse> => {
  try {
    const res = await apiClient.get<SquadFeedResponse>("/social/squad-feed");
    return res.data ?? { activeStatuses: [], recentShares: [] };
  } catch (err) {
    if (isNotFound(err)) {
      return { activeStatuses: [], recentShares: [] };
    }
    throw err;
  }
};

export const setActiveWorkoutStatus = async (payload: {
  sessionId: string;
  templateId?: string;
  templateName?: string;
  visibility: Visibility;
}) => {
  try {
    const res = await apiClient.post<ActiveWorkoutStatus>("/social/active-status", payload);
    return res.data;
  } catch (err) {
    if (isNotFound(err)) {
      return {
        id: payload.sessionId,
        user: fallbackUser,
        isActive: true,
        startedAt: new Date().toISOString(),
        elapsedSeconds: 0,
        visibility: payload.visibility,
        templateId: payload.templateId,
        templateName: payload.templateName,
      } satisfies ActiveWorkoutStatus;
    }
    throw err;
  }
};

export const clearActiveWorkoutStatus = async (sessionId: string) => {
  try {
    await apiClient.delete<void>(`/social/active-status/${sessionId}`);
  } catch (err) {
    if (isNotFound(err)) return;
    throw err;
  }
};

export const shareWorkoutSummary = async (payload: {
  sessionId: string;
  visibility: Visibility;
  progressPhotoUri?: string;
}) => {
  const { progressPhotoUri, ...rest } = payload;
  try {
    const res = await apiClient.post<WorkoutSummaryShare>("/social/share", {
      ...rest,
      progressPhotoUrl: progressPhotoUri,
    });
    return res.data;
  } catch (err) {
    if (isNotFound(err)) {
      return {
        id: payload.sessionId,
        user: fallbackUser,
        sessionId: payload.sessionId,
        templateName: undefined,
        totalSets: 0,
        createdAt: new Date().toISOString(),
        visibility: payload.visibility,
        progressPhotoUrl: progressPhotoUri,
      } satisfies WorkoutSummaryShare;
    }
    throw err;
  }
};

export const getUserProfile = async (userId: string) => {
  try {
    const res = await apiClient.get<SocialProfile>(`/social/profile/${userId}`);
    return res.data;
  } catch (err) {
    if (isNotFound(err)) {
      return {
        id: userId,
        name: "Athlete",
        handle: "you",
        followersCount: 0,
        followingCount: 0,
        friendsCount: 0,
        workoutsCompleted: 0,
        currentStreakDays: 0,
        isFollowing: false,
        gymName: null,
        gymVisibility: "hidden",
      } satisfies SocialProfile;
    }
    throw err;
  }
};

export const followUser = async (userId: string) => {
  try {
    await apiClient.post<void>("/social/follow", { userId });
  } catch (err) {
    if (isNotFound(err)) return;
    throw err;
  }
};

export const unfollowUser = async (userId: string) => {
  try {
    await apiClient.delete<void>(`/social/follow/${userId}`);
  } catch (err) {
    if (isNotFound(err)) return;
    throw err;
  }
};

export const getCurrentUserProfile = async () => {
  const res = await apiClient.get<UserProfile>("/social/me");
  return res.data;
};

export const updateCurrentUserProfile = async (payload: Partial<User>) => {
  const res = await apiClient.put<UserProfile>("/social/me", payload);
  return res.data;
};

export const searchUsers = async (query: string) => {
  const res = await apiClient.get<SocialUserSummary[]>("/social/search", {
    params: { q: query },
  });
  return res.data ?? [];
};

export const getConnections = async () => {
  const res = await apiClient.get<{
    following: SocialUserSummary[];
    followers: SocialUserSummary[];
    friends?: SocialUserSummary[];
    pendingInvites?: SocialUserSummary[];
    outgoingInvites?: SocialUserSummary[];
  }>("/social/connections");
  return {
    following: res.data?.following ?? [],
    followers: res.data?.followers ?? [],
    friends: res.data?.friends ?? [],
    pendingInvites: res.data?.pendingInvites ?? [],
    outgoingInvites: res.data?.outgoingInvites ?? [],
  };
};
