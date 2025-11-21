import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  deleteCurrentUserAccount,
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from "../api/social";
import { useAuth } from "./AuthContext";
import { UserProfile } from "../types/user";
import { SocialProfile } from "../types/social";

type State = {
  user: UserProfile | null;
  isLoading: boolean;
  isOnboarded: boolean;
  refresh: () => Promise<void>;
  updateProfile: (payload: Partial<UserProfile>) => Promise<void>;
  completeOnboarding: (payload: Partial<UserProfile>) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const STORAGE_KEY = "push-pull.user-profile";

const UserProfileContext = createContext<State | undefined>(undefined);

const isProfileComplete = (profile: UserProfile | null) =>
  Boolean(profile?.profileCompletedAt || profile?.handle);

export const UserProfileProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const persist = async (next: UserProfile | null) => {
    setUser(next);
    if (!next) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    const loadCached = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setUser(JSON.parse(raw) as UserProfile);
        }
      } finally {
        setIsLoading(false);
      }
    };
    void loadCached();
  }, []);

  const backfillProfileCompletion = async (profile: UserProfile) => {
    if (profile.profileCompletedAt || !profile.handle) {
      return profile;
    }
    try {
      const stamped = await updateCurrentUserProfile({
        profileCompletedAt: new Date().toISOString(),
      });
      return stamped as UserProfile;
    } catch (err) {
      console.warn("Failed to backfill profile completion", err);
      return profile;
    }
  };

  const refresh = async () => {
    if (!isAuthenticated) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    const shouldBlock = !user;
    if (shouldBlock) {
      setIsLoading(true);
    }
    try {
      const profile = await getCurrentUserProfile();
      const finalizedProfile = await backfillProfileCompletion(profile as UserProfile);
      await persist(finalizedProfile);
      queryClient.setQueryData<SocialProfile>(
        ["profile", profile.id],
        (prev) => ({ ...(prev ?? {}), ...(finalizedProfile as SocialProfile) })
      );
    } catch (err) {
      console.warn("Failed to sync profile", err);
    } finally {
      if (shouldBlock) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void refresh();
  }, [isAuthenticated]);

  const updateProfile = async (payload: Partial<UserProfile>) => {
    const updated = await updateCurrentUserProfile(payload);
    await persist(updated as UserProfile);
    queryClient.setQueryData<SocialProfile>(
      ["profile", updated.id],
      (prev) => ({
        ...(prev ?? {}),
        ...(updated as SocialProfile),
        isFollowing: prev?.isFollowing ?? false,
      })
    );
  };

  const completeOnboarding = async (payload: Partial<UserProfile>) => {
    await updateProfile({
      ...payload,
      profileCompletedAt:
        payload.profileCompletedAt ?? new Date().toISOString(),
    });
  };

  const deleteAccount = async () => {
    await deleteCurrentUserAccount();
    await persist(null);
    queryClient.clear();
  };

  const value = useMemo<State>(
    () => ({
      user,
      isLoading,
      isOnboarded: isProfileComplete(user),
      refresh,
      updateProfile,
      completeOnboarding,
      deleteAccount,
    }),
    [user, isLoading]
  );

  return (
    <UserProfileContext.Provider value={value}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const ctx = useContext(UserProfileContext);
  if (!ctx) {
    throw new Error("useUserProfile must be used within UserProfileProvider");
  }
  return ctx;
};
