import { ReactNode } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
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
    return (
      <FullScreenMessage>
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: fontFamilies.bold,
            fontSize: 26,
            textAlign: "center",
          }}
        >
          Welcome to Push / Pull
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamilies.regular,
            textAlign: "center",
          }}
        >
          Sign in to sync your workouts and templates securely.
        </Text>
        <TouchableOpacity
          onPress={login}
          disabled={isAuthorizing}
          style={{
            backgroundColor: isAuthorizing
              ? colors.surfaceMuted
              : colors.primary,
            paddingHorizontal: 24,
            paddingVertical: 14,
            borderRadius: 999,
            width: "100%",
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
            {isAuthorizing ? "Connecting..." : "Continue with Auth0"}
          </Text>
        </TouchableOpacity>
        {error ? (
          <Text
            style={{
              color: colors.error ?? "#f87171",
              textAlign: "center",
              fontFamily: fontFamilies.regular,
            }}
          >
            {error}
          </Text>
        ) : null}
      </FullScreenMessage>
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
