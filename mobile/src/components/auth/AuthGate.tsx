import { ReactNode, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAuth } from "../../context/AuthContext";
import { usePreAuthOnboardingControls } from "../../context/PreAuthOnboardingContext";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";

const FullScreenMessage = ({ children }: { children: ReactNode }) => (
  <View
    style={{
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      padding: 24,
      gap: 16,
    }}
  >
    {children}
  </View>
);

const AuthGate = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading, isAuthorizing, login, error } = useAuth();
  const preAuthControls = usePreAuthOnboardingControls();
  const [reduceMotion, setReduceMotion] = useState(false);
  const intro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (mounted) setReduceMotion(enabled);
      } catch {
        // ignore
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      intro.setValue(1);
      return;
    }
    intro.setValue(0);
    Animated.timing(intro, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [intro, reduceMotion]);

  if (isLoading) {
    return (
      <FullScreenMessage>
        <ActivityIndicator color={colors.primary} />
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamilies.medium,
            fontSize: 16,
          }}
        >
          Checking your session...
        </Text>
      </FullScreenMessage>
    );
  }

  if (!isAuthenticated) {
    const translateY = intro.interpolate({
      inputRange: [0, 1],
      outputRange: [14, 0],
    });
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LinearGradient
          colors={[
            `${colors.primary}1A`,
            `${colors.secondary}12`,
            "transparent",
          ]}
          locations={[0, 0.5, 1]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 340 }}
        />

        <FullScreenMessage>
          <Animated.View style={{ width: "100%", opacity: intro, transform: [{ translateY }] }}>
            <View style={{ alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 18,
                  backgroundColor: `${colors.primary}15`,
                  borderWidth: 1,
                  borderColor: `${colors.primary}30`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="barbell" size={28} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.bold,
                  fontSize: 28,
                  textAlign: "center",
                  letterSpacing: 0.2,
                }}
              >
                Welcome to Push / Pull
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.regular,
                  textAlign: "center",
                  fontSize: 15,
                  lineHeight: 21,
                  maxWidth: 320,
                }}
              >
                Sign in to save your workouts, track progress, and unlock your full plan.
              </Text>
            </View>

            <TouchableOpacity
              onPress={login}
              disabled={isAuthorizing}
              style={{
                backgroundColor: isAuthorizing ? colors.surfaceMuted : colors.primary,
                paddingHorizontal: 24,
                paddingVertical: 14,
                borderRadius: 999,
                width: "100%",
                marginTop: 8,
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
                {isAuthorizing ? "Connecting..." : "Continue"}
              </Text>
            </TouchableOpacity>

            <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 12 }}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.regular,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Sign in with Google, Apple, or Email
              </Text>
            </View>

            {preAuthControls?.restart ? (
              <Pressable
                onPress={preAuthControls.restart}
                style={({ pressed }) => ({
                  alignSelf: "center",
                  marginTop: 14,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: fontFamilies.medium,
                    fontSize: 13,
                    textDecorationLine: "underline",
                  }}
                >
                  Edit personalization
                </Text>
              </Pressable>
            ) : null}

            {error ? (
              <Text
                style={{
                  color: colors.error ?? "#f87171",
                  textAlign: "center",
                  fontFamily: fontFamilies.regular,
                  marginTop: 10,
                }}
              >
                {error}
              </Text>
            ) : null}
          </Animated.View>
        </FullScreenMessage>
      </View>
    );
  }

  if (isAuthorizing) {
    return (
      <FullScreenMessage>
        <ActivityIndicator color={colors.primary} />
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamilies.medium,
          }}
        >
          Updating your session...
        </Text>
      </FullScreenMessage>
    );
  }

  return <>{children}</>;
};

export default AuthGate;
