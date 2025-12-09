import { Platform, NativeModules } from "react-native";

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
  restEndsAt?: string; // ISO timestamp when rest timer ends
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
  if (Platform.OS !== "ios") {
    return;
  }

  if (!LiveActivityModule) {
    console.warn("⚠️ LiveActivityModule not available");
    return;
  }

  try {
    LiveActivityModule.startWorkoutActivity({
      sessionId: state.sessionId,
      templateName: state.templateName,
      exerciseName: state.exerciseName,
      currentSet: state.currentSet,
      totalSets: state.totalSets,
      targetReps: state.targetReps,
      targetWeight: state.targetWeight,
      totalExercises: state.totalExercises,
      completedExercises: state.completedExercises,
    });
  } catch (error) {
    console.error("❌ Failed to start Live Activity:", error);
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
    LiveActivityModule.updateWorkoutActivity(updates);
  } catch (error) {
    console.error("❌ Failed to update Live Activity:", error);
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
  } catch (error) {
    console.error("❌ Failed to end Live Activity with summary:", error);
  }
};

/**
 * Add a listener for "Log Set" button presses from Live Activity
 * (Legacy method using NotificationCenter - prefer App Group polling instead)
 *
 * @param callback Function to call with sessionId when user taps "Log Set"
 * @returns Cleanup function to remove the listener
 */
export const addLogSetListener = (
  callback: (sessionId: string) => void
): (() => void) => {
  if (Platform.OS !== "ios" || !LiveActivityModule) {
    return () => {};
  }

  // This is a legacy listener using NativeEventEmitter
  // The App Group polling method is preferred and more reliable
  const { NativeEventEmitter } = require("react-native");
  const eventEmitter = new NativeEventEmitter(LiveActivityModule);

  const subscription = eventEmitter.addListener(
    "onLogSetFromLiveActivity",
    (event: { sessionId: string }) => {
      callback(event.sessionId);
    }
  );

  return () => {
    subscription.remove();
  };
};
