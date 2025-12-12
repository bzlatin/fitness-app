export type AppleHealthPermissions = {
  workouts?: boolean;
  activeEnergy?: boolean;
  heartRate?: boolean;
};

export type AppleHealthSessionPayload = {
  externalId?: string;
  workoutType?: string;
  templateName?: string;
  startedAt: string;
  finishedAt?: string;
  durationSeconds?: number;
  totalEnergyBurned?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  sourceName?: string;
  notes?: string;
  sets?: Array<{
    exerciseId?: string;
    actualReps?: number;
    actualWeight?: number;
    setIndex?: number;
  }>;
};

export type AppleHealthSyncResult = {
  status: "synced" | "skipped" | "unavailable" | "denied" | "disabled";
  importedCount?: number;
  skippedCount?: number;
};
