export type Plan = "free" | "pro" | "lifetime";

export interface User {
  id: string;
  email: string;
  name: string;
  plan: Plan;
  planExpiresAt?: string | null;
  handle?: string;
  avatarUrl?: string;
  bio?: string;
  profileCompletedAt?: string;
  trainingStyle?: string;
}

export interface UserProfile extends User {
  followersCount?: number;
  followingCount?: number;
  workoutsCompleted?: number;
  currentStreakDays?: number;
}
