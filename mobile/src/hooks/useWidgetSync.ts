import { useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useCurrentUser } from "./useCurrentUser";
import { useQuery } from "@tanstack/react-query";
import { syncWidgetData } from "../services/widgetSync";
import { fetchWeeklyProgress } from "../api/sessions";

/**
 * Hook to automatically sync widget data whenever user or session data changes
 *
 * This hook:
 * - Syncs auth token to widgets on login/logout
 * - Syncs weekly goal and progress whenever user data changes
 * - Syncs on app startup to ensure widgets have latest data
 */
export const useWidgetSync = () => {
  const { getAccessToken, isAuthenticated } = useAuth();
  const { user } = useCurrentUser();

  // Fetch weekly progress data
  const { data: weeklyData } = useQuery({
    queryKey: ["weekly-progress"],
    queryFn: fetchWeeklyProgress,
    enabled: isAuthenticated,
    // Refetch often to keep widgets up-to-date
    refetchInterval: 5 * 60 * 1000, // Every 5 minutes
    staleTime: 1 * 60 * 1000, // Consider stale after 1 minute
  });

  // Sync auth token on mount and when authentication changes
  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const syncAuthToken = async () => {
      if (!isAuthenticated) {
        // Clear widget data on logout
        await syncWidgetData({ authToken: null });
        return;
      }

      const token = await getAccessToken();
      if (token) {
        await syncWidgetData({
          authToken: token,
          apiBaseURL: process.env.EXPO_PUBLIC_API_URL || "https://push-pull.onrender.com/api",
        });
      }
    };

    void syncAuthToken();
  }, [isAuthenticated, getAccessToken]);

  // Sync user data whenever it changes
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!user) return;

    const syncUserData = async () => {
      await syncWidgetData({
        weeklyGoal: user.weeklyGoal ?? 4,
        userName: user.name || null,
        userHandle: user.handle || null,
      });
    };

    void syncUserData();
  }, [user]);

  // Sync weekly progress whenever it changes
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!weeklyData) return;

    const syncProgress = async () => {
      await syncWidgetData({
        currentProgress: weeklyData.workoutsThisWeek,
        currentStreak: weeklyData.currentStreak || 0,
      });
    };

    void syncProgress();
  }, [weeklyData]);
};
