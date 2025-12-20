export type GymType = 'home' | 'commercial' | 'custom';

export type WarmupSetPreferences = {
  enabled: boolean;
  numSets: number;
  startPercentage: number;
  incrementPercentage: number;
};

export type CardioPreferences = {
  enabled: boolean;
  timing: 'before' | 'after' | 'separate';
  type: 'liss' | 'hiit' | 'mixed';
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

export const DEFAULT_GYM_PREFERENCES: GymPreferences = {
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
    timing: 'after',
    type: 'mixed',
    duration: 20,
    frequency: 2,
  },
  sessionDuration: 60,
};
