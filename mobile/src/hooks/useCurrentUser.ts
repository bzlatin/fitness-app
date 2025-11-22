import { useUserProfile } from "../context/UserProfileContext";
import { useAuth } from "../context/AuthContext";

export const useCurrentUser = () => {
  const {
    user,
    isLoading,
    updateProfile,
    deleteAccount,
    isOnboarded,
    completeOnboarding,
    refresh,
  } = useUserProfile();
  const { getAccessToken } = useAuth();
  return {
    user,
    isLoading,
    updateProfile,
    deleteAccount,
    isOnboarded,
    completeOnboarding,
    refresh,
    getAccessToken,
  };
};
