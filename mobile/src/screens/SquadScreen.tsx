import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LegendList } from "../components/feed/LegendList";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
  TextInput,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { useSquadFeed } from "../hooks/useSquadFeed";
import {
  ActiveWorkoutStatus,
  SocialUserSummary,
  WorkoutSummaryShare,
} from "../types/social";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { useSocialLocalState } from "../hooks/useSocialLocalState";
import { followUser, getConnections, searchUsers, unfollowUser } from "../api/social";

type FeedItem =
  | { kind: "section"; title: string; subtitle?: string }
  | { kind: "active"; status: ActiveWorkoutStatus }
  | { kind: "share"; share: WorkoutSummaryShare };

const reactionOptions = ["🔥", "💪", "🚀", "🙌"];

const initialsForName = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const Avatar = ({ user }: { user: SocialUserSummary }) =>
  user.avatarUrl ? (
    <Image
      source={{ uri: user.avatarUrl }}
      style={{ width: 44, height: 44, borderRadius: 999, backgroundColor: colors.surfaceMuted }}
    />
  ) : (
    <View
      style={{
        width: 44,
        height: 44,
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
          fontFamily: fontFamilies.semibold,
        }}
      >
        {initialsForName(user.name)}
      </Text>
    </View>
  );

const VisibilityPill = ({ label }: { label: string }) => (
  <View
    style={{
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Text
      style={{
        ...typography.caption,
        fontFamily: fontFamilies.semibold,
        color: colors.textSecondary,
      }}
    >
      {label}
    </Text>
  </View>
);

const ReactionRow = () => (
  <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
    {reactionOptions.map((emoji) => (
      <Pressable
        key={emoji}
        onPress={() => {}}
        style={({ pressed }) => ({
          paddingHorizontal: 10,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        })}
      >
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
      </Pressable>
    ))}
  </View>
);

const formatElapsed = (seconds: number) => {
  if (seconds < 60) return `${seconds}s in`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min in`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m in`;
};

const formatRelativeTime = (iso: string) => {
  const created = new Date(iso);
  const diffMs = Date.now() - created.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const ActiveCard = ({
  status,
  onPressProfile,
}: {
  status: ActiveWorkoutStatus;
  onPressProfile: (userId: string) => void;
}) => (
  <Pressable
    onPress={() => onPressProfile(status.user.id)}
    style={({ pressed }) => ({
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: pressed ? 0.92 : 1,
    })}
  >
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Avatar user={status.user} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.title, color: colors.textPrimary }}>
          {status.user.name}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Working out: {status.templateName ?? "Custom workout"}
        </Text>
      </View>
      <VisibilityPill
        label={
          status.visibility === "private"
            ? "Private"
            : status.visibility === "followers"
            ? "Followers"
            : "Squad"
        }
      />
    </View>
    <View style={{ marginTop: 8 }}>
      <Text style={{ color: colors.textSecondary, ...typography.caption }}>
        {formatElapsed(status.elapsedSeconds)}
      </Text>
      {status.currentExerciseName ? (
        <Text style={{ color: colors.textPrimary, marginTop: 4 }}>
          Now: {status.currentExerciseName}
        </Text>
      ) : null}
    </View>
    <ReactionRow />
  </Pressable>
);

const ShareCard = ({
  share,
  onPressProfile,
}: {
  share: WorkoutSummaryShare;
  onPressProfile: (userId: string) => void;
}) => (
  <Pressable
    onPress={() => onPressProfile(share.user.id)}
    style={({ pressed }) => ({
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: pressed ? 0.92 : 1,
    })}
  >
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Avatar user={share.user} />
      <View style={{ flex: 1 }}>
        <Text style={{ ...typography.title, color: colors.textPrimary }}>
          {share.user.name}
        </Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          {formatRelativeTime(share.createdAt)}
        </Text>
      </View>
      <VisibilityPill
        label={
          share.visibility === "private"
            ? "Private"
            : share.visibility === "followers"
            ? "Followers"
            : "Squad"
        }
      />
    </View>
    <View
      style={{
        marginTop: 10,
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
          {share.templateName ?? "Custom workout"}
        </Text>
        <Text style={{ color: colors.textSecondary, ...typography.caption }}>
          {share.totalSets} sets
          {share.totalVolume ? ` · ${share.totalVolume.toLocaleString()} kg` : ""}{" "}
          {share.prCount ? ` · ${share.prCount} PRs` : ""}
        </Text>
      </View>
      {share.progressPhotoUrl ? (
        <Image
          source={{ uri: share.progressPhotoUrl }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
          }}
        />
      ) : null}
    </View>
    <ReactionRow />
  </Pressable>
);

const SquadScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useSquadFeed();
  const { state, createSquad, inviteToSquad } = useSocialLocalState();
  const [squadName, setSquadName] = useState("");
  const [inviteHandle, setInviteHandle] = useState("");
  const [inviteSquad, setInviteSquad] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");

  const connectionsQuery = useQuery({
    queryKey: ["social", "connections"],
    queryFn: getConnections,
  });

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 250);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const searchQuery = useQuery({
    queryKey: ["social", "search", debouncedTerm],
    queryFn: () => searchUsers(debouncedTerm),
    enabled: debouncedTerm.length > 1,
  });

  const followMutation = useMutation({
    mutationFn: followUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social", "connections"] }),
  });

  const unfollowMutation = useMutation({
    mutationFn: unfollowUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social", "connections"] }),
  });

  const followingIds = useMemo(
    () => new Set((connectionsQuery.data?.following ?? []).map((u) => u.id)),
    [connectionsQuery.data?.following]
  );

  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    items.push({
      kind: "section",
      title: "Active now",
      subtitle: "Live presence from people you follow.",
    });
    (data?.activeStatuses ?? []).forEach((status) =>
      items.push({ kind: "active", status })
    );

    items.push({
      kind: "section",
      title: "Recent sessions",
      subtitle: "Share wins when you want—never public by default.",
    });
    (data?.recentShares ?? []).forEach((share) =>
      items.push({ kind: "share", share })
    );

    return items;
  }, [data?.activeStatuses, data?.recentShares]);

  const renderItem = ({ item }: { item: FeedItem }) => {
    switch (item.kind) {
      case "section":
        return (
          <View style={{ paddingHorizontal: 4, paddingVertical: 6 }}>
            <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={{ color: colors.textSecondary, marginTop: 4, ...typography.body }}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        );
      case "active":
        return (
          <ActiveCard
            status={item.status}
            onPressProfile={(userId) => navigation.navigate("Profile", { userId })}
          />
        );
      case "share":
        return (
          <ShareCard
            share={item.share}
            onPressProfile={(userId) => navigation.navigate("Profile", { userId })}
          />
        );
      default:
        return null;
    }
  };

  const emptyState = !isLoading && feedItems.filter((f) => f.kind !== "section").length === 0;

  return (
    <ScreenContainer>
      <View style={{ flex: 1, gap: 12 }}>
        <View style={{ marginTop: 6, gap: 4 }}>
          <Text style={{ ...typography.heading1, color: colors.textPrimary }}>Squad</Text>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            See who{"'"}s training and celebrate wins with your crew.
          </Text>
        </View>

        {isLoading ? (
          <View style={{ marginTop: 20 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
        {isError ? (
          <Text style={{ color: colors.error }}>
            Could not load your squad feed. We{"'"}ll retry in a moment.
          </Text>
        ) : null}

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Text style={{ ...typography.title, color: colors.textPrimary }}>Follow friends</Text>
          <Text style={{ color: colors.textSecondary }}>
            Keep following separate from squads. Search and follow people directly.
          </Text>

          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Search by name or handle"
            placeholderTextColor={colors.textSecondary}
            style={inputStyle}
          />

          <View style={{ gap: 8 }}>
            {debouncedTerm.length <= 1 ? (
              <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                Start typing to see suggestions.
              </Text>
            ) : searchQuery.isFetching ? (
              <ActivityIndicator color={colors.secondary} />
            ) : (searchQuery.data ?? []).length ? (
              (searchQuery.data ?? []).map((user) => {
                const alreadyFollowing = followingIds.has(user.id);
                const isPending =
                  followMutation.isPending || unfollowMutation.isPending;
                return (
                  <Pressable
                    key={user.id}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                      opacity: pressed || isPending ? 0.9 : 1,
                    })}
                  >
                    <View>
                      <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                        {user.name}
                      </Text>
                      {user.handle ? (
                        <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                          {user.handle}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      disabled={isPending}
                      onPress={() =>
                        alreadyFollowing
                          ? unfollowMutation.mutate(user.id)
                          : followMutation.mutate(user.id)
                      }
                      style={({ pressed }) => ({
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: alreadyFollowing ? colors.border : colors.primary,
                        backgroundColor: alreadyFollowing ? colors.surface : colors.primary,
                        opacity: pressed || isPending ? 0.85 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: alreadyFollowing ? colors.textPrimary : colors.surface,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {alreadyFollowing ? "Following" : "Follow"}
                      </Text>
                    </Pressable>
                  </Pressable>
                );
              })
            ) : (
              <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                No matching users yet.
              </Text>
            )}
          </View>

          {connectionsQuery.data?.following?.length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                Following
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {connectionsQuery.data.following.map((friend) => (
                  <View
                    key={friend.id}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary }}>
                      {friend.name} {friend.handle ? `· ${friend.handle}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {connectionsQuery.data?.followers?.length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                Followers
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {connectionsQuery.data.followers.map((follower) => (
                  <View
                    key={follower.id}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary }}>
                      {follower.name} {follower.handle ? `· ${follower.handle}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Text style={{ ...typography.title, color: colors.textPrimary }}>Squads</Text>
          <Text style={{ color: colors.textSecondary }}>
            Organize squads separately from your follow graph.
          </Text>
          <TextInput
            value={squadName}
            onChangeText={setSquadName}
            placeholder="Create squad name"
            placeholderTextColor={colors.textSecondary}
            style={inputStyle}
          />
          <Pressable
            onPress={() => {
              void createSquad(squadName);
              setInviteSquad(squadName || inviteSquad);
              setSquadName("");
            }}
            style={({ pressed }) => ({
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
              Create squad
            </Text>
          </Pressable>

          {state.squads.length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                Invite to squad
              </Text>
              <TextInput
                value={inviteHandle}
                onChangeText={setInviteHandle}
                placeholder="Friend handle"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
              <ScrollSquads
                squads={state.squads}
                active={inviteSquad}
                onSelect={(name) => setInviteSquad(name)}
              />
              <Pressable
                onPress={() => {
                  if (inviteSquad) {
                    void inviteToSquad(inviteSquad, inviteHandle);
                    setInviteHandle("");
                  }
                }}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold }}>
                  Send invite
                </Text>
              </Pressable>
            </View>
          ) : null}

          {state.squads.length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                Squads
              </Text>
              <View style={{ gap: 8 }}>
                {state.squads.map((squad) => (
                  <View
                    key={squad.name}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      padding: 10,
                      backgroundColor: colors.surfaceMuted,
                    }}
                  >
                    <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                      {squad.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                      Members: {squad.members.join(", ") || "Just you"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>

        {emptyState ? (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Quiet right now
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              When friends start a workout or share a session, it shows up here.
            </Text>
          </View>
        ) : (
          <LegendList
            data={feedItems}
            keyExtractor={(item, index) => {
              if (item.kind === "section") return `section-${item.title}-${index}`;
              if (item.kind === "active") return `active-${item.status.id}`;
              return `share-${item.share.id}`;
            }}
            renderItem={renderItem}
            estimatedItemSize={140}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
          />
        )}
      </View>
    </ScreenContainer>
  );
};

export default SquadScreen;

const inputStyle = {
  backgroundColor: colors.surfaceMuted,
  borderRadius: 10,
  padding: 10,
  borderWidth: 1,
  borderColor: colors.border,
  color: colors.textPrimary,
};

const ScrollSquads = ({
  squads,
  active,
  onSelect,
}: {
  squads: { name: string; members: string[] }[];
  active?: string;
  onSelect: (name: string) => void;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
    <View style={{ flexDirection: "row", gap: 8 }}>
      {squads.map((squad) => {
        const selected = active === squad.name;
        return (
          <Pressable
            key={squad.name}
            onPress={() => onSelect(squad.name)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected ? "rgba(34,197,94,0.12)" : colors.surface,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
              {squad.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </ScrollView>
);
