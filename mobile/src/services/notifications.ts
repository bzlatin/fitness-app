import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { apiClient } from "../api/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPreferences {
  goalReminders: boolean;
  inactivityNudges: boolean;
  squadActivity: boolean;
  weeklyGoalMet: boolean;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number; // 0-23
  maxNotificationsPerWeek: number;
}

export interface NotificationEvent {
  id: string;
  notification_type: string;
  trigger_reason: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sent_at: string;
  read_at: string | null;
  clicked_at: string | null;
  delivery_status: string;
}

export interface InboxResponse {
  notifications: NotificationEvent[];
  unreadCount: number;
  hasMore: boolean;
}

type RegisterOptions = {
  requestPermissions?: boolean;
};

const resolveExpoProjectId = (): string | null => {
  const manifest = Constants.manifest as
    | { extra?: { eas?: { projectId?: string } } }
    | null
    | undefined;

  return (
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId ??
    manifest?.extra?.eas?.projectId ??
    process?.env?.EXPO_PUBLIC_EAS_PROJECT_ID ??
    null
  );
};

/**
 * Register for push notifications and send token to server
 */
export const registerForPushNotificationsAsync = async (
  options: RegisterOptions = {}
): Promise<string | null> => {
  let token: string | null = null;
  const { requestPermissions = true } = options;

  if (!Device.isDevice) {
    console.log(
      "[Notifications] Push notifications only work on physical devices"
    );
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permissions if not granted
  if (existingStatus !== "granted") {
    if (!requestPermissions) {
      console.log(
        "[Notifications] Permission not granted; skipping token registration"
      );
      return null;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Notifications] Permission not granted for push notifications");
    return null;
  }

  try {
    // Get Expo push token
    const projectId = resolveExpoProjectId();

    if (!projectId) {
      console.error("[Notifications] Missing EAS project ID");
      return null;
    }

    token = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;

    console.log("[Notifications] Push token obtained");

    // Register token with backend
    await apiClient.post("/notifications/register-token", {
      pushToken: token,
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    });

    console.log("[Notifications] Token registered with server");
  } catch (error) {
    console.error("[Notifications] Error registering for push notifications:", error);
    return null;
  }

  // Android-specific notification channel setup
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22C55E",
    });
    await Notifications.setNotificationChannelAsync("silent", {
      name: "silent",
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [],
      sound: null,
    });
  }

  return token;
};

/**
 * Update user's timezone offset for notification scheduling
 */
export const updateNotificationTimezoneOffset = async (): Promise<void> => {
  try {
    await apiClient.post("/notifications/timezone", {
      tzOffsetMinutes: new Date().getTimezoneOffset(),
    });
  } catch (error) {
    console.error("[Notifications] Error updating timezone offset:", error);
  }
};

/**
 * Get user's notification preferences
 */
export const getNotificationPreferences =
  async (): Promise<NotificationPreferences> => {
    const response = await apiClient.get<NotificationPreferences>(
      "/notifications/preferences"
    );
    return response.data;
  };

/**
 * Update user's notification preferences
 */
export const updateNotificationPreferences = async (
  preferences: Partial<NotificationPreferences>
): Promise<NotificationPreferences> => {
  const response = await apiClient.put<NotificationPreferences>(
    "/notifications/preferences",
    preferences
  );
  return response.data;
};

/**
 * Get notification inbox
 */
export const getNotificationInbox = async (
  limit = 50,
  offset = 0
): Promise<InboxResponse> => {
  const response = await apiClient.get<InboxResponse>(
    `/notifications/inbox?limit=${limit}&offset=${offset}`
  );
  return response.data;
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (
  notificationId: string
): Promise<void> => {
  await apiClient.post(`/notifications/inbox/${notificationId}/read`);
};

/**
 * Mark notification as clicked
 */
export const markNotificationAsClicked = async (
  notificationId: string
): Promise<void> => {
  await apiClient.post(`/notifications/inbox/${notificationId}/clicked`);
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (): Promise<void> => {
  await apiClient.post("/notifications/inbox/mark-all-read");
};

/**
 * Delete notification from inbox
 */
export const deleteNotification = async (
  notificationId: string
): Promise<void> => {
  await apiClient.delete(`/notifications/inbox/${notificationId}`);
};

/**
 * Get badge count (unread notifications)
 */
export const getBadgeCount = async (): Promise<number> => {
  try {
    const inbox = await getNotificationInbox(1, 0);
    return inbox.unreadCount;
  } catch (error) {
    console.error("[Notifications] Error getting badge count:", error);
    return 0;
  }
};

/**
 * Set app icon badge count
 */
export const updateBadgeCount = async (): Promise<void> => {
  const count = await getBadgeCount();
  await Notifications.setBadgeCountAsync(count);
};

/**
 * Handle notification received while app is in foreground
 */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
) => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Handle notification tapped by user
 */
export const addNotificationResponseReceivedListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Schedule a local notification (for testing)
 */
export const scheduleTestNotification = async (
  title: string,
  body: string,
  seconds = 5
): Promise<void> => {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
    },
  });
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};

/**
 * Send a test notification (creates entry in inbox for testing)
 */
export const sendTestNotification = async (): Promise<void> => {
  await apiClient.post("/notifications/send-test");
};
