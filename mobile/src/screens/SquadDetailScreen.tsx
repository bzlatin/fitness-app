import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Modal,
  RefreshControl,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { RootNavigation, RootRoute } from "../navigation/RootNavigator";
import {
  getSquadById,
  removeSquadMember,
  updateMemberRole,
  leaveSquad,
  blockUser,
  searchSquadMembers,
} from "../api/social";
import { useSquadFeed } from "../hooks/useSquadFeed";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { SquadDetail, SquadMemberSummary } from "../types/social";
import { formatHandle } from "../utils/formatHandle";

const initialsForName = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const MemberAvatar = ({
  member,
  size = 48,
}: {
  member: SquadMemberSummary;
  size?: number;
}) =>
  member.avatarUrl ? (
    <Image
      source={{ uri: member.avatarUrl }}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: colors.surfaceMuted,
      }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
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
          fontSize: size * 0.35,
        }}
      >
        {initialsForName(member.name)}
      </Text>
    </View>
  );

const RoleBadge = ({ role }: { role: SquadMemberSummary["role"] }) => {
  if (!role || role === "member") return null;

  const isOwner = role === "owner";
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: isOwner
          ? "rgba(251, 191, 36, 0.15)"
          : "rgba(56, 189, 248, 0.15)",
      }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: fontFamilies.semibold,
          color: isOwner ? "#FBBF24" : colors.secondary,
        }}
      >
        {isOwner ? "Owner" : "Admin"}
      </Text>
    </View>
  );
};

const SquadDetailScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RootRoute<"SquadDetail">>();
  const { squadId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMember, setSelectedMember] = useState<SquadMemberSummary | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isNearTop, setIsNearTop] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    const distanceFromTop = contentOffset.y;
    setIsNearTop(distanceFromTop < 10);
    setIsNearBottom(distanceFromBottom < 50);
  };
  const isScrollable = contentHeight > scrollViewHeight;
  const showTopGradient = isScrollable && !isNearTop;
  const showBottomGradient = isScrollable && !isNearBottom;

  const squadQuery = useQuery({
    queryKey: ["social", "squad", squadId],
    queryFn: () => getSquadById(squadId),
  });

  const feedQuery = useSquadFeed(squadId);

  const squad = squadQuery.data;

  const removeMemberMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string }) =>
      removeSquadMember(squadId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "squad", squadId] });
      queryClient.invalidateQueries({ queryKey: ["social", "squads"] });
      setShowMemberModal(false);
      setSelectedMember(null);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      memberId,
      role,
    }: {
      memberId: string;
      role: "admin" | "member";
    }) => updateMemberRole(squadId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "squad", squadId] });
      queryClient.invalidateQueries({ queryKey: ["social", "squads"] });
      setShowMemberModal(false);
      setSelectedMember(null);
    },
  });

  const leaveSquadMutation = useMutation({
    mutationFn: () => leaveSquad(squadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "squads"] });
      navigation.goBack();
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) => blockUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social"] });
      setShowMemberModal(false);
      setSelectedMember(null);
      Alert.alert("User Blocked", "This user has been blocked.");
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["social", "squad", squadId] }),
      queryClient.invalidateQueries({ queryKey: ["social", "squad-feed", squadId] }),
    ]);
    setRefreshing(false);
  }, [queryClient, squadId]);

  const filteredMembers = useMemo(() => {
    if (!squad?.members) return [];
    if (!searchTerm.trim()) return squad.members;
    const term = searchTerm.toLowerCase();
    return squad.members.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.handle?.toLowerCase().includes(term)
    );
  }, [squad?.members, searchTerm]);

  const viewerMember = squad?.members.find((m) => m.id === user?.id);
  const viewerRole = viewerMember?.role;
  const isOwner = viewerRole === "owner";
  const isAdmin = isOwner || viewerRole === "admin";

  const handleMemberPress = (member: SquadMemberSummary) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  const handleRemoveMember = () => {
    if (!selectedMember) return;
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${selectedMember.name} from the squad?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMemberMutation.mutate({ memberId: selectedMember.id }),
        },
      ]
    );
  };

  const handlePromoteToAdmin = () => {
    if (!selectedMember) return;
    updateRoleMutation.mutate({ memberId: selectedMember.id, role: "admin" });
  };

  const handleDemoteToMember = () => {
    if (!selectedMember) return;
    updateRoleMutation.mutate({ memberId: selectedMember.id, role: "member" });
  };

  const handleLeaveSquad = () => {
    Alert.alert(
      "Leave Squad",
      "Are you sure you want to leave this squad?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => leaveSquadMutation.mutate(),
        },
      ]
    );
  };

  const handleBlockUser = () => {
    if (!selectedMember) return;
    Alert.alert(
      "Block User",
      `Block ${selectedMember.name}? You won't see their activity and they won't see yours.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => blockUserMutation.mutate({ userId: selectedMember.id }),
        },
      ]
    );
  };

  if (squadQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
            Loading squad...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!squad) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text
            style={{
              ...typography.title,
              color: colors.textPrimary,
              marginTop: 16,
              textAlign: "center",
            }}
          >
            Squad not found
          </Text>
          <Text
            style={{
              ...typography.caption,
              color: colors.textSecondary,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            This squad may have been deleted or you're no longer a member.
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              marginTop: 24,
              paddingVertical: 12,
              paddingHorizontal: 24,
              backgroundColor: colors.primary,
              borderRadius: 12,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold }}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const activeCount = feedQuery.data?.activeStatuses?.length ?? 0;
  const recentCount = feedQuery.data?.recentShares?.length ?? 0;

  return (
    <ScreenContainer paddingTop={20} includeTopInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={(w, h) => setContentHeight(h)}
        onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
      >
        {/* Header */}
        <View style={{ gap: 16 }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
                  {squad.name}
                </Text>
                {squad.description ? (
                  <Text style={{ ...typography.body, color: colors.textSecondary }}>
                    {squad.description}
                  </Text>
                ) : null}
              </View>
              {isAdmin && (
                <Pressable
                  onPress={() => navigation.navigate("SquadSettings", { squadId })}
                  style={({ pressed }) => ({
                    padding: 8,
                    borderRadius: 10,
                    backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                  })}
                >
                  <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
                </Pressable>
              )}
            </View>

            {/* Stats Row */}
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ ...typography.title, color: colors.textPrimary }}>
                  {squad.memberCount}
                </Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  Members
                </Text>
              </View>
              <View
                style={{
                  width: 1,
                  backgroundColor: colors.border,
                  marginVertical: 4,
                }}
              />
              <View style={{ alignItems: "center" }}>
                <Text style={{ ...typography.title, color: colors.primary }}>
                  {activeCount}
                </Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  Live Now
                </Text>
              </View>
              <View
                style={{
                  width: 1,
                  backgroundColor: colors.border,
                  marginVertical: 4,
                }}
              />
              <View style={{ alignItems: "center", gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ ...typography.title, color: colors.textPrimary }}>
                    {recentCount}
                  </Text>
                  <Pressable
                    hitSlop={8}
                    accessibilityLabel="What does workout shares mean?"
                    accessibilityHint="Opens an explanation for the workout share count"
                    onPress={() =>
                      Alert.alert(
                        "Workout shares",
                        "Count of workout summaries recently shared to this squad feed (latest 20 posts you can view)."
                      )
                    }
                  >
                    <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  Workout shares
                </Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {!isOwner && (
                <Pressable
                  onPress={handleLeaveSquad}
                  disabled={leaveSquadMutation.isPending}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed || leaveSquadMutation.isPending ? 0.7 : 1,
                  })}
                >
                  <Ionicons name="exit-outline" size={18} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                    Leave Squad
                  </Text>
                </Pressable>
              )}
              {isAdmin && (
                <Pressable
                  onPress={() => navigation.navigate("SquadSettings", { squadId })}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Ionicons name="person-add-outline" size={18} color={colors.surface} />
                  <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold }}>
                    Invite Members
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Members Section */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                Members ({squad.memberCount})
              </Text>
            </View>

            {/* Search */}
            {squad.memberCount > 5 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="search" size={18} color={colors.textSecondary} />
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Search members..."
                  placeholderTextColor={colors.textSecondary}
                  style={{
                    flex: 1,
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.regular,
                  }}
                />
              </View>
            )}

            {/* Member List */}
            <View style={{ gap: 8 }}>
              {filteredMembers.map((member) => (
                <Pressable
                  key={member.id}
                  onPress={() => handleMemberPress(member)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                  })}
                >
                  <MemberAvatar member={member} size={44} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {member.name}
                      </Text>
                      <RoleBadge role={member.role} />
                    </View>
                    {member.handle && (
                      <Text style={{ color: colors.textSecondary, ...typography.caption }}>
                        {formatHandle(member.handle)}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Scroll fade gradients */}
      {showTopGradient && (
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
            left: 0,
            right: 0,
            height: 60,
            pointerEvents: "none",
          }}
        />
      )}
      {showBottomGradient && (
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
            left: 0,
            right: 0,
            height: 60 + insets.bottom,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Member Action Modal */}
      <Modal
        visible={showMemberModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMemberModal(false)}
      >
        <Pressable
          onPress={() => setShowMemberModal(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.55)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 20,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            {selectedMember && (
              <>
                {/* Member Info */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <MemberAvatar member={selectedMember} size={56} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={{ ...typography.title, color: colors.textPrimary }}>
                        {selectedMember.name}
                      </Text>
                      <RoleBadge role={selectedMember.role} />
                    </View>
                    {selectedMember.handle && (
                      <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                        {formatHandle(selectedMember.handle)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Actions */}
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => {
                      setShowMemberModal(false);
                      navigation.navigate("UserProfile", { userId: selectedMember.id });
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    })}
                  >
                    <Ionicons name="person-outline" size={20} color={colors.textPrimary} />
                    <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                      View Profile
                    </Text>
                  </Pressable>

                  {/* Admin actions */}
                  {isOwner && selectedMember.id !== user?.id && selectedMember.role !== "owner" && (
                    <>
                      {selectedMember.role === "admin" ? (
                        <Pressable
                          onPress={handleDemoteToMember}
                          disabled={updateRoleMutation.isPending}
                          style={({ pressed }) => ({
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            padding: 14,
                            borderRadius: 12,
                            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: updateRoleMutation.isPending ? 0.7 : 1,
                          })}
                        >
                          <Ionicons name="arrow-down-outline" size={20} color={colors.textPrimary} />
                          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                            Remove Admin Role
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={handlePromoteToAdmin}
                          disabled={updateRoleMutation.isPending}
                          style={({ pressed }) => ({
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            padding: 14,
                            borderRadius: 12,
                            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: updateRoleMutation.isPending ? 0.7 : 1,
                          })}
                        >
                          <Ionicons name="shield-outline" size={20} color={colors.secondary} />
                          <Text style={{ color: colors.secondary, fontFamily: fontFamilies.semibold }}>
                            Make Admin
                          </Text>
                        </Pressable>
                      )}
                    </>
                  )}

                  {/* Remove member (admin can remove members, owner can remove anyone except self) */}
                  {isAdmin &&
                    selectedMember.id !== user?.id &&
                    selectedMember.role !== "owner" &&
                    (isOwner || selectedMember.role !== "admin") && (
                      <Pressable
                        onPress={handleRemoveMember}
                        disabled={removeMemberMutation.isPending}
                        style={({ pressed }) => ({
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                          padding: 14,
                          borderRadius: 12,
                          backgroundColor: pressed
                            ? "rgba(239,68,68,0.12)"
                            : "rgba(239,68,68,0.08)",
                          borderWidth: 1,
                          borderColor: colors.error,
                          opacity: removeMemberMutation.isPending ? 0.7 : 1,
                        })}
                      >
                        <Ionicons name="person-remove-outline" size={20} color={colors.error} />
                        <Text style={{ color: colors.error, fontFamily: fontFamilies.semibold }}>
                          Remove from Squad
                        </Text>
                      </Pressable>
                    )}

                  {/* Block user (anyone except self) */}
                  {selectedMember.id !== user?.id && (
                    <Pressable
                      onPress={handleBlockUser}
                      disabled={blockUserMutation.isPending}
                      style={({ pressed }) => ({
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        padding: 14,
                        borderRadius: 12,
                        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: blockUserMutation.isPending ? 0.7 : 1,
                      })}
                    >
                      <Ionicons name="ban-outline" size={20} color={colors.textSecondary} />
                      <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                        Block User
                      </Text>
                    </Pressable>
                  )}
                </View>

                {/* Close button */}
                <Pressable
                  onPress={() => setShowMemberModal(false)}
                  style={({ pressed }) => ({
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                    Cancel
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
};

export default SquadDetailScreen;
