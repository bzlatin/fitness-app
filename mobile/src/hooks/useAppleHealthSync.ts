import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useCurrentUser } from "./useCurrentUser";
import { syncAppleHealthWorkouts } from "../services/appleHealth";

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const useAppleHealthSync = () => {
  const { user, refresh } = useCurrentUser();
  const syncingRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!user?.appleHealthEnabled || user.appleHealthPermissions?.workouts === false) return;

    let cancelled = false;

    const runSync = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const result = await syncAppleHealthWorkouts({
          permissions: user.appleHealthPermissions ?? undefined,
          respectThrottle: true,
        });
        if (!cancelled && result.status === "synced") {
          await refresh();
        }
      } catch (err) {
        console.warn("[AppleHealth] background sync failed", err);
      } finally {
        syncingRef.current = false;
      }
    };

    void runSync();
    const interval = setInterval(runSync, DAILY_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.appleHealthEnabled, user?.appleHealthPermissions, refresh]);
};
