import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Text,
  TouchableOpacity,
  View,
  Pressable,
  TextInput,
  Alert,
  Modal,
  Image,
  Switch,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { UNSTABLE_usePreventRemove as usePreventRemove } from "@react-navigation/core";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import { useAuth } from "../context/AuthContext";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  followUser,
  getConnections,
  removeFollower,
  unfollowUser,
} from "../api/social";
import { UserProfile } from "../types/user";
import { SocialUserSummary } from "../types/social";
import { formatHandle, normalizeHandle } from "../utils/formatHandle";
import { RootNavigation } from "../navigation/RootNavigator";
import { RootRoute } from "../navigation/types";
import { restorePurchases } from "../services/payments";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { TERMS_URL, PRIVACY_URL, SUPPORT_URL } from "../config/legal";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
import { isRemoteAvatarUrl, processAvatarAsset } from "../utils/avatarImage";
import {
  registerForPushNotificationsAsync,
  getNotificationPreferences,
  updateNotificationPreferences,
  NotificationPreferences,
} from "../services/notifications";
import { useNewShippedCount } from "../api/feedback";
import { uploadCurrentUserAvatar } from "../api/social";
import {
  clearAppleHealthData,
  getLastAppleHealthSync,
  getAppleHealthAvailability,
  requestAppleHealthPermissions,
  syncAppleHealthWorkouts,
} from "../services/appleHealth";
import { AppleHealthPermissions } from "../types/health";

const initialsForName = (name?: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

const HANDLE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const SettingsScreen = () => {
  const queryClient = useQueryClient();
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RootRoute<"Settings">>();
  const insets = useSafeAreaInsets();
  const { logout, isAuthorizing } = useAuth();
  const { user, updateProfile, deleteAccount, refresh, isLoading } =
    useCurrentUser();
  const lastUserIdRef = useRef<string | null>(null);
  const [draftName, setDraftName] = useState(user?.name ?? "");
  const [draftHandle, setDraftHandle] = useState(user?.handle ?? "");
  const [draftBio, setDraftBio] = useState(user?.bio ?? "");
  const [draftTraining, setDraftTraining] = useState(user?.trainingStyle ?? "");
  const [draftGym, setDraftGym] = useState(user?.gymName ?? "");
  const [draftWeeklyGoal, setDraftWeeklyGoal] = useState(
    String(user?.weeklyGoal ?? 4)
  );
  const [showGym, setShowGym] = useState(
    (user?.gymVisibility ?? "hidden") === "shown"
  );
  const [avatarUri, setAvatarUri] = useState<string | undefined>(
    user?.avatarUrl
  );
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const pendingLeaveActionRef = useRef<any | null>(null);
  const [selectedConnection, setSelectedConnection] =
    useState<SocialUserSummary | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isTogglingProgression, setIsTogglingProgression] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [showPreferencesSheet, setShowPreferencesSheet] = useState(false);
  const [showNotificationsSheet, setShowNotificationsSheet] = useState(false);
  const [showBillingSheet, setShowBillingSheet] = useState(false);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [connectionsContentHeight, setConnectionsContentHeight] = useState(0);
  const [connectionsScrollHeight, setConnectionsScrollHeight] = useState(0);
  const [connectionsIsNearTop, setConnectionsIsNearTop] = useState(true);
  const [connectionsIsNearBottom, setConnectionsIsNearBottom] = useState(false);
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPreferences | null>(null);
  const [isLoadingNotificationPrefs, setIsLoadingNotificationPrefs] =
    useState(false);
  const isLoadingNotificationPrefsRef = useRef(false);
  const [healthPermissions, setHealthPermissions] =
    useState<AppleHealthPermissions>({
      workouts: true,
      activeEnergy: true,
      heartRate: true,
    });
  const [isSyncingHealth, setIsSyncingHealth] = useState(false);
  const [lastHealthSync, setLastHealthSync] = useState<Date | null>(null);
  const [appleHealthEnabledUi, setAppleHealthEnabledUi] = useState<
    boolean | null
  >(null);
  const lastHandleChange = user?.handleLastChangedAt
    ? new Date(user.handleLastChangedAt)
    : null;
  const nextHandleChangeDate =
    lastHandleChange && !Number.isNaN(lastHandleChange.getTime())
      ? new Date(lastHandleChange.getTime() + HANDLE_CHANGE_COOLDOWN_MS)
      : null;
  const canEditHandle =
    !user?.handle ||
    !nextHandleChangeDate ||
    nextHandleChangeDate.getTime() <= Date.now();
  const handleStatusMessage = canEditHandle
    ? "Handles are unique—pick one you'll keep. You can update yours every 30 days."
    : nextHandleChangeDate
    ? `Handle changes unlock on ${nextHandleChangeDate.toLocaleDateString()}.`
    : "Handle changes are temporarily locked.";

  const subscriptionAccess = useSubscriptionAccess();
  const subscriptionStatus = subscriptionAccess.raw;

  // Feedback board badge
  const { data: newShippedData } = useNewShippedCount();
  const newShippedCount = newShippedData?.count ?? 0;
  const isSubscriptionLoading = subscriptionAccess.isLoading;
  const isSubscriptionError = subscriptionAccess.isError;
  const refetchSubscriptionStatus = subscriptionAccess.refetch;
  const subscriptionPlan = subscriptionStatus?.plan ?? user?.plan ?? "free";
  const hasProPlan = subscriptionAccess.hasProPlan;
  const hasProAccess = subscriptionAccess.hasProAccess;
  const isPro = hasProAccess;
  const isIOS = Platform.OS === "ios";
  const appleHealthEnabledFromProfile = user?.appleHealthEnabled ?? false;
  const appleHealthEnabled =
    appleHealthEnabledUi ?? appleHealthEnabledFromProfile;
  const isAppleSubscription =
    subscriptionStatus?.subscriptionPlatform === "apple" ||
    !!subscriptionStatus?.appleOriginalTransactionId;
  const platformStatus = subscriptionAccess.status;
  const isGrace = subscriptionAccess.isGrace;
  const isExpired = subscriptionAccess.isExpired;
  const formatDate = (value?: number | null | string | Date) => {
    if (!value) return undefined;
    const date =
      value instanceof Date
        ? value
        : typeof value === "number"
        ? new Date(value < 2_000_000_000 ? value * 1000 : value)
        : new Date(value);
    return date.toLocaleDateString();
  };
  const shouldShowRenewalDate =
    (hasProPlan || subscriptionAccess.isTrial || isGrace) && !isExpired;
  const renewalDate = shouldShowRenewalDate
    ? formatDate(subscriptionAccess.currentPeriodEnd) ??
      (user?.planExpiresAt ? formatDate(user.planExpiresAt) : undefined)
    : undefined;
  const expiredOn = isExpired
    ? formatDate(
        subscriptionStatus?.planExpiresAt ??
          subscriptionStatus?.currentPeriodEnd ??
          subscriptionAccess.currentPeriodEnd ??
          undefined
      )
    : undefined;
  const trialEnds = formatDate(subscriptionAccess.trialEndsAt ?? undefined);
  const healthSyncDisplay =
    (
      lastHealthSync ??
      (user?.appleHealthLastSyncAt
        ? new Date(user.appleHealthLastSyncAt)
        : null)
    )?.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) ?? "Not synced yet";

  const hasProfileChanges = useMemo(() => {
    if (!user) return false;
    return (
      draftName !== (user.name ?? "") ||
      draftHandle !== (user.handle ?? "") ||
      draftBio !== (user.bio ?? "") ||
      draftTraining !== (user.trainingStyle ?? "") ||
      draftGym !== (user.gymName ?? "") ||
      draftWeeklyGoal !== String(user.weeklyGoal ?? 4) ||
      showGym !== ((user.gymVisibility ?? "hidden") === "shown") ||
      (avatarUri ?? undefined) !== (user.avatarUrl ?? undefined)
    );
  }, [
    user,
    draftName,
    draftHandle,
    draftBio,
    draftTraining,
    draftGym,
    draftWeeklyGoal,
    showGym,
    avatarUri,
  ]);

  const preventRemove = isEditing && hasProfileChanges && !isSaving;

  const resetProfileDraftsToUser = useCallback(() => {
    if (!user) return;
    setDraftName(user.name ?? "");
    setDraftHandle(user.handle ?? "");
    setDraftBio(user.bio ?? "");
    setDraftTraining(user.trainingStyle ?? "");
    setDraftGym(user.gymName ?? "");
    setDraftWeeklyGoal(String(user.weeklyGoal ?? 4));
    setShowGym((user.gymVisibility ?? "hidden") === "shown");
    setAvatarUri(user.avatarUrl ?? undefined);
  }, [user]);

  useEffect(() => {
    navigation.setOptions({
      headerBackButtonMenuEnabled: false,
      headerRight: isEditing
        ? () => (
            <Pressable
              onPress={() => handleSave()}
              disabled={!hasProfileChanges || isSaving || isProcessingAvatar}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor:
                  !hasProfileChanges || isSaving || isProcessingAvatar
                    ? colors.border
                    : pressed
                    ? `${colors.primary}CC`
                    : colors.primary,
              })}
            >
              <Text
                style={{
                  color: colors.surface,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                {isSaving ? "Saving…" : hasProfileChanges ? "Save" : "Saved"}
              </Text>
            </Pressable>
          )
        : undefined,
    });
  }, [
    navigation,
    isEditing,
    hasProfileChanges,
    isSaving,
    isProcessingAvatar,
  ]);

  // Warn on back/swipe-out when editing profile with unsaved changes.
  usePreventRemove(preventRemove, (event) => {
    const actionType = event.data.action.type;
    if (
      actionType !== "GO_BACK" &&
      actionType !== "POP" &&
      actionType !== "POP_TO_TOP"
    ) {
      return;
    }

    Alert.alert(
      "Unsaved changes",
      "You have unsaved profile changes. Save before leaving?",
      [
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            pendingLeaveActionRef.current = null;
            setIsEditing(false);
            resetProfileDraftsToUser();
            setTimeout(() => navigation.dispatch(event.data.action), 0);
          },
        },
        { text: "Keep editing", style: "cancel" },
        {
          text: "Save",
          onPress: () => {
            pendingLeaveActionRef.current = event.data.action;
            handleSave({ leaveAfterSave: true });
          },
        },
      ]
    );
  });

  useEffect(() => {
    if (
      appleHealthEnabledUi !== null &&
      appleHealthEnabledUi === appleHealthEnabledFromProfile
    ) {
      setAppleHealthEnabledUi(null);
    }
  }, [appleHealthEnabledFromProfile, appleHealthEnabledUi]);

  useEffect(() => {
    const lastUserId = lastUserIdRef.current;
    const nextUserId = user?.id ?? null;
    lastUserIdRef.current = nextUserId;

    if (lastUserId && nextUserId && lastUserId !== nextUserId) {
      setIsEditing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user || isEditing) return;
    setDraftName(user.name ?? "");
    setDraftHandle(user.handle ?? "");
    setDraftBio(user.bio ?? "");
    setDraftTraining(user.trainingStyle ?? "");
    setDraftGym(user.gymName ?? "");
    setDraftWeeklyGoal(String(user.weeklyGoal ?? 4));
    setShowGym((user.gymVisibility ?? "hidden") === "shown");
    setAvatarUri(user.avatarUrl ?? undefined);
    setHealthPermissions({
      workouts: user.appleHealthPermissions?.workouts ?? true,
      activeEnergy: user.appleHealthPermissions?.activeEnergy ?? true,
      heartRate: user.appleHealthPermissions?.heartRate ?? true,
    });
    setLastHealthSync(
      user.appleHealthLastSyncAt ? new Date(user.appleHealthLastSyncAt) : null
    );
  }, [
    user?.id,
    user?.name,
    user?.handle,
    user?.bio,
    user?.trainingStyle,
    user?.gymName,
    user?.gymVisibility,
    user?.avatarUrl,
    user?.weeklyGoal,
    user?.appleHealthPermissions,
    user?.appleHealthLastSyncAt,
    isEditing,
  ]);

  useEffect(() => {
    if (route.params?.openConnections) {
      // Open modal immediately when navigated here with openConnections param
      setShowConnectionsModal(true);
    }
  }, [route.params?.openConnections]);

  useEffect(() => {
    const loadLocalHealthSync = async () => {
      if (user?.appleHealthLastSyncAt) return;
      const local = await getLastAppleHealthSync();
      if (local) {
        setLastHealthSync(local);
      }
    };

    void loadLocalHealthSync();
  }, [user?.appleHealthLastSyncAt]);

  useEffect(() => {
    if (showConnectionsModal) {
      setConnectionsIsNearTop(true);
      setConnectionsIsNearBottom(false);
      setConnectionsContentHeight(0);
      setConnectionsScrollHeight(0);
    }
  }, [showConnectionsModal]);

  const loadNotificationPreferences = useCallback(async () => {
    // Skip if already loading
    if (isLoadingNotificationPrefsRef.current) return;
    isLoadingNotificationPrefsRef.current = true;
    try {
      setIsLoadingNotificationPrefs(true);
      const prefs = await getNotificationPreferences();
      setNotificationPrefs(prefs);
    } catch (error) {
      console.error(
        "[Settings] Error loading notification preferences:",
        error
      );
    } finally {
      setIsLoadingNotificationPrefs(false);
      isLoadingNotificationPrefsRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refetchSubscriptionStatus();
      // Only load notification prefs if we don't have them yet
      if (!notificationPrefs) {
        void loadNotificationPreferences();
      }
    }, [
      refresh,
      refetchSubscriptionStatus,
      loadNotificationPreferences,
      notificationPrefs,
    ])
  );

  const handleEnableNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        Alert.alert(
          "Notifications Enabled",
          "You'll now receive goal reminders and squad activity updates."
        );
        // Reset ref and reload prefs after enabling
        isLoadingNotificationPrefsRef.current = false;
        await loadNotificationPreferences();
      } else {
        Alert.alert(
          "Notification Permission Required",
          "Please enable notifications in your device settings to receive updates."
        );
      }
    } catch (error) {
      console.error("[Settings] Error enabling notifications:", error);

      // Check if it's the "native module not found" error (Expo Go limitation)
      const errorMessage = error instanceof Error ? error.message : "";
      if (
        errorMessage.includes("ExpoPushTokenManager") ||
        errorMessage.includes("native module")
      ) {
        Alert.alert(
          "Development Build Required",
          "Push notifications require a development build. In Expo Go, you can view the notification settings UI, but won't receive actual push notifications.\n\nTo test push notifications, create a development build with: eas build --profile development --platform ios",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Error",
          "Failed to enable notifications. Please try again."
        );
      }
    }
  };

  const notificationToggleKeys = [
    "goalReminders",
    "inactivityNudges",
    "squadActivity",
    "weeklyGoalMet",
  ] as const;
  type NotificationToggleKey = (typeof notificationToggleKeys)[number];

  const handleToggleNotificationPref = async (
    key: NotificationToggleKey,
    value: boolean
  ) => {
    if (!notificationPrefs) return;

    try {
      const updatedPrefs = await updateNotificationPreferences(
        { [key]: value } as Partial<NotificationPreferences>
      );
      setNotificationPrefs(updatedPrefs);
    } catch (error) {
      console.error(
        "[Settings] Error updating notification preference:",
        error
      );
      Alert.alert("Error", "Failed to update notification settings.");
    }
  };

  const handleAppleHealthToggle = async (enabled: boolean) => {
    const previousEnabled = appleHealthEnabledFromProfile;
    const previousPermissions = { ...healthPermissions };
    setAppleHealthEnabledUi(enabled);

    if (enabled) {
      const availability = getAppleHealthAvailability();
      if (!availability.available) {
        setAppleHealthEnabledUi(previousEnabled);
        Alert.alert(
          "Apple Health unavailable",
          availability.reason ??
            "Apple Health sync is unavailable on this device."
        );
        return;
      }
    }

    setIsSyncingHealth(true);
    try {
      if (enabled) {
        const permissionsToUse = {
          workouts: true,
          activeEnergy: true,
          heartRate: true,
        };
        setHealthPermissions(permissionsToUse);
        const granted = await requestAppleHealthPermissions(
          permissionsToUse,
          "readWrite"
        );
        if (!granted) {
          setAppleHealthEnabledUi(previousEnabled);
          Alert.alert(
            "Permission needed",
            "Please allow Apple Health access in the system prompt or Settings > Health > Apps."
          );
          return;
        }

        const result = await syncAppleHealthWorkouts({
          permissions: permissionsToUse,
          force: true,
          respectThrottle: false,
        });
        const now = new Date();
        await updateProfile({
          appleHealthEnabled: true,
          appleHealthPermissions: permissionsToUse,
          appleHealthLastSyncAt:
            result.status === "synced"
              ? now.toISOString()
              : user?.appleHealthLastSyncAt,
        });
        if (result.status === "synced") {
          setLastHealthSync(now);
        }
        Alert.alert(
          "Apple Health synced",
          `Imported ${result.importedCount ?? 0} workouts${
            result.skippedCount ? ` · ${result.skippedCount} skipped` : ""
          }`
        );
      } else {
        const disabledPermissions: AppleHealthPermissions = {
          workouts: false,
          activeEnergy: false,
          heartRate: false,
        };
        setHealthPermissions(disabledPermissions);
        await updateProfile({
          appleHealthEnabled: false,
          appleHealthPermissions: disabledPermissions,
          appleHealthLastSyncAt: null,
        });
        setLastHealthSync(null);
        try {
          await clearAppleHealthData();
        } catch (err) {
          console.error("[Settings] Failed to clear Apple Health imports", err);
          Alert.alert(
            "Apple Health",
            "Sync was turned off, but we couldn't clear imported workouts yet."
          );
        }
      }
    } catch (err) {
      setAppleHealthEnabledUi(previousEnabled);
      setHealthPermissions(previousPermissions);
      console.error("[Settings] Apple Health toggle failed", err);
      Alert.alert(
        "Apple Health",
        "Could not update Apple Health sync. Please try again."
      );
    } finally {
      setIsSyncingHealth(false);
    }
  };

  const handleHealthPermissionToggle = async (
    key: keyof AppleHealthPermissions,
    value: boolean
  ) => {
    const next = { ...healthPermissions, [key]: value };
    setHealthPermissions(next);

    if (key === "workouts" && !value) {
      await handleAppleHealthToggle(false);
      return;
    }

    try {
      if (appleHealthEnabled && isIOS) {
        await requestAppleHealthPermissions(next, "readWrite");
      }
      await updateProfile({
        appleHealthPermissions: next,
        appleHealthEnabled: appleHealthEnabled || (key === "workouts" && value),
      });
    } catch (err) {
      console.error(
        "[Settings] Failed to update Apple Health permissions",
        err
      );
      Alert.alert(
        "Apple Health",
        "Could not update permissions. Please try again."
      );
    }
  };

  const handleSyncAppleHealthNow = async () => {
    const availability = getAppleHealthAvailability();
    if (!availability.available) {
      Alert.alert(
        "Apple Health unavailable",
        availability.reason ??
          "Apple Health sync is unavailable on this device."
      );
      return;
    }
    setIsSyncingHealth(true);
    try {
      const result = await syncAppleHealthWorkouts({
        permissions: { ...healthPermissions, workouts: true },
        force: true,
        respectThrottle: false,
      });
      if (result.status === "denied") {
        Alert.alert(
          "Permission needed",
          "Please allow Apple Health access to import workouts and activity."
        );
        return;
      }
      const now = new Date();
      await updateProfile({
        appleHealthEnabled: true,
        appleHealthPermissions: healthPermissions,
        appleHealthLastSyncAt: now.toISOString(),
      });
      setLastHealthSync(now);
      Alert.alert(
        "Apple Health synced",
        `Imported ${result.importedCount ?? 0} workouts${
          result.skippedCount ? ` · ${result.skippedCount} skipped` : ""
        }`
      );
    } catch (err) {
      console.error("[Settings] Manual Apple Health sync failed", err);
      Alert.alert(
        "Apple Health",
        "Could not sync Apple Health data. Please try again."
      );
    } finally {
      setIsSyncingHealth(false);
    }
  };

  const handleClearAppleHealthImports = () => {
    Alert.alert(
      "Clear imported workouts?",
      "This removes Apple Health sessions from your history and turns off syncing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            const disabledPermissions: AppleHealthPermissions = {
              workouts: false,
              activeEnergy: false,
              heartRate: false,
            };
            const previousPermissions = { ...healthPermissions };
            const previousLastSync = lastHealthSync;
            const previousEnabled = appleHealthEnabledFromProfile;
            setAppleHealthEnabledUi(false);
            setHealthPermissions(disabledPermissions);
            setLastHealthSync(null);
            setIsSyncingHealth(true);
            try {
              await updateProfile({
                appleHealthEnabled: false,
                appleHealthPermissions: disabledPermissions,
                appleHealthLastSyncAt: null,
              });
              try {
                await clearAppleHealthData();
              } catch (err) {
                console.error(
                  "[Settings] Failed to clear Apple Health imports",
                  err
                );
                Alert.alert(
                  "Apple Health",
                  "Sync was turned off, but we couldn't clear imported workouts yet."
                );
              }
            } catch (err) {
              setAppleHealthEnabledUi(previousEnabled);
              setHealthPermissions(previousPermissions);
              setLastHealthSync(previousLastSync);
              console.error(
                "[Settings] Failed to clear Apple Health imports",
                err
              );
              Alert.alert(
                "Apple Health",
                "Could not clear imported workouts right now."
              );
            } finally {
              setIsSyncingHealth(false);
            }
          },
        },
      ]
    );
  };

  const restorePurchasesMutation = useMutation({
    mutationFn: () => restorePurchases(),
    onError: (err: Error) => {
      Alert.alert("Restore failed", err.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["subscription", "status"],
      });
      await refresh();
      Alert.alert("Restored", "Your Apple subscription has been restored.");
    },
  });

  const connectionsQuery = useQuery({
    queryKey: ["social", "connections", "settings"],
    queryFn: getConnections,
    enabled: Boolean(user),
  });
  const { refetch: refetchConnections } = connectionsQuery;
  useEffect(() => {
    if (showConnectionsModal) {
      void refetchConnections();
    }
  }, [showConnectionsModal, refetchConnections]);
  const friends = connectionsQuery.data?.friends ?? [];
  const pendingInvites = connectionsQuery.data?.pendingInvites ?? [];
  const outgoingInvites = connectionsQuery.data?.outgoingInvites ?? [];
  const friendCount = connectionsQuery.data
    ? friends.length
    : user?.friendsCount ?? 0;
  const invalidateConnections = () =>
    queryClient.invalidateQueries({
      queryKey: ["social", "connections"],
      exact: false,
    });
  const refreshConnections = async () => {
    invalidateConnections();
    await queryClient.refetchQueries({
      queryKey: ["social", "connections"],
      type: "active",
    });
    await queryClient.refetchQueries({
      queryKey: ["social", "connections", "settings"],
      type: "active",
    });
    await refresh();
  };

  const acceptInvite = useMutation({
    mutationFn: followUser,
    onMutate: (id) => setPendingActionId(id),
    onSettled: () => setPendingActionId(null),
    onSuccess: refreshConnections,
  });

  const closeConnectionsModal = () => {
    setShowConnectionsModal(false);
    setSelectedConnection(null);
    setConnectionsContentHeight(0);
    setConnectionsScrollHeight(0);
    setConnectionsIsNearTop(true);
    setConnectionsIsNearBottom(false);

    // If the modal was opened via route params (from Profile), go back
    if (route.params?.openConnections) {
      navigation.goBack();
    }
  };

  const declineInvite = useMutation({
    mutationFn: removeFollower,
    onMutate: (id) => setPendingActionId(id),
    onSettled: () => setPendingActionId(null),
    onSuccess: refreshConnections,
  });

  const cancelOutgoing = useMutation({
    mutationFn: unfollowUser,
    onMutate: (id) => setPendingActionId(id),
    onSettled: () => setPendingActionId(null),
    onSuccess: refreshConnections,
  });

  const renderConnectionGroup = (
    title: string,
    subtitle: string,
    list: SocialUserSummary[],
    emptyCopy: string,
    renderActions?: (person: SocialUserSummary) => ReactElement | null
  ) => (
    <View
      style={{
        gap: 10,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
              fontSize: 14,
            }}
          >
            {title}
          </Text>
          <Text
            style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}
          >
            {subtitle}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", minWidth: 52 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.bold,
              fontSize: 18,
            }}
          >
            {list.length}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            people
          </Text>
        </View>
      </View>
      {list.length ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          {list.map((person) => (
            <View
              key={person.id}
              style={{
                flexBasis: "48%",
                maxWidth: 200,
                minWidth: 150,
                alignItems: "stretch",
                gap: 10,
              }}
            >
              <Pressable
                onPress={() => setSelectedConnection(person)}
                style={({ pressed }) => ({
                  width: "100%",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 10,
                  borderRadius: 16,
                  backgroundColor: pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {person.avatarUrl ? (
                    <Image
                      source={{ uri: person.avatarUrl }}
                      style={{ width: 64, height: 64, borderRadius: 999 }}
                    />
                  ) : (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 18,
                      }}
                    >
                      {initialsForName(person.name)}
                    </Text>
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 12,
                  }}
                >
                  {person.name}
                </Text>
                {person.handle ? (
                  <Text
                    numberOfLines={1}
                    style={{ color: colors.textSecondary, fontSize: 11 }}
                  >
                    {formatHandle(person.handle)}
                  </Text>
                ) : null}
              </Pressable>
              {renderActions ? renderActions(person) : null}
            </View>
          ))}
        </View>
      ) : (
        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {emptyCopy}
          </Text>
        </View>
      )}
    </View>
  );

  if (!user || isLoading) {
    return (
      <ScreenContainer>
        <Text style={{ color: colors.textSecondary, marginTop: 20 }}>
          Loading profile…
        </Text>
      </ScreenContainer>
    );
  }

  const ensurePhotoPermission = async () => {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing.granted || existing.accessPrivileges === "limited")
      return true;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted || permission.accessPrivileges === "limited")
      return true;
    Alert.alert(
      "Permission needed",
      "Enable photo access to add a profile picture.",
      [
        {
          text: "Open settings",
          onPress: () => Linking.openSettings(),
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
    return false;
  };

  const pickAvatar = async () => {
    const allowed = await ensurePhotoPermission();
    if (!allowed) return;
    try {
      setIsProcessingAvatar(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.75,
        base64: false,
        aspect: [1, 1],
        mediaTypes: ['images'], // Only allow images, no videos
        presentationStyle:
          ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const processed = await processAvatarAsset(asset);
        setAvatarUri(processed);
      } else if (result.canceled) {
        Alert.alert(
          "No photo selected",
          "Choose a photo to update your profile."
        );
      }
    } catch (err) {
      console.warn("Image picker failed", err);
      Alert.alert(
        "Could not open photos",
        "Please try again or reopen app permissions."
      );
    } finally {
      setIsProcessingAvatar(false);
    }
  };

  async function handleSave(options?: { leaveAfterSave?: boolean }) {
    if (!user) return;
    if (isProcessingAvatar) {
      Alert.alert(
        "Processing photo",
        "Hang tight—still preparing your picture. Try saving again in a moment."
      );
      return;
    }

    setIsSaving(true);
    try {
      let uploadReadyAvatar = isRemoteAvatarUrl(avatarUri)
        ? avatarUri
        : undefined;
      if (avatarUri && !uploadReadyAvatar) {
        try {
          uploadReadyAvatar = await uploadCurrentUserAvatar(avatarUri);
          setAvatarUri(uploadReadyAvatar);
        } catch (err) {
          console.error("[Settings] Avatar upload failed", err);
          Alert.alert(
            "Photo upload failed",
            "We saved your other profile changes, but couldn't upload that photo. Try again later."
          );
          setAvatarUri(user.avatarUrl ?? undefined);
          uploadReadyAvatar = undefined;
        }
      }
      const payload: Partial<UserProfile> = {
        name: draftName.trim() || user.name,
        bio: draftBio.trim() || undefined,
        trainingStyle: draftTraining.trim() || undefined,
        gymName: draftGym.trim() ? draftGym.trim() : null,
        gymVisibility: showGym ? "shown" : "hidden",
        weeklyGoal: Number(draftWeeklyGoal) || 4,
        avatarUrl: uploadReadyAvatar,
      };

      if (canEditHandle) {
        const normalized = normalizeHandle(draftHandle);
        if (!normalized) {
          throw new Error("Handle is required");
        }
        payload.handle = normalized;
      }

      await updateProfile(payload);
      Alert.alert("Saved", "Profile updated.");
      setIsEditing(false);
      if (options?.leaveAfterSave && pendingLeaveActionRef.current) {
        const action = pendingLeaveActionRef.current;
        pendingLeaveActionRef.current = null;
        setTimeout(() => navigation.dispatch(action), 0);
      }
    } catch (err) {
      if (options?.leaveAfterSave) {
        pendingLeaveActionRef.current = null;
      }
      const status = (err as { status?: number }).status;
      const message =
        err instanceof Error && err.message.includes("Handle already taken")
          ? "That handle is taken. Try another."
        : status === 429
          ? "You can only change your handle once every 30 days."
          : (err as Error)?.message ?? "Please try again.";
      Alert.alert("Could not save", message);
    } finally {
      setIsSaving(false);
    }
  }

  const preferencesSubtitle = `${
    isPro
      ? `Progressive overload ${
          user?.progressiveOverloadEnabled ? "on" : "off"
        }`
      : "Unlock progressive overload"
  } · Rest timer ${
    user?.restTimerSoundEnabled ?? true ? "sound on" : "silent"
  } · Training goals`;

  const notificationToggleCount = notificationPrefs
    ? notificationToggleKeys.filter((key) => notificationPrefs[key]).length
    : 0;

  const notificationsSubtitle = isLoadingNotificationPrefs
    ? "Loading notification preferences…"
    : !notificationPrefs
    ? "Enable push to manage goal reminders and squad activity"
    : `${notificationToggleCount}/4 toggles on · Inbox`;

  const billingSubtitle = isSubscriptionLoading
    ? "Loading billing status…"
    : isPro
    ? `Pro · ${isAppleSubscription ? "Apple billing" : "Billing"}${
        renewalDate
          ? ` · ${
              subscriptionStatus?.cancelAtPeriodEnd
                ? `Ends ${renewalDate}`
                : `Renews ${renewalDate}`
            }`
          : ""
      }`
    : "Free · Upgrade for unlimited templates and smart workouts";

  return (
    <ScreenContainer
      scroll
      includeTopInset={false}
      paddingTop={12}
      bottomOverlay={
        isEditing ? (
          <View pointerEvents="box-none">
            <LinearGradient
              colors={["transparent", `${colors.background}CC`, colors.background]}
              locations={[0, 0.45, 1]}
              style={{ height: 36 }}
              pointerEvents="none"
            />
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: colors.background,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
                elevation: 10,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 99,
                      backgroundColor: hasProfileChanges ? colors.primary : colors.border,
                    }}
                  />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    {hasProfileChanges ? "Unsaved changes" : "All changes saved"}
                  </Text>
                </View>
                {isProcessingAvatar ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Processing photo…
                  </Text>
                ) : isSaving ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Saving…
                  </Text>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => {
                    if (!hasProfileChanges) {
                      setIsEditing(false);
                      return;
                    }
                    Alert.alert(
                      "Discard changes?",
                      "Your edits will be lost.",
                      [
                        { text: "Keep editing", style: "cancel" },
                        {
                          text: "Discard",
                          style: "destructive",
                          onPress: () => {
                            resetProfileDraftsToUser();
                            setIsEditing(false);
                          },
                        },
                      ]
                    );
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isSaving ? 0.6 : 1,
                  })}
                  disabled={isSaving}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    {hasProfileChanges ? "Discard" : "Done"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSave()}
                  disabled={!hasProfileChanges || isSaving || isProcessingAvatar}
                  style={({ pressed }) => ({
                    flex: 2,
                    paddingVertical: 16,
                    borderRadius: 16,
                    backgroundColor:
                      !hasProfileChanges || isSaving || isProcessingAvatar
                        ? colors.border
                        : colors.primary,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                    opacity: pressed ? 0.92 : 1,
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity:
                      !hasProfileChanges || isSaving || isProcessingAvatar ? 0 : 0.28,
                    shadowRadius: 10,
                    elevation:
                      !hasProfileChanges || isSaving || isProcessingAvatar ? 0 : 5,
                  })}
                >
                  <Ionicons
                    name={isSaving ? "sync" : "checkmark-circle"}
                    size={20}
                    color={colors.surface}
                  />
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fontFamilies.bold,
                      fontSize: 16,
                    }}
                  >
                    {isSaving ? "Saving…" : "Save changes"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null
      }
    >
      <>
        {/* Hide settings content if opened just to show connections modal */}
        {!route.params?.openConnections && (
          <View style={{ marginTop: 10, gap: 16 }}>
            <Section
              title='Account'
              subtitle='Keep your profile tidy and your gym details accurate.'
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                <View
                  style={{ alignItems: "center", justifyContent: "center" }}
                >
                  {avatarUri ? (
                    <Image
                      source={{ uri: avatarUri }}
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 999,
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 999,
                        backgroundColor: colors.surfaceMuted,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 22,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {user.name?.[0]?.toUpperCase() ?? "?"}
                      </Text>
                    </View>
                  )}
                  {isProcessingAvatar ? (
                    <ActivityIndicator
                      size='small'
                      color={colors.primary}
                      style={{ position: "absolute" }}
                    />
                  ) : null}
                  {isEditing ? (
                    <Pressable
                      onPress={pickAvatar}
                      disabled={isProcessingAvatar}
                      style={({ pressed }) => ({
                        marginTop: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceMuted,
                        opacity: pressed || isProcessingAvatar ? 0.9 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {isProcessingAvatar
                          ? "Processing photo…"
                          : avatarUri
                          ? "Change photo"
                          : "Add photo"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 20,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    {user.name}
                  </Text>
                  {user.handle ? (
                    <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                      {user.handle}
                    </Text>
                  ) : null}
                  {user.trainingStyle ? (
                    <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                      {user.trainingStyle}
                    </Text>
                  ) : null}
                  {user.gymName && showGym ? (
                    <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                      {user.gymName}
                    </Text>
                  ) : null}
                </View>
                {!isEditing ? (
                  <Pressable
                    onPress={() => setIsEditing(true)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      Edit
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Stat label='Workouts' value={user.workoutsCompleted ?? 0} />
                <Stat
                  label='Friends'
                  value={friendCount ?? 0}
                  onPress={() => setShowConnectionsModal(true)}
                />
                <Stat
                  label='Streak'
                  value={
                    user.currentStreakDays ? `${user.currentStreakDays}d` : "—"
                  }
                />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Pending invites: {pendingInvites.length} · Sent invites:{" "}
                {outgoingInvites.length} (tap Friends to manage)
              </Text>

              {user.bio && !isEditing ? (
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      marginBottom: 4,
                    }}
                  >
                    Bio
                  </Text>
                  <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                    {user.bio}
                  </Text>
                </View>
              ) : null}
              {!isEditing ? (
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      marginBottom: 4,
                    }}
                  >
                    Gym
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {user.gymName
                      ? user.gymVisibility === "shown"
                        ? user.gymName
                        : "Hidden from profile"
                      : "Add your home gym so buddies can find you."}
                  </Text>
                </View>
              ) : null}

              {isEditing ? (
                <View style={{ gap: 8 }}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    Edit profile
                  </Text>
                  <TextInput
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder='Name'
                    placeholderTextColor={colors.textSecondary}
                    style={inputStyle}
                  />
                  <TextInput
                    value={draftHandle}
                    onChangeText={canEditHandle ? setDraftHandle : undefined}
                    placeholder='@handle'
                    placeholderTextColor={colors.textSecondary}
                    editable={canEditHandle}
                    selectTextOnFocus={canEditHandle}
                    style={[
                      inputStyle,
                      !canEditHandle
                        ? { opacity: 0.6, color: colors.textSecondary }
                        : null,
                    ]}
                  />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginTop: -4,
                    }}
                  >
                    {handleStatusMessage}
                  </Text>
                  <TextInput
                    value={draftBio}
                    onChangeText={setDraftBio}
                    placeholder='Bio'
                    placeholderTextColor={colors.textSecondary}
                    style={[inputStyle, { minHeight: 64 }]}
                    multiline
                  />
                  <TextInput
                    value={draftTraining}
                    onChangeText={setDraftTraining}
                    placeholder='Training focus'
                    placeholderTextColor={colors.textSecondary}
                    style={inputStyle}
                  />
                  <TextInput
                    value={draftGym}
                    onChangeText={setDraftGym}
                    placeholder='Home gym'
                    placeholderTextColor={colors.textSecondary}
                    style={inputStyle}
                  />
                  <TextInput
                    value={draftWeeklyGoal}
                    onChangeText={setDraftWeeklyGoal}
                    placeholder='4'
                    placeholderTextColor={colors.textSecondary}
                    keyboardType='numeric'
                    style={inputStyle}
                  />
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginTop: -4,
                    }}
                  >
                    Weekly workout goal (workouts per week)
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: colors.surfaceMuted,
                      padding: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <View>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        Show gym on profile
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 12 }}
                      >
                        Toggle off to keep it private.
                      </Text>
                    </View>
                    <Switch
                      value={showGym}
                      onValueChange={setShowGym}
                      trackColor={{
                        true: colors.primary,
                        false: colors.border,
                      }}
                      thumbColor={showGym ? "#fff" : "#f4f3f4"}
                    />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                    Use the sticky Save button below to commit changes.
                  </Text>
                </View>
              ) : null}

              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() => setIsDeleteOpen(true)}
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    Manage account
                  </Text>
                </Pressable>
                <TouchableOpacity
                  onPress={logout}
                  disabled={isAuthorizing}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 999,
                    backgroundColor: isAuthorizing
                      ? colors.border
                      : colors.primary,
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      color: colors.surface,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    {isAuthorizing ? "Signing out..." : "Sign out"}
                  </Text>
                </TouchableOpacity>
              </View>
            </Section>

            <Section
              title='Preferences'
              subtitle='Goal defaults, timers, and training smarts.'
            >
              <SettingRowCard
                title='Workout preferences'
                subtitle={preferencesSubtitle}
                onPress={() => setShowPreferencesSheet(true)}
              />
            </Section>

            <Section
              title='Notifications'
              subtitle='Reminders and inbox for streaks, goals, and squads.'
            >
              <SettingRowCard
                title='Push + inbox'
                subtitle={notificationsSubtitle}
                onPress={() => setShowNotificationsSheet(true)}
              />
            </Section>

            <Section
              title='Billing'
              subtitle='Plan, renewal, and purchase recovery.'
            >
              <SettingRowCard
                title='Plan & billing'
                subtitle={billingSubtitle}
                onPress={() => setShowBillingSheet(true)}
              />
              {isIOS ? (
                <Pressable
                  onPress={() => restorePurchasesMutation.mutate()}
                  disabled={restorePurchasesMutation.isPending}
                  style={({ pressed }) => ({
                    marginTop: 8,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed
                      ? colors.surface
                      : colors.surfaceMuted,
                    alignItems: "center",
                    opacity: restorePurchasesMutation.isPending ? 0.6 : 1,
                  })}
                >
                  {restorePurchasesMutation.isPending ? (
                    <ActivityIndicator color={colors.textPrimary} />
                  ) : (
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      Restore purchases (iOS)
                    </Text>
                  )}
                </Pressable>
              ) : null}
              <View
                style={{
                  marginTop: 10,
                  flexDirection: "row",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  Legal:
                </Text>
                <Pressable onPress={() => Linking.openURL(TERMS_URL)}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 12,
                    }}
                  >
                    Terms of Service
                  </Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL(PRIVACY_URL)}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 12,
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Pressable>
              </View>
            </Section>

            <Section
              title='Feedback & Support'
              subtitle='Spot issues or want a feature? Share it here.'
            >
              <Pressable
                onPress={() => navigation.navigate("FeedbackBoard")}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                })}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  View feedback board
                </Text>
                {newShippedCount > 0 && (
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      minWidth: 20,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.background,
                        fontSize: 11,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      {newShippedCount}
                    </Text>
                  </View>
                )}
              </Pressable>
              <Pressable
                onPress={() =>
                  Linking.openURL(SUPPORT_URL).catch(() =>
                    Alert.alert(
                      "Contact support",
                      "If the support page won't open, email us at help@push-pull.app."
                    )
                  )
                }
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: pressed
                    ? colors.surfaceMuted
                    : colors.surface,
                  alignItems: "center",
                })}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Contact support
                </Text>
              </Pressable>
            </Section>
          </View>
        )}

        <DrillInSheet
          visible={showPreferencesSheet}
          onClose={() => setShowPreferencesSheet(false)}
          title='Workout preferences'
        >
          <Pressable
            onPress={() => {
              if (!isPro) {
                setShowPreferencesSheet(false);
                setShowPaywallModal(true);
                return;
              }
            }}
            disabled={isPro && isTogglingProgression}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: !isPro
                ? `${colors.primary}10`
                : colors.surfaceMuted,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: !isPro ? colors.primary : colors.border,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Progressive Overload
                </Text>
                {!isPro && (
                  <View
                    style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: "#0B1220",
                        fontSize: 10,
                        fontFamily: fontFamilies.bold,
                      }}
                    >
                      PRO
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {!isPro
                  ? "Tap to unlock smart weight progression suggestions"
                  : "Get smart weight increase recommendations based on your performance"}
              </Text>
            </View>
            {isPro ? (
              <Switch
                value={user?.progressiveOverloadEnabled ?? true}
                disabled={isTogglingProgression}
                onValueChange={async (value) => {
                  setIsTogglingProgression(true);
                  try {
                    await updateProfile({ progressiveOverloadEnabled: value });
                  } catch (err) {
                    Alert.alert(
                      "Could not update setting",
                      "Please try again."
                    );
                  } finally {
                    setIsTogglingProgression(false);
                  }
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={
                  user?.progressiveOverloadEnabled ?? true ? "#fff" : "#f4f3f4"
                }
              />
            ) : (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primary + "20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 16 }}>🔒</Text>
              </View>
            )}
          </Pressable>

          <View
            style={{
              gap: 10,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 15,
                  }}
                >
                  Apple Health Sync
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Import Apple Health workouts, calories, and heart rate into
                  your history.
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {healthSyncDisplay}
                </Text>
              </View>
              <Switch
                value={appleHealthEnabled}
                disabled={!isIOS || isSyncingHealth}
                onValueChange={handleAppleHealthToggle}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={appleHealthEnabled ? "#fff" : "#f4f3f4"}
              />
            </View>
            {!isIOS ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Apple Health is available on iOS devices.
              </Text>
            ) : (
              <>
                <View
                  style={{
                    gap: 10,
                    paddingVertical: 4,
                    opacity: appleHealthEnabled ? 1 : 0.7,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      handleHealthPermissionToggle(
                        "workouts",
                        !healthPermissions.workouts
                      )
                    }
                    disabled={isSyncingHealth}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        Workouts
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 12 }}
                      >
                        Required to import Apple workouts & save workout data to
                        Apple Health.
                      </Text>
                    </View>
                    <Switch
                      value={healthPermissions.workouts ?? true}
                      onValueChange={(value) =>
                        handleHealthPermissionToggle("workouts", value)
                      }
                      disabled={isSyncingHealth}
                      trackColor={{
                        true: colors.primary,
                        false: colors.border,
                      }}
                      thumbColor={
                        healthPermissions.workouts ? "#fff" : "#f4f3f4"
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handleHealthPermissionToggle(
                        "activeEnergy",
                        !healthPermissions.activeEnergy
                      )
                    }
                    disabled={isSyncingHealth || !appleHealthEnabled}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: appleHealthEnabled ? 1 : 0.7,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        Active energy
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 12 }}
                      >
                        Use Apple-calculated calories instead of estimates.
                      </Text>
                    </View>
                    <Switch
                      value={healthPermissions.activeEnergy ?? false}
                      onValueChange={(value) =>
                        handleHealthPermissionToggle("activeEnergy", value)
                      }
                      disabled={isSyncingHealth || !appleHealthEnabled}
                      trackColor={{
                        true: colors.primary,
                        false: colors.border,
                      }}
                      thumbColor={
                        healthPermissions.activeEnergy ? "#fff" : "#f4f3f4"
                      }
                    />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handleHealthPermissionToggle(
                        "heartRate",
                        !healthPermissions.heartRate
                      )
                    }
                    disabled={isSyncingHealth || !appleHealthEnabled}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: appleHealthEnabled ? 1 : 0.7,
                    })}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        Heart rate
                      </Text>
                      <Text
                        style={{ color: colors.textSecondary, fontSize: 12 }}
                      >
                        Overlay Apple Health avg/max HR on summaries.
                      </Text>
                    </View>
                    <Switch
                      value={healthPermissions.heartRate ?? false}
                      onValueChange={(value) =>
                        handleHealthPermissionToggle("heartRate", value)
                      }
                      disabled={isSyncingHealth || !appleHealthEnabled}
                      trackColor={{
                        true: colors.primary,
                        false: colors.border,
                      }}
                      thumbColor={
                        healthPermissions.heartRate ? "#fff" : "#f4f3f4"
                      }
                    />
                  </Pressable>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={handleSyncAppleHealthNow}
                    disabled={isSyncingHealth || !appleHealthEnabled}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: colors.primary,
                      opacity:
                        pressed || isSyncingHealth || !appleHealthEnabled
                          ? 0.85
                          : 1,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 6,
                    })}
                  >
                    {isSyncingHealth ? (
                      <ActivityIndicator color={colors.surface} size='small' />
                    ) : (
                      <Ionicons
                        name='cloud-download-outline'
                        size={18}
                        color={colors.surface}
                      />
                    )}
                    <Text
                      style={{
                        color: colors.surface,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 14,
                      }}
                    >
                      Sync now
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleClearAppleHealthImports}
                    disabled={isSyncingHealth}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      opacity: pressed || isSyncingHealth ? 0.85 : 1,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 6,
                    })}
                  >
                    <Ionicons
                      name='trash-outline'
                      size={18}
                      color={colors.textPrimary}
                    />
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.medium,
                        fontSize: 14,
                      }}
                    >
                      Clear imports
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>

          <Pressable
            onPress={() => {
              const newValue = !(user?.restTimerSoundEnabled ?? true);
              updateProfile({ restTimerSoundEnabled: newValue });
            }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 14,
                }}
              >
                Rest Timer Sound
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Play a notification sound when rest timer completes
              </Text>
            </View>
            <Switch
              value={user?.restTimerSoundEnabled ?? true}
              onValueChange={(value) => {
                updateProfile({ restTimerSoundEnabled: value });
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={
                user?.restTimerSoundEnabled ?? true ? "#fff" : "#f4f3f4"
              }
            />
          </Pressable>

          <Pressable
            onPress={() => {
              setShowPreferencesSheet(false);
              navigation.navigate("Onboarding", { isRetake: true });
            }}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: colors.primary,
              borderWidth: 1,
              borderColor: colors.primary,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                color: colors.surface,
                fontFamily: fontFamilies.semibold,
                fontSize: 15,
              }}
            >
              🎯 Update Training Preferences
            </Text>
          </Pressable>
        </DrillInSheet>

        <DrillInSheet
          visible={showNotificationsSheet}
          onClose={() => setShowNotificationsSheet(false)}
          title='Notifications'
        >
          <Pressable
            onPress={() => {
              setShowNotificationsSheet(false);
              navigation.navigate("NotificationInbox" as never);
            }}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              alignItems: "center",
            })}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
              }}
            >
              View inbox
            </Text>
          </Pressable>

          {isLoadingNotificationPrefs ? (
            <ActivityIndicator size='small' color={colors.primary} />
          ) : !notificationPrefs ? (
            <Pressable
              onPress={async () => {
                await handleEnableNotifications();
                setShowNotificationsSheet(false);
              }}
              style={{
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: colors.primary,
                borderWidth: 1,
                borderColor: colors.primary,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.surface,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
              >
                Enable Push Notifications
              </Text>
            </Pressable>
          ) : (
            <>
              {notificationToggleKeys.map((key) => (
                <View
                  key={key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 14,
                      }}
                    >
                      {key === "goalReminders"
                        ? "Goal Reminders"
                        : key === "inactivityNudges"
                        ? "Inactivity Nudges"
                        : key === "squadActivity"
                        ? "Squad Activity"
                        : "Weekly Goal Met"}
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        marginTop: 2,
                      }}
                    >
                      {key === "goalReminders"
                        ? "Remind me when at risk of missing weekly goal"
                        : key === "inactivityNudges"
                        ? "Gentle reminder if inactive for 5+ days"
                        : key === "squadActivity"
                        ? "Reactions and squad members hitting goals"
                        : "Celebrate when you complete your weekly goal"}
                    </Text>
                  </View>
                  <Switch
                    value={notificationPrefs[key]}
                    onValueChange={(value) =>
                      handleToggleNotificationPref(key, value)
                    }
                    trackColor={{ true: colors.primary, false: colors.border }}
                    thumbColor={notificationPrefs[key] ? "#fff" : "#f4f3f4"}
                  />
                </View>
              ))}

              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 8,
                }}
              >
                Max 3 notifications per week
              </Text>
            </>
          )}
        </DrillInSheet>

        <DrillInSheet
          visible={showBillingSheet}
          onClose={() => setShowBillingSheet(false)}
          title='Plan & billing'
        >
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 4,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
              }}
            >
              {isPro ? "Pro plan" : "Free plan"}
            </Text>
            {isAppleSubscription ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Billed through Apple. Manage from your iOS subscription
                settings.
              </Text>
            ) : null}
            {isSubscriptionLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : isSubscriptionError ? (
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.error, fontSize: 12 }}>
                  Unable to load billing status.
                </Text>
                <Pressable
                  onPress={() => refetchSubscriptionStatus()}
                  style={({ pressed }) => ({
                    alignSelf: "flex-start",
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed
                      ? colors.surface
                      : colors.surfaceMuted,
                  })}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 12,
                    }}
                  >
                    Retry
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                {platformStatus ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Status: {platformStatus.replace(/_/g, " ")}
                    {subscriptionStatus?.subscriptionPlatform === "apple" &&
                    subscriptionStatus?.appleEnvironment
                      ? ` (${subscriptionStatus.appleEnvironment})`
                      : ""}
                  </Text>
                ) : null}
                {trialEnds ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Trial ends {trialEnds}
                  </Text>
                ) : null}
                {renewalDate ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {subscriptionStatus?.cancelAtPeriodEnd
                      ? `Ends on ${renewalDate}`
                      : `Renews on ${renewalDate}`}
                  </Text>
                ) : null}
                {expiredOn ? (
                  <Text style={{ color: colors.error, fontSize: 12 }}>
                    Expired on {expiredOn}
                  </Text>
                ) : null}
                {isGrace ? (
                  <Text style={{ color: "#fbbf24", fontSize: 12 }}>
                    Grace period: update your Apple billing to keep Pro access.
                  </Text>
                ) : null}
                {isExpired ? (
                  <Text style={{ color: colors.error, fontSize: 12 }}>
                    Subscription expired — renew to restore Pro features.
                  </Text>
                ) : null}
              </>
            )}
          </View>
          <Pressable
            onPress={() => {
              setShowBillingSheet(false);
              if (isAppleSubscription) {
                void Linking.openURL(
                  "https://apps.apple.com/account/subscriptions"
                );
                return;
              }
              navigation.navigate("Upgrade", { plan: "monthly" });
            }}
            style={({ pressed }) => ({
              marginTop: 10,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.primary,
              backgroundColor: pressed ? colors.primary : "transparent",
              alignItems: "center",
            })}
          >
            <Text
              style={{
                color: colors.primary,
                fontFamily: fontFamilies.semibold,
              }}
            >
              {isPro
                ? isAppleSubscription
                  ? "Manage in App Store"
                  : "Manage subscription"
                : isAppleSubscription
                ? "Manage in App Store"
                : "Upgrade to Pro"}
            </Text>
          </Pressable>
        </DrillInSheet>

        <Modal
          visible={showConnectionsModal}
          transparent
          animationType='fade'
          onRequestClose={closeConnectionsModal}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "flex-end",
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeConnectionsModal} />
            <View
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 20,
                borderWidth: 1,
                borderColor: colors.border,
                maxHeight: "95%",
                minHeight: "85%",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 14,
                overflow: "hidden",
              }}
            >
              <View style={{ alignItems: "center", paddingVertical: 6 }}>
                <View
                  style={{
                    width: 50,
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingBottom: 4,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 18,
                    }}
                  >
                    Friends & invites
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    Manage buddies, pending requests, and invites you sent.
                  </Text>
                </View>
                <Pressable
                  onPress={closeConnectionsModal}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed
                      ? colors.surfaceMuted
                      : colors.surface,
                  })}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    Close
                  </Text>
                </Pressable>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  marginTop: 6,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    Gym buddies
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.bold,
                      fontSize: 18,
                    }}
                  >
                    {friendCount ?? 0}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: `${colors.primary}16`,
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    Pending
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.bold,
                      fontSize: 18,
                    }}
                  >
                    {pendingInvites.length}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: `${colors.secondary}22`,
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    Sent
                  </Text>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.bold,
                      fontSize: 18,
                    }}
                  >
                    {outgoingInvites.length}
                  </Text>
                </View>
              </View>

              {connectionsQuery.isFetching ? (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 24,
                  }}
                >
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : (
                <View style={{ position: "relative", flex: 1, marginTop: 10 }}>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                      gap: 14,
                      paddingBottom: 32,
                    }}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    alwaysBounceVertical={false}
                    overScrollMode='never'
                    onContentSizeChange={(w, h) =>
                      setConnectionsContentHeight(h)
                    }
                    onLayout={(event) =>
                      setConnectionsScrollHeight(
                        event.nativeEvent.layout.height
                      )
                    }
                    onScroll={(
                      event: NativeSyntheticEvent<NativeScrollEvent>
                    ) => {
                      const { contentOffset, contentSize, layoutMeasurement } =
                        event.nativeEvent;
                      const distanceFromBottom =
                        contentSize.height -
                        layoutMeasurement.height -
                        contentOffset.y;
                      setConnectionsIsNearTop(contentOffset.y < 10);
                      setConnectionsIsNearBottom(distanceFromBottom < 40);
                    }}
                    scrollEventThrottle={16}
                  >
                    {renderConnectionGroup(
                      "Gym buddies",
                      "Mutual follows you can invite to squads or challenge.",
                      friends,
                      "Add gym buddies from the Squad tab to see them here."
                    )}
                    {renderConnectionGroup(
                      "Pending invites",
                      "They follow you. Follow back to make it mutual.",
                      pendingInvites,
                      "No pending requests from others.",
                      (person) => (
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Pressable
                            onPress={() => acceptInvite.mutate(person.id)}
                            disabled={pendingActionId === person.id}
                            style={({ pressed }) => ({
                              flex: 1,
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                              backgroundColor: colors.primary,
                              borderWidth: 1,
                              borderColor: colors.primary,
                              opacity:
                                pressed || pendingActionId === person.id
                                  ? 0.85
                                  : 1,
                            })}
                          >
                            <Text
                              style={{
                                color: colors.surface,
                                fontFamily: fontFamilies.semibold,
                                fontSize: 13,
                                textAlign: "center",
                              }}
                            >
                              {pendingActionId === person.id
                                ? "Adding..."
                                : "Accept"}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => declineInvite.mutate(person.id)}
                            disabled={pendingActionId === person.id}
                            style={({ pressed }) => ({
                              paddingVertical: 10,
                              paddingHorizontal: 12,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.surfaceMuted,
                              opacity:
                                pressed || pendingActionId === person.id
                                  ? 0.8
                                  : 1,
                            })}
                          >
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontFamily: fontFamilies.semibold,
                                fontSize: 13,
                              }}
                            >
                              Decline
                            </Text>
                          </Pressable>
                        </View>
                      )
                    )}
                    {renderConnectionGroup(
                      "Invites you sent",
                      "You're following them. They'll move to buddies when they follow back.",
                      outgoingInvites,
                      "You haven't sent any invites yet.",
                      (person) => (
                        <Pressable
                          onPress={() => cancelOutgoing.mutate(person.id)}
                          disabled={pendingActionId === person.id}
                          style={({ pressed }) => ({
                            width: "100%",
                            paddingVertical: 10,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.surfaceMuted,
                            opacity:
                              pressed || pendingActionId === person.id
                                ? 0.85
                                : 1,
                          })}
                        >
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontFamily: fontFamilies.semibold,
                              fontSize: 13,
                              textAlign: "center",
                            }}
                          >
                            {pendingActionId === person.id
                              ? "Cancelling..."
                              : "Cancel invite"}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </ScrollView>
                  {connectionsContentHeight > connectionsScrollHeight &&
                  !connectionsIsNearTop ? (
                    <LinearGradient
                      colors={[
                        `${colors.surface}F0`,
                        `${colors.surface}E0`,
                        `${colors.surface}C0`,
                        `${colors.surface}90`,
                        `${colors.surface}40`,
                        "transparent",
                      ]}
                      locations={[0, 0.25, 0.5, 0.7, 0.85, 1]}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 48,
                        pointerEvents: "none",
                      }}
                    />
                  ) : null}
                  {connectionsContentHeight > connectionsScrollHeight &&
                  !connectionsIsNearBottom ? (
                    <LinearGradient
                      colors={[
                        "transparent",
                        `${colors.surface}40`,
                        `${colors.surface}90`,
                        `${colors.surface}C0`,
                        `${colors.surface}E0`,
                        `${colors.surface}F0`,
                      ]}
                      locations={[0, 0.15, 0.3, 0.5, 0.75, 1]}
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 52,
                        pointerEvents: "none",
                      }}
                    />
                  ) : null}
                </View>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(selectedConnection)}
          transparent
          animationType='fade'
          onRequestClose={() => setSelectedConnection(null)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setSelectedConnection(null)}
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
              padding: 22,
            }}
          >
            {selectedConnection ? (
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 16,
                  padding: 18,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 999,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {selectedConnection.avatarUrl ? (
                      <Image
                        source={{ uri: selectedConnection.avatarUrl }}
                        style={{ width: 72, height: 72, borderRadius: 999 }}
                      />
                    ) : (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: fontFamilies.bold,
                          fontSize: 26,
                        }}
                      >
                        {initialsForName(selectedConnection.name)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 18,
                      }}
                    >
                      {selectedConnection.name}
                    </Text>
                    {selectedConnection.handle ? (
                      <Text
                        style={{ color: colors.textSecondary, marginTop: 2 }}
                      >
                        {formatHandle(selectedConnection.handle)}
                      </Text>
                    ) : null}
                    {selectedConnection.trainingStyleTags?.length ? (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          marginTop: 4,
                          fontSize: 12,
                        }}
                      >
                        {selectedConnection.trainingStyleTags.join(" · ")}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Jump to their profile to follow back, invite them, or view
                  their latest sessions.
                </Text>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      navigation.navigate("UserProfile", {
                        userId: selectedConnection.id,
                      });
                      setSelectedConnection(null);
                    }}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                      backgroundColor: colors.primary,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.surface,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      View profile
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setSelectedConnection(null)}
                    style={({ pressed }) => ({
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      Close
                    </Text>
                  </Pressable>
                </View>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </Modal>

        <Modal visible={isDeleteOpen} animationType='slide' transparent>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.6)",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 10,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 18,
                }}
              >
                Delete account
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Type DELETE to confirm. This removes local data from this
                device.
              </Text>
              <TextInput
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder='DELETE'
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
              <Pressable
                onPress={async () => {
                  if (deleteConfirm !== "DELETE") {
                    Alert.alert("Type DELETE to confirm account removal.");
                    return;
                  }
                  await deleteAccount();
                  setIsDeleteOpen(false);
                  logout();
                }}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.error,
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.error,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Delete account
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsDeleteOpen(false);
                  setDeleteConfirm("");
                }}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <PaywallComparisonModal
          visible={showPaywallModal}
          onClose={() => setShowPaywallModal(false)}
          triggeredBy='progression'
        />
      </>
    </ScreenContainer>
  );
};

const inputStyle = {
  backgroundColor: colors.surfaceMuted,
  borderRadius: 10,
  padding: 10,
  borderWidth: 1,
  borderColor: colors.border,
  color: colors.textPrimary,
};

const SettingRowCard = ({
  title,
  subtitle,
  onPress,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  rightSlot?: ReactNode;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: 14,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: pressed ? 0.92 : 1,
    })}
  >
    <View style={{ flex: 1, gap: 4 }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: fontFamilies.semibold,
          fontSize: 14,
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{ color: colors.textSecondary, fontSize: 12 }}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
    {rightSlot ?? (
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: fontFamilies.semibold,
        }}
      >
        Manage
      </Text>
    )}
  </Pressable>
);

const DrillInSheet = ({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) => (
  <Modal
    visible={visible}
    animationType='slide'
    transparent
    onRequestClose={onClose}
  >
    <View style={{ flex: 1, justifyContent: "flex-end" }}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
        }}
      />
      <View
        style={{
          padding: 16,
          paddingBottom: 28,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
              fontSize: 16,
            }}
          >
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <Text style={{ color: colors.textSecondary }}>Close</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  </Modal>
);

const Section = ({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) => (
  <View
    style={{
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    }}
  >
    <View style={{ gap: 4 }}>
      <Text
        style={{
          color: colors.textPrimary,
          fontFamily: fontFamilies.semibold,
          fontSize: 16,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {children}
  </View>
);

const Stat = ({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | number;
  onPress?: () => void;
}) => (
  <Pressable
    disabled={!onPress}
    onPress={onPress}
    style={({ pressed }) => ({
      flex: 1,
      opacity: onPress && pressed ? 0.85 : 1,
    })}
  >
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 10,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.9}
        style={{
          color: colors.textPrimary,
          fontFamily: fontFamilies.semibold,
          fontSize: 16,
        }}
      >
        {value}
      </Text>
      <Text
        style={{ color: colors.textSecondary, fontSize: 12 }}
        numberOfLines={1}
        ellipsizeMode='tail'
      >
        {label}
      </Text>
    </View>
  </Pressable>
);

export default SettingsScreen;
