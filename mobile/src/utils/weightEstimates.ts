import { User } from "../types/user";

const KG_TO_LB = 2.20462;

const normalizeExerciseText = (
  exerciseName?: string,
  exerciseId?: string
) => `${exerciseName ?? ""} ${exerciseId ?? ""}`.toLowerCase();

export const isBodyweightMovement = (
  exerciseName?: string,
  exerciseId?: string
) => {
  const name = normalizeExerciseText(exerciseName, exerciseId);
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
  const name = normalizeExerciseText(exerciseName, exerciseId);
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

export const isIsolationMovement = (
  exerciseName?: string,
  exerciseId?: string
) => {
  const name = normalizeExerciseText(exerciseName, exerciseId);
  const keywords = [
    "curl",
    "extension",
    "fly",
    "lateral raise",
    "front raise",
    "rear delt",
    "reverse fly",
    "kickback",
    "shrug",
    "pullover",
    "pec deck",
    "adduction",
    "abduction",
    "calf",
    "wrist",
    "forearm",
    "triceps",
    "biceps",
  ];
  return keywords.some((keyword) => name.includes(keyword));
};

export const isPerSideMovement = (
  exerciseName?: string,
  exerciseId?: string,
  equipment?: string
) => {
  const name = normalizeExerciseText(exerciseName, exerciseId);
  const equipmentValue = (equipment ?? "").toLowerCase();
  const perSideNameKeywords = [
    "one-arm",
    "one arm",
    "single-arm",
    "single arm",
    "single-hand",
    "single hand",
    "one-hand",
    "one hand",
    "alternating",
    "unilateral",
  ];
  if (perSideNameKeywords.some((keyword) => name.includes(keyword))) {
    return true;
  }

  if (equipmentValue.includes("dumbbell") || name.includes("dumbbell")) {
    return true;
  }

  const cableDualHandleKeywords = [
    "crossover",
    "fly",
    "chest press",
    "shoulder press",
    "lateral raise",
    "front raise",
    "rear delt",
    "reverse fly",
    "upright row",
  ];
  const isCable = equipmentValue.includes("cable") || name.includes("cable");
  return (
    isCable &&
    cableDualHandleKeywords.some((keyword) => name.includes(keyword))
  );
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
  const isPerSide = isPerSideMovement(exerciseName, exerciseId);
  const isIsolation = isIsolationMovement(exerciseName, exerciseId);
  const perSideFactor = isPerSide ? 0.5 : 1;
  const isolationFactor = isIsolation ? 0.7 : 1;
  const safetyFactor =
    exp === "advanced" ? 0.9 : exp === "intermediate" ? 0.85 : 0.8;
  const estimated =
    bodyWeightKg *
    KG_TO_LB *
    multiplier *
    safetyFactor *
    perSideFactor *
    isolationFactor;
  const rounded = roundToIncrement(estimated, 2.5);
  const min = isLower ? (isPerSide ? 20 : 45) : isPerSide ? 10 : 15;
  const max = isLower
    ? isPerSide
      ? 225
      : 405
    : isIsolation
    ? isPerSide
      ? 40
      : 80
    : isPerSide
    ? 120
    : 225;
  return Math.min(Math.max(rounded, min), max);
};
