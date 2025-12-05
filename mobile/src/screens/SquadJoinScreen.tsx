import { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, Image } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { RootRoute, RootNavigation } from "../navigation/RootNavigator";
import { API_BASE_URL } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useAuth } from "../context/AuthContext";

type SquadInvitePreview = {
  squadId: string;
  squadName: string;
  memberCount: number;
  maxMembers: number;
  membersPreview: {
    id: string;
    name: string;
    avatarUrl?: string;
  }[];
};

const SquadJoinScreen = () => {
  const route = useRoute<RootRoute<"SquadJoin">>();
  const navigation = useNavigation<RootNavigation>();
  const { code } = route.params;
  const { getAccessToken } = useCurrentUser();
  const { login, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [preview, setPreview] = useState<SquadInvitePreview | null>(null);
  const [tokenReady, setTokenReady] = useState(false);

  const loadPreview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setPreview(null);
      setAuthRequired(false);
      setAlreadyMember(false);

      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/social/squad-invite/${code}`, {
        headers,
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        setAuthRequired(true);
        setError("Sign in to view this squad invite.");
        return;
      }

      if (!response.ok) {
        setError(data.error || "Failed to load invite");
        return;
      }

      setPreview(data);
    } catch (err) {
      console.error("Failed to load squad invite", err);
      setError("Failed to load invite");
    } finally {
      setLoading(false);
    }
  }, [code, getAccessToken]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    // Check for a token up front so we can surface a sign-in prompt before join
    const ensureToken = async () => {
      const token = await getAccessToken();
      setTokenReady(Boolean(token));
      if (!token && isAuthenticated) {
        setAuthRequired(true);
        setError("Session expired. Please sign in again to join this squad.");
      }
    };
    void ensureToken();
  }, [getAccessToken, isAuthenticated]);

  const handleJoin = async () => {
    if (!preview) return;

    try {
      setJoining(true);
      setError(null);
      setAuthRequired(false);
      setAlreadyMember(false);

      const token = await getAccessToken();
      if (!token) {
        setAuthRequired(true);
        setError("Session expired. Please sign in again to join this squad.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/social/squad-invite/${code}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setAuthRequired(true);
          setError("Session expired. Please sign in again to join this squad.");
          return;
        }
        if (
          response.status === 400 &&
          typeof data.error === "string" &&
          data.error.toLowerCase().includes("already a member")
        ) {
          setAlreadyMember(true);
          setError("You're already a member of this squad");
          return;
        }
        setError(data.error || "Failed to join squad");
        return;
      }

      // Navigate to Squad tab on success
      navigation.navigate("RootTabs", { screen: "Squad" });
    } catch (err) {
      console.error("Failed to join squad", err);
      setError("Failed to join squad");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: 16 }}>
            Loading invite...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ ...typography.h2, color: colors.textPrimary, marginBottom: 16 }}>
            Invite Error
          </Text>
          <Text
            style={{
              ...typography.body,
              color: colors.textSecondary,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {error}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {authRequired ? (
              <Pressable
                onPress={() => void login()}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.surface,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                    textAlign: "center",
                  }}
                >
                  Sign in to continue
                </Text>
              </Pressable>
            ) : null}
            {!authRequired && !alreadyMember && !tokenReady ? (
              <Pressable
                onPress={() => void login()}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                    textAlign: "center",
                  }}
                >
                  Retry
                </Text>
              </Pressable>
            ) : null}
            {alreadyMember && preview ? (
              <Pressable
                onPress={() => navigation.navigate("SquadDetail", { squadId: preview.squadId })}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                    textAlign: "center",
                  }}
                >
                  View squad
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => navigation.goBack()}
              style={({ pressed }) => ({
                flex: authRequired || alreadyMember ? 1 : undefined,
                paddingVertical: 14,
                paddingHorizontal: 24,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.medium,
                  fontSize: 16,
                  textAlign: "center",
                }}
              >
                Go Back
              </Text>
            </Pressable>
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (!preview) {
    return null;
  }

  return (
    <ScreenContainer>
      <View style={{ flex: 1, padding: 24 }}>
        {/* Squad Info */}
        <View style={{ alignItems: "center", marginTop: 40, marginBottom: 32 }}>
          <Text style={{ ...typography.h1, color: colors.textPrimary, marginBottom: 8 }}>
            Join Squad
          </Text>
          <Text
            style={{
              ...typography.h2,
              color: colors.primary,
              marginBottom: 16,
            }}
          >
            {preview.squadName}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            {preview.memberCount} / {preview.maxMembers} members
          </Text>
        </View>

        {/* Members Preview */}
        {preview.membersPreview.length > 0 && (
          <View style={{ marginBottom: 32 }}>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Squad Members
            </Text>
            <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 12 }}>
              {preview.membersPreview.map((member) => (
                <View key={member.id} style={{ alignItems: "center", width: 80 }}>
                  {member.avatarUrl ? (
                    <Image
                      source={{ uri: member.avatarUrl }}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: colors.surfaceMuted,
                        marginBottom: 4,
                      }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: colors.surfaceMuted,
                        justifyContent: "center",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <Text style={{ ...typography.body, color: colors.textSecondary }}>
                        {member.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text
                    style={{
                      ...typography.caption,
                      color: colors.textSecondary,
                      textAlign: "center",
                    }}
                    numberOfLines={1}
                  >
                    {member.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Join Button */}
        <Pressable
          onPress={handleJoin}
          disabled={joining}
          style={({ pressed }) => ({
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: joining ? colors.border : colors.primary,
            alignItems: "center",
            opacity: pressed ? 0.9 : 1,
            marginBottom: 12,
          })}
        >
          {joining ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text
              style={{
                color: colors.surface,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              Join Squad
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => navigation.goBack()}
          disabled={joining}
          style={({ pressed }) => ({
            paddingVertical: 16,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            opacity: pressed || joining ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.medium,
              fontSize: 16,
            }}
          >
            Cancel
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

export default SquadJoinScreen;
