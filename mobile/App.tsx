import "react-native-gesture-handler";
import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  createNavigationContainerRef,
  DarkTheme,
  getStateFromPath as defaultGetStateFromPath,
  LinkingOptions,
  NavigationContainerRefWithCurrent,
  NavigationContainer,
} from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
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
import { setTemplateShareCodeProvider } from "./src/api/client";
import { bootstrapPayments } from "./src/services/payments";
import ErrorBoundary from "./src/components/ErrorBoundary";
import { useAuth } from "./src/context/AuthContext";
import { WorkoutTemplatePreviewContent } from "./src/screens/WorkoutTemplatePreviewScreen";
import {
  isPreAuthOnboardingFinished,
  clearPreAuthOnboarding,
  loadPreAuthOnboarding,
  skipPreAuthOnboarding,
} from "./src/services/preAuthOnboarding";
import { PreAuthOnboardingProvider } from "./src/context/PreAuthOnboardingContext";
import {
  clearTemplateShareCode,
  loadTemplateShareCode,
  saveTemplateShareCode,
} from "./src/services/templateShareAttribution";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (__DEV__) {
  console.log("[App] Starting Push/Pull...");
  console.log("[App] Platform:", Platform.OS, Platform.Version);
  console.log("[App] STRIPE_PUBLISHABLE_KEY set:", !!STRIPE_PUBLISHABLE_KEY);
  console.log("[App] ENV AUTH0_DOMAIN:", process.env.EXPO_PUBLIC_AUTH0_DOMAIN ? "set" : "NOT SET");
  console.log("[App] ENV AUTH0_CLIENT_ID:", process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ? "set" : "NOT SET");
  console.log("[App] ENV API_URL:", process.env.EXPO_PUBLIC_API_URL ?? "NOT SET");
}

// Dynamically load AuthProvider to catch module-level errors
let AuthProvider: React.ComponentType<{ children: ReactNode }> | null = null;
let authLoadError: Error | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AuthProvider = require("./src/context/AuthContext").AuthProvider;
  if (__DEV__) console.log("[App] AuthProvider loaded successfully");
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

  const [templateShareCode, setTemplateShareCode] = useState<string | null>(null);
  const [pendingTemplateShareCode, setPendingTemplateShareCode] = useState<string | null>(null);
  const templateShareCodeRef = useRef<string | null>(null);

  useEffect(() => {
    templateShareCodeRef.current = templateShareCode;
  }, [templateShareCode]);

  useEffect(() => {
    setTemplateShareCodeProvider(() => templateShareCodeRef.current);
    return () => setTemplateShareCodeProvider(null);
  }, []);

  useEffect(() => {
    const load = async () => {
      const existing = await loadTemplateShareCode();
      if (existing) setTemplateShareCode(existing);
    };
    void load();
  }, []);

  useEffect(() => {
    void bootstrapPayments();
  }, []);

  const clearShareContext = () => {
    setPendingTemplateShareCode(null);
    setTemplateShareCode(null);
    void clearTemplateShareCode();
  };

  useEffect(() => {
    const extractShareCodeFromUrl = (url: string) => {
      const parsed = ExpoLinking.parse(url);
      const path = (parsed.path ?? "").replace(/^\/+/, "");
      const match =
        path.match(/^workout\/share\/([0-9a-z]{8})(?:\/)?$/i) ??
        path.match(/^workout\/([0-9a-z]{8})(?:\/)?$/i);
      const code = match?.[1]?.toLowerCase();
      if (!code || !/^[0-9a-z]{8}$/.test(code)) return null;
      return code;
    };

    const handleUrl = async (url: string | null | undefined) => {
      if (!url) return;
      const code = extractShareCodeFromUrl(url);
      if (!code) return;
      setPendingTemplateShareCode(code);
      setTemplateShareCode(code);
      await saveTemplateShareCode(code);
    };

    void ExpoLinking.getInitialURL().then(handleUrl);
    const sub = ExpoLinking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });
    return () => sub.remove();
  }, []);

  const navigationRef = useRef(createNavigationContainerRef<RootStackParamList>()).current;
  const [navReady, setNavReady] = useState(false);

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
    prefixes: ["push-pull://", "pushpull://", "pushpullapp://", "https://push-pull.app"],
    getStateFromPath: (path, options) => {
      const normalized = path.replace(/^\/+/, "");
      const shareMatch = normalized.match(/^workout\/([0-9a-z]{8})\/?$/i);
      if (shareMatch) {
        return defaultGetStateFromPath(`workout/share/${shareMatch[1]}`, options);
      }
      return defaultGetStateFromPath(path, options);
    },
    config: {
      screens: {
        RootTabs: {
          screens: {
            Home: "home",
            Squad: "squad",
            History: "history",
            Profile: "profile",
          },
        },
        Settings: "settings",
        SquadJoin: {
          path: "squad/join/:code",
          parse: {
            code: (code: string) => code,
          },
        },
        WorkoutTemplatePreview: {
          path: "workout/share/:code",
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
              <PreAuthOnboardingGate
                pendingTemplateShareCode={pendingTemplateShareCode}
                onDismissTemplateShare={clearShareContext}
              >
                <AuthGate>
                  <AccountSetupGate>
                    <TemplateShareNavigationBridge
                      pendingTemplateShareCode={pendingTemplateShareCode}
                      navigationRef={navigationRef}
                      navReady={navReady}
                      onConsumed={() => setPendingTemplateShareCode(null)}
                    />
                    <NavigationContainer
                      theme={navTheme}
                      linking={linking}
                      ref={navigationRef}
                      onReady={() => setNavReady(true)}
                    >
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

const PreAuthOnboardingGate = ({
  children,
  pendingTemplateShareCode,
  onDismissTemplateShare,
}: {
  children: ReactNode;
  pendingTemplateShareCode: string | null;
  onDismissTemplateShare: () => void;
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isBootstrapping, setIsBootstrapping] = React.useState(true);
  const [isFinished, setIsFinished] = React.useState(false);

  if (pendingTemplateShareCode && !isAuthenticated) {
    return (
      <WorkoutTemplatePreviewContent
        code={pendingTemplateShareCode}
        onDismiss={onDismissTemplateShare}
      />
    );
  }

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

const TemplateShareNavigationBridge = ({
  pendingTemplateShareCode,
  navigationRef,
  navReady,
  onConsumed,
}: {
  pendingTemplateShareCode: string | null;
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>;
  navReady: boolean;
  onConsumed: () => void;
}) => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!pendingTemplateShareCode || !isAuthenticated || !navReady) return;
    if (!navigationRef.isReady()) return;

    const current = navigationRef.getCurrentRoute();
    const currentCode =
      current?.name === "WorkoutTemplatePreview" && current.params && "code" in current.params
        ? String((current.params as { code?: string }).code ?? "")
        : null;

    if (current?.name === "WorkoutTemplatePreview" && currentCode === pendingTemplateShareCode) {
      onConsumed();
      return;
    }

    navigationRef.navigate("WorkoutTemplatePreview", { code: pendingTemplateShareCode });
    onConsumed();
  }, [isAuthenticated, navReady, navigationRef, onConsumed, pendingTemplateShareCode]);

  return null;
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
