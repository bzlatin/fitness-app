import "react-native-gesture-handler";
import React, { ReactNode, useEffect, useMemo } from "react";
import { NavigationContainer, DarkTheme, LinkingOptions } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View, Platform, ScrollView } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { StripeProvider } from "@stripe/stripe-react-native";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import RootNavigator from "./src/navigation/RootNavigator";
import { colors } from "./src/theme/colors";
import { fontFamilies } from "./src/theme/typography";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import AuthGate from "./src/components/auth/AuthGate";
import { UserProfileProvider } from "./src/context/UserProfileContext";
import { useCurrentUser } from "./src/hooks/useCurrentUser";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import { RootStackParamList } from "./src/navigation/types";
import { bootstrapPayments } from "./src/services/payments";
import ErrorBoundary from "./src/components/ErrorBoundary";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Log startup info for debugging production issues
console.log("[App] Starting Push/Pull...");
console.log("[App] Platform:", Platform.OS, Platform.Version);
console.log("[App] STRIPE_PUBLISHABLE_KEY set:", !!STRIPE_PUBLISHABLE_KEY);
console.log("[App] ENV AUTH0_DOMAIN:", process.env.EXPO_PUBLIC_AUTH0_DOMAIN ? "set" : "NOT SET");
console.log("[App] ENV AUTH0_CLIENT_ID:", process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ? "set" : "NOT SET");
console.log("[App] ENV API_URL:", process.env.EXPO_PUBLIC_API_URL ?? "NOT SET");

// Dynamically load AuthProvider to catch module-level errors
let AuthProvider: React.ComponentType<{ children: ReactNode }> | null = null;
let authLoadError: Error | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AuthProvider = require("./src/context/AuthContext").AuthProvider;
  console.log("[App] AuthProvider loaded successfully");
} catch (err) {
  authLoadError = err instanceof Error ? err : new Error(String(err));
  console.error("[App] Failed to load AuthProvider:", authLoadError.message);
}

const App = () => {
  const [fontsLoaded] = useFonts({
    [fontFamilies.regular]: SpaceGrotesk_400Regular,
    [fontFamilies.medium]: SpaceGrotesk_500Medium,
    [fontFamilies.semibold]: SpaceGrotesk_600SemiBold,
    [fontFamilies.bold]: SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    void bootstrapPayments();
  }, []);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 1000 * 60, retry: 1 },
        },
      }),
    []
  );

  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: colors.background,
      card: colors.surface,
      primary: colors.primary,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.secondary,
    },
  };

  const linking: LinkingOptions<RootStackParamList> = {
    prefixes: ["pushpullapp://", "push-pull://"],
    config: {
      screens: {
        RootTabs: {
          screens: {
            Home: "home",
            Squad: "squad",
            History: "history",
            Settings: "settings",
          },
        },
        SquadJoin: {
          path: "squad/join/:code",
          parse: {
            code: (code: string) => code,
          },
        },
        WorkoutTemplateDetail: "workout/:templateId",
        WorkoutTemplateBuilder: "workout/builder",
        WorkoutSession: "session/:templateId",
        Profile: "profile/:userId",
        PostWorkoutShare: "share/:sessionId",
        Onboarding: "onboarding",
        Upgrade: "upgrade",
      },
    },
  };

  // Show auth load error if AuthProvider failed to import
  if (authLoadError) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View
            style={{
              flex: 1,
              backgroundColor: colors.background,
              paddingTop: Platform.OS === "ios" ? 60 : 40,
              paddingHorizontal: 20,
            }}
          >
            <Text
              style={{
                color: colors.error ?? "#f87171",
                fontSize: 20,
                fontWeight: "bold",
                marginBottom: 16,
              }}
            >
              App Initialization Failed
            </Text>
            <ScrollView style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 14, marginBottom: 8 }}>
                {authLoadError.message}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                {authLoadError.stack}
              </Text>
            </ScrollView>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  const content = fontsLoaded ? (
    STRIPE_PUBLISHABLE_KEY && AuthProvider ? (
      <StripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier='com.pushpull.app'
        urlScheme='push-pull'
      >
        <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <UserProfileProvider>
              <StatusBar style='light' />
              <AuthGate>
                <OnboardingGate>
                  <NavigationContainer theme={navTheme} linking={linking}>
                    <RootNavigator />
                  </NavigationContainer>
                </OnboardingGate>
              </AuthGate>
            </UserProfileProvider>
          </QueryClientProvider>
        </AuthProvider>
      </StripeProvider>
    ) : (
      <MissingStripeKey />
    )
  ) : (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <ActivityIndicator color={colors.primary} />
      <Text
        style={{
          color: colors.textSecondary,
          fontFamily: fontFamilies.medium,
          letterSpacing: 0.3,
        }}
      >
        Loading Push / Pull...
      </Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>{content}</ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;

const OnboardingGate = ({ children }: { children: ReactNode }) => {
  const { isOnboarded, isLoading, user } = useCurrentUser();

  // Only block the UI while we haven't loaded a user yet.
  if (isLoading && !user) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isOnboarded) {
    return <OnboardingScreen />;
  }
  return <>{children}</>;
};

const MissingStripeKey = () => (
  <View
    style={{
      flex: 1,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 24,
    }}
  >
    <Text
      style={{
        color: colors.textPrimary,
        fontFamily: fontFamilies.semibold,
        fontSize: 18,
      }}
    >
      Stripe not configured
    </Text>
    <Text
      style={{
        color: colors.textSecondary,
        fontFamily: fontFamilies.regular,
        textAlign: "center",
      }}
    >
      Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to your env to enable upgrades.
    </Text>
  </View>
);
