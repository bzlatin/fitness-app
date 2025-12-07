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
}

/**
 * Sync user data to widget storage
 *
 * This should be called:
 * - When user completes a workout (update currentProgress)
 * - When user updates their weekly goal
 * - When user logs in/out (update authToken)
 * - On app startup (ensure widgets have latest data)
 */
export const syncWidgetData = async (data: WidgetData): Promise<void> => {
  if (Platform.OS !== "ios") {
    // Only iOS supports widgets currently
    return;
  }

  try {
    if (!WidgetSyncModule) {
      console.warn("⚠️ WidgetSyncModule not available - widgets may not update");
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
      console.warn("⚠️ WidgetSyncModule not available");
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
      console.warn("⚠️ WidgetSyncModule not available");
      return;
    }

    WidgetSyncModule.refreshWidgets();
    console.log("📱 Widget refresh triggered");
  } catch (error) {
    console.error("❌ Failed to refresh widgets:", error);
  }
};
