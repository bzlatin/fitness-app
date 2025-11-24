export type MuscleFatigue = {
  muscleGroup: string;
  last7DaysVolume: number;
  baselineVolume: number | null;
  fatigueScore: number;
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
