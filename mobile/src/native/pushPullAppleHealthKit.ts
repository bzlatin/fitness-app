import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export type HealthPermission = 'Workout' | 'ActiveEnergyBurned' | 'HeartRate';

export type HealthKitPermissions = {
  permissions: {
    read: HealthPermission[];
    write?: HealthPermission[];
  };
};

export type HealthKitWorkout = {
  uuid: string;
  startDate: string;
  endDate: string;
  duration: number;
  activityName?: string;
  workoutActivityType?: string;
  totalEnergyBurned?: number;
  energyBurned?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  sourceName?: string;
};

type NativePushPullAppleHealthKitModule = {
  isAvailable(): Promise<boolean>;
  initHealthKit(permissions: HealthKitPermissions): Promise<boolean>;
  saveWorkout(options: {
    startDate: string;
    endDate: string;
    activityType?: string;
    totalEnergyBurned?: number;
    externalUUID?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string>;
  getWorkouts(options: {
    startDate: string;
    endDate?: string;
    limit?: number;
    includeHeartRate?: boolean;
  }): Promise<HealthKitWorkout[]>;
};

const PERMISSIONS = {
  Workout: 'Workout' as const,
  ActiveEnergyBurned: 'ActiveEnergyBurned' as const,
  HeartRate: 'HeartRate' as const,
};

export type PushPullAppleHealthKit = NativePushPullAppleHealthKitModule & {
  Constants: {
    Permissions: typeof PERMISSIONS;
  };
};

export const getPushPullAppleHealthKit = (): PushPullAppleHealthKit | null => {
  if (Platform.OS !== 'ios') return null;
  const native = requireOptionalNativeModule<NativePushPullAppleHealthKitModule>(
    'PushPullAppleHealthKit'
  );
  if (!native) return null;

  const withConstants = native as unknown as PushPullAppleHealthKit;
  const existingConstants = (withConstants as any).Constants;
  if (existingConstants && typeof existingConstants === 'object') {
    if (!(existingConstants as any).Permissions) (existingConstants as any).Permissions = PERMISSIONS;
  } else {
    Object.defineProperty(withConstants, 'Constants', {
      value: { Permissions: PERMISSIONS },
      enumerable: true,
      configurable: false,
      writable: false,
    });
  }
  return withConstants;
};

export const debugPushPullAppleHealthKitShape = () => {
  const module = getPushPullAppleHealthKit();
  if (!module) return { available: false as const, keys: [] as string[] };
  return {
    available: true as const,
    keys: Object.keys(module as unknown as Record<string, unknown>),
    hasInit: typeof (module as any).initHealthKit === 'function',
    hasGetWorkouts: typeof (module as any).getWorkouts === 'function',
    hasIsAvailable: typeof (module as any).isAvailable === 'function',
  };
};
