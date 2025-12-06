import { useCallback, useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { RootRoute } from "../navigation/types";
import { followUser, getUserProfile, unfollowUser } from "../api/social";
import { SocialProfile, SocialUserSummary } from "../types/social";
import { formatHandle } from "../utils/formatHandle";
import { useCurrentUser } from "../hooks/useCurrentUser";
import ProfileHeader from "../components/profile/ProfileHeader";

const initialForName = (name?: string) => {
  if (!name) return "?";
  return name[0]?.toUpperCase() ?? "?";
};

const StatBlock = ({ label, value }: { label: string; value: string }) => (
  <LinearGradient
    colors={[`${colors.primary}16`, colors.surfaceMuted]}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={{
      flex: 1,
      borderRadius: 12,
      padding: 12,
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
        fontSize: 18,
      }}
    >
      {value}
    </Text>
    <Text
      numberOfLines={1}
      ellipsizeMode='tail'
      style={{ color: colors.textSecondary, ...typography.caption }}
    >
      {label}
    </Text>
  </LinearGradient>
);

const ProfileScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RootRoute<"Profile">>();
  const queryClient = useQueryClient();
  const { user: currentUser, refresh: refreshCurrentUser } = useCurrentUser();
  const userId = route.params?.userId ?? currentUser?.id;
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
  const isViewingSelf =
    (!route.params?.userId && resolvedProfile?.id === currentUser?.id) ||
    userId === currentUser?.id ||
    resolvedProfile?.id === currentUser?.id;
  const isFollowing = resolvedProfile?.isFollowing ?? false;
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
  const weeklyGoal =
    (resolvedProfile as { weeklyGoal?: number } | null)?.weeklyGoal ??
    currentUser?.weeklyGoal ??
    null;
  const workoutsThisWeek =
    (resolvedProfile as { workoutsThisWeek?: number } | null)?.workoutsThisWeek ??
    0;
  const goalProgress = weeklyGoal ? Math.min(workoutsThisWeek, weeklyGoal) : null;
  const heroSubtitle = resolvedProfile?.trainingStyleTags?.length
    ? resolvedProfile.trainingStyleTags.join(" · ")
    : resolvedProfile?.trainingStyle;
  const squadBadgeLabel = friendCount
    ? `${friendCount} gym buddies`
    : "Build your squad";
  const handleSettingsPress = () => {
    if (isViewingSelf) {
      navigation.navigate("Settings");
    }
  };
  const openConnections = useCallback(() => {
    if (!isViewingSelf) return;
    navigation.navigate("Settings", { openConnections: true });
  }, [isViewingSelf, navigation]);
  const relationshipCopy = isViewingSelf
    ? null
    : isFollowing
    ? {
        title: "You're gym buddies",
        body: "You follow their training. Remove if you no longer want updates.",
        icon: "checkmark-circle",
        iconColor: colors.primary,
        bg: colors.surface,
        border: colors.primary,
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
        <View style={{ gap: 16, marginTop: 6 }}>
          <ProfileHeader
            name={resolvedProfile.name}
            handle={formattedHandle}
            trainingStyle={heroSubtitle}
            gymName={resolvedProfile.gymName}
            gymVisibility={resolvedProfile.gymVisibility}
            avatarUrl={resolvedProfile.avatarUrl}
            isViewingSelf={isViewingSelf}
            isFollowing={isFollowing}
            friendCount={friendCount}
            bio={resolvedProfile.bio}
            onToggleFollow={handleFollowToggle}
            isFollowLoading={
              followMutation.isPending || unfollowMutation.isPending
            }
            onPressSettings={handleSettingsPress}
            onPressFriends={openConnections}
          />

          <View style={{ gap: 10 }}>
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Highlights
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <StatBlock
                label='Streak'
                value={
                  `${resolvedProfile.currentStreakDays ?? 0} day${
                    (resolvedProfile.currentStreakDays ?? 0) === 1 ? "" : "s"
                  }`
                }
              />
              <StatBlock
                label='Workouts'
                value={String(resolvedProfile.workoutsCompleted ?? "—")}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: `${colors.surface}F2`,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  gap: 6,
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
                    Goal progress
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {weeklyGoal ? `${goalProgress ?? 0}/${weeklyGoal}` : "Not set"}
                  </Text>
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
                    ? "Keep up the pace to close the ring."
                    : "Set a weekly target to unlock reminders."}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: `${colors.surfaceMuted}F2`,
                  borderWidth: 1,
                  borderColor: colors.secondary,
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                  }}
                >
                  Squad badge
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                  }}
                >
                  {squadBadgeLabel}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 6,
                    flexWrap: "wrap",
                    marginTop: 6,
                  }}
                >
                  {friendsPreview.slice(0, 4).map((friend) => (
                    <View
                      key={friend.id}
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 17,
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
                          style={{ width: 34, height: 34, borderRadius: 17 }}
                        />
                      ) : (
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontFamily: fontFamilies.semibold,
                            fontSize: 12,
                          }}
                        >
                          {initialForName(friend.name)}
                        </Text>
                      )}
                    </View>
                  ))}
                  {!friendsPreview.length ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Invite buddies from Squads.
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

          {relationshipCopy ? (
            <View
              style={{
                borderRadius: 14,
                backgroundColor: relationshipCopy.bg,
                borderWidth: 1,
                borderColor: relationshipCopy.border,
                padding: 14,
                gap: 10,
              }}
            >
              <View
                style={{ flexDirection: "row", gap: 10, alignItems: "center" }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
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
                    size={22}
                    color={relationshipCopy.iconColor}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 15,
                    }}
                  >
                    {relationshipCopy.title}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      marginTop: 2,
                      fontSize: 12,
                    }}
                  >
                    {relationshipCopy.body}
                  </Text>
                </View>
                {!isViewingSelf ? (
                  <Pressable
                    onPress={handleFollowToggle}
                    disabled={
                      followMutation.isPending || unfollowMutation.isPending
                    }
                    style={({ pressed }) => ({
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: isFollowing
                        ? colors.surfaceMuted
                        : colors.primary,
                      borderWidth: 1,
                      borderColor: isFollowing ? colors.border : colors.primary,
                      opacity:
                        pressed ||
                        followMutation.isPending ||
                        unfollowMutation.isPending
                          ? 0.86
                          : 1,
                    })}
                  >
                    <Text
                      style={{
                        color: isFollowing ? colors.textPrimary : colors.surface,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 13,
                      }}
                    >
                      {isFollowing ? "Remove" : "Add"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Quick actions
            </Text>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <ShortcutCard
                title='Edit goals'
                subtitle='Adjust weekly targets'
                icon='target'
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
                onPress={() => {
                  navigation.navigate("Settings");
                  Alert.alert(
                    "Feedback board",
                    "We’re polishing the in-app board. Head to Settings → Feedback to drop ideas."
                  );
                }}
              />
            </View>
          </View>

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
                    navigation.navigate("Profile", {
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
