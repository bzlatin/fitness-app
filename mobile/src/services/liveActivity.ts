import { Platform, NativeModules, NativeEventEmitter } from "react-native";

/**
 * Live Activity Service
 *
 * Manages Live Activities (Dynamic Island + Lock Screen) for active workout sessions.
 * Automatically appears when workout starts, updates in real-time, and dismisses on completion.
 *
 * Requirements:
 * - iOS 16.1+
 * - Live Activities capability enabled in Xcode
 * - ActivityKit framework linked
 */

const { LiveActivityModule } = NativeModules;

// Event emitter for listening to Live Activity interactions
const liveActivityEmitter = Platform.OS === "ios" && LiveActivityModule
  ? new NativeEventEmitter(LiveActivityModule)
  : null;

export interface WorkoutActivityState {
  // Session info
  sessionId: string;
  templateName: string;

  // Current exercise
  exerciseName: string;
  currentSet: number;
  totalSets: number;

  // Performance
  lastReps?: number;
  lastWeight?: number;
  targetReps?: number;
  targetWeight?: number;

  // Progress
  totalExercises: number;
  completedExercises: number;

  // Rest timer
  restDuration?: number; // seconds
}

export interface WorkoutSummary {
  totalSets: number;
  totalVolume: number;
  durationMinutes: number;
}

/**
 * Check if Live Activities are available and enabled
 */
export const areLiveActivitiesAvailable = async (): Promise<boolean> => {
  if (Platform.OS !== "ios") {
    return false;
  }

  if (!LiveActivityModule) {
    console.warn("⚠️ LiveActivityModule not available");
    return false;
  }

  return new Promise((resolve) => {
    LiveActivityModule.areLiveActivitiesEnabled((enabled: boolean) => {
      resolve(enabled);
    });
  });
};

/**
 * Start a Live Activity for an active workout
 *
 * This will show up in:
 * - Dynamic Island (iPhone 14 Pro+)
 * - Lock Screen
 * - Notification banner when backgrounded
 *
 * @param state Initial workout state
 */
export const startWorkoutLiveActivity = async (
  state: WorkoutActivityState
): Promise<void> => {
  console.log("🔵 [LiveActivity] startWorkoutLiveActivity called", {
    platform: Platform.OS,
    moduleAvailable: !!LiveActivityModule,
    sessionId: state.sessionId,
    exerciseName: state.exerciseName,
  });

  if (Platform.OS !== "ios") {
    console.log("⚠️ [LiveActivity] Not iOS, skipping");
    return;
  }

  if (!LiveActivityModule) {
    console.warn("⚠️ [LiveActivity] LiveActivityModule not available");
    return;
  }

  // Check if Live Activities are enabled
  const enabled = await areLiveActivitiesAvailable();
  console.log("🔵 [LiveActivity] Live Activities enabled:", enabled);

  if (!enabled) {
    console.warn("⚠️ [LiveActivity] Live Activities are disabled in Settings");
    return;
  }

  try {
    const params = {
      sessionId: state.sessionId,
      templateName: state.templateName,
      exerciseName: state.exerciseName,
      currentSet: state.currentSet,
      totalSets: state.totalSets,
      targetReps: state.targetReps,
      targetWeight: state.targetWeight,
      totalExercises: state.totalExercises,
      completedExercises: state.completedExercises,
    };

    console.log("🔵 [LiveActivity] Starting with params:", params);
    LiveActivityModule.startWorkoutActivity(params);
    console.log("✅ [LiveActivity] Started:", state.exerciseName);
  } catch (error) {
    console.error("❌ [LiveActivity] Failed to start:", error);
  }
};

/**
 * Update the active Live Activity
 *
 * Call this when:
 * - User logs a set
 * - User changes exercises
 * - Rest timer starts
 *
 * @param updates Partial state to update
 */
export const updateWorkoutLiveActivity = async (
  updates: Partial<WorkoutActivityState>
): Promise<void> => {
  if (Platform.OS !== "ios") {
    return;
  }

  if (!LiveActivityModule) {
    return;
  }

  try {
    console.log("🔵 [LiveActivity] Updating with:", updates);
    LiveActivityModule.updateWorkoutActivity(updates);
    console.log("✅ [LiveActivity] Updated");
  } catch (error) {
    console.error("❌ [LiveActivity] Failed to update:", error);
  }
};

/**
 * End the Live Activity immediately
 *
 * Call this when:
 * - User cancels workout
 * - User navigates away
 */
export const endWorkoutLiveActivity = async (): Promise<void> => {
  if (Platform.OS !== "ios") {
    return;
  }

  if (!LiveActivityModule) {
    return;
  }

  try {
    LiveActivityModule.endWorkoutActivity();
    console.log("✅ Live Activity ended");
  } catch (error) {
    console.error("❌ Failed to end Live Activity:", error);
  }
};

/**
 * End the Live Activity with a summary
 *
 * Shows completion state for 3 seconds before dismissing.
 *
 * Call this when:
 * - User completes workout
 *
 * @param summary Workout summary stats
 */
export const endWorkoutLiveActivityWithSummary = async (
  summary: WorkoutSummary
): Promise<void> => {
  if (Platform.OS !== "ios") {
    return;
  }

  if (!LiveActivityModule) {
    return;
  }

  try {
    LiveActivityModule.endWorkoutActivityWithSummary({
      totalSets: summary.totalSets,
      totalVolume: summary.totalVolume,
      durationMinutes: summary.durationMinutes,
    });

    console.log("✅ Live Activity ended with summary");
  } catch (error) {
    console.error("❌ Failed to end Live Activity with summary:", error);
  }
};

/**
 * Add listener for "Log Set" button pressed from Live Activity
 *
 * This fires when the user taps the "Log Set" button in the Live Activity
 * (Lock Screen or Dynamic Island).
 *
 * @param callback Function to call when log set is triggered
 * @returns Cleanup function to remove the listener
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   const cleanup = addLogSetListener((sessionId) => {
 *     console.log('Log set from Live Activity:', sessionId);
 *     // Handle the log set action
 *   });
 *   return cleanup;
 * }, []);
 * ```
 */
export const addLogSetListener = (
  callback: (sessionId: string) => void
): (() => void) => {
  if (!liveActivityEmitter) {
    return () => {}; // No-op cleanup
  }

  console.log("🔵 [LiveActivity] Adding log set listener");

  const subscription = liveActivityEmitter.addListener(
    "onLogSetFromLiveActivity",
    (event: { sessionId: string }) => {
      console.log("🔵 [LiveActivity] Log set event received:", event);
      callback(event.sessionId);
    }
  );

  // Return cleanup function
  return () => {
    console.log("🔵 [LiveActivity] Removing log set listener");
    subscription.remove();
  };
};
