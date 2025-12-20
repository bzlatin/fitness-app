import { z } from "zod";

export type GymType = "home" | "commercial" | "custom";

export type WarmupSetPreferences = {
  enabled: boolean;
  numSets: number;
  startPercentage: number;
  incrementPercentage: number;
};

export type CardioPreferences = {
  enabled: boolean;
  timing: "before" | "after" | "separate";
  type: "liss" | "hiit" | "mixed";
  duration: number;
  frequency: number;
};

export type GymProfile = {
  id: string;
  name: string;
  type: GymType;
  equipment: string[];
  bodyweightOnly: boolean;
};

export type GymPreferences = {
  equipment: string[];
  bodyweightOnly: boolean;
  gyms: GymProfile[];
  activeGymId: string | null;
  warmupSets: WarmupSetPreferences;
  cardio: CardioPreferences;
  sessionDuration: number;
};

export const gymPreferencesSchema = z
  .object({
    equipment: z.array(z.string().trim().min(1).max(60)).max(120).optional(),
    bodyweightOnly: z.boolean().optional(),
    gyms: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(80),
            name: z.string().trim().min(1).max(80),
            type: z.enum(["home", "commercial", "custom"]).optional(),
            equipment: z.array(z.string().trim().min(1).max(60)).max(120).optional(),
            bodyweightOnly: z.boolean().optional(),
          })
          .strip()
      )
      .max(12)
      .optional(),
    activeGymId: z.string().trim().min(1).max(80).nullable().optional(),
    warmupSets: z
      .object({
        enabled: z.boolean().optional(),
        numSets: z.number().int().min(0).max(6).optional(),
        startPercentage: z.number().int().min(10).max(95).optional(),
        incrementPercentage: z.number().int().min(5).max(30).optional(),
      })
      .optional(),
    cardio: z
      .object({
        enabled: z.boolean().optional(),
        timing: z.enum(["before", "after", "separate"]).optional(),
        type: z.enum(["liss", "hiit", "mixed"]).optional(),
        duration: z.number().int().min(5).max(120).optional(),
        frequency: z.number().int().min(0).max(7).optional(),
      })
      .optional(),
    sessionDuration: z.number().int().min(20).max(180).optional(),
  })
  .strip();

const DEFAULT_GYM_PREFERENCES: GymPreferences = {
  equipment: [],
  bodyweightOnly: false,
  gyms: [],
  activeGymId: null,
  warmupSets: {
    enabled: false,
    numSets: 2,
    startPercentage: 50,
    incrementPercentage: 15,
  },
  cardio: {
    enabled: false,
    timing: "after",
    type: "mixed",
    duration: 20,
    frequency: 2,
  },
  sessionDuration: 60,
};

const normalizeStringList = (value?: unknown) => {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  value.forEach((item) => {
    const cleaned = String(item ?? "")
      .trim()
      .toLowerCase();
    if (!cleaned) return;
    deduped.add(cleaned);
  });
  return Array.from(deduped);
};

export const normalizeGymPreferences = (raw?: unknown): GymPreferences => {
  const parsed = gymPreferencesSchema.safeParse(raw ?? {});
  const input = parsed.success ? parsed.data : {};

  const warmupSets = {
    ...DEFAULT_GYM_PREFERENCES.warmupSets,
    ...(input.warmupSets ?? {}),
  };
  const cardio = {
    ...DEFAULT_GYM_PREFERENCES.cardio,
    ...(input.cardio ?? {}),
  };

  const gyms = (input.gyms ?? []).map((gym, index) => ({
    id: String(gym.id ?? "").trim() || `gym-${index + 1}`,
    name: String(gym.name ?? "").trim() || "My Gym",
    type: gym.type ?? "custom",
    equipment: normalizeStringList(gym.equipment),
    bodyweightOnly: Boolean(gym.bodyweightOnly ?? false),
  }));

  const fallbackEquipment = normalizeStringList(
    input.equipment ?? DEFAULT_GYM_PREFERENCES.equipment
  );
  const fallbackBodyweightOnly = Boolean(
    input.bodyweightOnly ?? DEFAULT_GYM_PREFERENCES.bodyweightOnly
  );

  const resolvedActive =
    (input.activeGymId
      ? gyms.find((gym) => gym.id === input.activeGymId)
      : null) ?? gyms[0];

  const equipment =
    resolvedActive?.equipment ??
    (fallbackBodyweightOnly ? [] : fallbackEquipment);
  const bodyweightOnly = resolvedActive
    ? resolvedActive.bodyweightOnly
    : fallbackBodyweightOnly;

  return {
    equipment: bodyweightOnly ? [] : equipment,
    bodyweightOnly,
    gyms,
    activeGymId: resolvedActive?.id ?? null,
    warmupSets,
    cardio,
    sessionDuration:
      input.sessionDuration ?? DEFAULT_GYM_PREFERENCES.sessionDuration,
  };
};

export const getDefaultGymPreferences = () =>
  JSON.parse(JSON.stringify(DEFAULT_GYM_PREFERENCES)) as GymPreferences;
