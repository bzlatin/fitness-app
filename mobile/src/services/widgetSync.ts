import { Platform, NativeModules } from "react-native";

/**
 * Widget Data Sync Service
 *
 * Syncs user data to iOS App Group UserDefaults so widgets can access it.
 * Uses native module to write to shared UserDefaults suite.
 *
 * Note: Requires App Groups capability and WidgetSyncModule native module.
 */

const { WidgetSyncModule } = NativeModules;

const APP_GROUP_ID = "group.com.pushpull.app";

// Keys for widget data (must match Swift AppGroupUserDefaults.swift)
const WIDGET_KEYS = {
  weeklyGoal: "widget_weeklyGoal",
  currentProgress: "widget_currentProgress",
  userName: "widget_userName",
  userHandle: "widget_userHandle",
  lastUpdated: "widget_lastUpdated",
  authToken: "widget_authToken",
  apiBaseURL: "widget_apiBaseURL",
  currentStreak: "widget_currentStreak",
  // Active session keys
  activeSessionId: "widget_activeSessionId",
  activeSessionExerciseName: "widget_activeSessionExerciseName",
  activeSessionCurrentSet: "widget_activeSessionCurrentSet",
  activeSessionTotalSets: "widget_activeSessionTotalSets",
  activeSessionLastReps: "widget_activeSessionLastReps",
  activeSessionLastWeight: "widget_activeSessionLastWeight",
  activeSessionTargetReps: "widget_activeSessionTargetReps",
  activeSessionTargetWeight: "widget_activeSessionTargetWeight",
  activeSessionStartedAt: "widget_activeSessionStartedAt",
};

/**
 * Widget data interface
 */
export interface WidgetData {
  weeklyGoal?: number;
  currentProgress?: number;
  userName?: string | null;
  userHandle?: string | null;
  authToken?: string | null;
  apiBaseURL?: string;
  currentStreak?: number;
  // Active session data for Quick Set Logger widget
  activeSessionId?: string | null;
  activeSessionExerciseName?: string | null;
  activeSessionCurrentSet?: number | null;
  activeSessionTotalSets?: number | null;
  activeSessionLastReps?: number | null;
  activeSessionLastWeight?: number | null;
  activeSessionTargetReps?: number | null;
  activeSessionTargetWeight?: number | null;
  activeSessionStartedAt?: string | null;
}

/**
 * Sync user data to widget storage
 *
 * This should be called:
 * - When user completes a workout (update currentProgress)
 * - When user updates their weekly goal
 * - When user logs in/out (update authToken)
 * - On app startup (ensure widgets have latest data)
 * - When user starts/updates/completes an active workout session (for Quick Set Logger widget)
 */
// Track whether we've already warned about missing module (prevents spam)
let hasWarnedAboutMissingModule = false;

export const syncWidgetData = async (data: WidgetData): Promise<void> => {
  if (Platform.OS !== "ios") {
    // Only iOS supports widgets currently
    return;
  }

  try {
    if (!WidgetSyncModule) {
      // Only warn once to avoid console spam
      if (!hasWarnedAboutMissingModule) {
        console.warn("⚠️ WidgetSyncModule not available - widgets will not update. To enable widgets, add the native WidgetSyncModule.");
        hasWarnedAboutMissingModule = true;
      }
      return;
    }

    // Use native module to write to App Group UserDefaults
    WidgetSyncModule.syncWidgetData(data);

    console.log("✅ Widget data synced successfully via native module");
  } catch (error) {
    console.error("❌ Failed to sync widget data:", error);
  }
};

/**
 * Clear all widget data (call on logout)
 */
export const clearWidgetData = async (): Promise<void> => {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    if (!WidgetSyncModule) {
      // Silently return if module not available
      return;
    }

    WidgetSyncModule.clearWidgetData();

    console.log("✅ Widget data cleared");
  } catch (error) {
    console.error("❌ Failed to clear widget data:", error);
  }
};

/**
 * Get current widget data (for debugging)
 * Note: This is now read-only from the widget's perspective.
 * The native module only writes to App Group UserDefaults.
 */
export const getWidgetData = async (): Promise<WidgetData> => {
  // Widget data is stored in App Group UserDefaults, which we can't read from React Native
  // without a native module getter. For now, this returns empty.
  // If you need to read widget data, add a getter to WidgetSyncModule.swift
  console.log("ℹ️ Widget data is stored in App Group UserDefaults (not accessible from RN)");
  return {};
};

/**
 * Trigger widget refresh (iOS only)
 *
 * This tells WidgetKit to refresh all widgets immediately.
 */
export const refreshWidgets = async (): Promise<void> => {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    if (!WidgetSyncModule) {
      // Silently return if module not available
      return;
    }

    WidgetSyncModule.refreshWidgets();
    console.log("📱 Widget refresh triggered");
  } catch (error) {
    console.error("❌ Failed to refresh widgets:", error);
  }
};

/**
 * Sync active workout session data to Quick Set Logger widget
 *
 * This should be called:
 * - When user starts a workout session
 * - When user logs a set (to update current set number and last performance)
 * - When user changes exercises during the workout
 * - When user completes or cancels the workout (pass null to clear)
 *
 * @param sessionData Active session data, or null to clear the widget
 */
export const syncActiveSessionToWidget = async (
  sessionData: {
    sessionId: string;
    exerciseName: string;
    currentSet: number;
    totalSets: number;
    lastReps?: number;
    lastWeight?: number;
    targetReps?: number;
    targetWeight?: number;
    startedAt: string;
  } | null
): Promise<void> => {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    if (!WidgetSyncModule) {
      // Silently return if module not available
      return;
    }

    if (sessionData === null) {
      // Clear active session data
      await syncWidgetData({
        activeSessionId: null,
        activeSessionExerciseName: null,
        activeSessionCurrentSet: null,
        activeSessionTotalSets: null,
        activeSessionLastReps: null,
        activeSessionLastWeight: null,
        activeSessionTargetReps: null,
        activeSessionTargetWeight: null,
        activeSessionStartedAt: null,
      });
      console.log("✅ Active session cleared from widget");
    } else {
      // Sync active session data
      await syncWidgetData({
        activeSessionId: sessionData.sessionId,
        activeSessionExerciseName: sessionData.exerciseName,
        activeSessionCurrentSet: sessionData.currentSet,
        activeSessionTotalSets: sessionData.totalSets,
        activeSessionLastReps: sessionData.lastReps ?? null,
        activeSessionLastWeight: sessionData.lastWeight ?? null,
        activeSessionTargetReps: sessionData.targetReps ?? null,
        activeSessionTargetWeight: sessionData.targetWeight ?? null,
        activeSessionStartedAt: sessionData.startedAt,
      });
      console.log("✅ Active session synced to widget:", sessionData.exerciseName);
    }

    // Refresh widgets to show updated data
    await refreshWidgets();
  } catch (error) {
    console.error("❌ Failed to sync active session to widget:", error);
  }
};
