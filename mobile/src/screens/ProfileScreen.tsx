import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { followUser, getConnections, getUserProfile, removeFollower, unfollowUser } from "../api/social";
import { SocialProfile, SocialUserSummary } from "../types/social";
import { formatHandle } from "../utils/formatHandle";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
import ProfileHeader from "../components/profile/ProfileHeader";
import TotalWorkoutsBottomSheet from "../components/profile/TotalWorkoutsBottomSheet";
import TotalVolumeBottomSheet from "../components/profile/TotalVolumeBottomSheet";
import GoalProgressBottomSheet from "../components/profile/GoalProgressBottomSheet";

const initialForName = (name?: string) => {
  if (!name) return "?";
  return name[0]?.toUpperCase() ?? "?";
};

const AnimatedStatBlock = ({
  label,
  value,
  onPress,
  disabled = false,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  disabled?: boolean;
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || !onPress;

  const handlePressIn = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    if (isDisabled) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{ flex: 1 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient
          colors={[`${colors.primary}16`, colors.surfaceMuted]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
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
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 18,
              }}
            >
              {value}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ color: colors.textSecondary, ...typography.caption }}
          >
            {label}
          </Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
};

const ProfileScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute();
  const queryClient = useQueryClient();
  const { user: currentUser, refresh: refreshCurrentUser } = useCurrentUser();
  const subscriptionAccess = useSubscriptionAccess();
  // Handle both tab navigation (no params) and stack navigation (with userId param)
  const userId = (route.params as { userId?: string })?.userId ?? currentUser?.id;
  const invalidateConnections = () => {
    queryClient.invalidateQueries({
      queryKey: ["social", "connections"],
      exact: false,
    });
    queryClient.invalidateQueries({
      queryKey: ["social", "connections", "settings"],
      exact: false,
    });
  };
  const [selectedFriend, setSelectedFriend] =
    useState<SocialUserSummary | null>(null);
  const [showConnectionsModal, setShowConnectionsModal] = useState(false);
  const [selectedConnection, setSelectedConnection] =
    useState<SocialUserSummary | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  // Bottom sheet states for interactive highlights
  const [showWorkoutsSheet, setShowWorkoutsSheet] = useState(false);
  const [showGoalSheet, setShowGoalSheet] = useState(false);

  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getUserProfile(userId as string),
    enabled: Boolean(userId),
  });

  const followMutation = useMutation({
    mutationFn: followUser,
    onMutate: async () => {
      queryClient.setQueryData<SocialProfile>(
        ["profile", userId],
        (prev) =>
          prev
            ? {
                ...prev,
                isFollowing: true,
                followersCount: (prev.followersCount ?? 0) + 1,
                friendsCount:
                  prev.friendsCount !== undefined
                    ? Math.min(
                        (prev.followersCount ?? 0) + 1,
                        prev.followingCount ?? 0
                      )
                    : prev.friendsCount,
              }
            : prev
      );
    },
    onSuccess: async () => {
      invalidateConnections();
      await queryClient.refetchQueries({
        queryKey: ["social", "connections"],
        type: "active",
      });
      await queryClient.refetchQueries({
        queryKey: ["social", "connections", "settings"],
        type: "active",
      });
      await queryClient.refetchQueries({
        queryKey: ["profile", userId],
        type: "active",
      });
      if (currentUser?.id) {
        await queryClient.refetchQueries({
          queryKey: ["profile", currentUser.id],
          type: "active",
        });
      }
      // Invalidate pending requests count (user just followed someone or accepted a request)
      await queryClient.invalidateQueries({
        queryKey: ["social", "pendingRequestsCount"],
      });
      void refreshCurrentUser();
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: unfollowUser,
    onMutate: async () => {
      queryClient.setQueryData<SocialProfile>(
        ["profile", userId],
        (prev) =>
          prev
            ? {
                ...prev,
                isFollowing: false,
                followersCount: Math.max(0, (prev.followersCount ?? 1) - 1),
                friendsCount:
                  prev.friendsCount !== undefined
                    ? Math.max(0, (prev.friendsCount ?? 0) - 1)
                    : prev.friendsCount,
                friendsPreview: prev.friendsPreview?.filter(
                  (friend) => friend.id !== currentUser?.id
                ),
              }
            : prev
      );
    },
    onSuccess: async () => {
      invalidateConnections();
      await queryClient.refetchQueries({
        queryKey: ["social", "connections"],
        type: "active",
      });
      await queryClient.refetchQueries({
        queryKey: ["social", "connections", "settings"],
        type: "active",
      });
      await queryClient.refetchQueries({
        queryKey: ["profile", userId],
        type: "active",
      });
      if (currentUser?.id) {
        await queryClient.refetchQueries({
          queryKey: ["profile", currentUser.id],
          type: "active",
        });
      }
      void refreshCurrentUser();
    },
  });

  const handleFollowToggle = () => {
    if (isViewingSelf) return;
    if (!profile) return;
    if (profile.isFollowing) {
      unfollowMutation.mutate(profile.id);
    } else {
      followMutation.mutate(profile.id);
    }
  };

  const resolvedProfile =
    profile ?? ((currentUser as unknown as SocialProfile) || null);
  const loadingState = isLoading && !resolvedProfile;
  // Determine if viewing own profile based on route params first
  const routeUserId = (route.params as { userId?: string })?.userId;
  const isViewingSelf = !routeUserId || userId === currentUser?.id;
  const isFollowing = resolvedProfile?.isFollowing ?? false;
  const isFriend = resolvedProfile?.isFriend ?? false;
  const statsVisibility = resolvedProfile?.statsVisibility ?? "friends";
  const canViewHighlights =
    Boolean(resolvedProfile) &&
    (isViewingSelf ||
      statsVisibility === "public" ||
      (statsVisibility === "friends" && isFriend));
  const displayName =
    resolvedProfile?.name?.trim() ||
    resolvedProfile?.handle?.replace(/^@/, "") ||
    "their";
  const possessiveName =
    displayName === "their"
      ? "their"
      : displayName.endsWith("s")
      ? `${displayName}'`
      : `${displayName}'s`;
  const friendCount = useMemo(() => {
    if (!resolvedProfile) return 0;
    if (resolvedProfile.friendsCount !== undefined)
      return resolvedProfile.friendsCount;
    const followers = resolvedProfile.followersCount ?? 0;
    const following = resolvedProfile.followingCount ?? 0;
    return Math.min(followers, following);
  }, [resolvedProfile]);
  const gymStatValue =
    resolvedProfile?.gymName && resolvedProfile?.gymVisibility !== "hidden"
      ? resolvedProfile.gymName
      : resolvedProfile?.gymName
      ? "Hidden"
      : "Not set";
  const formattedHandle = formatHandle(resolvedProfile?.handle);
  const friendsPreview = resolvedProfile?.friendsPreview ?? [];
  const weeklyGoal = isViewingSelf
    ? (resolvedProfile as { weeklyGoal?: number } | null)?.weeklyGoal ??
      currentUser?.weeklyGoal ??
      null
    : (resolvedProfile as { weeklyGoal?: number } | null)?.weeklyGoal ?? null;
  const workoutsThisWeek = isViewingSelf
    ? (resolvedProfile as { workoutsThisWeek?: number } | null)?.workoutsThisWeek ??
      0
    : (resolvedProfile as { workoutsThisWeek?: number } | null)?.workoutsThisWeek ??
      0;
  const goalProgress = weeklyGoal ? Math.min(workoutsThisWeek, weeklyGoal) : null;
  const heroSubtitle = resolvedProfile?.trainingStyleTags?.length
    ? resolvedProfile.trainingStyleTags.join(" · ")
    : resolvedProfile?.trainingStyle;
  const handleSettingsPress = () => {
    if (isViewingSelf) {
      navigation.navigate("Settings");
    }
  };
  const openConnections = useCallback(() => {
    if (!isViewingSelf) return;
    // Show connections modal directly on Profile screen
    setShowConnectionsModal(true);
  }, [isViewingSelf]);

  const connectionsQuery = useQuery({
    queryKey: ["social", "connections", "profile"],
    queryFn: getConnections,
    enabled: Boolean(currentUser) && isViewingSelf && showConnectionsModal,
  });

  // Get pending friend requests count for notification badge
  const { data: pendingRequestsCount = 0 } = useQuery({
    queryKey: ["social", "pendingRequestsCount"],
    queryFn: async () => {
      const { getPendingRequestsCount } = await import("../api/social");
      return getPendingRequestsCount();
    },
    enabled: Boolean(currentUser) && isViewingSelf,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const friends = connectionsQuery.data?.friends ?? [];
  const pendingInvites = connectionsQuery.data?.pendingInvites ?? [];
  const outgoingInvites = connectionsQuery.data?.outgoingInvites ?? [];
  const connectionsFriendCount = connectionsQuery.data
    ? friends.length
    : friendCount;

  const refreshConnections = async () => {
    invalidateConnections();
    await queryClient.refetchQueries({
      queryKey: ["social", "connections"],
      type: "active",
    });
    await refreshCurrentUser();
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

  const closeConnectionsModal = () => {
    setShowConnectionsModal(false);
    setSelectedConnection(null);
  };

  const renderConnectionGroup = (
    title: string,
    subtitle: string,
    list: SocialUserSummary[],
    emptyCopy: string,
    renderActions?: (person: SocialUserSummary) => React.ReactElement | null
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
                      {initialForName(person.name)}
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

  const isPending = !isViewingSelf && isFollowing && !isFriend;
  const relationshipCopy = isViewingSelf
    ? null
    : isFriend
    ? {
        title: "You're gym buddies",
        body: "You follow each other's training. Unfollow if you want fewer updates.",
        icon: "checkmark-circle",
        iconColor: colors.primary,
        bg: colors.surface,
        border: colors.primary,
      }
    : isPending
    ? {
        title: "Invite pending",
        body: "They'll show as gym buddies once they add you back.",
        icon: "time-outline",
        iconColor: colors.textSecondary,
        bg: colors.surfaceMuted,
        border: colors.border,
      }
    : {
        title: "Not gym buddies yet",
        body: "Follow to swap gym updates and invite them to squads.",
        icon: "people-circle-outline",
        iconColor: colors.textSecondary,
        bg: colors.surfaceMuted,
        border: colors.border,
      };
  const mutualLabel = isViewingSelf ? "Gym buddies" : "Mutual gym buddies";

  return (
    <ScreenContainer scroll>
      {/* Close/Back Button for other user profiles */}
      {!isViewingSelf ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Pressable
            onPress={() => {
              // Pop the current screen from the stack to return to previous screen
              navigation.goBack();
            }}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
        </View>
      ) : null}

      {loadingState ? (
        <View style={{ marginTop: 20 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
      {!loadingState && isError ? (
        <Text style={{ color: colors.error, marginTop: 12 }}>
          Could not load profile right now. Please try again in a bit.
        </Text>
      ) : null}

      {resolvedProfile ? (
        <View style={{ gap: 16, marginTop: !isViewingSelf ? 0 : 6 }}>
          <ProfileHeader
            name={resolvedProfile.name}
            handle={formattedHandle}
            trainingStyle={heroSubtitle}
            gymName={resolvedProfile.gymName}
            gymVisibility={resolvedProfile.gymVisibility}
            avatarUrl={resolvedProfile.avatarUrl}
            showProBadge={isViewingSelf && subscriptionAccess.hasProAccess}
            isViewingSelf={isViewingSelf}
            isFollowing={isFollowing}
            isFriend={isFriend}
            friendCount={friendCount}
            pendingRequestsCount={pendingRequestsCount}
            bio={resolvedProfile.bio}
            onToggleFollow={handleFollowToggle}
            isFollowLoading={
              followMutation.isPending || unfollowMutation.isPending
            }
            onPressSettings={handleSettingsPress}
            onPressFriends={openConnections}
          />

          {canViewHighlights ? (
            <View style={{ gap: 10 }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                Highlights
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <AnimatedStatBlock
                  label="Total Workouts"
                  value={String(resolvedProfile.workoutsCompleted ?? "—")}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowWorkoutsSheet(true);
                  }}
                />
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowGoalSheet(true);
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: `${colors.surface}F2`,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    gap: 6,
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
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
                      {isViewingSelf ? "Goal progress" : `${possessiveName} goal`}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                        {weeklyGoal ? `${goalProgress ?? 0}/${weeklyGoal}` : "Not set"}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                    </View>
                  </View>
                  <View
                    style={{
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        width: `${
                          weeklyGoal && goalProgress !== null
                            ? Math.min(100, (goalProgress / weeklyGoal) * 100)
                            : 8
                        }%`,
                        backgroundColor: colors.primary,
                        flex: 1,
                      }}
                    />
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {weeklyGoal
                      ? isViewingSelf
                        ? "Tap to see your weekly progress"
                        : `Tap to see ${possessiveName} weekly progress`
                      : isViewingSelf
                      ? "Tap to set a weekly goal"
                      : displayName === "their"
                      ? "Weekly goal not set yet."
                      : `${displayName} hasn't set a weekly goal yet.`}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {isViewingSelf ? (
            <View style={{ gap: 10 }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                Private
              </Text>
              <Pressable
                onPress={() => {
                  if (!subscriptionAccess.hasProAccess) {
                    navigation.navigate("Upgrade");
                    return;
                  }
                  navigation.navigate("ProgressPhotos");
                }}
                style={({ pressed }) => ({
                  borderRadius: 16,
                  overflow: "hidden",
                  opacity: pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.99 : 1 }],
                })}
              >
                <LinearGradient
                  colors={[`${colors.primary}22`, `${colors.surface}F2`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          backgroundColor: `${colors.primary}1A`,
                          borderWidth: 1,
                          borderColor: `${colors.primary}33`,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Ionicons name="images" size={18} color={colors.primary} />
                      </View>
                      <View style={{ gap: 2 }}>
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontFamily: fontFamilies.semibold,
                            fontSize: 16,
                          }}
                        >
                          Progress photos
                        </Text>
                        <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                          Your private timeline
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: `${colors.surfaceMuted}CC`,
                          borderWidth: 1,
                          borderColor: colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Ionicons
                          name={subscriptionAccess.hasProAccess ? "lock-closed" : "sparkles"}
                          size={12}
                          color={colors.textSecondary}
                        />
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                          {subscriptionAccess.hasProAccess ? "Only you" : "Pro"}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                    </View>
                  </View>

                  <Text style={{ color: colors.textSecondary }}>
                    Compare your physique over time—captured right after workouts.
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          ) : null}

          {/* Relationship status - only show for other users */}
          {!isViewingSelf && relationshipCopy ? (
            <View
              style={{
                borderRadius: 14,
                backgroundColor: relationshipCopy.bg,
                borderWidth: 1,
                borderColor: relationshipCopy.border,
                padding: 16,
                gap: 12,
              }}
            >
              <View
                style={{ flexDirection: "row", gap: 12, alignItems: "center" }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons
                    name={relationshipCopy.icon as keyof typeof Ionicons.glyphMap}
                    size={24}
                    color={relationshipCopy.iconColor}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    {relationshipCopy.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      marginTop: 2,
                      fontSize: 13,
                    }}
                  >
                    {relationshipCopy.body}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={handleFollowToggle}
                disabled={
                  followMutation.isPending || unfollowMutation.isPending
                }
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: isFollowing
                    ? colors.surfaceMuted
                    : colors.primary,
                  borderWidth: 1,
                  borderColor: isFollowing ? colors.border : colors.primary,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                  opacity:
                    pressed ||
                    followMutation.isPending ||
                    unfollowMutation.isPending
                      ? 0.86
                      : 1,
                })}
              >
                <Ionicons
                  name={
                    isPending
                      ? "close-circle"
                      : isFollowing
                      ? "person-remove"
                      : "person-add"
                  }
                  size={20}
                  color={isFollowing ? colors.textPrimary : colors.surface}
                />
                <Text
                  style={{
                    color: isFollowing ? colors.textPrimary : colors.surface,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                  }}
                >
                  {isPending ? "Cancel request" : isFollowing ? "Unfollow" : "Follow"}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/* Quick actions section - only show for own profile */}
          {isViewingSelf ? (
            <View style={{ gap: 10 }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                Quick actions
              </Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <ShortcutCard
                  title='Edit goals'
                  subtitle='Adjust weekly targets'
                  icon='trophy-outline'
                  onPress={() =>
                    navigation.navigate("Onboarding", { isRetake: true })
                  }
                />
                <ShortcutCard
                  title='Manage squads'
                  subtitle='Invite buddies or join'
                  icon='people'
                  onPress={() =>
                    navigation.navigate("RootTabs", { screen: "Squad" })
                  }
                />
                <ShortcutCard
                  title='Add friends'
                  subtitle='Find gym buddies fast'
                  icon='person-add'
                  onPress={() =>
                    navigation.navigate("RootTabs", {
                      screen: "Squad",
                      params: { openFindBuddies: true },
                    })
                  }
                />
                <ShortcutCard
                  title='View feedback board'
                  subtitle='See what we are building next'
                  icon='chatbubble-ellipses-outline'
                  onPress={() => navigation.navigate("FeedbackBoard")}
                />
              </View>
            </View>
          ) : null}

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 8,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Training & gym
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {heroSubtitle || "Share your style to help buddies follow along."}
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Gym: {gymStatValue}
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 10,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              {mutualLabel}
            </Text>
            {friendsPreview.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {friendsPreview.map((friend) => (
                  <Pressable
                    key={friend.id}
                    onPress={() => setSelectedFriend(friend)}
                    style={({ pressed }) => ({
                      width: 78,
                      alignItems: "center",
                      gap: 6,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 58,
                        height: 58,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceMuted,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {friend.avatarUrl ? (
                        <Image
                          source={{ uri: friend.avatarUrl }}
                          style={{ width: 58, height: 58, borderRadius: 999 }}
                        />
                      ) : (
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontFamily: fontFamilies.semibold,
                            fontSize: 18,
                          }}
                        >
                          {initialForName(friend.name)}
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
                      {friend.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                No mutual gym buddies to show yet.
              </Text>
            )}
          </View>
        </View>
      ) : null}

      <Modal
        visible={Boolean(selectedFriend)}
        transparent
        animationType='fade'
        onRequestClose={() => setSelectedFriend(null)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setSelectedFriend(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          {selectedFriend ? (
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                padding: 20,
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
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selectedFriend.avatarUrl ? (
                    <Image
                      source={{ uri: selectedFriend.avatarUrl }}
                      style={{ width: 64, height: 64, borderRadius: 999 }}
                    />
                  ) : (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontFamily: fontFamilies.bold,
                        fontSize: 24,
                      }}
                    >
                      {initialForName(selectedFriend.name)}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ ...typography.title, color: colors.textPrimary }}
                  >
                    {selectedFriend.name}
                  </Text>
                  {selectedFriend.handle ? (
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                      {formatHandle(selectedFriend.handle)}
                    </Text>
                  ) : null}
                  {selectedFriend.trainingStyleTags?.length ? (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        marginTop: 4,
                        fontSize: 12,
                      }}
                    >
                      {selectedFriend.trainingStyleTags.join(" · ")}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => {
                    navigation.navigate("UserProfile", {
                      userId: selectedFriend.id,
                    });
                    setSelectedFriend(null);
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
                  onPress={() => setSelectedFriend(null)}
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

      {/* Connections Modal */}
      <Modal
        visible={showConnectionsModal && !selectedConnection}
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
                  backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
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
                  {connectionsFriendCount ?? 0}
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
              <ScrollView
                style={{ flex: 1, marginTop: 10 }}
                contentContainerStyle={{
                  gap: 14,
                  paddingBottom: 32,
                }}
                showsVerticalScrollIndicator={false}
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
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Selected Connection Modal */}
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
                      {initialForName(selectedConnection.name)}
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
                    navigation.navigate("UserProfile", {
                      userId: selectedConnection.id,
                    });
                    setSelectedConnection(null);
                    closeConnectionsModal();
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

      {/* Interactive Highlights Bottom Sheets */}
      <TotalWorkoutsBottomSheet
        visible={showWorkoutsSheet}
        onClose={() => setShowWorkoutsSheet(false)}
        totalWorkouts={resolvedProfile?.workoutsCompleted ?? 0}
        isViewingSelf={isViewingSelf}
        ownerName={displayName}
      />

      <GoalProgressBottomSheet
        visible={showGoalSheet}
        onClose={() => setShowGoalSheet(false)}
        weeklyGoal={weeklyGoal}
        workoutsThisWeek={workoutsThisWeek}
        onEditGoal={() => navigation.navigate("Onboarding", { isRetake: true })}
        isViewingSelf={isViewingSelf}
        ownerName={displayName}
      />
    </ScreenContainer>
  );
};

const ShortcutCard = ({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      flexBasis: "48%",
      minWidth: 160,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: pressed ? 0.88 : 1,
      gap: 8,
    })}
  >
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: colors.surfaceMuted,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name={icon} size={18} color={colors.textPrimary} />
    </View>
    <Text
      style={{
        color: colors.textPrimary,
        fontFamily: fontFamilies.semibold,
        fontSize: 15,
      }}
    >
      {title}
    </Text>
    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
      {subtitle}
    </Text>
  </Pressable>
);

export default ProfileScreen;
