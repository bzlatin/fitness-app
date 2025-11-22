export type FitnessGoal =
  | "build_muscle"
  | "lose_weight"
  | "strength"
  | "endurance"
  | "general_fitness";

export type ExperienceLevel = "beginner" | "intermediate" | "advanced";

export type EquipmentType =
  | "gym_full"
  | "home_limited"
  | "bodyweight"
  | "custom";

export type TrainingSplit =
  | "push_pull_legs"
  | "upper_lower"
  | "full_body"
  | "custom";

export interface OnboardingData {
  // Step 1: Welcome (handled separately - name, handle)

  // Step 2: Goals
  goals: FitnessGoal[];

  // Step 3: Experience
  experienceLevel: ExperienceLevel;

  // Step 4: Equipment
  availableEquipment: EquipmentType[];
  customEquipment?: string[]; // If custom is selected

  // Step 5: Schedule
  weeklyFrequency: number; // 3-7 days
  sessionDuration: number; // 30, 45, 60, or 90 minutes

  // Step 6: Limitations
  injuryNotes?: string;
  movementsToAvoid?: string[];

  // Step 7: Training Style
  preferredSplit: TrainingSplit;
}

// Partial type for incomplete onboarding
export type PartialOnboardingData = Partial<OnboardingData>;

// Display labels for the UI
export const FITNESS_GOAL_LABELS: Record<FitnessGoal, string> = {
  build_muscle: "Build Muscle",
  lose_weight: "Lose Weight",
  strength: "Get Stronger",
  endurance: "Build Endurance",
  general_fitness: "General Fitness",
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const EXPERIENCE_LEVEL_DESCRIPTIONS: Record<ExperienceLevel, string> = {
  beginner: "Less than 6 months of training",
  intermediate: "6 months to 2 years",
  advanced: "2+ years of consistent training",
};

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  gym_full: "Full Gym Access",
  home_limited: "Home Gym (Limited)",
  bodyweight: "Bodyweight Only",
  custom: "Custom Equipment",
};

export const TRAINING_SPLIT_LABELS: Record<TrainingSplit, string> = {
  push_pull_legs: "Push / Pull / Legs",
  upper_lower: "Upper / Lower",
  full_body: "Full Body",
  custom: "Custom Split",
};

export const SESSION_DURATIONS = [30, 45, 60, 90] as const;
export const WEEKLY_FREQUENCIES = [3, 4, 5, 6, 7] as const;
