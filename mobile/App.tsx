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
import { useWidgetSync } from "./src/hooks/useWidgetSync";
import { useAppleHealthSync } from "./src/hooks/useAppleHealthSync";
import PreAuthOnboardingScreen from "./src/screens/PreAuthOnboardingScreen";
import AccountSetupScreen from "./src/screens/AccountSetupScreen";
import { RootStackParamList } from "./src/navigation/types";
import { bootstrapPayments } from "./src/services/payments";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { useAuth } from "./src/context/AuthContext";
import {
  isPreAuthOnboardingFinished,
  clearPreAuthOnboarding,
  loadPreAuthOnboarding,
  skipPreAuthOnboarding,
} from "./src/services/preAuthOnboarding";
import { PreAuthOnboardingProvider } from "./src/context/PreAuthOnboardingContext";

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
    prefixes: ["push-pull://", "pushpull://", "pushpullapp://"],
    config: {
      screens: {
        RootTabs: {
          screens: {
            Home: "home",
            Squad: "squad",
            History: "history",
            Settings: "settings",
            Profile: "profile",
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
        UserProfile: "profile/:userId",
        PostWorkoutShare: "share/:sessionId",
        Onboarding: "onboarding",
        Upgrade: "upgrade",
        // Widget deep links
        "workout/start": {
          path: "workout/start",
          screens: {
            RootTabs: {
              screens: {
                Home: "home",
              },
            },
          },
        },
        "workout/log": {
          path: "workout/log",
          screens: {
            RootTabs: {
              screens: {
                Home: "home",
              },
            },
          },
        },
        "workout/log-set": {
          path: "workout/log-set",
          screens: {
            RootTabs: {
              screens: {
                Home: "home",
              },
            },
          },
        },
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
              <PreAuthOnboardingGate>
                <AuthGate>
                  <AccountSetupGate>
                    <NavigationContainer theme={navTheme} linking={linking}>
                      <RootNavigator />
                    </NavigationContainer>
                  </AccountSetupGate>
                </AuthGate>
              </PreAuthOnboardingGate>
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

const PreAuthOnboardingGate = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const [isFinished, setIsFinished] = React.useState(false);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        if (!mounted) return;
        if (isAuthenticated) {
          setIsFinished(true);
          return;
        }
        const existing = await loadPreAuthOnboarding();
        setIsFinished(isPreAuthOnboardingFinished(existing));
      } finally {
        if (mounted) setIsBootstrapping(false);
      }
    };
    if (!isLoading) {
      void bootstrap();
    }
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, isLoading]);

  if (isLoading || isBootstrapping) {
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

  if (!isAuthenticated && !isFinished) {
    return <PreAuthOnboardingScreen onFinished={() => setIsFinished(true)} />;
  }

  return (
    <PreAuthOnboardingProvider
      restart={() => {
        setIsFinished(false);
        setIsBootstrapping(false);
        void clearPreAuthOnboarding();
      }}
    >
      {children}
    </PreAuthOnboardingProvider>
  );
};

const AccountSetupGate = ({ children }: { children: ReactNode }) => {
  const { isOnboarded, isLoading, user } = useCurrentUser();

  // Sync widget data automatically (iOS only)
  useWidgetSync();
  // Keep Apple Health imports fresh once per day (iOS only)
  useAppleHealthSync();

  useEffect(() => {
    const markSeen = async () => {
      if (!isOnboarded) return;
      const existing = await loadPreAuthOnboarding();
      if (!isPreAuthOnboardingFinished(existing)) {
        await skipPreAuthOnboarding();
      }
    };
    void markSeen();
  }, [isOnboarded]);

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
    return <AccountSetupScreen onFinished={() => {}} />;
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
