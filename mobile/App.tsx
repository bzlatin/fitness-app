import "react-native-gesture-handler";
import { NavigationContainer, DarkTheme, LinkingOptions } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
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
import { AuthProvider } from "./src/context/AuthContext";
import AuthGate from "./src/components/auth/AuthGate";
import { UserProfileProvider } from "./src/context/UserProfileContext";
import { useCurrentUser } from "./src/hooks/useCurrentUser";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import { RootStackParamList } from "./src/navigation/types";

const App = () => {
  const [fontsLoaded] = useFonts({
    [fontFamilies.regular]: SpaceGrotesk_400Regular,
    [fontFamilies.medium]: SpaceGrotesk_500Medium,
    [fontFamilies.semibold]: SpaceGrotesk_600SemiBold,
    [fontFamilies.bold]: SpaceGrotesk_700Bold,
  });

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
      },
    },
  };

  const content = fontsLoaded ? (
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
      <SafeAreaProvider>{content}</SafeAreaProvider>
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
