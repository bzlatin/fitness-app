"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultGymPreferences = exports.normalizeGymPreferences = exports.gymPreferencesSchema = void 0;
const zod_1 = require("zod");
exports.gymPreferencesSchema = zod_1.z
    .object({
    equipment: zod_1.z.array(zod_1.z.string().trim().min(1).max(60)).max(120).optional(),
    bodyweightOnly: zod_1.z.boolean().optional(),
    gyms: zod_1.z
        .array(zod_1.z
        .object({
        id: zod_1.z.string().trim().min(1).max(80),
        name: zod_1.z.string().trim().min(1).max(80),
        type: zod_1.z.enum(["home", "commercial", "custom"]).optional(),
        equipment: zod_1.z.array(zod_1.z.string().trim().min(1).max(60)).max(120).optional(),
        bodyweightOnly: zod_1.z.boolean().optional(),
    })
        .strip())
        .max(12)
        .optional(),
    activeGymId: zod_1.z.string().trim().min(1).max(80).nullable().optional(),
    warmupSets: zod_1.z
        .object({
        enabled: zod_1.z.boolean().optional(),
        numSets: zod_1.z.number().int().min(0).max(6).optional(),
        startPercentage: zod_1.z.number().int().min(10).max(95).optional(),
        incrementPercentage: zod_1.z.number().int().min(5).max(30).optional(),
    })
        .optional(),
    cardio: zod_1.z
        .object({
        enabled: zod_1.z.boolean().optional(),
        timing: zod_1.z.enum(["before", "after", "separate"]).optional(),
        type: zod_1.z.enum(["liss", "hiit", "mixed"]).optional(),
        duration: zod_1.z.number().int().min(5).max(120).optional(),
        frequency: zod_1.z.number().int().min(0).max(7).optional(),
    })
        .optional(),
    sessionDuration: zod_1.z.number().int().min(20).max(180).optional(),
})
    .strip();
const DEFAULT_GYM_PREFERENCES = {
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
const normalizeStringList = (value) => {
    if (!Array.isArray(value))
        return [];
    const deduped = new Set();
    value.forEach((item) => {
        const cleaned = String(item ?? "")
            .trim()
            .toLowerCase();
        if (!cleaned)
            return;
        deduped.add(cleaned);
    });
    return Array.from(deduped);
};
const normalizeGymPreferences = (raw) => {
    const parsed = exports.gymPreferencesSchema.safeParse(raw ?? {});
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
    const fallbackEquipment = normalizeStringList(input.equipment ?? DEFAULT_GYM_PREFERENCES.equipment);
    const fallbackBodyweightOnly = Boolean(input.bodyweightOnly ?? DEFAULT_GYM_PREFERENCES.bodyweightOnly);
    const resolvedActive = (input.activeGymId
        ? gyms.find((gym) => gym.id === input.activeGymId)
        : null) ?? gyms[0];
    const equipment = resolvedActive?.equipment ??
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
        sessionDuration: input.sessionDuration ?? DEFAULT_GYM_PREFERENCES.sessionDuration,
    };
};
exports.normalizeGymPreferences = normalizeGymPreferences;
const getDefaultGymPreferences = () => JSON.parse(JSON.stringify(DEFAULT_GYM_PREFERENCES));
exports.getDefaultGymPreferences = getDefaultGymPreferences;
