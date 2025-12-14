import { apiClient } from "./client";
import {
  ActiveWorkoutStatus,
  SocialProfile,
  SquadDetail,
  SquadMemberSummary,
  Visibility,
  WorkoutSummaryShare,
  SocialUserSummary,
  ReactionsData,
  WorkoutComment,
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

export const getSquadFeed = async (squadId?: string): Promise<SquadFeedResponse> => {
  try {
    const res = await apiClient.get<SquadFeedResponse>("/social/squad-feed", {
      params: squadId ? { squadId } : undefined,
    });
    return res.data ?? { activeStatuses: [], recentShares: [] };
  } catch (err) {
    if (isNotFound(err)) {
      return { activeStatuses: [], recentShares: [] };
    }
    throw err;
  }
};

export const getSquads = async (): Promise<SquadDetail[]> => {
  try {
    const res = await apiClient.get<{ squads: SquadDetail[] }>("/social/squads");
    return res.data?.squads ?? [];
  } catch (err) {
    if (isNotFound(err)) {
      return [];
    }
    throw err;
  }
};

export const createSquad = async (params: {
  name: string;
  description?: string;
  isPublic?: boolean;
}): Promise<SquadDetail> => {
  const res = await apiClient.post<{ squad: SquadDetail }>("/social/squads", params);
  if (!res.data?.squad) {
    throw new Error("Failed to create squad");
  }
  return res.data.squad;
};

export type PublicSquad = {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  maxMembers: number;
  createdBy: string;
  isMember: boolean;
};

export const discoverSquads = async (searchQuery?: string): Promise<PublicSquad[]> => {
  try {
    const params = searchQuery ? { q: searchQuery } : {};
    const res = await apiClient.get<{ squads: PublicSquad[] }>("/social/squads/discover", { params });
    return res.data?.squads ?? [];
  } catch (err) {
    if (isNotFound(err)) {
      return [];
    }
    throw err;
  }
};

export const joinPublicSquad = async (squadId: string): Promise<SquadDetail> => {
  const res = await apiClient.post<{ squad: SquadDetail }>(`/social/squads/${squadId}/join`);
  if (!res.data?.squad) {
    throw new Error("Failed to join squad");
  }
  return res.data.squad;
};

export const inviteToSquad = async (squadId: string, handle: string) => {
  await apiClient.post(`/social/squads/${squadId}/members`, { handle });
};

export const deleteSquad = async (squadId: string) => {
  await apiClient.delete<void>(`/social/squads/${squadId}`);
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
  templateName?: string;
  totalSets?: number;
  totalVolume?: number;
  prCount?: number;
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
        templateName: payload.templateName,
        totalSets: payload.totalSets ?? 0,
        totalVolume: payload.totalVolume,
        prCount: payload.prCount,
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

export const removeFollower = async (userId: string) => {
  try {
    await apiClient.delete<void>(`/social/followers/${userId}`);
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

export const uploadCurrentUserAvatar = async (uri: string) => {
  const form = new FormData();
  form.append(
    "avatar",
    {
      uri,
      name: "avatar.jpg",
      type: "image/jpeg",
    } as any
  );

  const res = await apiClient.post<{ avatarUrl: string }>("/social/me/avatar", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  if (!res.data?.avatarUrl) {
    throw new Error("Avatar upload failed");
  }
  return res.data.avatarUrl;
};

export const deleteCurrentUserAccount = async () => {
  await apiClient.delete<void>("/social/me");
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

// Squad Management

export const getSquadById = async (squadId: string): Promise<SquadDetail | null> => {
  try {
    const res = await apiClient.get<{ squad: SquadDetail }>(`/social/squads/${squadId}`);
    return res.data?.squad ?? null;
  } catch (err) {
    if (isNotFound(err)) {
      return null;
    }
    throw err;
  }
};

export const updateSquad = async (
  squadId: string,
  data: { name?: string; description?: string; isPublic?: boolean }
): Promise<SquadDetail> => {
  const res = await apiClient.put<{ squad: SquadDetail }>(`/social/squads/${squadId}`, data);
  if (!res.data?.squad) {
    throw new Error("Failed to update squad");
  }
  return res.data.squad;
};

export const removeSquadMember = async (squadId: string, memberId: string) => {
  await apiClient.delete<void>(`/social/squads/${squadId}/members/${memberId}`);
};

export const updateMemberRole = async (
  squadId: string,
  memberId: string,
  role: "admin" | "member"
): Promise<SquadDetail> => {
  const res = await apiClient.put<{ squad: SquadDetail }>(
    `/social/squads/${squadId}/members/${memberId}/role`,
    { role }
  );
  if (!res.data?.squad) {
    throw new Error("Failed to update member role");
  }
  return res.data.squad;
};

export const leaveSquad = async (squadId: string) => {
  await apiClient.post<void>(`/social/squads/${squadId}/leave`);
};

export const transferSquadOwnership = async (
  squadId: string,
  newOwnerId: string
): Promise<SquadDetail> => {
  const res = await apiClient.post<{ squad: SquadDetail }>(
    `/social/squads/${squadId}/transfer`,
    { newOwnerId }
  );
  if (!res.data?.squad) {
    throw new Error("Failed to transfer ownership");
  }
  return res.data.squad;
};

export const searchSquadMembers = async (
  squadId: string,
  query: string
): Promise<SquadMemberSummary[]> => {
  const res = await apiClient.get<{ members: SquadMemberSummary[] }>(
    `/social/squads/${squadId}/members/search`,
    { params: { q: query } }
  );
  return res.data?.members ?? [];
};

// Block/Report

export const blockUser = async (blockedUserId: string) => {
  await apiClient.post<void>("/social/block", { blockedUserId });
};

export const unblockUser = async (blockedId: string) => {
  await apiClient.delete<void>(`/social/block/${blockedId}`);
};

export const getBlockedUsers = async (): Promise<SocialUserSummary[]> => {
  const res = await apiClient.get<{ blockedUsers: SocialUserSummary[] }>("/social/blocked");
  return res.data?.blockedUsers ?? [];
};

// Reactions & Comments

export const addReaction = async (
  targetType: "status" | "share",
  targetId: string,
  emoji: string
) => {
  await apiClient.post<{ success: boolean }>("/social/reactions", {
    targetType,
    targetId,
    emoji,
  });
};

export const removeReaction = async (
  targetType: "status" | "share",
  targetId: string,
  emoji: string
) => {
  await apiClient.delete<void>(
    `/social/reactions/${targetType}/${targetId}/${encodeURIComponent(emoji)}`
  );
};

export const addComment = async (
  targetType: "status" | "share",
  targetId: string,
  comment: string
): Promise<WorkoutComment> => {
  const res = await apiClient.post<WorkoutComment>("/social/comments", {
    targetType,
    targetId,
    comment,
  });
  if (!res.data) {
    throw new Error("Failed to add comment");
  }
  return res.data;
};

export const deleteComment = async (commentId: string) => {
  await apiClient.delete<void>(`/social/comments/${commentId}`);
};

export const getReactions = async (
  targetType: "status" | "share",
  targetId: string
): Promise<ReactionsData> => {
  const res = await apiClient.get<ReactionsData>(
    `/social/reactions/${targetType}/${targetId}`
  );
  return res.data ?? { emojis: [], comments: [] };
};
