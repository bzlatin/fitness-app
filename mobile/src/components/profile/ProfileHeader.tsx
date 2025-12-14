import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

type Props = {
  name?: string | null;
  handle?: string | null;
  trainingStyle?: string | null;
  gymName?: string | null;
  gymVisibility?: "hidden" | "shown";
  avatarUrl?: string | null;
  friendCount?: number | null;
  pendingRequestsCount?: number;
  bio?: string | null;
  showProBadge?: boolean;
  isViewingSelf: boolean;
  isFollowing: boolean;
  onToggleFollow?: () => void;
  isFollowLoading?: boolean;
  onPressSettings?: () => void;
  onPressFriends?: () => void;
};

const fallbackInitial = (value?: string | null) =>
  value?.trim()?.[0]?.toUpperCase() ?? "?";

const ProfileHeader = ({
  name,
  handle,
  trainingStyle,
  gymName,
  gymVisibility,
  avatarUrl,
  friendCount = null,
  pendingRequestsCount = 0,
  bio,
  showProBadge = false,
  isViewingSelf,
  isFollowing,
  onToggleFollow,
  isFollowLoading,
  onPressSettings,
  onPressFriends,
}: Props) => {
  const showGym = gymName && gymVisibility !== "hidden";
  const badgeTone = isFollowing ? colors.primary : colors.border;

  return (
    <View
      style={{
        borderRadius: 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <LinearGradient
        colors={[`${colors.primary}26`, `${colors.secondary}1A`, colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
      />
      <View
        style={{
          padding: 16,
          gap: 10,
          backgroundColor: `${colors.surface}E6`,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <View
            style={{
              width: 86,
              height: 86,
              borderRadius: 22,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: "100%", height: "100%" }}
              />
            ) : (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.bold,
                  fontSize: 28,
                }}
              >
                {fallbackInitial(name ?? handle ?? undefined)}
              </Text>
            )}
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text
                style={{ ...typography.heading1, color: colors.textPrimary }}
                numberOfLines={1}
              >
                {name}
              </Text>
              {showProBadge ? (
                <LinearGradient
                  colors={[`${colors.primary}35`, `${colors.secondary}25`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: `${colors.primary}55`,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Ionicons name='sparkles' size={12} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 12,
                    }}
                  >
                    Pro
                  </Text>
                </LinearGradient>
              ) : null}
              {onPressSettings && isViewingSelf ? (
                <Pressable
                  onPress={onPressSettings}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    padding: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed
                      ? colors.surfaceMuted
                      : colors.surface,
                  })}
                >
                  <Ionicons
                    name='settings-outline'
                    size={18}
                    color={colors.textPrimary}
                  />
                </Pressable>
              ) : null}
            </View>

            {handle ? (
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                {handle}
              </Text>
            ) : null}
            {trainingStyle ? (
              <Text
                style={{ color: colors.textSecondary, fontSize: 14 }}
                numberOfLines={1}
              >
                {trainingStyle}
              </Text>
            ) : null}
            {gymName ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Gym: {showGym ? gymName : "Hidden"}
              </Text>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                gap: 8,
                marginTop: 2,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: `${colors.primary}1A`,
                  borderWidth: 1,
                  borderColor: colors.primary,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 12,
                  }}
                >
                  {isViewingSelf ? "You" : "Gym buddy ready"}
                </Text>
              </View>
              <Pressable
                onPress={onPressFriends}
                disabled={!onPressFriends}
                style={({ pressed }) => ({
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: `${colors.secondary}20`,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  opacity: onPressFriends && pressed ? 0.8 : 1,
                  position: "relative",
                })}
              >
                <Ionicons
                  name='people'
                  size={14}
                  color={colors.textPrimary}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 12,
                  }}
                >
                  {friendCount ?? 0} friends
                </Text>
                {/* Notification badge for pending friend requests */}
                {isViewingSelf && pendingRequestsCount > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      backgroundColor: colors.error,
                      borderRadius: 999,
                      minWidth: 18,
                      height: 18,
                      paddingHorizontal: 5,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor: colors.surface,
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontFamily: fontFamilies.bold,
                        fontSize: 10,
                      }}
                    >
                      {pendingRequestsCount > 9 ? "9+" : pendingRequestsCount}
                    </Text>
                  </View>
                )}
              </Pressable>
              {!isViewingSelf ? (
                <Pressable
                  onPress={onToggleFollow}
                  disabled={isFollowLoading}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    borderWidth: 1,
                    borderColor: isFollowing ? colors.border : colors.primary,
                    backgroundColor: isFollowing ? colors.surfaceMuted : colors.primary,
                    opacity: pressed || isFollowLoading ? 0.85 : 1,
                  })}
                >
                  <Ionicons
                    name={isFollowing ? "checkmark" : "person-add"}
                    size={16}
                    color={isFollowing ? colors.textPrimary : colors.surface}
                  />
                  <Text
                    style={{
                      color: isFollowing ? colors.textPrimary : colors.surface,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 13,
                    }}
                  >
                    {isFollowing ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {bio ? (
          <Text
            style={{
              color: colors.textSecondary,
              lineHeight: 20,
            }}
            numberOfLines={3}
          >
            {bio}
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default ProfileHeader;
