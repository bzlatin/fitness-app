export type Visibility = "private" | "followers" | "squad";

export interface SocialUserSummary {
  id: string;
  name: string;
  avatarUrl?: string;
  handle?: string;
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
  workoutsCompleted?: number;
  currentStreakDays?: number;
  isFollowing?: boolean;
  plan?: string;
  planExpiresAt?: string | null;
  profileCompletedAt?: string | null;
  trainingStyle?: string | null;
}
