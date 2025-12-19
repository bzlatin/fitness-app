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
import { normalizeWorkoutTemplateName } from "../utils/workoutNames";

const LAST_SYNC_STORAGE_KEY = "pushpull.apple_health.last_sync";
const EXPORTED_SESSIONS_STORAGE_KEY = "pushpull.apple_health.exported_sessions";
const DEFAULT_LOOKBACK_DAYS = 14;
const DEFAULT_PERMISSIONS: AppleHealthPermissions = {
  workouts: true,
  activeEnergy: true,
  heartRate: true,
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
  const normalized = normalizeWorkoutTemplateName(raw);
  if (!normalized) return undefined;
  if (normalized === "Imported workout") return normalized;
  const pretty = normalized.replace(/[_-]+/g, " ").trim();
  return pretty ? pretty.replace(/\b\w/g, (c) => c.toUpperCase()) : undefined;
};

export const requestAppleHealthPermissions = async (
  permissions: AppleHealthPermissions = DEFAULT_PERMISSIONS,
  mode: "read" | "readWrite" = "read"
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
        write: mode === "readWrite" ? ["Workout"] : [],
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
    const workouts = (await HealthKit.getWorkouts({
      startDate: since.toISOString(),
      includeHeartRate: permissions.heartRate,
    })) as unknown[];

    return workouts
      .map((workout: unknown) => {
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

  const authorized = await requestAppleHealthPermissions(selectedPermissions, "readWrite");
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
  await AsyncStorage.removeItem(EXPORTED_SESSIONS_STORAGE_KEY);
};

export const getLastAppleHealthSync = async () => {
  const raw = await AsyncStorage.getItem(LAST_SYNC_STORAGE_KEY);
  return raw ? new Date(raw) : null;
};

const guessActivityType = (templateName?: string | null) => {
  const name = (templateName ?? "").toLowerCase();
  if (!name) return "strength_training";
  if (/\brun(ning)?\b/.test(name)) return "running";
  if (/\bwalk(ing)?\b/.test(name)) return "walking";
  if (/\bcycle|cycling|bike\b/.test(name)) return "cycling";
  if (/\bswim(ming)?\b/.test(name)) return "swimming";
  if (/\brow(ing)?\b/.test(name)) return "rowing";
  if (/\belliptical\b/.test(name)) return "elliptical";
  if (/\bhiit\b/.test(name)) return "hiit";
  if (/\byoga\b/.test(name)) return "yoga";
  if (/\bpilates\b/.test(name)) return "pilates";
  if (/\bhike|hiking\b/.test(name)) return "hiking";
  if (/\bstair\b/.test(name)) return "stair_climbing";
  return "strength_training";
};

const readExportedSessionIds = async (): Promise<Record<string, string>> => {
  const raw = await AsyncStorage.getItem(EXPORTED_SESSIONS_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
};

const writeExportedSessionIds = async (value: Record<string, string>) => {
  const entries = Object.entries(value);
  if (entries.length <= 200) {
    await AsyncStorage.setItem(EXPORTED_SESSIONS_STORAGE_KEY, JSON.stringify(value));
    return;
  }

  const trimmed = entries
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .slice(0, 200)
    .reduce<Record<string, string>>((acc, [k, v]) => {
      acc[k] = v;
      return acc;
    }, {});

  await AsyncStorage.setItem(EXPORTED_SESSIONS_STORAGE_KEY, JSON.stringify(trimmed));
};

export const exportWorkoutToAppleHealth = async ({
  sessionId,
  startedAt,
  finishedAt,
  templateName,
  totalEnergyBurned,
  enabled,
  permissions,
}: {
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  templateName?: string | null;
  totalEnergyBurned?: number | null;
  enabled: boolean;
  permissions?: AppleHealthPermissions | null;
}): Promise<{ status: "exported" | "skipped" | "unavailable" | "denied" | "disabled" }> => {
  if (Platform.OS !== "ios") return { status: "unavailable" };
  if (!enabled) return { status: "disabled" };
  if (permissions?.workouts === false) return { status: "disabled" };

  const HealthKit = getHealthKitModule();
  if (!HealthKit || typeof HealthKit.saveWorkout !== "function") {
    return { status: "unavailable" };
  }

  const start = new Date(startedAt);
  const end = new Date(finishedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { status: "skipped" };
  }

  const exportedIds = await readExportedSessionIds();
  if (exportedIds[sessionId]) return { status: "skipped" };

  const authorized = await requestAppleHealthPermissions(
    { ...DEFAULT_PERMISSIONS, ...permissions, workouts: true },
    "readWrite"
  );
  if (!authorized) return { status: "denied" };

  try {
    await HealthKit.saveWorkout({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      activityType: guessActivityType(templateName),
      totalEnergyBurned:
        typeof totalEnergyBurned === "number" && Number.isFinite(totalEnergyBurned)
          ? totalEnergyBurned
          : undefined,
      externalUUID: sessionId,
      metadata: {
        templateName: templateName ?? undefined,
      },
    });

    exportedIds[sessionId] = new Date().toISOString();
    await writeExportedSessionIds(exportedIds);

    return { status: "exported" };
  } catch (err) {
    console.warn("[AppleHealth] Failed to export workout", err);
    return { status: "unavailable" };
  }
};
