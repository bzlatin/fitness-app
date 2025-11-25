export type Visibility = "private" | "followers" | "squad";

export interface SocialUserSummary {
  id: string;
  name: string;
  avatarUrl?: string;
  handle?: string | null;
  trainingStyleTags?: string[];
}

export interface ActiveWorkoutStatus {
  id: string;
  user: SocialUserSummary;
  templateId?: string;
  templateName?: string;
  startedAt: string;
  currentExerciseName?: string;
  visibility: Visibility;
  isActive: boolean;
  elapsedSeconds: number;
}

export interface WorkoutSummaryShare {
  id: string;
  user: SocialUserSummary;
  sessionId: string;
  templateName?: string;
  totalSets: number;
  totalVolume?: number;
  prCount?: number;
  createdAt: string;
  visibility: Visibility;
  progressPhotoUrl?: string;
}

export interface SocialProfile extends SocialUserSummary {
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  friendsCount?: number;
  workoutsCompleted?: number;
  currentStreakDays?: number;
  isFollowing?: boolean;
  plan?: string;
  planExpiresAt?: string | null;
  profileCompletedAt?: string | null;
  trainingStyle?: string | null;
  gymName?: string | null;
  gymVisibility?: "hidden" | "shown";
  progressiveOverloadEnabled?: boolean;
  friendsPreview?: SocialUserSummary[];
}

export interface SquadMemberSummary {
  id: string;
  name: string;
  handle?: string;
  avatarUrl?: string | null;
  role?: string | null;
}

export interface SquadDetail {
  id: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
  members: SquadMemberSummary[];
}
