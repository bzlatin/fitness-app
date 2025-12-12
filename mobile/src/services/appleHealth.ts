import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  debugPushPullAppleHealthKitShape,
  getPushPullAppleHealthKit,
} from "../native/pushPullAppleHealthKit";
import {
  AppleHealthPermissions,
  AppleHealthSessionPayload,
  AppleHealthSyncResult,
} from "../types/health";
import {
  clearAppleHealthImports,
  importAppleHealthSessions,
} from "../api/analytics";

const LAST_SYNC_STORAGE_KEY = "pushpull.apple_health.last_sync";
const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_PERMISSIONS: AppleHealthPermissions = {
  workouts: true,
  activeEnergy: true,
  heartRate: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getHealthKitModule = (): any | null => {
  if (Platform.OS !== "ios") return null;
  try {
    const healthKit = getPushPullAppleHealthKit();
    if (!healthKit) {
      console.warn("[AppleHealth] Native module PushPullAppleHealthKit not found; treating as unavailable");
      return null;
    }
    if (typeof healthKit.initHealthKit !== "function") {
      console.warn(
        "[AppleHealth] Native module missing initHealthKit; treating as unavailable",
        debugPushPullAppleHealthKitShape()
      );
      return null;
    }
    return healthKit;
  } catch (err) {
    console.warn("[AppleHealth] HealthKit module not available", err);
    return null;
  }
};

export const getAppleHealthAvailability = () => {
  if (Platform.OS !== "ios") {
    return {
      available: false,
      reason: "Apple Health sync is only available on iOS devices.",
    };
  }

  const module = getHealthKitModule();
  if (!module) {
    return {
      available: false,
      reason:
        "Apple HealthKit is not available in this build. Rebuild and reinstall the iOS dev client with HealthKit enabled.",
    };
  }

  return { available: true, reason: undefined as string | undefined };
};

const parseNumber = (value: unknown) =>
  typeof value === "number" && !Number.isNaN(value) ? value : undefined;

const formatWorkoutName = (raw?: string | null) => {
  if (!raw) return undefined;
  const pretty = raw.replace(/[_-]+/g, " ").trim();
  return pretty ? pretty.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
};

export const requestAppleHealthPermissions = async (
  permissions: AppleHealthPermissions = DEFAULT_PERMISSIONS
) => {
  const HealthKit = getHealthKitModule();
  if (!HealthKit) return false;

  const readPermissions: string[] = ["Workout"];
  if (permissions.activeEnergy) readPermissions.push("ActiveEnergyBurned");
  if (permissions.heartRate) readPermissions.push("HeartRate");

  try {
    return await HealthKit.initHealthKit({
      permissions: {
        read: readPermissions,
      },
    });
  } catch (error) {
    console.warn("[AppleHealth] Permission request failed", error);
    return false;
  }
};

const fetchWorkoutsSince = async (
  since: Date,
  permissions: AppleHealthPermissions
): Promise<AppleHealthSessionPayload[]> => {
  const HealthKit = getHealthKitModule();
  if (!HealthKit) return [];

  try {
    const workouts = await HealthKit.getWorkouts({
      startDate: since.toISOString(),
      includeHeartRate: permissions.heartRate,
    });

    return workouts
      .map((workout) => {
        const item = workout as Record<string, unknown>;
        const start = new Date((item.startDate as string) ?? (item.start as string));
        const endRaw = (item.endDate as string) ?? (item.end as string);
        const end = endRaw ? new Date(endRaw) : null;
        if (Number.isNaN(start.getTime())) return null;
        const durationSeconds = parseNumber(item.duration) ??
          (end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000)) : undefined);

        const totalEnergy = permissions.activeEnergy
          ? parseNumber(item.totalEnergyBurned ?? item.energyBurned)
          : undefined;

        const avgHeartRate = permissions.heartRate
          ? parseNumber(item.avgHeartRate ?? item.averageHeartRate)
          : undefined;
        const maxHeartRate = permissions.heartRate
          ? parseNumber(item.maxHeartRate)
          : undefined;

        const workoutType =
          (item.workoutActivityType as string | undefined) ??
          (item.activityName as string | undefined);

        return {
          externalId:
            (item.uuid as string | undefined) ??
            (item.id as string | undefined) ??
            (item.workoutActivityId as string | undefined),
          workoutType,
          templateName: formatWorkoutName(workoutType) ?? "Imported workout",
          startedAt: start.toISOString(),
          finishedAt: end ? end.toISOString() : undefined,
          durationSeconds,
          totalEnergyBurned: totalEnergy,
          avgHeartRate,
          maxHeartRate,
          sourceName: (item.sourceName as string | undefined) ?? undefined,
        } satisfies AppleHealthSessionPayload;
      })
      .filter(Boolean) as AppleHealthSessionPayload[];
  } catch (err) {
    console.warn("[AppleHealth] Failed to fetch workouts", err);
    return [];
  }
};

export const syncAppleHealthWorkouts = async ({
  permissions,
  force = false,
  respectThrottle = true,
}: {
  permissions?: AppleHealthPermissions;
  force?: boolean;
  respectThrottle?: boolean;
} = {}): Promise<AppleHealthSyncResult> => {
  if (Platform.OS !== "ios") return { status: "unavailable" };

  const selectedPermissions = { ...DEFAULT_PERMISSIONS, ...permissions };
  if (!selectedPermissions.workouts) {
    return { status: "disabled" };
  }

  const healthKit = getHealthKitModule();
  if (!healthKit) return { status: "unavailable" };

  const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_STORAGE_KEY);
  const lastSync = lastSyncRaw ? new Date(lastSyncRaw) : null;
  if (
    !force &&
    respectThrottle &&
    lastSync &&
    Date.now() - lastSync.getTime() < 18 * 60 * 60 * 1000
  ) {
    return { status: "skipped" };
  }

  const authorized = await requestAppleHealthPermissions(selectedPermissions);
  if (!authorized) {
    return { status: "denied" };
  }

  const since =
    force || !lastSync
      ? new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
      : lastSync;

  const sessions = await fetchWorkoutsSince(since, selectedPermissions);
  try {
    const result = await importAppleHealthSessions({
      sessions,
      permissions: selectedPermissions,
      lastSyncAt: new Date().toISOString(),
    });

    await AsyncStorage.setItem(LAST_SYNC_STORAGE_KEY, new Date().toISOString());

    return {
      status: "synced",
      importedCount: result.importedCount ?? 0,
      skippedCount: result.skippedCount ?? 0,
    };
  } catch (err) {
    console.warn("[AppleHealth] Failed to import sessions", err);
    return { status: "unavailable" };
  }
};

export const clearAppleHealthData = async () => {
  await clearAppleHealthImports();
  await AsyncStorage.removeItem(LAST_SYNC_STORAGE_KEY);
};

export const getLastAppleHealthSync = async () => {
  const raw = await AsyncStorage.getItem(LAST_SYNC_STORAGE_KEY);
  return raw ? new Date(raw) : null;
};
