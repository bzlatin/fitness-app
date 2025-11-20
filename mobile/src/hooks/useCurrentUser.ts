import { useUserProfile } from "../context/UserProfileContext";

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
  return {
    user,
    isLoading,
    updateProfile,
    deleteAccount,
    isOnboarded,
    completeOnboarding,
    refresh,
  };
};
