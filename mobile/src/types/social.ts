import { StatsVisibility } from "./user";

export type Visibility = "private" | "followers" | "squad";

export interface SocialUserSummary {
  id: string;
  name: string;
  avatarUrl?: string;
  handle?: string | null;
  handleLastChangedAt?: string | null;
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

export interface ProgressPhoto {
  id: string;
  imageUrl: string;
  createdAt: string;
  sessionId?: string | null;
  templateName?: string | null;
  visibility?: Visibility;
}

export interface SocialProfile extends SocialUserSummary {
  bio?: string;
  followersCount?: number;
  followingCount?: number;
  friendsCount?: number;
  workoutsCompleted?: number;
  workoutsThisWeek?: number;
  currentStreakDays?: number;
  isFollowing?: boolean;
  isFriend?: boolean;
  statsVisibility?: StatsVisibility;
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
  role?: "owner" | "admin" | "member" | null;
}

export interface SquadDetail {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  memberCount: number;
  members: SquadMemberSummary[];
}

export interface EmojiReaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

export interface WorkoutComment {
  id: string;
  user: SocialUserSummary;
  comment: string;
  createdAt: string;
}

export interface ReactionsData {
  emojis: EmojiReaction[];
  comments: WorkoutComment[];
}
