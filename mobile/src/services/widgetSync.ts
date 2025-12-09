import { Platform, NativeModules } from "react-native";

/**
 * Widget Data Sync Service — FIXED VERSION
 *
 * - Full state merge on every sync
 * - Prevents overwriting previous set data
 * - Keeps rest timer visible
 * - Makes widget/state atomic
 */

const { WidgetSyncModule } = NativeModules;

const APP_GROUP_ID = "group.com.pushpull.app";

// Track last widget state
const widgetCurrent = {
  state: {} as WidgetData,
};

// keys (optional keep as is)
const WIDGET_KEYS = {
  weeklyGoal: "widget_weeklyGoal",
  currentProgress: "widget_currentProgress",
  userName: "widget_userName",
  userHandle: "widget_userHandle",
  lastUpdated: "widget_lastUpdated",
  authToken: "widget_authToken",
  apiBaseURL: "widget_apiBaseURL",
  currentStreak: "widget_currentStreak",
  activeSessionId: "widget_activeSessionId",
  activeSessionExerciseName: "widget_activeSessionExerciseName",
  activeSessionCurrentSet: "widget_activeSessionCurrentSet",
  activeSessionTotalSets: "widget_activeSessionTotalSets",
  activeSessionLastReps: "widget_activeSessionLastReps",
  activeSessionLastWeight: "widget_activeSessionLastWeight",
  activeSessionTargetReps: "widget_activeSessionTargetReps",
  activeSessionTargetWeight: "widget_activeSessionTargetWeight",
  activeSessionStartedAt: "widget_activeSessionStartedAt",
  activeSessionRestDuration: "widget_activeSessionRestDuration",
  activeSessionRestEndsAt: "widget_activeSessionRestEndsAt",
};

export interface WidgetData {
  weeklyGoal?: number;
  currentProgress?: number;
  userName?: string | null;
  userHandle?: string | null;
  authToken?: string | null;
  apiBaseURL?: string;
  currentStreak?: number;
  activeSessionId?: string | null;
  activeSessionExerciseName?: string | null;
  activeSessionCurrentSet?: number | null;
  activeSessionTotalSets?: number | null;
  activeSessionLastReps?: number | null;
  activeSessionLastWeight?: number | null;
  activeSessionTargetReps?: number | null;
  activeSessionTargetWeight?: number | null;
  activeSessionStartedAt?: string | null;
  activeSessionRestDuration?: number | null;
  activeSessionRestEndsAt?: string | null;
  lastUpdated?: string;
}

let hasWarnedAboutMissingModule = false;

/*==========================================
=  MERGED WRITE = prevents state loss
==========================================*/
export const syncWidgetData = async (data: WidgetData): Promise<void> => {
  if (Platform.OS !== "ios") return;

  try {
    if (!WidgetSyncModule) {
      if (!hasWarnedAboutMissingModule) {
        console.warn("⚠️ WidgetSyncModule not available");
        hasWarnedAboutMissingModule = true;
      }
      return;
    }

    // merge FULL previous widget state
    const merged = {
      ...widgetCurrent.state,
      ...data,
      lastUpdated: new Date().toISOString(),
    };

    widgetCurrent.state = merged;

    WidgetSyncModule.syncWidgetData(merged);

    console.log("✅ Widget merged + synced", merged);
  } catch (error) {
    console.error("❌ Failed to sync widget data:", error);
  }
};

/*==========================================
=  Active Session Sync
==========================================*/
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
    restDuration?: number;
    restEndsAt?: string;
  } | null
): Promise<void> => {
  if (Platform.OS !== "ios") return;

  try {
    if (!WidgetSyncModule) return;

    if (sessionData === null) {
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
        activeSessionRestDuration: null,
        activeSessionRestEndsAt: null,
      });
      console.log("🟢 cleared active widget session");
    } else {
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
        activeSessionRestDuration: sessionData.restDuration ?? null,
        activeSessionRestEndsAt: sessionData.restEndsAt ?? null,
      });
      console.log("🟢 active session synced", sessionData);
    }
  } catch (error) {
    console.error("❌ Failed to sync active widget session:", error);
  }
};

export const clearWidgetData = async (): Promise<void> => {
  if (Platform.OS !== "ios") return;

  try {
    if (!WidgetSyncModule) return;
    WidgetSyncModule.clearWidgetData();
    widgetCurrent.state = {};
  } catch {}
};

export const refreshWidgets = async (): Promise<void> => {
  if (Platform.OS !== "ios") return;

  try {
    if (!WidgetSyncModule) return;
    WidgetSyncModule.refreshWidgets();
  } catch {}
};

export const getWidgetData = async (): Promise<WidgetData> => {
  console.log("ℹ️ stored in App Group UserDefaults");
  return widgetCurrent.state;
};
