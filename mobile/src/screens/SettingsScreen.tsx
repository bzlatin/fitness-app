import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Text, TouchableOpacity, View, Pressable, TextInput, Alert, Modal, Image, Switch, ActivityIndicator, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "@react-navigation/native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import { useAuth } from "../context/AuthContext";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { getConnections } from "../api/social";

const SettingsScreen = () => {
  const { logout, isAuthorizing } = useAuth();
  const { user, updateProfile, deleteAccount, refresh, isLoading } = useCurrentUser();
  const [draftName, setDraftName] = useState(user?.name ?? "");
  const [draftHandle, setDraftHandle] = useState(user?.handle ?? "");
  const [draftBio, setDraftBio] = useState(user?.bio ?? "");
  const [draftTraining, setDraftTraining] = useState(user?.trainingStyle ?? "");
  const [draftGym, setDraftGym] = useState(user?.gymName ?? "");
  const [showGym, setShowGym] = useState((user?.gymVisibility ?? "hidden") === "shown");
  const [avatarUri, setAvatarUri] = useState<string | undefined>(user?.avatarUrl);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (user) {
      setDraftName(user.name ?? "");
      setDraftHandle(user.handle ?? "");
      setDraftBio(user.bio ?? "");
      setDraftTraining(user.trainingStyle ?? "");
      setDraftGym(user.gymName ?? "");
      setShowGym((user.gymVisibility ?? "hidden") === "shown");
      setAvatarUri(user.avatarUrl ?? undefined);
      setIsEditing(false);
    }
  }, [user?.id, user?.name, user?.handle, user?.bio, user?.trainingStyle, user?.gymName, user?.gymVisibility, user?.avatarUrl]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const connectionsQuery = useQuery({
    queryKey: ["social", "connections", "settings"],
    queryFn: getConnections,
    enabled: Boolean(user),
  });
  const friends = connectionsQuery.data?.friends ?? [];
  const pendingInvites = connectionsQuery.data?.pendingInvites ?? [];
  const outgoingInvites = connectionsQuery.data?.outgoingInvites ?? [];
  const friendCount = user?.friendsCount ?? friends.length;

  if (!user || isLoading) {
    return (
      <ScreenContainer>
        <Text style={{ color: colors.textSecondary, marginTop: 20 }}>Loading profile…</Text>
      </ScreenContainer>
    );
  }

  const ensurePhotoPermission = async () => {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (existing.granted || existing.accessPrivileges === "limited") return true;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted || permission.accessPrivileges === "limited") return true;
    Alert.alert("Permission needed", "Enable photo access to add a profile picture.", [
      {
        text: "Open settings",
        onPress: () => Linking.openSettings(),
      },
      { text: "Cancel", style: "cancel" },
    ]);
    return false;
  };

  const pickAvatar = async () => {
    const allowed = await ensurePhotoPermission();
    if (!allowed) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.85,
        presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
      });
      if (!result.canceled && result.assets?.length) {
        setAvatarUri(result.assets[0]?.uri);
      } else if (result.canceled) {
        Alert.alert("No photo selected", "Choose a photo to update your profile.");
      }
    } catch (err) {
      console.warn("Image picker failed", err);
      Alert.alert("Could not open photos", "Please try again or reopen app permissions.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        name: draftName.trim() || user.name,
        handle: draftHandle.trim() || undefined,
        bio: draftBio.trim() || undefined,
        trainingStyle: draftTraining.trim() || undefined,
        gymName: draftGym.trim() ? draftGym.trim() : null,
        gymVisibility: showGym ? "shown" : "hidden",
        avatarUrl: avatarUri,
      });
      Alert.alert("Saved", "Profile updated.");
      setIsEditing(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message.includes("Handle already taken")
          ? "That handle is taken. Try another."
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
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
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
            <View style={{ alignItems: "center" }}>
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
                  <Text style={{ color: colors.textSecondary, fontSize: 22, fontFamily: fontFamilies.semibold }}>
                    {user.name?.[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
              {isEditing ? (
                <Pressable
                  onPress={pickAvatar}
                  style={({ pressed }) => ({
                    marginTop: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                    {avatarUri ? "Change photo" : "Add photo"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontFamily: fontFamilies.semibold }}>
                {user.name}
              </Text>
              {user.handle ? (
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{user.handle}</Text>
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
                <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                  Edit
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Stat label="Workouts" value={user.workoutsCompleted ?? 0} />
            <Stat label="Friends" value={friendCount ?? 0} />
            <Stat label="Streak" value={user.currentStreakDays ? `${user.currentStreakDays}d` : "—"} />
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
              <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, marginBottom: 4 }}>
                Bio
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>{user.bio}</Text>
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
              <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, marginBottom: 4 }}>
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
              <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                Edit profile
              </Text>
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                placeholder="Name"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
              <TextInput
                value={draftHandle}
                onChangeText={setDraftHandle}
                placeholder="@handle"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
              <TextInput
                value={draftBio}
                onChangeText={setDraftBio}
                placeholder="Bio"
                placeholderTextColor={colors.textSecondary}
                style={[inputStyle, { minHeight: 64 }]}
                multiline
              />
              <TextInput
                value={draftTraining}
                onChangeText={setDraftTraining}
                placeholder="Training focus"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
              <TextInput
                value={draftGym}
                onChangeText={setDraftGym}
                placeholder="Home gym"
                placeholderTextColor={colors.textSecondary}
                style={inputStyle}
              />
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
                  <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
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
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    backgroundColor: colors.primary,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    alignItems: "center",
                    opacity: pressed || isSaving ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold }}>
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
                    setShowGym((user.gymVisibility ?? "hidden") === "shown");
                    setAvatarUri(user.avatarUrl ?? undefined);
                  }}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    alignItems: "center",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
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
            gap: 12,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
              Friends
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Friends are people you both follow. Invites land here until it{"'"}s mutual.
            </Text>
          </View>
          {connectionsQuery.isFetching ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                  Active friends ({friends.length})
                </Text>
                {friends.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {friends.map((friend) => (
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
                        <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                          {friend.name}
                        </Text>
                        {friend.handle ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{friend.handle}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Add gym buddies from the Squad tab to see them here.
                  </Text>
                )}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                  Pending invites
                </Text>
                {pendingInvites.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {pendingInvites.map((invite) => (
                      <View
                        key={invite.id}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 10,
                          backgroundColor: colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                          {invite.name}
                        </Text>
                        {invite.handle ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{invite.handle}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    No pending requests from others.
                  </Text>
                )}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
                  Invites you sent
                </Text>
                {outgoingInvites.length ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {outgoingInvites.map((invite) => (
                      <View
                        key={invite.id}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 10,
                          backgroundColor: colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                          {invite.name}
                        </Text>
                        {invite.handle ? (
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{invite.handle}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    You haven{"'"}t sent any invites yet.
                  </Text>
                )}
              </View>
            </>
          )}
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
          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
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
            <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
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

      <Modal visible={isDeleteOpen} animationType="slide" transparent>
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
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 18 }}>
              Delete account
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Type DELETE to confirm. This removes local data from this device.
            </Text>
            <TextInput
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="DELETE"
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
              <Text style={{ color: colors.error, fontFamily: fontFamilies.semibold }}>
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
      style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 16 }}
    >
      {value}
    </Text>
    <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1} ellipsizeMode="tail">
      {label}
    </Text>
  </View>
);

export default SettingsScreen;
