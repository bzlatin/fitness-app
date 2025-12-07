import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

/**
 * Widget Data Sync Service
 *
 * Syncs user data to iOS App Group UserDefaults so widgets can access it.
 * This uses AsyncStorage with a shared app group identifier.
 *
 * Note: Requires App Groups capability and shared UserDefaults suite.
 */

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
    // In a real implementation, we'd use react-native-shared-group-preferences
    // or a native module to write to UserDefaults with the app group suite.
    // For now, we'll use AsyncStorage as a placeholder.

    // NOTE: You'll need to install and configure:
    // npm install react-native-shared-group-preferences
    // Then use: SharedGroupPreferences.setItem(WIDGET_KEYS.weeklyGoal, value, APP_GROUP_ID)

    const updates: Array<Promise<void>> = [];

    if (data.weeklyGoal !== undefined) {
      updates.push(AsyncStorage.setItem(WIDGET_KEYS.weeklyGoal, String(data.weeklyGoal)));
    }

    if (data.currentProgress !== undefined) {
      updates.push(
        AsyncStorage.setItem(WIDGET_KEYS.currentProgress, String(data.currentProgress))
      );
      updates.push(AsyncStorage.setItem(WIDGET_KEYS.lastUpdated, new Date().toISOString()));
    }

    if (data.userName !== undefined) {
      updates.push(AsyncStorage.setItem(WIDGET_KEYS.userName, data.userName || ""));
    }

    if (data.userHandle !== undefined) {
      updates.push(AsyncStorage.setItem(WIDGET_KEYS.userHandle, data.userHandle || ""));
    }

    if (data.authToken !== undefined) {
      updates.push(AsyncStorage.setItem(WIDGET_KEYS.authToken, data.authToken || ""));
    }

    if (data.apiBaseURL !== undefined) {
      updates.push(AsyncStorage.setItem(WIDGET_KEYS.apiBaseURL, data.apiBaseURL));
    }

    if (data.currentStreak !== undefined) {
      updates.push(AsyncStorage.setItem(WIDGET_KEYS.currentStreak, String(data.currentStreak)));
    }

    await Promise.all(updates);

    console.log("✅ Widget data synced successfully");
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
    await Promise.all([
      AsyncStorage.removeItem(WIDGET_KEYS.weeklyGoal),
      AsyncStorage.removeItem(WIDGET_KEYS.currentProgress),
      AsyncStorage.removeItem(WIDGET_KEYS.userName),
      AsyncStorage.removeItem(WIDGET_KEYS.userHandle),
      AsyncStorage.removeItem(WIDGET_KEYS.lastUpdated),
      AsyncStorage.removeItem(WIDGET_KEYS.authToken),
      AsyncStorage.removeItem(WIDGET_KEYS.currentStreak),
    ]);

    console.log("✅ Widget data cleared");
  } catch (error) {
    console.error("❌ Failed to clear widget data:", error);
  }
};

/**
 * Get current widget data (for debugging)
 */
export const getWidgetData = async (): Promise<WidgetData> => {
  if (Platform.OS !== "ios") {
    return {};
  }

  try {
    const [weeklyGoal, currentProgress, userName, userHandle, currentStreak] = await Promise.all([
      AsyncStorage.getItem(WIDGET_KEYS.weeklyGoal),
      AsyncStorage.getItem(WIDGET_KEYS.currentProgress),
      AsyncStorage.getItem(WIDGET_KEYS.userName),
      AsyncStorage.getItem(WIDGET_KEYS.userHandle),
      AsyncStorage.getItem(WIDGET_KEYS.currentStreak),
    ]);

    return {
      weeklyGoal: weeklyGoal ? parseInt(weeklyGoal, 10) : undefined,
      currentProgress: currentProgress ? parseInt(currentProgress, 10) : undefined,
      userName: userName || undefined,
      userHandle: userHandle || undefined,
      currentStreak: currentStreak ? parseInt(currentStreak, 10) : undefined,
    };
  } catch (error) {
    console.error("❌ Failed to get widget data:", error);
    return {};
  }
};

/**
 * Trigger widget refresh (iOS only)
 *
 * This tells WidgetKit to refresh all widgets immediately.
 * Requires a native module or react-native-widget-extension.
 */
export const refreshWidgets = async (): Promise<void> => {
  if (Platform.OS !== "ios") {
    return;
  }

  // TODO: Implement native module to call WidgetCenter.shared.reloadAllTimelines()
  // For now, widgets will refresh on their own timeline (every 30 minutes)
  console.log("📱 Widget refresh requested (auto-refresh in ~30min)");
};
