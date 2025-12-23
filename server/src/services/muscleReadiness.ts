import { FatigueResult, MuscleFatigue } from "./fatigue";

export type CanonicalMuscleStats = {
  readiness: number;
  fatigueScore: number;
};

export const READINESS_BLOCKED_THRESHOLD = 30;
export const READINESS_HIGH_THRESHOLD = 45;
export const READINESS_MODERATE_THRESHOLD = 65;
export const READINESS_FRESH_THRESHOLD = 85;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const normalizeMuscleGroup = (value?: string | null) => {
  const key = (value ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!key) return "other";

  const aliases: Record<string, string> = {
    "upper back": "back",
    upper_back: "back",
    trapezius: "back",
    traps: "back",
    lats: "back",
    "latissimus dorsi": "back",
    "lower back": "back",
    lower_back: "back",
    back: "back",
    chest: "chest",
    pectorals: "chest",
    pecs: "chest",
    deltoids: "shoulders",
    delts: "shoulders",
    shoulders: "shoulders",
    "rear delts": "shoulders",
    biceps: "biceps",
    triceps: "triceps",
    quadriceps: "legs",
    quads: "legs",
    hamstring: "legs",
    hamstrings: "legs",
    calves: "legs",
    "calves both": "legs",
    adductors: "legs",
    gluteal: "glutes",
    glutes: "glutes",
    abs: "core",
    abdominals: "core",
    core: "core",
    obliques: "core",
  };

  if (aliases[key]) return aliases[key];
  if (key.includes("back") || key.includes("lat") || key.includes("trap")) return "back";
  if (key.includes("shoulder") || key.includes("delt")) return "shoulders";
  if (key.includes("chest") || key.includes("pec")) return "chest";
  if (key.includes("bicep")) return "biceps";
  if (key.includes("tricep")) return "triceps";
  if (key.includes("quad") || key.includes("ham") || key.includes("calf") || key.includes("leg"))
    return "legs";
  if (key.includes("glute")) return "glutes";
  if (key.includes("ab") || key.includes("core") || key.includes("oblique")) return "core";

  return key;
};

export const readinessFromMuscle = (muscle: MuscleFatigue) => {
  const load = muscle.recoveryLoad;
  if (typeof load === "number" && Number.isFinite(load)) {
    return Math.round(clamp(100 * (1 - Math.min(1, load)), 0, 100));
  }

  const fallbackFromLoad = () =>
    Math.round(clamp(120 - (muscle.fatigueScore - 70) * 1.2, 0, 100));

  if (!muscle.lastTrainedAt) return fallbackFromLoad();
  const last = new Date(muscle.lastTrainedAt);
  const lastMs = last.getTime();
  if (Number.isNaN(lastMs)) return fallbackFromLoad();

  const hoursSince = (Date.now() - lastMs) / (1000 * 60 * 60);
  if (!Number.isFinite(hoursSince) || hoursSince < 0) return fallbackFromLoad();

  const sessionSets = Math.max(0, muscle.lastSessionSets ?? 0);
  const sessionVolume = Math.max(0, muscle.lastSessionVolume ?? 0);
  const baselineWeekly = muscle.baselineVolume ?? null;

  const intensityFromSets = clamp((sessionSets - 1) / 5, 0, 1);
  const intensityFromVolume =
    baselineWeekly && baselineWeekly > 0
      ? clamp(sessionVolume / (baselineWeekly * 0.4), 0, 1)
      : clamp(sessionVolume / 8000, 0, 1);

  const intensity = Math.max(intensityFromSets, intensityFromVolume);

  if (sessionSets === 0 && sessionVolume === 0) return fallbackFromLoad();

  const initialReadiness = Math.round(clamp(100 - intensity * 100, 0, 100));
  const recoveryHours = 12 + intensity * 84;
  const t = clamp(hoursSince / recoveryHours, 0, 1);
  return Math.round(initialReadiness + (100 - initialReadiness) * t);
};

export const buildCanonicalMuscleStats = (fatigue: FatigueResult | null) => {
  const stats = new Map<string, CanonicalMuscleStats>();
  if (!fatigue) return stats;

  fatigue.perMuscle.forEach((muscle) => {
    const canonical = normalizeMuscleGroup(muscle.muscleGroup);
    const readiness = readinessFromMuscle(muscle);
    const existing = stats.get(canonical);
    if (!existing) {
      stats.set(canonical, {
        readiness,
        fatigueScore: muscle.fatigueScore,
      });
      return;
    }

    stats.set(canonical, {
      readiness: Math.min(existing.readiness, readiness),
      fatigueScore: Math.max(existing.fatigueScore, muscle.fatigueScore),
    });
  });

  return stats;
};
