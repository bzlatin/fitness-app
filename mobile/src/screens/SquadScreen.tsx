import { useEffect, useMemo, useState, ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
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
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { useSquadFeed } from "../hooks/useSquadFeed";
import { useSquads } from "../hooks/useSquads";
import {
  ActiveWorkoutStatus,
  SocialUserSummary,
  SquadDetail,
  WorkoutSummaryShare,
} from "../types/social";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import {
  followUser,
  getConnections,
  searchUsers,
  unfollowUser,
} from "../api/social";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatHandle } from "../utils/formatHandle";
import * as Clipboard from "expo-clipboard";
import { Share, Alert } from "react-native";
import { API_BASE_URL } from "../api/client";
import { WorkoutReactions } from "../components/social/WorkoutReactions";

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
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        backgroundColor: colors.surfaceMuted,
      }}
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

const buildFeedItems = (
  activeStatuses: ActiveWorkoutStatus[],
  recentShares: WorkoutSummaryShare[],
  excludeUserId?: string,
  titles?: {
    liveTitle?: string;
    liveEmptyTitle?: string;
    liveSubtitle?: string;
    recentTitle?: string;
    recentSubtitle?: string;
  }
): FeedItem[] => {
  const filteredActive = activeStatuses.filter(
    (status) => status.user.id !== excludeUserId
  );
  const filteredShares = recentShares.filter(
    (share) => share.user.id !== excludeUserId
  );
  const defaultLiveTitle = titles?.liveTitle ?? "Active friends";
  const emptyLiveTitle =
    titles?.liveEmptyTitle ??
    (titles?.liveTitle ? titles.liveTitle : "No active friends");
  const items: FeedItem[] = [];
  items.push({
    kind: "section",
    title: filteredActive.length ? defaultLiveTitle : emptyLiveTitle,
    subtitle: titles?.liveSubtitle,
  });
  filteredActive.forEach((status) => items.push({ kind: "active", status }));
  items.push({
    kind: "section",
    title: titles?.recentTitle ?? "Recent sessions",
    subtitle: titles?.recentSubtitle,
  });
  filteredShares.forEach((share) => items.push({ kind: "share", share }));
  return items;
};

const ActiveCard = ({
  status,
  onPressProfile,
}: {
  status: ActiveWorkoutStatus;
  onPressProfile: (userId: string) => void;
}) => (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Pressable
      onPress={() => onPressProfile(status.user.id)}
      style={({ pressed }) => ({
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
              ? "Friends"
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
    </Pressable>
    <WorkoutReactions targetType='status' targetId={status.id} compact />
  </View>
);

const ShareCard = ({
  share,
  onPressProfile,
}: {
  share: WorkoutSummaryShare;
  onPressProfile: (userId: string) => void;
}) => (
  <View
    style={{
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Pressable
      onPress={() => onPressProfile(share.user.id)}
      style={({ pressed }) => ({
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
              ? "Friends"
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
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
            }}
          >
            {share.templateName ?? "Custom workout"}
          </Text>
          <Text style={{ color: colors.textSecondary, ...typography.caption }}>
            {share.totalSets} sets
            {share.totalVolume
              ? ` · ${share.totalVolume.toLocaleString()} kg`
              : ""}{" "}
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
    </Pressable>
    <WorkoutReactions targetType='share' targetId={share.id} compact />
  </View>
);

const SquadScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: generalFeed, isLoading, isError } = useSquadFeed();
  const {
    data: squads = [],
    isLoading: squadsLoading,
    isError: squadsError,
    createSquad: createSquadAction,
    inviteToSquad: inviteToSquadAction,
    isCreatingSquad,
    isInvitingToSquad,
    deleteSquad: deleteSquadAction,
    isDeletingSquad,
  } = useSquads();
  const { user, getAccessToken } = useCurrentUser();
  const [squadName, setSquadName] = useState("");
  const [inviteHandle, setInviteHandle] = useState("");
  const [inviteSquadId, setInviteSquadId] = useState<string | undefined>(
    undefined
  );
  const [selectedSquadId, setSelectedSquadId] = useState<string | undefined>(
    undefined
  );
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [isNearTop, setIsNearTop] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [showFriendsSection, setShowFriendsSection] = useState(false);
  const [showCreateSquadSection, setShowCreateSquadSection] = useState(false);
  const [showInviteSection, setShowInviteSection] = useState(false);
  const [showSquadListSection, setShowSquadListSection] = useState(false);
  const [deletingSquadId, setDeletingSquadId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [profilePreview, setProfilePreview] =
    useState<SocialUserSummary | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [currentInviteCode, setCurrentInviteCode] = useState<string | null>(
    null
  );
  const {
    data: selectedSquadData,
    isLoading: selectedSquadLoading,
    isError: selectedSquadError,
  } = useSquadFeed(selectedSquadId, { enabled: Boolean(selectedSquadId) });
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showSquadModal, setShowSquadModal] = useState(false);
  const closeSocialModal = () => {
    setShowSocialModal(false);
    setSearchTerm("");
    setDebouncedTerm("");
    setShowFriendsSection(false);
  };

  const closeSquadModal = () => {
    setShowSquadModal(false);
    setShowCreateSquadSection(false);
    setShowInviteSection(false);
    setShowSquadListSection(false);
    setConfirmDeleteId(null);
  };

  const openSquadModal = (options?: {
    focusCreate?: boolean;
    focusInvite?: boolean;
    focusManage?: boolean;
  }) => {
    const hasSquads = squads.length > 0;
    setShowSquadModal(true);
    setShowCreateSquadSection(options?.focusCreate ?? !hasSquads);
    setShowInviteSection(options?.focusInvite ?? hasSquads);
    setShowSquadListSection(options?.focusManage ?? hasSquads);
  };

  const connectionsQuery = useQuery({
    queryKey: ["social", "connections"],
    queryFn: getConnections,
  });

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 250);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    if (!inviteSquadId && squads.length > 0) {
      setInviteSquadId(squads[0].id);
    }
  }, [squads, inviteSquadId]);

  useEffect(() => {
    if (
      selectedSquadId &&
      !squads.some((squad) => squad.id === selectedSquadId)
    ) {
      setSelectedSquadId(undefined);
    }
  }, [squads, selectedSquadId]);

  useEffect(() => {
    if (!squads.length) {
      setShowInviteSection(false);
      setShowSquadListSection(false);
    }
  }, [squads.length]);

  const handleCreateSquad = async () => {
    const trimmed = squadName.trim();
    if (!trimmed) return;
    try {
      const squad = await createSquadAction(trimmed);
      setSelectedSquadId(squad.id);
      setInviteSquadId(squad.id);
      setSquadName("");
      setShowCreateSquadSection(false);
      setShowInviteSection(true);
      setShowSquadListSection(true);
    } catch (err) {
      console.error("Failed to create squad", err);
    }
  };

  const handleInvite = async () => {
    const trimmedHandle = inviteHandle.trim();
    if (!inviteSquadId || !trimmedHandle) return;
    try {
      await inviteToSquadAction({
        squadId: inviteSquadId,
        handle: trimmedHandle,
      });
      setInviteHandle("");
    } catch (err) {
      console.error("Failed to invite to squad", err);
    }
  };

  const handleDeleteSquad = async (squadId: string) => {
    setDeletingSquadId(squadId);
    try {
      await deleteSquadAction(squadId);
      if (selectedSquadId === squadId) {
        setSelectedSquadId(undefined);
      }
      if (inviteSquadId === squadId) {
        const nextSquad = squads.find((squad) => squad.id !== squadId);
        setInviteSquadId(nextSquad?.id);
      }
      setShowInviteSection(false);
      setShowSquadListSection(false);
      setConfirmDeleteId(null);
    } catch (err) {
      console.error("Failed to delete squad", err);
    } finally {
      setDeletingSquadId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleGenerateInviteLink = async () => {
    if (!inviteSquadId) return;

    setGeneratingInvite(true);
    try {
      const token = await getAccessToken();

      const response = await fetch(
        `${API_BASE_URL}/social/squads/${inviteSquadId}/invites`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        Alert.alert("Error", data.error || "Failed to generate invite link");
        return;
      }

      setCurrentInviteCode(data.code);
    } catch (err) {
      console.error("Failed to generate invite link", err);
      Alert.alert("Error", "Failed to generate invite link");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleCopyInviteLink = async () => {
    if (!currentInviteCode) return;
    const link = `push-pull://squad/join/${currentInviteCode}`;
    await Clipboard.setStringAsync(link);
    Alert.alert("Copied!", "Invite link copied to clipboard");
  };

  const handleShareInviteLink = async () => {
    if (!currentInviteCode) return;
    const link = `push-pull://squad/join/${currentInviteCode}`;
    const selectedSquad = squads.find((s) => s.id === inviteSquadId);

    try {
      await Share.share({
        message: `Join my squad "${selectedSquad?.name}" on Push/Pull! ${link}`,
        title: `Join ${selectedSquad?.name}`,
      });
    } catch (err) {
      console.error("Failed to share invite link", err);
    }
  };

  const searchQuery = useQuery({
    queryKey: ["social", "search", debouncedTerm],
    queryFn: () => searchUsers(debouncedTerm),
    enabled: debouncedTerm.length > 1,
  });

  const followMutation = useMutation({
    mutationFn: followUser,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["social", "connections"] }),
  });

  const openProfilePreview = (user: SocialUserSummary) => {
    Keyboard.dismiss();
    setShowSocialModal(false);
    setProfilePreview(user);
  };

  const closeProfilePreview = () => setProfilePreview(null);

  const unfollowMutation = useMutation({
    mutationFn: unfollowUser,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["social", "connections"] }),
  });

  const followingIds = useMemo(
    () => new Set((connectionsQuery.data?.following ?? []).map((u) => u.id)),
    [connectionsQuery.data?.following]
  );
  const friendsList = connectionsQuery.data?.friends ?? [];
  const pendingIncoming = connectionsQuery.data?.pendingInvites ?? [];
  const pendingOutgoing = connectionsQuery.data?.outgoingInvites ?? [];

  const feedItems = useMemo<FeedItem[]>(() => {
    return buildFeedItems(
      generalFeed?.activeStatuses ?? [],
      generalFeed?.recentShares ?? [],
      user?.id
    );
  }, [generalFeed?.activeStatuses, generalFeed?.recentShares, user?.id]);

  const selectedSquad = squads.find((squad) => squad.id === selectedSquadId);
  const selectedSquadItems = useMemo<FeedItem[]>(() => {
    if (!selectedSquadId) return [];
    return buildFeedItems(
      selectedSquadData?.activeStatuses ?? [],
      selectedSquadData?.recentShares ?? [],
      undefined,
      {
        liveTitle: selectedSquad ? `${selectedSquad.name} live` : "Squad live",
        liveSubtitle: undefined,

        recentSubtitle: undefined,
      }
    );
  }, [
    selectedSquadId,
    selectedSquadData?.activeStatuses,
    selectedSquadData?.recentShares,
    selectedSquad?.name,
    user?.id,
  ]);
  const selectedSquadEmpty =
    selectedSquadId &&
    !selectedSquadLoading &&
    selectedSquadItems.filter((item) => item.kind !== "section").length === 0;

  const showingSquadFeed = Boolean(selectedSquadId);
  const displayItems = showingSquadFeed ? selectedSquadItems : feedItems;
  const displayLoading = showingSquadFeed ? selectedSquadLoading : isLoading;
  const displayError = showingSquadFeed ? selectedSquadError : isError;

  const emptyState =
    !isLoading && feedItems.filter((f) => f.kind !== "section").length === 0;

  const displayEmpty = showingSquadFeed ? selectedSquadEmpty : emptyState;

  const renderItem = ({ item }: { item: FeedItem }) => {
    switch (item.kind) {
      case "section":
        return (
          <View style={{ paddingHorizontal: 4, paddingVertical: 4 }}>
            <Text
              style={{
                ...typography.title,
                color: colors.textSecondary,
                fontFamily: fontFamilies.semibold,
              }}
            >
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  marginTop: 2,
                  ...typography.caption,
                }}
              >
                {item.subtitle}
              </Text>
            ) : null}
          </View>
        );
      case "active":
        return (
          <ActiveCard
            status={item.status}
            onPressProfile={(userId) =>
              navigation.navigate("Profile", { userId })
            }
          />
        );
      case "share":
        return (
          <ShareCard
            share={item.share}
            onPressProfile={(userId) =>
              navigation.navigate("Profile", { userId })
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1, gap: 12 }}>
        <View
          style={{
            marginTop: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
              Who{"'"}s lifting
            </Text>
            <Text
              style={{ ...typography.caption, color: colors.textSecondary }}
            >
              More room for the live crew and your squads.
            </Text>
          </View>
          <Pressable
            accessibilityLabel='Find buddies'
            onPress={() => setShowSocialModal(true)}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            })}
          >
            <Ionicons
              name='person-add-outline'
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Squads
            </Text>
            <Pressable
              onPress={() => openSquadModal()}
              style={({ pressed }) => ({
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              })}
            >
              <Ionicons
                name='settings-outline'
                size={16}
                color={colors.textSecondary}
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                {squads.length ? "Manage" : "Browse & manage"}
              </Text>
            </Pressable>
          </View>
          {selectedSquadId ? (
            <Pressable
              onPress={() => setSelectedSquadId(undefined)}
              style={({ pressed }) => ({
                marginTop: 4,
                alignSelf: "flex-start",
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              })}
            >
              <Ionicons
                name='eye-outline'
                size={16}
                color={colors.textSecondary}
              />
              <Text
                style={{ color: colors.textSecondary, ...typography.caption }}
              >
                Viewing {selectedSquad?.name ?? "Squad"} — tap to switch back
              </Text>
            </Pressable>
          ) : null}
          {squadsError ? (
            <Text style={{ color: colors.error, ...typography.caption }}>
              Could not load your squads. Try again shortly.
            </Text>
          ) : null}
          {squadsLoading ? (
            <View
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: 12,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
              }}
            >
              <ActivityIndicator color={colors.primary} />
              <Text
                style={{ color: colors.textSecondary, ...typography.caption }}
              >
                Loading squads…
              </Text>
            </View>
          ) : squads.length ? (
            <ScrollSquads
              squads={squads}
              activeId={selectedSquadId}
              onSelect={(id) =>
                setSelectedSquadId((prev) => (prev === id ? undefined : id))
              }
              onLongPress={(id) =>
                navigation.navigate("SquadDetail", { squadId: id })
              }
            />
          ) : (
            <Pressable
              onPress={() => setShowSquadModal(true)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              })}
            >
              <Ionicons
                name='compass-outline'
                size={18}
                color={colors.textSecondary}
              />
              <Text
                style={{ color: colors.textSecondary, ...typography.caption }}
              >
                Find a gym squad
              </Text>
            </Pressable>
          )}
        </View>

        <View style={{ flex: 1 }}>
          {displayError ? (
            <Text style={{ color: colors.error }}>
              Could not load your {showingSquadFeed ? "squad feed" : "feed"}. We
              {"'"}ll retry in a moment.
            </Text>
          ) : null}
          {displayLoading ? (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 24,
                borderWidth: 1,
                borderColor: colors.border,
                marginTop: 12,
              }}
            >
              <ActivityIndicator color={colors.primary} />
              <Text
                style={{
                  color: colors.textSecondary,
                  marginTop: 8,
                  ...typography.caption,
                }}
              >
                Searching for live {showingSquadFeed ? "squad" : "crew"}…
              </Text>
            </View>
          ) : displayEmpty ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 6,
                marginTop: 12,
              }}
            >
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                Quiet right now
              </Text>
              <Text
                style={{ ...typography.caption, color: colors.textSecondary }}
              >
                When {showingSquadFeed ? "squadmates" : "friends"} start a
                workout or share a session, it shows up here.
              </Text>
            </View>
          ) : (
            <LegendList
              data={displayItems}
              keyExtractor={(item, index) => {
                if (item.kind === "section")
                  return `section-${item.title}-${index}`;
                if (item.kind === "active") return `active-${item.status.id}`;
                return `share-${item.share.id}`;
              }}
              renderItem={renderItem}
              estimatedItemSize={140}
              style={{ flex: 1 }}
              contentContainerStyle={{
                gap: 12,
                paddingBottom: 60 + insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } =
                  event.nativeEvent;
                const distanceFromBottom =
                  contentSize.height -
                  layoutMeasurement.height -
                  contentOffset.y;
                const distanceFromTop = contentOffset.y;
                setIsNearBottom(distanceFromBottom < 10);
                setIsNearTop(distanceFromTop < 10);
              }}
              scrollEventThrottle={16}
            />
          )}

          {!displayEmpty && !isNearTop && (
            <LinearGradient
              colors={[
                colors.background,
                `${colors.background}E0`,
                `${colors.background}C0`,
                `${colors.background}90`,
                `${colors.background}60`,
                `${colors.background}30`,
                `${colors.background}10`,
                "transparent",
              ]}
              locations={[0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1]}
              style={{
                position: "absolute",
                top: 0,
                left: -16,
                right: -16,
                height: 60,
                pointerEvents: "none",
              }}
            />
          )}
          {!displayEmpty && !isNearBottom && (
            <LinearGradient
              colors={[
                "transparent",
                `${colors.background}10`,
                `${colors.background}30`,
                `${colors.background}60`,
                `${colors.background}90`,
                `${colors.background}C0`,
                `${colors.background}E0`,
                colors.background,
              ]}
              locations={[0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]}
              style={{
                position: "absolute",
                bottom: 0,
                left: -16,
                right: -16,
                height: 60 + insets.bottom,
                pointerEvents: "none",
              }}
            />
          )}
        </View>

        <Modal
          visible={showSocialModal}
          animationType='slide'
          transparent
          onRequestClose={closeSocialModal}
        >
          <TouchableWithoutFeedback onPress={closeSocialModal}>
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.55)",
                justifyContent: "flex-end",
              }}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={24}
                style={{ flex: 1, justifyContent: "flex-end" }}
              >
                <TouchableWithoutFeedback
                  onPress={(event) => event.stopPropagation()}
                >
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderTopLeftRadius: 20,
                      borderTopRightRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      maxHeight: "88%",
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
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Ionicons
                          name='person-add-outline'
                          size={18}
                          color={colors.textPrimary}
                        />
                        <Text
                          style={{
                            ...typography.title,
                            color: colors.textPrimary,
                          }}
                        >
                          Find buddies
                        </Text>
                      </View>
                      <Pressable onPress={closeSocialModal}>
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
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        marginHorizontal: -16,
                        marginTop: 4,
                        marginBottom: 10,
                      }}
                    />
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps='always'
                    >
                      <View style={{ gap: 12, paddingBottom: 18 }}>
                        <View
                          style={{
                            backgroundColor: colors.surfaceMuted,
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                            gap: 10,
                          }}
                        >
                          <View
                            style={{
                              gap: 4,
                              flexDirection: "row",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text
                                style={{
                                  ...typography.title,
                                  color: colors.textPrimary,
                                }}
                              >
                                Find gym buddies
                              </Text>
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  ...typography.caption,
                                }}
                              >
                                Search, tap add, done.
                              </Text>
                            </View>
                            <Ionicons
                              name='search'
                              size={18}
                              color={colors.textSecondary}
                            />
                          </View>
                          <TextInput
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                            placeholder='Search by name or handle'
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                          />
                          <View style={{ gap: 8 }}>
                            {debouncedTerm.length <= 1 ? (
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  ...typography.caption,
                                }}
                              >
                                Type at least 2 characters to see suggestions.
                              </Text>
                            ) : searchQuery.isFetching ? (
                              <ActivityIndicator color={colors.secondary} />
                            ) : (searchQuery.data ?? []).length ? (
                              (searchQuery.data ?? []).map((user) => {
                                const alreadyFollowing = followingIds.has(
                                  user.id
                                );
                                const isPending =
                                  followMutation.isPending ||
                                  unfollowMutation.isPending;
                                return (
                                  <TouchableOpacity
                                    key={user.id}
                                    onPress={() => openProfilePreview(user)}
                                    activeOpacity={0.9}
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      padding: 12,
                                      borderRadius: 12,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                      backgroundColor: colors.surface,
                                      opacity: isPending ? 0.9 : 1,
                                    }}
                                  >
                                    <View>
                                      <Text
                                        style={{
                                          color: colors.textPrimary,
                                          fontFamily: fontFamilies.semibold,
                                        }}
                                      >
                                        {user.name}
                                      </Text>
                                      {user.handle ? (
                                        <Text
                                          style={{
                                            color: colors.textSecondary,
                                            ...typography.caption,
                                          }}
                                        >
                                          {formatHandle(user.handle)}
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
                                        borderColor: alreadyFollowing
                                          ? colors.border
                                          : colors.primary,
                                        backgroundColor: alreadyFollowing
                                          ? colors.surfaceMuted
                                          : colors.primary,
                                        opacity:
                                          pressed || isPending ? 0.85 : 1,
                                      })}
                                    >
                                      <Text
                                        style={{
                                          color: alreadyFollowing
                                            ? colors.textPrimary
                                            : colors.surface,
                                          fontFamily: fontFamilies.semibold,
                                        }}
                                      >
                                        {alreadyFollowing
                                          ? "Added"
                                          : "Add friend"}
                                      </Text>
                                    </Pressable>
                                  </TouchableOpacity>
                                );
                              })
                            ) : (
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  ...typography.caption,
                                }}
                              >
                                No matching users yet.
                              </Text>
                            )}
                          </View>
                        </View>

                        <CollapsibleSection
                          title='Friends & requests'
                          subtitle={
                            friendsList.length
                              ? `${friendsList.length} friend${
                                  friendsList.length === 1 ? "" : "s"
                                } plus invites`
                              : "Keep friends tucked away until you need them."
                          }
                          open={showFriendsSection}
                          onToggle={() =>
                            setShowFriendsSection((prev) => !prev)
                          }
                          iconName='people-outline'
                        >
                          {friendsList.length ? (
                            <View style={{ gap: 6 }}>
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  ...typography.caption,
                                }}
                              >
                                Friends
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                  gap: 8,
                                }}
                              >
                                {friendsList.map((friend) => (
                                  <TouchableOpacity
                                    key={friend.id}
                                    onPress={() => openProfilePreview(friend)}
                                    activeOpacity={0.85}
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingVertical: 6,
                                      borderRadius: 10,
                                      backgroundColor: colors.surface,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: colors.textPrimary,
                                        fontFamily: fontFamilies.semibold,
                                      }}
                                    >
                                      {friend.name}
                                    </Text>
                                    {friend.handle ? (
                                      <Text
                                        style={{
                                          color: colors.textSecondary,
                                          fontSize: 12,
                                        }}
                                      >
                                        {formatHandle(friend.handle)}
                                      </Text>
                                    ) : null}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>
                          ) : (
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 12,
                              }}
                            >
                              No friends yet. Add a gym buddy to see them here.
                            </Text>
                          )}

                          <View style={{ gap: 6 }}>
                            <Text
                              style={{
                                ...typography.caption,
                                color: colors.textSecondary,
                              }}
                            >
                              Pending invites
                            </Text>
                            {pendingIncoming.length ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                  gap: 8,
                                }}
                              >
                                {pendingIncoming.map((invite) => (
                                  <TouchableOpacity
                                    key={invite.id}
                                    onPress={() => openProfilePreview(invite)}
                                    activeOpacity={0.85}
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingVertical: 6,
                                      borderRadius: 10,
                                      backgroundColor: colors.surface,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                    }}
                                  >
                                    <Text style={{ color: colors.textPrimary }}>
                                      {invite.name}
                                    </Text>
                                    {invite.handle ? (
                                      <Text
                                        style={{
                                          color: colors.textSecondary,
                                          fontSize: 12,
                                        }}
                                      >
                                        {formatHandle(invite.handle)}
                                      </Text>
                                    ) : null}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            ) : (
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  fontSize: 12,
                                }}
                              >
                                No pending requests at the moment.
                              </Text>
                            )}
                          </View>

                          <View style={{ gap: 6 }}>
                            <Text
                              style={{
                                ...typography.caption,
                                color: colors.textSecondary,
                              }}
                            >
                              Invites you sent
                            </Text>
                            {pendingOutgoing.length ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                  gap: 8,
                                }}
                              >
                                {pendingOutgoing.map((invite) => (
                                  <TouchableOpacity
                                    key={invite.id}
                                    onPress={() => openProfilePreview(invite)}
                                    activeOpacity={0.85}
                                    style={{
                                      paddingHorizontal: 10,
                                      paddingVertical: 6,
                                      borderRadius: 10,
                                      backgroundColor: colors.surface,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                    }}
                                  >
                                    <Text style={{ color: colors.textPrimary }}>
                                      {invite.name}
                                    </Text>
                                    {invite.handle ? (
                                      <Text
                                        style={{
                                          color: colors.textSecondary,
                                          fontSize: 12,
                                        }}
                                      >
                                        {formatHandle(invite.handle)}
                                      </Text>
                                    ) : null}
                                  </TouchableOpacity>
                                ))}
                              </View>
                            ) : (
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  fontSize: 12,
                                }}
                              >
                                No outgoing invites right now.
                              </Text>
                            )}
                          </View>
                        </CollapsibleSection>
                      </View>
                    </ScrollView>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal
          visible={showSquadModal}
          animationType='slide'
          transparent
          onRequestClose={closeSquadModal}
        >
          <TouchableWithoutFeedback onPress={closeSquadModal}>
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.55)",
                justifyContent: "flex-end",
              }}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={24}
                style={{ flex: 1, justifyContent: "flex-end" }}
              >
                <TouchableWithoutFeedback
                  onPress={(event) => event.stopPropagation()}
                >
                  <View
                    style={{
                      backgroundColor: colors.surface,
                      borderTopLeftRadius: 20,
                      borderTopRightRadius: 20,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      maxHeight: "90%",
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
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Ionicons
                          name='people-outline'
                          size={18}
                          color={colors.textPrimary}
                        />
                        <Text
                          style={{
                            ...typography.title,
                            color: colors.textPrimary,
                          }}
                        >
                          Manage squads
                        </Text>
                      </View>
                      <Pressable onPress={closeSquadModal}>
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
                        height: 1,
                        backgroundColor: colors.border,
                        marginHorizontal: -16,
                        marginTop: 4,
                        marginBottom: 10,
                      }}
                    />
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <View style={{ gap: 12, paddingBottom: 18 }}>
                        <View
                          style={{
                            backgroundColor: colors.surfaceMuted,
                            borderRadius: 12,
                            padding: 12,
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
                              gap: 12,
                            }}
                          >
                            <View style={{ flex: 1, gap: 4 }}>
                              <Text
                                style={{
                                  ...typography.title,
                                  color: colors.textPrimary,
                                }}
                              >
                                Squads
                              </Text>
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  ...typography.caption,
                                }}
                              >
                                Quick selection for feeds, with deeper controls
                                below.
                              </Text>
                            </View>
                            <VisibilityPill
                              label={
                                squadsLoading
                                  ? "Loading…"
                                  : squads.length
                                  ? `${squads.length} total`
                                  : "None yet"
                              }
                            />
                          </View>

                          {squadsError ? (
                            <Text
                              style={{
                                color: colors.error,
                                ...typography.caption,
                              }}
                            >
                              Could not load your squads. Try again shortly.
                            </Text>
                          ) : null}

                          {squadsLoading ? (
                            <View
                              style={{
                                backgroundColor: colors.surface,
                                borderRadius: 12,
                                padding: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                flexDirection: "row",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <ActivityIndicator color={colors.primary} />
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  ...typography.caption,
                                }}
                              >
                                Loading squads…
                              </Text>
                            </View>
                          ) : squads.length ? (
                            <ScrollSquads
                              squads={squads}
                              activeId={selectedSquadId}
                              onSelect={(id) =>
                                setSelectedSquadId((prev) =>
                                  prev === id ? undefined : id
                                )
                              }
                            />
                          ) : (
                            <Pressable
                              onPress={() =>
                                openSquadModal({ focusCreate: true })
                              }
                              style={({ pressed }) => ({
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                padding: 10,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: pressed
                                  ? colors.surface
                                  : colors.surfaceMuted,
                              })}
                            >
                              <Ionicons
                                name='compass-outline'
                                size={18}
                                color={colors.textSecondary}
                              />
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  ...typography.caption,
                                }}
                              >
                                Find a squad to get started
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        <CollapsibleSection
                          title='Create a squad'
                          subtitle='Name it now, invite later.'
                          open={showCreateSquadSection}
                          onToggle={() =>
                            setShowCreateSquadSection((prev) => !prev)
                          }
                          iconName='add-circle-outline'
                        >
                          <TextInput
                            value={squadName}
                            onChangeText={setSquadName}
                            placeholder='Squad name'
                            placeholderTextColor={colors.textSecondary}
                            style={inputStyle}
                          />
                          <Pressable
                            onPress={() => {
                              void handleCreateSquad();
                            }}
                            disabled={isCreatingSquad}
                            style={({ pressed }) => ({
                              paddingVertical: 10,
                              borderRadius: 10,
                              backgroundColor: colors.surface,
                              borderWidth: 1,
                              borderColor: colors.border,
                              alignItems: "center",
                              opacity: pressed || isCreatingSquad ? 0.7 : 1,
                            })}
                          >
                            <Text
                              style={{
                                color: colors.textPrimary,
                                fontFamily: fontFamilies.semibold,
                              }}
                            >
                              {isCreatingSquad
                                ? "Creating squad…"
                                : "Create squad"}
                            </Text>
                          </Pressable>
                        </CollapsibleSection>

                        {squads.length ? (
                          <>
                            <CollapsibleSection
                              title='Invite to a squad'
                              subtitle='Generate an invite link or send a direct invite.'
                              open={showInviteSection}
                              onToggle={() =>
                                setShowInviteSection((prev) => !prev)
                              }
                              iconName='send-outline'
                            >
                              <ScrollSquads
                                squads={squads}
                                activeId={inviteSquadId}
                                onSelect={(id) => setInviteSquadId(id)}
                              />

                              {/* Invite Link Section */}
                              <View style={{ gap: 10 }}>
                                <Text
                                  style={{
                                    ...typography.caption,
                                    color: colors.textSecondary,
                                  }}
                                >
                                  Invite Link (expires in 7 days)
                                </Text>
                                {currentInviteCode ? (
                                  <View style={{ gap: 8 }}>
                                    <View
                                      style={{
                                        backgroundColor: colors.surface,
                                        borderRadius: 10,
                                        padding: 10,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          ...typography.caption,
                                          color: colors.textPrimary,
                                          fontFamily: fontFamilies.regular,
                                        }}
                                      >
                                        push-pull://squad/join/
                                        {currentInviteCode}
                                      </Text>
                                    </View>
                                    <View
                                      style={{ flexDirection: "row", gap: 8 }}
                                    >
                                      <Pressable
                                        onPress={() =>
                                          void handleCopyInviteLink()
                                        }
                                        style={({ pressed }) => ({
                                          flex: 1,
                                          paddingVertical: 10,
                                          borderRadius: 10,
                                          backgroundColor: colors.surface,
                                          borderWidth: 1,
                                          borderColor: colors.border,
                                          alignItems: "center",
                                          opacity: pressed ? 0.7 : 1,
                                        })}
                                      >
                                        <Text
                                          style={{
                                            color: colors.textPrimary,
                                            fontFamily: fontFamilies.semibold,
                                          }}
                                        >
                                          Copy
                                        </Text>
                                      </Pressable>
                                      <Pressable
                                        onPress={() =>
                                          void handleShareInviteLink()
                                        }
                                        style={({ pressed }) => ({
                                          flex: 1,
                                          paddingVertical: 10,
                                          borderRadius: 10,
                                          backgroundColor: colors.primary,
                                          alignItems: "center",
                                          opacity: pressed ? 0.7 : 1,
                                        })}
                                      >
                                        <Text
                                          style={{
                                            color: colors.surface,
                                            fontFamily: fontFamilies.semibold,
                                          }}
                                        >
                                          Share
                                        </Text>
                                      </Pressable>
                                    </View>
                                  </View>
                                ) : (
                                  <Pressable
                                    onPress={() =>
                                      void handleGenerateInviteLink()
                                    }
                                    disabled={
                                      generatingInvite || !inviteSquadId
                                    }
                                    style={({ pressed }) => ({
                                      paddingVertical: 10,
                                      borderRadius: 10,
                                      backgroundColor: colors.surface,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                      alignItems: "center",
                                      opacity:
                                        pressed || generatingInvite ? 0.7 : 1,
                                    })}
                                  >
                                    <Text
                                      style={{
                                        color: colors.textPrimary,
                                        fontFamily: fontFamilies.semibold,
                                      }}
                                    >
                                      {generatingInvite
                                        ? "Generating..."
                                        : "Generate Invite Link"}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>

                              {/* Direct Invite Section */}
                              <View style={{ gap: 10 }}>
                                <Text
                                  style={{
                                    ...typography.caption,
                                    color: colors.textSecondary,
                                  }}
                                >
                                  Or invite by handle
                                </Text>
                                <TextInput
                                  value={inviteHandle}
                                  onChangeText={setInviteHandle}
                                  placeholder='Friend handle'
                                  placeholderTextColor={colors.textSecondary}
                                  style={inputStyle}
                                />
                                <Pressable
                                  onPress={() => {
                                    void handleInvite();
                                  }}
                                  disabled={
                                    isInvitingToSquad ||
                                    !inviteSquadId ||
                                    !inviteHandle.trim()
                                  }
                                  style={({ pressed }) => ({
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    backgroundColor: colors.primary,
                                    alignItems: "center",
                                    opacity:
                                      pressed || isInvitingToSquad ? 0.7 : 1,
                                  })}
                                >
                                  <Text
                                    style={{
                                      color: colors.surface,
                                      fontFamily: fontFamilies.semibold,
                                    }}
                                  >
                                    {isInvitingToSquad
                                      ? "Inviting…"
                                      : "Send invite"}
                                  </Text>
                                </Pressable>
                              </View>
                            </CollapsibleSection>

                            <CollapsibleSection
                              title='Manage squads'
                              subtitle='See members, swap feeds, or delete squads you own.'
                              open={showSquadListSection}
                              onToggle={() =>
                                setShowSquadListSection((prev) => !prev)
                              }
                              iconName='settings-outline'
                            >
                              <View style={{ gap: 8 }}>
                                {squads.map((squad) => {
                                  const isDeletingThisSquad =
                                    deletingSquadId === squad.id &&
                                    isDeletingSquad;
                                  const readyToConfirm =
                                    confirmDeleteId === squad.id;
                                  return (
                                    <View
                                      key={squad.id}
                                      style={{
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        borderRadius: 10,
                                        padding: 10,
                                        backgroundColor: colors.surface,
                                        gap: 8,
                                      }}
                                    >
                                      <View
                                        style={{
                                          flexDirection: "row",
                                          alignItems: "center",
                                          justifyContent: "space-between",
                                          gap: 10,
                                        }}
                                      >
                                        <View style={{ flex: 1 }}>
                                          <Text
                                            style={{
                                              color: colors.textPrimary,
                                              fontFamily: fontFamilies.semibold,
                                            }}
                                          >
                                            {squad.name}
                                          </Text>
                                          <Text
                                            style={{
                                              color: colors.textSecondary,
                                              ...typography.caption,
                                            }}
                                          >
                                            Members:{" "}
                                            {formatSquadMembersLabel(
                                              squad.members
                                            )}
                                          </Text>
                                        </View>
                                      </View>

                                      {squad.isOwner ? (
                                        readyToConfirm ? (
                                          <View style={{ gap: 6 }}>
                                            <Text
                                              style={{
                                                color: colors.textSecondary,
                                                ...typography.caption,
                                              }}
                                            >
                                              Delete this squad? Members will
                                              lose access.
                                            </Text>
                                            <View
                                              style={{
                                                flexDirection: "row",
                                                gap: 8,
                                                justifyContent: "flex-end",
                                              }}
                                            >
                                              <Pressable
                                                onPress={() =>
                                                  setConfirmDeleteId(null)
                                                }
                                                style={({ pressed }) => ({
                                                  paddingVertical: 8,
                                                  paddingHorizontal: 12,
                                                  borderRadius: 10,
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
                                                    fontFamily:
                                                      fontFamilies.semibold,
                                                  }}
                                                >
                                                  Keep squad
                                                </Text>
                                              </Pressable>
                                              <Pressable
                                                disabled={isDeletingSquad}
                                                onPress={() => {
                                                  setConfirmDeleteId(squad.id);
                                                  void handleDeleteSquad(
                                                    squad.id
                                                  );
                                                }}
                                                style={({ pressed }) => ({
                                                  paddingVertical: 8,
                                                  paddingHorizontal: 12,
                                                  borderRadius: 10,
                                                  borderWidth: 1,
                                                  borderColor: colors.error,
                                                  backgroundColor: pressed
                                                    ? "rgba(239,68,68,0.12)"
                                                    : "rgba(239,68,68,0.08)",
                                                  opacity: isDeletingSquad
                                                    ? 0.7
                                                    : 1,
                                                })}
                                              >
                                                <Text
                                                  style={{
                                                    color: colors.error,
                                                    fontFamily:
                                                      fontFamilies.semibold,
                                                  }}
                                                >
                                                  {isDeletingThisSquad
                                                    ? "Deleting…"
                                                    : "Delete squad"}
                                                </Text>
                                              </Pressable>
                                            </View>
                                          </View>
                                        ) : (
                                          <Pressable
                                            onPress={() =>
                                              setConfirmDeleteId(squad.id)
                                            }
                                            style={({ pressed }) => ({
                                              paddingVertical: 8,
                                              paddingHorizontal: 12,
                                              borderRadius: 10,
                                              borderWidth: 1,
                                              borderColor: colors.border,
                                              backgroundColor: pressed
                                                ? colors.surfaceMuted
                                                : colors.surfaceMuted,
                                            })}
                                          >
                                            <Text
                                              style={{
                                                color: colors.textSecondary,
                                                fontFamily:
                                                  fontFamilies.semibold,
                                              }}
                                            >
                                              Delete squad (owner)
                                            </Text>
                                          </Pressable>
                                        )
                                      ) : null}
                                    </View>
                                  );
                                })}
                              </View>
                            </CollapsibleSection>
                          </>
                        ) : null}
                      </View>
                    </ScrollView>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
        {profilePreview ? (
          <ProfilePreviewModal
            user={profilePreview}
            onClose={() => setProfilePreview(null)}
            onView={() => {
              navigation.navigate("Profile", { userId: profilePreview.id });
              setProfilePreview(null);
              closeSocialModal();
            }}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
};

export default SquadScreen;

const ProfilePreviewModal = ({
  user,
  onClose,
  onView,
}: {
  user: SocialUserSummary;
  onClose: () => void;
  onView: () => void;
}) => (
  <Modal
    visible={Boolean(user)}
    transparent
    animationType='fade'
    onRequestClose={onClose}
  >
    <TouchableOpacity
      activeOpacity={1}
      onPress={onClose}
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.55)",
        justifyContent: "center",
        padding: 22,
      }}
    >
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
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
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
            {user.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
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
                {initialsForName(user.name)}
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
              {user.name}
            </Text>
            {user.handle ? (
              <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                {formatHandle(user.handle)}
              </Text>
            ) : null}
            {user.trainingStyleTags?.length ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  marginTop: 4,
                  fontSize: 12,
                }}
              >
                {user.trainingStyleTags.join(" · ")}
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
            onPress={onView}
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
            onPress={onClose}
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
    </TouchableOpacity>
  </Modal>
);

const inputStyle = {
  backgroundColor: colors.surfaceMuted,
  borderRadius: 10,
  padding: 10,
  borderWidth: 1,
  borderColor: colors.border,
  color: colors.textPrimary,
};

type CollapsibleSectionProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  iconName?: keyof typeof Ionicons.glyphMap;
};

const CollapsibleSection = ({
  title,
  subtitle,
  open,
  onToggle,
  children,
  iconName,
}: CollapsibleSectionProps) => (
  <View
    style={{
      backgroundColor: colors.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {iconName ? (
        <Ionicons
          name={iconName}
          size={18}
          color={colors.textSecondary}
          style={{ marginTop: 2 }}
        />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ ...typography.title, color: colors.textPrimary }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.textSecondary, ...typography.caption }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name={open ? "chevron-up-outline" : "chevron-down-outline"}
        size={18}
        color={colors.textSecondary}
      />
    </Pressable>
    {open ? <View style={{ marginTop: 10, gap: 10 }}>{children}</View> : null}
  </View>
);

const ScrollSquads = ({
  squads,
  activeId,
  onSelect,
  onLongPress,
}: {
  squads: SquadDetail[];
  activeId?: string;
  onSelect: (id: string) => void;
  onLongPress?: (id: string) => void;
}) => (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    style={{ marginVertical: 8 }}
  >
    <View style={{ flexDirection: "row", gap: 8 }}>
      {squads.map((squad) => {
        const selected = activeId === squad.id;
        return (
          <Pressable
            key={squad.id}
            onPress={() => onSelect(squad.id)}
            onLongPress={() => onLongPress?.(squad.id)}
            delayLongPress={400}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: selected
                ? "rgba(34,197,94,0.12)"
                : colors.surface,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Text
                style={{
                  color: selected ? colors.primary : colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                {squad.name}
              </Text>
              {squad.isAdmin && (
                <Ionicons
                  name='shield-checkmark'
                  size={12}
                  color={selected ? colors.primary : colors.textSecondary}
                />
              )}
            </View>
            <Text
              style={{ color: colors.textSecondary, ...typography.caption }}
            >
              {squad.memberCount} member{squad.memberCount !== 1 ? "s" : ""} ·
              Hold to view
            </Text>
          </Pressable>
        );
      })}
    </View>
  </ScrollView>
);

const formatSquadMembersLabel = (members: SquadDetail["members"]) => {
  const names = members
    .map((member) => member.handle ?? member.name ?? "Athlete")
    .filter((value): value is string => Boolean(value));
  if (!names.length) return "Just you";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
};
