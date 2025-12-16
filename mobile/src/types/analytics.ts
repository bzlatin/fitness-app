export type MuscleFatigue = {
  muscleGroup: string;
  last7DaysVolume: number;
  baselineVolume: number | null;
  fatigueScore: number;
  lastTrainedAt: string | null;
  lastSessionSets: number;
  lastSessionReps: number;
  lastSessionVolume: number;
  recoveryLoad: number;
  status: "under-trained" | "optimal" | "moderate-fatigue" | "high-fatigue" | "no-data";
  color: "green" | "blue" | "yellow" | "red" | "gray";
  fatigued: boolean;
  underTrained: boolean;
  baselineMissing: boolean;
};

export type FatigueResult = {
  generatedAt: string;
  windowDays: number;
  baselineWeeks: number;
  perMuscle: MuscleFatigue[];
  deloadWeekDetected: boolean;
  readinessScore: number;
  freshMuscles: string[];
  lastWorkoutAt: string | null;
  totals: {
    last7DaysVolume: number;
    baselineVolume: number | null;
    fatigueScore: number;
  };
};

export type TrainingRecommendation = {
  targetMuscles: string[];
  recommendedWorkouts: Array<{
    id: string;
    name: string;
    muscleGroups: string[];
    reason: string;
  }>;
};

export type StartingSuggestion = {
  exerciseId: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  reason: string;
  confidence: "high" | "medium" | "low";
} | null;

// Advanced Analytics Types
export type WeeklyVolumeData = {
  weekStartDate: string;
  weekNumber: number;
  year: number;
  muscleGroup: string;
  totalVolume: number;
  totalSets: number;
  workoutCount: number;
};

export type MuscleGroupSummary = {
  muscleGroup: string;
  totalVolume: number;
  totalSets: number;
  workoutCount: number;
  averageVolumePerWorkout: number;
  lastTrainedDate: string | null;
};

export type PushPullBalance = {
  pushVolume: number;
  pullVolume: number;
  legVolume: number;
  otherVolume: number;
  pushPullRatio: number;
  balanceStatus: "balanced" | "push-heavy" | "pull-heavy";
  recommendations: string[];
};

export type VolumePR = {
  muscleGroup: string;
  peakVolume: number;
  peakWeekDate: string;
  currentVolume: number;
  percentOfPR: number;
};

export type FrequencyHeatmapData = {
  muscleGroup: string;
  dateTrainingCount: Record<string, number>;
  weeklyFrequency: number;
  mostTrainedDay: string | null;
};

export type AdvancedAnalytics = {
  weeklyVolumeData: WeeklyVolumeData[];
  muscleGroupSummaries: MuscleGroupSummary[];
  pushPullBalance: PushPullBalance;
  volumePRs: VolumePR[];
  frequencyHeatmap: FrequencyHeatmapData[];
};

export type RecapSessionQuality = {
  sessionId: string;
  finishedAt: string;
  templateName?: string | null;
  qualityScore: number;
  status: "peak" | "solid" | "dip";
  totalVolume: number;
  avgRpe: number | null;
};

export type RecapHighlight = {
  id: string;
  type: "pr" | "volume_high" | "streak" | "badge" | "dip";
  title: string;
  subtitle?: string;
  date: string;
  tone: "positive" | "warning" | "info";
  value?: number;
};

export type RecapSlice = {
  generatedAt: string;
  lookbackWeeks: number;
  baselineVolume: number | null;
  baselineRpe: number | null;
  streak: {
    current: number;
    best: number;
    lastWorkoutAt: string | null;
  };
  quality: RecapSessionQuality[];
  highlights: RecapHighlight[];
  qualityDip: {
    consecutive: number;
    since: string;
    suggestion: string;
    lastScore: number;
  } | null;
  winBack:
    | {
        headline: string;
        message: string;
        since: string | null;
      }
    | null;
};

// Up Next Intelligence Types
export type UpNextTemplate = {
  templateId: string;
  templateName: string;
  splitType: string | null;
  exerciseCount: number;
  muscleGroups: string[];
  lastUsedAt: string | null;
  matchScore: number;
  matchReason: string;
};

export type UpNextRecommendation = {
  // The recommended split type (push, pull, legs, upper, lower, full_body)
  recommendedSplit: {
    splitKey: string;
    label: string;
    reason: string;
    tags: string[];
  };
  // Alternate split options
  alternateSplits: Array<{
    splitKey: string;
    label: string;
    reason: string;
  }>;
  // Best matching template from user's saved templates (if any)
  matchedTemplate: UpNextTemplate | null;
  // Other templates that could work
  alternateTemplates: UpNextTemplate[];
  // Recovery status for the recommended split
  fatigueStatus: "fresh" | "ready" | "moderate-fatigue" | "high-fatigue" | "no-data";
  // Overall readiness score (0-100)
  readinessScore: number;
  // Whether user has Pro access (affects what actions are available)
  canGenerateAI: boolean;
  // Reasoning for the recommendation
  reasoning: string;
  // Last workout info
  lastWorkoutAt: string | null;
  // How long since last workout of this split type
  daysSinceLastSplit: number | null;
};
