import { useMemo } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { RootRoute } from "../navigation/types";
import {
  followUser,
  getUserProfile,
  unfollowUser,
} from "../api/social";
import { SocialProfile } from "../types/social";

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
    <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 18 }}>
      {value}
    </Text>
    <Text style={{ color: colors.textSecondary, ...typography.caption }}>{label}</Text>
  </View>
);

const ProfileScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RootRoute<"Profile">>();
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["profile", route.params.userId],
    queryFn: () => getUserProfile(route.params.userId),
  });

  const followMutation = useMutation({
    mutationFn: followUser,
    onSuccess: () =>
      queryClient.setQueryData<SocialProfile>(
        ["profile", route.params.userId],
        (prev) =>
          prev
            ? {
                ...prev,
                isFollowing: true,
                followersCount: (prev.followersCount ?? 0) + 1,
              }
            : prev
      ),
  });

  const unfollowMutation = useMutation({
    mutationFn: unfollowUser,
    onSuccess: () =>
      queryClient.setQueryData<SocialProfile>(
        ["profile", route.params.userId],
        (prev) =>
          prev
            ? {
                ...prev,
                isFollowing: false,
                followersCount: Math.max(0, (prev.followersCount ?? 1) - 1),
              }
            : prev
      ),
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
              <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
                {profile.name}
              </Text>
              {profile.handle ? (
                <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                  @{profile.handle}
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
            </View>
          </View>

          <Pressable
            onPress={handleFollowToggle}
            disabled={followMutation.isPending || unfollowMutation.isPending}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: isFollowing ? colors.surfaceMuted : colors.primary,
              borderWidth: 1,
              borderColor: isFollowing ? colors.border : colors.primary,
              opacity: pressed || followMutation.isPending || unfollowMutation.isPending ? 0.86 : 1,
            })}
          >
            <Text
              style={{
                color: isFollowing ? colors.textPrimary : colors.surface,
                fontFamily: fontFamilies.semibold,
              }}
            >
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </Pressable>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatBlock
              label="Workouts"
              value={String(profile.workoutsCompleted ?? "—")}
            />
            <StatBlock
              label="Streak"
              value={
                profile.currentStreakDays
                  ? `${profile.currentStreakDays} days`
                  : "—"
              }
            />
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatBlock
              label="Followers"
              value={String(profile.followersCount ?? "—")}
            />
            <StatBlock
              label="Following"
              value={String(profile.followingCount ?? "—")}
            />
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
              <Text style={{ color: colors.textPrimary, ...typography.title }}>Bio</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 6, lineHeight: 20 }}>
                {profile.bio}
              </Text>
            </View>
          ) : null}

        </View>
      ) : null}

      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => ({
          marginTop: 24,
          alignSelf: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ color: colors.textSecondary }}>Back to feed</Text>
      </Pressable>
    </ScreenContainer>
  );
};

export default ProfileScreen;
