import { useCallback, useEffect, useState, type ReactElement } from "react";
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
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
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
import { restorePurchases } from "../services/payments";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { TERMS_URL, PRIVACY_URL } from "../config/legal";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
import { ensureShareableAvatarUri, processAvatarAsset } from "../utils/avatarImage";

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
  const { logout, isAuthorizing } = useAuth();
  const { user, updateProfile, deleteAccount, refresh, isLoading } =
    useCurrentUser();
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
  const [selectedConnection, setSelectedConnection] =
    useState<SocialUserSummary | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [isTogglingProgression, setIsTogglingProgression] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
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
  const isSubscriptionLoading = subscriptionAccess.isLoading;
  const isSubscriptionError = subscriptionAccess.isError;
  const refetchSubscriptionStatus = subscriptionAccess.refetch;
  const subscriptionPlan = subscriptionStatus?.plan ?? user?.plan ?? "free";
  const hasProPlan = subscriptionAccess.hasProPlan;
  const hasProAccess = subscriptionAccess.hasProAccess;
  const isPro = hasProAccess;
  const isIOS = Platform.OS === "ios";
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

  useEffect(() => {
    if (user) {
      setDraftName(user.name ?? "");
      setDraftHandle(user.handle ?? "");
      setDraftBio(user.bio ?? "");
      setDraftTraining(user.trainingStyle ?? "");
      setDraftGym(user.gymName ?? "");
      setDraftWeeklyGoal(String(user.weeklyGoal ?? 4));
      setShowGym((user.gymVisibility ?? "hidden") === "shown");
      setAvatarUri(user.avatarUrl ?? undefined);
      setIsEditing(false);
    }
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
  ]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refetchSubscriptionStatus();
    }, [refresh, refetchSubscriptionStatus])
  );

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
    <View style={{ gap: 8 }}>
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
        base64: true,
        aspect: [1, 1],
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

  const handleSave = async () => {
    if (isProcessingAvatar) {
      Alert.alert(
        "Processing photo",
        "Hang tight—still preparing your picture. Try saving again in a moment."
      );
      return;
    }

    setIsSaving(true);
    try {
      const uploadReadyAvatar = await ensureShareableAvatarUri(avatarUri);
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
    } catch (err) {
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
  };

  return (
    <ScreenContainer scroll>
      <View style={{ marginTop: 16, gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 24,
              fontWeight: "700",
            }}
          >
            Profile
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Review your profile, update details, or manage your account.
          </Text>
        </View>

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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
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
            <Stat label='Friends' value={friendCount ?? 0} />
            <Stat
              label='Streak'
              value={
                user.currentStreakDays ? `${user.currentStreakDays}d` : "—"
              }
            />
          </View>

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
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Toggle off to keep it private.
                  </Text>
                </View>
                <Switch
                  value={showGym}
                  onValueChange={setShowGym}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={showGym ? "#fff" : "#f4f3f4"}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  style={({ pressed }) => ({
                    flex: 2,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    alignItems: "center",
                    opacity: pressed || isSaving ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsEditing(false);
                    setDraftName(user.name ?? "");
                    setDraftHandle(user.handle ?? "");
                    setDraftBio(user.bio ?? "");
                    setDraftTraining(user.trainingStyle ?? "");
                    setDraftGym(user.gymName ?? "");
                    setDraftWeeklyGoal(String(user.weeklyGoal ?? 4));
                    setShowGym((user.gymVisibility ?? "hidden") === "shown");
                    setAvatarUri(user.avatarUrl ?? undefined);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
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
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              Billing
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Manage your subscription and billing details.
            </Text>
          </View>
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
                Billed through Apple. Manage from your iOS subscription settings.
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
                    backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
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
            <Pressable
              onPress={() => {
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
          </View>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              Friends
            </Text>
            <Text style={{ color: colors.textSecondary }}></Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: `${friends.length} buddies`, tone: colors.primary },
                {
                  label: `${pendingInvites.length} pending`,
                  tone: colors.textSecondary,
                },
                {
                  label: `${outgoingInvites.length} outgoing`,
                  tone: colors.border,
                },
              ].map((pill, idx) => (
                <View
                  key={idx}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      backgroundColor: pill.tone,
                    }}
                  />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    {pill.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {connectionsQuery.isFetching ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={{ gap: 14 }}>
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
                          pressed || pendingActionId === person.id ? 0.85 : 1,
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
                        {pendingActionId === person.id ? "Adding..." : "Accept"}
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
                          pressed || pendingActionId === person.id ? 0.8 : 1,
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
                        pressed || pendingActionId === person.id ? 0.85 : 1,
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
            </View>
          )}
        </View>

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
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              Training Preferences
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Update your goals, equipment, schedule, and preferences
            </Text>
          </View>

          {/* Progressive Overload Toggle */}
          <Pressable
            onPress={() => {
              if (!isPro) {
                setShowPaywallModal(true);
              }
            }}
            disabled={isPro}
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
                value={user.progressiveOverloadEnabled ?? true}
                disabled={isTogglingProgression}
                onValueChange={async (value) => {
                  setIsTogglingProgression(true);
                  try {
                    await updateProfile({ progressiveOverloadEnabled: value });
                  } catch (err) {
                    Alert.alert("Could not update setting", "Please try again.");
                  } finally {
                    setIsTogglingProgression(false);
                  }
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={
                  user.progressiveOverloadEnabled ?? true ? "#fff" : "#f4f3f4"
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
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 14,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
              fontSize: 16,
            }}
          >
            Account
          </Text>
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
              backgroundColor: isAuthorizing ? colors.border : colors.primary,
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
      </View>

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
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
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
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
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
                Jump to their profile to follow back, invite them, or view their
                latest sessions.
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => {
                    navigation.navigate("Profile", {
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
              Type DELETE to confirm. This removes local data from this device.
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
        triggeredBy="progression"
      />
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

const Stat = ({ label, value }: { label: string; value: string | number }) => (
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
);

export default SettingsScreen;
