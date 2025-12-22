import { User } from "../types/user";

const KG_TO_LB = 2.20462;

export const isBodyweightMovement = (
  exerciseName?: string,
  exerciseId?: string
) => {
  const name = `${exerciseName ?? ""} ${exerciseId ?? ""}`.toLowerCase();
  const keywords = [
    "bodyweight",
    "push-up",
    "pull-up",
    "chin-up",
    "dip",
    "plank",
    "burpee",
    "sit-up",
    "crunch",
    "mountain climber",
    "air squat",
  ];
  return keywords.some((keyword) => name.includes(keyword));
};

export const isLowerBodyMovement = (
  exerciseName?: string,
  exerciseId?: string
) => {
  const name = `${exerciseName ?? ""} ${exerciseId ?? ""}`.toLowerCase();
  const keywords = [
    "squat",
    "deadlift",
    "lunge",
    "leg",
    "glute",
    "hamstring",
    "quad",
    "calf",
    "hip",
  ];
  return keywords.some((keyword) => name.includes(keyword));
};

const estimateBodyWeightKg = (profile?: User["onboardingData"] | null) => {
  if (profile?.weightKg && Number.isFinite(profile.weightKg)) {
    return profile.weightKg;
  }
  if (!profile?.heightCm || !Number.isFinite(profile.heightCm)) {
    return undefined;
  }
  const heightMeters = profile.heightCm / 100;
  const bmi =
    profile.bodyGender === "female"
      ? 21
      : profile.bodyGender === "male"
      ? 23
      : 22;
  return bmi * heightMeters * heightMeters;
};

const roundToIncrement = (value: number, increment: number) => {
  if (!Number.isFinite(value)) return value;
  if (!Number.isFinite(increment) || increment <= 0) return value;
  return Math.round(value / increment) * increment;
};

export const estimateWorkingWeightFromProfile = (
  exerciseName: string | undefined,
  exerciseId: string,
  profile?: User["onboardingData"] | null
) => {
  if (isBodyweightMovement(exerciseName, exerciseId)) return undefined;
  const bodyWeightKg = estimateBodyWeightKg(profile);
  if (!bodyWeightKg) return undefined;

  const isLower = isLowerBodyMovement(exerciseName, exerciseId);
  const exp = profile?.experienceLevel ?? "beginner";
  const gender =
    profile?.bodyGender === "female"
      ? "female"
      : profile?.bodyGender === "male"
      ? "male"
      : "neutral";
  const expIndex = exp === "advanced" ? 2 : exp === "intermediate" ? 1 : 0;

  const multipliers = {
    male: {
      lower: [0.6, 0.8, 1.0],
      upper: [0.4, 0.55, 0.7],
    },
    female: {
      lower: [0.5, 0.65, 0.85],
      upper: [0.3, 0.45, 0.6],
    },
    neutral: {
      lower: [0.55, 0.72, 0.9],
      upper: [0.35, 0.5, 0.65],
    },
  } as const;

  const multiplier =
    multipliers[gender][isLower ? "lower" : "upper"][expIndex] ?? 0.4;
  const estimated = bodyWeightKg * KG_TO_LB * multiplier;
  const rounded = roundToIncrement(estimated, 2.5);
  const min = isLower ? 45 : 15;
  const max = isLower ? 405 : 225;
  return Math.min(Math.max(rounded, min), max);
};
