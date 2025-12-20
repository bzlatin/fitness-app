import { DEFAULT_GYM_PREFERENCES, GymPreferences, GymProfile } from '../types/gym';

const createGymId = () =>
  `gym-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeStringList = (items?: string[]) => {
  if (!items) return [];
  const deduped = new Set<string>();
  items.forEach((item) => {
    const cleaned = String(item ?? '').trim().toLowerCase();
    if (!cleaned) return;
    deduped.add(cleaned);
  });
  return Array.from(deduped);
};

export const normalizeGymPreferences = (
  raw?: Partial<GymPreferences> | null
): GymPreferences => {
  const base = raw ?? {};
  const warmupSets = {
    ...DEFAULT_GYM_PREFERENCES.warmupSets,
    ...(base.warmupSets ?? {}),
  };
  const cardio = {
    ...DEFAULT_GYM_PREFERENCES.cardio,
    ...(base.cardio ?? {}),
  };
  const gyms = (base.gyms ?? []).map((gym, index) => ({
    id: gym.id?.trim() || `gym-${index + 1}`,
    name: gym.name?.trim() || 'My Gym',
    type: gym.type ?? 'custom',
    equipment: normalizeStringList(gym.equipment),
    bodyweightOnly: Boolean(gym.bodyweightOnly ?? false),
  }));

  return {
    equipment: normalizeStringList(base.equipment) ?? DEFAULT_GYM_PREFERENCES.equipment,
    bodyweightOnly: Boolean(
      base.bodyweightOnly ?? DEFAULT_GYM_PREFERENCES.bodyweightOnly
    ),
    gyms,
    activeGymId: base.activeGymId ?? DEFAULT_GYM_PREFERENCES.activeGymId,
    warmupSets,
    cardio,
    sessionDuration: base.sessionDuration ?? DEFAULT_GYM_PREFERENCES.sessionDuration,
  };
};

export const ensureGymPreferences = (
  raw?: Partial<GymPreferences> | null
): GymPreferences => {
  const normalized = normalizeGymPreferences(raw);
  if (normalized.gyms.length === 0) {
    const fallbackGym: GymProfile = {
      id: createGymId(),
      name: 'My Gym',
      type: 'custom',
      equipment: normalized.bodyweightOnly ? [] : normalized.equipment,
      bodyweightOnly: normalized.bodyweightOnly,
    };
    return {
      ...normalized,
      gyms: [fallbackGym],
      activeGymId: fallbackGym.id,
      equipment: fallbackGym.equipment,
      bodyweightOnly: fallbackGym.bodyweightOnly,
    };
  }

  const activeGym =
    normalized.gyms.find((gym) => gym.id === normalized.activeGymId) ??
    normalized.gyms[0];
  const resolvedBodyweight =
    activeGym?.bodyweightOnly ?? normalized.bodyweightOnly;
  const resolvedEquipment = resolvedBodyweight
    ? []
    : activeGym?.equipment ?? normalized.equipment;

  return {
    ...normalized,
    activeGymId: activeGym?.id ?? null,
    equipment: resolvedEquipment,
    bodyweightOnly: resolvedBodyweight,
  };
};

export const getActiveGym = (prefs: GymPreferences) => {
  return prefs.gyms.find((gym) => gym.id === prefs.activeGymId) ?? prefs.gyms[0] ?? null;
};
