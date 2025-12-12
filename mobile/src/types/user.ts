import { OnboardingData } from "./onboarding";
import { AppleHealthPermissions } from "./health";

export type Plan = "free" | "pro" | "lifetime";

export interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  planExpiresAt?: string | null;
  handle?: string | null;
  handleLastChangedAt?: string | null;
  avatarUrl?: string;
  bio?: string;
  profileCompletedAt?: string | null;
  trainingStyle?: string;
  gymName?: string | null;
  gymVisibility?: "hidden" | "shown";
  weeklyGoal?: number;
  onboardingData?: OnboardingData | null;
  progressiveOverloadEnabled?: boolean;
  restTimerSoundEnabled?: boolean;
  appleHealthEnabled?: boolean;
  appleHealthPermissions?: AppleHealthPermissions | null;
  appleHealthLastSyncAt?: string | null;
}

export interface UserProfile extends User {
  followersCount?: number;
  followingCount?: number;
  friendsCount?: number;
  workoutsCompleted?: number;
  currentStreakDays?: number;
}
