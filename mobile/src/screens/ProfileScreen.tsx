import { useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { RootRoute } from "../navigation/types";
import { followUser, getUserProfile, unfollowUser } from "../api/social";
import { SocialProfile, SocialUserSummary } from "../types/social";
import { formatHandle } from "../utils/formatHandle";
import { useCurrentUser } from "../hooks/useCurrentUser";

const initialForName = (name?: string) => {
  if (!name) return "?";
  return name[0]?.toUpperCase() ?? "?";
};

const StatBlock = ({ label, value }: { label: string; value: string }) => (
  <View
    style={{
      flex: 1,
      borderRadius: 12,
      padding: 12,
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
  </View>
);

const ProfileScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RootRoute<"Profile">>();
  const queryClient = useQueryClient();
  const { user: currentUser, refresh: refreshCurrentUser } = useCurrentUser();
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
    queryKey: ["profile", route.params.userId],
    queryFn: () => getUserProfile(route.params.userId),
  });

  const followMutation = useMutation({
    mutationFn: followUser,
    onMutate: async () => {
      queryClient.setQueryData<SocialProfile>(
        ["profile", route.params.userId],
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
        queryKey: ["profile", route.params.userId],
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
        ["profile", route.params.userId],
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
        queryKey: ["profile", route.params.userId],
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
    if (!profile) return;
    if (profile.isFollowing) {
      unfollowMutation.mutate(profile.id);
    } else {
      followMutation.mutate(profile.id);
    }
  };

  const avatar = useMemo(() => {
    if (profile?.avatarUrl) {
      return (
        <Image
          source={{ uri: profile.avatarUrl }}
          style={{
            width: 96,
            height: 96,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
          }}
        />
      );
    }
    return (
      <View
        style={{
          width: 96,
          height: 96,
          borderRadius: 999,
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamilies.bold,
            fontSize: 28,
          }}
        >
          {initialForName(profile?.name)}
        </Text>
      </View>
    );
  }, [profile?.avatarUrl, profile?.name]);

  const loadingState = isLoading;
  const isFollowing = profile?.isFollowing ?? false;
  const friendCount = useMemo(() => {
    if (!profile) return 0;
    if (profile.friendsCount !== undefined) return profile.friendsCount;
    const followers = profile.followersCount ?? 0;
    const following = profile.followingCount ?? 0;
    return Math.min(followers, following);
  }, [profile]);
  const gymStatValue =
    profile?.gymName && profile?.gymVisibility !== "hidden"
      ? profile.gymName
      : profile?.gymName
      ? "Hidden"
      : "Not set";
  const formattedHandle = formatHandle(profile?.handle);
  const friendsPreview = profile?.friendsPreview ?? [];
  const relationshipCopy = isFollowing
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

      {profile ? (
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            {avatar}
            <View style={{ flex: 1 }}>
              <Text
                style={{ ...typography.heading1, color: colors.textPrimary }}
              >
                {profile.name}
              </Text>
              {formattedHandle ? (
                <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                  {formattedHandle}
                </Text>
              ) : null}
              {profile.trainingStyleTags?.length ? (
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                  {profile.trainingStyleTags.join(" · ")}
                </Text>
              ) : profile.trainingStyle ? (
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                  {profile.trainingStyle}
                </Text>
              ) : null}
              {profile.gymName ? (
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                  Gym:{" "}
                  {profile.gymVisibility === "hidden"
                    ? "Hidden from profile"
                    : profile.gymName}
                </Text>
              ) : null}
              {isFollowing ? (
                <View
                  style={{
                    marginTop: 8,
                    alignSelf: "flex-start",
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: colors.surfaceMuted,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons
                    name='checkmark-circle'
                    size={16}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 12,
                    }}
                  >
                    Gym buddy
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: 14,
              backgroundColor: relationshipCopy.bg,
              borderWidth: 1,
              borderColor: relationshipCopy.border,
            }}
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
            <Pressable
              onPress={handleFollowToggle}
              disabled={followMutation.isPending || unfollowMutation.isPending}
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
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatBlock
              label='Workouts'
              value={String(profile.workoutsCompleted ?? "—")}
            />
            <StatBlock label='Mutual gym buddies' value={String(friendCount)} />
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatBlock
              label='Streak'
              value={
                profile.currentStreakDays
                  ? `${profile.currentStreakDays} days`
                  : "—"
              }
            />
            <StatBlock label='Gym' value={gymStatValue} />
          </View>

          {profile.bio ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 14,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textPrimary, ...typography.title }}>
                Bio
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  marginTop: 6,
                  lineHeight: 20,
                }}
              >
                {profile.bio}
              </Text>
            </View>
          ) : null}

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
              Mutual gym buddies
            </Text>
            {friendsPreview.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {friendsPreview.map((friend) => (
                  <Pressable
                    key={friend.id}
                    onPress={() => setSelectedFriend(friend)}
                    style={({ pressed }) => ({
                      width: 72,
                      alignItems: "center",
                      gap: 6,
                      opacity: pressed ? 0.85 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
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
                          style={{ width: 56, height: 56, borderRadius: 999 }}
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

export default ProfileScreen;
