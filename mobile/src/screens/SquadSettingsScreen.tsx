import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { Share } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { typography, fontFamilies } from "../theme/typography";
import { RootNavigation, RootRoute } from "../navigation/RootNavigator";
import {
  getSquadById,
  updateSquad,
  deleteSquad,
  transferSquadOwnership,
  inviteToSquad,
} from "../api/social";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { API_BASE_URL } from "../api/client";
import { SquadMemberSummary } from "../types/social";

const SquadSettingsScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RootRoute<"SquadSettings">>();
  const { squadId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, getAccessToken } = useCurrentUser();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [inviteHandle, setInviteHandle] = useState("");
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [currentInviteCode, setCurrentInviteCode] = useState<string | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [isNearTop, setIsNearTop] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const initializedRef = useRef(false);

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

  const squad = squadQuery.data;

  // Initialize form fields when squad data loads
  useEffect(() => {
    if (squad && !initializedRef.current) {
      setName(squad.name);
      setDescription(squad.description ?? "");
      setIsPublic(squad.isPublic);
      initializedRef.current = true;
    }
  }, [squad]);

  const updateSquadMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; isPublic?: boolean }) =>
      updateSquad(squadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "squad", squadId] });
      queryClient.invalidateQueries({ queryKey: ["social", "squads"] });
      setHasChanges(false);
      Alert.alert("Success", "Squad settings updated.");
    },
    onError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update squad");
    },
  });

  const deleteSquadMutation = useMutation({
    mutationFn: () => deleteSquad(squadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "squads"] });
      navigation.navigate("RootTabs", { screen: "Squad" });
    },
    onError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete squad");
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: (newOwnerId: string) => transferSquadOwnership(squadId, newOwnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "squad", squadId] });
      queryClient.invalidateQueries({ queryKey: ["social", "squads"] });
      setShowTransferModal(false);
      Alert.alert("Success", "Ownership transferred successfully.");
    },
    onError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to transfer ownership");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (handle: string) => inviteToSquad(squadId, handle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social", "squad", squadId] });
      queryClient.invalidateQueries({ queryKey: ["social", "squads"] });
      setInviteHandle("");
      Alert.alert("Success", "Invitation sent!");
    },
    onError: (err) => {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to invite user");
    },
  });

  const handleSaveChanges = () => {
    if (!name.trim()) {
      Alert.alert("Error", "Squad name cannot be empty");
      return;
    }
    updateSquadMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      isPublic,
    });
  };

  const handleDeleteSquad = () => {
    Alert.alert(
      "Delete Squad",
      "Are you sure you want to delete this squad? This action cannot be undone. All members will lose access.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteSquadMutation.mutate(),
        },
      ]
    );
  };

  const handleTransferOwnership = (member: SquadMemberSummary) => {
    Alert.alert(
      "Transfer Ownership",
      `Transfer ownership to ${member.name}? You will become an admin.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: () => transferOwnershipMutation.mutate(member.id),
        },
      ]
    );
  };

  const handleGenerateInviteLink = async () => {
    setGeneratingInvite(true);
    try {
      const token = await getAccessToken();
      const response = await fetch(
        `${API_BASE_URL}/social/squads/${squadId}/invites`,
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
    try {
      await Share.share({
        message: `Join my squad "${squad?.name}" on Push/Pull! ${link}`,
        title: `Join ${squad?.name}`,
      });
    } catch (err) {
      console.error("Failed to share invite link", err);
    }
  };

  const handleInviteByHandle = () => {
    const trimmed = inviteHandle.trim();
    if (!trimmed) return;
    inviteMutation.mutate(trimmed);
  };

  const viewerMember = squad?.members.find((m) => m.id === user?.id);
  const isOwner = viewerMember?.role === "owner";

  if (squadQuery.isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!squad) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>
            Squad not found
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              marginTop: 16,
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

  return (
    <ScreenContainer paddingTop={20} includeTopInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom, gap: 16 }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={(w, h) => setContentHeight(h)}
        onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
      >
        {/* Squad Info Section */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <Text style={{ ...typography.title, color: colors.textPrimary }}>
            Squad Settings
          </Text>

          <View style={{ gap: 6 }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Squad Name
            </Text>
            <TextInput
              value={name}
              onChangeText={(text) => {
                setName(text);
                setHasChanges(true);
              }}
              placeholder="Squad name"
              placeholderTextColor={colors.textSecondary}
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.textPrimary,
                fontFamily: fontFamilies.regular,
              }}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Description (optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setHasChanges(true);
              }}
              placeholder="What's this squad about?"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.surfaceMuted,
                borderRadius: 10,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.textPrimary,
                fontFamily: fontFamilies.regular,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                Public Squad
              </Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Anyone can discover and request to join
              </Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={(value) => {
                setIsPublic(value);
                setHasChanges(true);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          {hasChanges && (
            <Pressable
              onPress={handleSaveChanges}
              disabled={updateSquadMutation.isPending}
              style={({ pressed }) => ({
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: colors.primary,
                alignItems: "center",
                opacity: pressed || updateSquadMutation.isPending ? 0.7 : 1,
              })}
            >
              <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold }}>
                {updateSquadMutation.isPending ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Invite Members Section */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="person-add-outline" size={20} color={colors.textPrimary} />
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Invite Members
            </Text>
          </View>

          {/* Invite Link */}
          <View style={{ gap: 10 }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Share an invite link (expires in 7 days)
            </Text>
            {currentInviteCode ? (
              <View style={{ gap: 8 }}>
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: 10,
                    padding: 12,
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
                    numberOfLines={1}
                  >
                    push-pull://squad/join/{currentInviteCode}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => void handleCopyInviteLink()}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                      Copy
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleShareInviteLink()}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: colors.primary,
                      alignItems: "center",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold }}>
                      Share
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => void handleGenerateInviteLink()}
                disabled={generatingInvite}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                  opacity: pressed || generatingInvite ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                  {generatingInvite ? "Generating..." : "Generate Invite Link"}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Direct invite by handle */}
          <View style={{ gap: 10, marginTop: 8 }}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>
              Or invite by handle
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                value={inviteHandle}
                onChangeText={setInviteHandle}
                placeholder="@handle"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.regular,
                }}
              />
              <Pressable
                onPress={handleInviteByHandle}
                disabled={inviteMutation.isPending || !inviteHandle.trim()}
                style={({ pressed }) => ({
                  paddingHorizontal: 20,
                  justifyContent: "center",
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed || inviteMutation.isPending || !inviteHandle.trim() ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold }}>
                  {inviteMutation.isPending ? "..." : "Invite"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Owner-only Actions */}
        {isOwner && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 14,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Owner Actions
            </Text>

            {/* Transfer Ownership */}
            <View style={{ gap: 8 }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Transfer ownership to another member
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {squad.members
                    .filter((m) => m.id !== user?.id)
                    .map((member) => (
                      <Pressable
                        key={member.id}
                        onPress={() => handleTransferOwnership(member)}
                        disabled={transferOwnershipMutation.isPending}
                        style={({ pressed }) => ({
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 10,
                          backgroundColor: colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: colors.border,
                          opacity: pressed || transferOwnershipMutation.isPending ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                          {member.name}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              </ScrollView>
            </View>

            {/* Delete Squad */}
            <Pressable
              onPress={handleDeleteSquad}
              disabled={deleteSquadMutation.isPending}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: "rgba(239,68,68,0.08)",
                borderWidth: 1,
                borderColor: colors.error,
                opacity: pressed || deleteSquadMutation.isPending ? 0.7 : 1,
              })}
            >
              <Ionicons name="trash-outline" size={18} color={colors.error} />
              <Text style={{ color: colors.error, fontFamily: fontFamilies.semibold }}>
                {deleteSquadMutation.isPending ? "Deleting..." : "Delete Squad"}
              </Text>
            </Pressable>
          </View>
        )}
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
    </ScreenContainer>
  );
};

export default SquadSettingsScreen;
