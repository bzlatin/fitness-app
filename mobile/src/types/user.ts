export type Plan = "free" | "pro" | "lifetime";

export interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  planExpiresAt?: string | null;
  handle?: string | null;
  avatarUrl?: string;
  bio?: string;
  profileCompletedAt?: string;
  trainingStyle?: string;
  gymName?: string | null;
  gymVisibility?: "hidden" | "shown";
}

export interface UserProfile extends User {
  followersCount?: number;
  followingCount?: number;
  friendsCount?: number;
  workoutsCompleted?: number;
  currentStreakDays?: number;
}
