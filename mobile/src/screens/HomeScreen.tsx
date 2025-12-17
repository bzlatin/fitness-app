import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useActiveSession } from "../hooks/useActiveSession";
import { useUpNextRecommendation } from "../hooks/useUpNextRecommendation";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { WorkoutSession, WorkoutTemplate } from "../types/workouts";
import MuscleGroupBreakdown from "../components/MuscleGroupBreakdown";
import UpNextCard from "../components/workout/UpNextCard";
import { generateWorkout, recommendNextWorkout } from "../api/ai";
import { deleteTemplate } from "../api/templates";
import { deleteSession, undoAutoEndSession } from "../api/sessions";
import { fetchRecap } from "../api/analytics";
import { useFatigue } from "../hooks/useFatigue";
import { endWorkoutLiveActivity } from "../services/liveActivity";
import { syncActiveSessionToWidget } from "../services/widgetSync";
import { clearActiveWorkoutStatus } from "../api/social";
import { cancelScheduledRestTimerFinishSound } from "../utils/timerSound";
import {
  TRAINING_SPLIT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
} from "../types/onboarding";
import RecoveryBodyMap from "../components/RecoveryBodyMap";
import TrialBanner from "../components/premium/TrialBanner";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
import {
  canGenerateAiWorkout,
  getAiWorkoutGenerationsRemaining,
} from "../utils/featureGating";
import RecapCard from "../components/RecapCard";
import { RecapSlice } from "../types/analytics";

// Generate unique ID for React Native (no crypto dependency)
const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const HomeScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { data: templates } = useWorkoutTemplates();
  const { user } = useCurrentUser();
  const subscriptionAccess = useSubscriptionAccess();
  const hasProAccess = subscriptionAccess.hasProAccess;
  const isPro = hasProAccess;
  const aiRemaining = getAiWorkoutGenerationsRemaining(user, { hasProAccess });
  const aiFreeUsed = !hasProAccess && aiRemaining === 0;
  const [paywallTrigger, setPaywallTrigger] = useState<
    "analytics" | "ai" | "templates" | "recovery" | "progression" | null
  >(null);

  // Check for active (uncompleted) workout session
  const { data: activeSessionData, status: activeSessionStatus } = useActiveSession();
  const rawActiveSession = activeSessionData?.session ?? null;
  const serverAutoEndedSession = activeSessionData?.autoEndedSession ?? null;
  const activeSession = rawActiveSession && !rawActiveSession.endedReason ? rawActiveSession : null;
  const activeSessionId = activeSession?.id ?? null;
  const rawActiveSessionId = rawActiveSession?.id ?? null;
  const autoEndedSessionId = serverAutoEndedSession?.id ?? null;

  // Guardrail: never show Live Activity/widget session state unless there's an active workout.
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (activeSessionStatus !== "success") return;
    if (activeSessionId) return;
    void syncActiveSessionToWidget(null);
    void endWorkoutLiveActivity();
  }, [activeSessionStatus, activeSessionId, rawActiveSessionId, autoEndedSessionId]);

  // Fetch fatigue data for all users (free users can see heatmap)
  const { data: fatigue, isLoading: fatigueLoading, refetch: refetchFatigue } =
    useFatigue(true);

  // Fetch Up Next intelligent recommendation
  const {
    data: upNextRecommendation,
    isLoading: upNextLoading,
    isError: upNextError,
    refetch: refetchUpNext,
  } = useUpNextRecommendation();

  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null
  );
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [dismissedSession, setDismissedSession] = useState<{
    id: string;
    dismissedAt: number;
  } | null>(null);
  const [autoEndedSession, setAutoEndedSession] = useState<WorkoutSession | null>(null);
  const [dismissedAutoEndedSession, setDismissedAutoEndedSession] = useState<{
    id: string;
    dismissedAt: number;
  } | null>(null);

  // Subscription status for trial/grace/expired handling
  const subscriptionStatusError = subscriptionAccess.isError;
  const refetchSubscriptionStatus = subscriptionAccess.refetch;
  const isTrial = subscriptionAccess.isTrial;
  const isGrace = subscriptionAccess.isGrace;
  const isExpired = subscriptionAccess.isExpired;
  const trialEndsIso = subscriptionAccess.trialEndsAt
    ? subscriptionAccess.trialEndsAt.toISOString()
    : null;

  const upNext = useMemo<WorkoutTemplate | null>(() => {
    if (!templates || templates.length === 0) return null;
    return templates.find((t) => t.id === selectedTemplateId) ?? templates[0];
  }, [templates, selectedTemplateId]);

  // Compute override template for UpNextCard when user manually selects a different workout
  const overrideTemplate = useMemo(() => {
    if (!selectedTemplateId || !templates) return null;

    // Check if the selected template is different from the AI recommendation's matched template
    const matchedTemplateId = upNextRecommendation?.matchedTemplate?.templateId;
    if (selectedTemplateId === matchedTemplateId) return null;

    const selected = templates.find((t) => t.id === selectedTemplateId);
    if (!selected) return null;

    return {
      templateId: selected.id,
      templateName: selected.name,
      exerciseCount: selected.exercises.length,
      splitType: selected.splitType ?? null,
    };
  }, [selectedTemplateId, templates, upNextRecommendation?.matchedTemplate?.templateId]);

  const overallRecoveryLabel = useMemo(() => {
    if (!fatigue) return "Recovery calibrating";
    if (fatigue.totals.baselineVolume === null) return "Building baseline";
    if (fatigue.totals.fatigueScore > 130) return "High fatigue";
    if (fatigue.totals.fatigueScore < 70) return "Under-trained";
    return "Ready to train";
  }, [fatigue]);

  const queryClient = useQueryClient();
  const { data: recap, isLoading: recapLoading, isError: recapError, refetch: refetchRecap } =
    useQuery<RecapSlice>({
      queryKey: ["recap"],
      queryFn: fetchRecap,
      enabled: isPro,
      staleTime: 2 * 60 * 1000,
    });

  const openPaywall = (
    trigger: "analytics" | "ai" | "templates" | "recovery" | "progression"
  ) => {
    setPaywallTrigger(trigger);
    setShowPaywallModal(true);
  };

  useFocusEffect(
    useCallback(() => {
      void refetchFatigue();
      void refetchUpNext();
    }, [refetchFatigue, refetchUpNext])
  );

  const closePaywall = () => {
    setShowPaywallModal(false);
    setPaywallTrigger(null);
  };

  const handleAnalyticsPress = () => {
    if (isPro) {
      navigation.navigate("Analytics");
      return;
    }
    openPaywall("analytics");
  };

  const startWorkout = (template: WorkoutTemplate | null) => {
    if (!template) return;
    navigation.navigate("WorkoutSession", { templateId: template.id });
  };

  // Generate workout mutation for Up Next card
  const generateUpNextMutation = useMutation({
    mutationFn: async (splitKey: string) => {
      const workout = await generateWorkout({
        requestedSplit: splitKey,
      });
      return workout;
    },
    onSuccess: (workout) => {
      navigation.navigate("WorkoutPreview", { workout });
    },
    onError: (error: any) => {
      if (error?.response?.data?.requiresUpgrade || error?.requiresUpgrade) {
        openPaywall("ai");
        return;
      }
      Alert.alert(
        "Generation Failed",
        error?.response?.data?.message ||
          error?.message ||
          "Failed to generate workout. Please try again."
      );
    },
  });

  const cancelActiveWorkout = useMutation({
    mutationFn: async (sessionId: string) => {
      await deleteSession(sessionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
    },
    onError: () => {
      Alert.alert("Error", "Failed to cancel workout");
      setDismissedSession(null);
    },
  });

  const undoAutoEnd = useMutation({
    mutationFn: async (sessionId: string) => undoAutoEndSession(sessionId),
    onSuccess: (session) => {
      setAutoEndedSession(null);
      setDismissedAutoEndedSession(null);
      queryClient.setQueryData(["activeSession"], { session, autoEndedSession: null });
      navigation.navigate("WorkoutSession", {
        sessionId: session.id,
        templateId: session.templateId || "",
      });
    },
    onError: () => {
      Alert.alert("Error", "Failed to resume workout");
    },
  });

  const handleCancelWorkout = (sessionId: string) => {
    Alert.alert(
      "Cancel Workout?",
      "This will delete your unfinished workout. This cannot be undone.",
      [
        { text: "Keep Workout", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void cancelScheduledRestTimerFinishSound();
            void endWorkoutLiveActivity();
            void syncActiveSessionToWidget(null);
            void clearActiveWorkoutStatus(sessionId);
            setDismissedSession({
              id: sessionId,
              dismissedAt: Date.now(),
            });
            void AsyncStorage.removeItem(`workout_logged_set_ids:${sessionId}`);
            // Optimistically drop the banner so it doesn't flash back
            queryClient.setQueryData(["activeSession"], {
              session: null,
              autoEndedSession: null,
            });
            cancelActiveWorkout.mutate(sessionId);
          },
        },
      ]
    );
  };

  // If a different session comes in, clear any dismissal guard
  useEffect(() => {
    if (!dismissedSession || !activeSession?.startedAt) return;
    const startedAtMs = new Date(activeSession.startedAt).getTime();
    if (Number.isNaN(startedAtMs)) return;

    // Only re-show the banner if a newer session appears after the dismissal
    if (
      activeSession.id !== dismissedSession.id &&
      startedAtMs > dismissedSession.dismissedAt
    ) {
      setDismissedSession(null);
    }
  }, [activeSession, dismissedSession]);

  const shouldShowResumeBanner = useMemo(() => {
    // Never show resume banner for sessions that the server has marked as ended
    if (!activeSession) return false;
    if (!dismissedSession) return true;

    const startedAtMs = activeSession.startedAt
      ? new Date(activeSession.startedAt).getTime()
      : NaN;

    if (activeSession.id === dismissedSession.id) return false;
    if (Number.isNaN(startedAtMs)) return true;

    // Hide any sessions that started before or at the time we dismissed the banner
    return startedAtMs > dismissedSession.dismissedAt;
  }, [activeSession, dismissedSession]);

  useEffect(() => {
    if (!serverAutoEndedSession) {
      setAutoEndedSession(null);
      return;
    }

    if (
      dismissedAutoEndedSession &&
      dismissedAutoEndedSession.id === serverAutoEndedSession.id
    ) {
      return;
    }

    setAutoEndedSession(serverAutoEndedSession);
  }, [serverAutoEndedSession, dismissedAutoEndedSession]);

  const resumeSession = shouldShowResumeBanner ? activeSession : null;
  const autoEndedDurationHours = useMemo(() => {
    if (!autoEndedSession?.autoEndedAt || !autoEndedSession.startedAt) return null;
    const autoEndedAtMs = new Date(autoEndedSession.autoEndedAt).getTime();
    const startedAtMs = new Date(autoEndedSession.startedAt).getTime();
    if (Number.isNaN(autoEndedAtMs) || Number.isNaN(startedAtMs)) return null;
    const hours = (autoEndedAtMs - startedAtMs) / (1000 * 60 * 60);
    if (hours <= 0) return null;
    return Math.round(hours * 10) / 10;
  }, [autoEndedSession]);

  const handleResumeAutoEnded = (sessionId: string) => {
    if (undoAutoEnd.isPending) return;
    undoAutoEnd.mutate(sessionId);
  };

  const handleDismissAutoEnded = (sessionId: string) => {
    setAutoEndedSession(null);
    setDismissedAutoEndedSession({ id: sessionId, dismissedAt: Date.now() });
    queryClient.setQueryData(["activeSession"], (prev) => {
      const currentSession =
        prev && typeof prev === "object" && "session" in prev
          ? (prev as { session: WorkoutSession | null }).session
          : null;
      return { session: currentSession, autoEndedSession: null };
    });
  };

  return (
    <ScreenContainer scroll>
      {/* Subscription status banners */}
      {subscriptionStatusError ? (
        <Pressable
          onPress={() => refetchSubscriptionStatus()}
          style={{
            marginTop: 8,
            marginBottom: 4,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
            }}
          >
            Subscription status unavailable
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamilies.regular,
              marginTop: 4,
            }}
          >
            We couldn&apos;t refresh your subscription. Tap to retry.
          </Text>
        </Pressable>
      ) : null}

      {isTrial && trialEndsIso ? (
        <TrialBanner
          trialEndsAt={trialEndsIso}
          onUpgrade={() => navigation.navigate("Upgrade")}
        />
      ) : null}

      {isGrace ? (
        <Pressable
          onPress={() => navigation.navigate("Upgrade")}
          style={{
            marginTop: 8,
            marginBottom: 4,
            backgroundColor: "#2d1b00",
            borderColor: "#f59e0b",
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Text
            style={{
              color: "#fbbf24",
              fontFamily: fontFamilies.semibold,
            }}
          >
            Billing issue • Grace period
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamilies.regular,
              marginTop: 4,
            }}
          >
            Your Apple subscription is in a grace period. Update billing to keep
            Pro access.
          </Text>
        </Pressable>
      ) : null}

      {isExpired ? (
        <Pressable
          onPress={() => navigation.navigate("Upgrade")}
          style={{
            marginTop: 8,
            marginBottom: 4,
            backgroundColor: "#2b0003",
            borderColor: "#ef4444",
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <Text
            style={{
              color: "#f87171",
              fontFamily: fontFamilies.semibold,
            }}
          >
            Subscription expired
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamilies.regular,
              marginTop: 4,
            }}
          >
            Renew your plan to unlock smart workouts, analytics, and progression.
          </Text>
        </Pressable>
      ) : null}

      {autoEndedSession ? (
        <View
          style={{
            marginTop: 8,
            marginBottom: 4,
            backgroundColor: "rgba(251,191,36,0.12)",
            borderColor: "#fbbf24",
            borderWidth: 1,
            borderRadius: 12,
            overflow: "hidden",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() => handleResumeAutoEnded(autoEndedSession.id)}
            disabled={undoAutoEnd.isPending}
            style={{
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              flex: 1,
              opacity: undoAutoEnd.isPending ? 0.7 : 1,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#fbbf24",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name='time' size={20} color='#0B1220' />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 16,
                }}
              >
                Workout auto-ended
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.regular,
                  marginTop: 2,
                  fontSize: 13,
                }}
              >
                Auto-ended after {autoEndedDurationHours ?? 4}h of inactivity. Tap to resume.
              </Text>
            </View>
            <Ionicons name='chevron-forward' size={20} color='#fbbf24' />
          </Pressable>
          <Pressable
            onPress={() => handleDismissAutoEnded(autoEndedSession.id)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              borderLeftWidth: 1,
              borderLeftColor: colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : "transparent",
            })}
          >
            <Ionicons name='close' size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      ) : null}

      {/* Resume Workout Banner - Show for any unfinished workout */}
      {resumeSession ? (
        <View
          style={{
            marginTop: 8,
            marginBottom: 4,
            backgroundColor: "rgba(34,197,94,0.15)",
            borderColor: colors.primary,
            borderWidth: 1,
            borderRadius: 12,
            overflow: "hidden",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Pressable
            onPress={() =>
              navigation.navigate("WorkoutSession", {
                sessionId: resumeSession.id,
                templateId: resumeSession.templateId || "",
              })
            }
            style={{
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              flex: 1,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name='play' size={20} color='#0B1220' />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 16,
                }}
              >
                Resume Workout
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.regular,
                  marginTop: 2,
                  fontSize: 13,
                }}
              >
                {resumeSession.templateName || "Workout in progress"}
              </Text>
            </View>
            <Ionicons name='chevron-forward' size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            onPress={() =>
              cancelActiveWorkout.isPending
                ? undefined
                : handleCancelWorkout(resumeSession.id)
            }
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              borderLeftWidth: 1,
              borderLeftColor: colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : "transparent",
              opacity: cancelActiveWorkout.isPending ? 0.6 : 1,
            })}
          >
            <Ionicons name='close' size={18} color={colors.textPrimary} />
          </Pressable>
        </View>
      ) : null}

      <View style={{ gap: 12 }}>
        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
              Up Next
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>
              {upNextRecommendation?.recommendedSplit
                ? `Based on your ${user?.onboardingData?.preferredSplit ? TRAINING_SPLIT_LABELS[user.onboardingData.preferredSplit] : "training"} split`
                : "Built from your history"}
            </Text>
          </View>
          <Pressable
            onPress={() => setSwapOpen(true)}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
              }}
            >
              New workout
            </Text>
          </Pressable>
        </View>

        <UpNextCard
          recommendation={upNextRecommendation ?? null}
          isLoading={upNextLoading || generateUpNextMutation.isPending}
          isError={upNextError}
          isPro={isPro}
          overrideTemplate={overrideTemplate}
          onStartTemplate={(templateId) => {
            navigation.navigate("WorkoutSession", { templateId });
          }}
          onGenerate={(splitKey) => {
            // Auto-generate workout for the recommended split
            generateUpNextMutation.mutate(splitKey);
          }}
          onCreate={() => {
            // Go directly to manual workout builder
            navigation.navigate("WorkoutTemplateBuilder", {});
          }}
          onSwap={() => setSwapOpen(true)}
          onEditTemplate={(templateId) => {
            navigation.navigate("WorkoutTemplateBuilder", { templateId });
          }}
          onUpgrade={() => openPaywall("ai")}
        />

        {/* Show muscle breakdown for matched template or first template */}
        <MuscleGroupBreakdown
          template={
            upNextRecommendation?.matchedTemplate
              ? templates?.find((t) => t.id === upNextRecommendation.matchedTemplate?.templateId) ?? upNext
              : upNext
          }
        />

        {user?.onboardingData && (
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 10,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 14,
                }}
              >
                Your Training Plan
              </Text>
              <Pressable
                onPress={() => {
                  navigation.navigate("Onboarding", { isRetake: true });
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontFamily: fontFamilies.medium,
                  }}
                >
                  Update
                </Text>
                <Ionicons
                  name='settings-outline'
                  size={14}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {user.onboardingData.preferredSplit && (
                <PrefsChip
                  label={
                    TRAINING_SPLIT_LABELS[user.onboardingData.preferredSplit]
                  }
                />
              )}
              {user.onboardingData.experienceLevel && (
                <PrefsChip
                  label={
                    EXPERIENCE_LEVEL_LABELS[user.onboardingData.experienceLevel]
                  }
                />
              )}
              {user.onboardingData.weeklyFrequency && (
                <PrefsChip
                  label={`${user.onboardingData.weeklyFrequency}x/week`}
                />
              )}
              {user.onboardingData.sessionDuration && (
                <PrefsChip
                  label={`${user.onboardingData.sessionDuration} min`}
                />
              )}
            </View>
          </View>
        )}

        <View
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
            marginTop: 6,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  ...typography.heading2,
                  color: colors.textPrimary,
                  fontSize: 18,
                }}
              >
                Recovery Status
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                {overallRecoveryLabel}
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate("Recovery")}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 13,
                }}
              >
                View all
              </Text>
            </Pressable>
          </View>

          {/* Always show body heatmap for all users */}
          {fatigue && fatigue.perMuscle.length > 0 ? (
            <View style={{ gap: 10 }}>
              <RecoveryBodyMap
                data={fatigue.perMuscle}
                onSelectMuscle={() => navigation.navigate("Recovery")}
                gender={
                  (user?.onboardingData?.bodyGender as
                    | "male"
                    | "female"
                    | undefined) ?? "male"
                }
              />
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {isPro
                  ? "Tap a muscle to see detailed recovery insights."
                  : "Tap the body map to explore recovery features."}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10, paddingVertical: 8 }}>
              <Text
                style={{ color: colors.textSecondary, textAlign: "center" }}
              >
                {fatigueLoading
                  ? "Loading recovery data..."
                  : "Log a few workouts to see your muscle recovery heatmap and track which muscles need rest."}
              </Text>
            </View>
          )}
        </View>

        {/* Advanced Analytics (Locked for Free users) */}
        <Pressable
          onPress={handleAnalyticsPress}
          style={({ pressed }) => ({
            marginTop: 12,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <View style={{ gap: 4 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    ...typography.heading2,
                    color: colors.textPrimary,
                    fontSize: 18,
                  }}
                >
                  Advanced Analytics
                </Text>
                {!isPro ? (
                  <View
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: `${colors.primary}15`,
                      borderWidth: 1,
                      borderColor: `${colors.primary}25`,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons
                      name='lock-closed'
                      size={12}
                      color={colors.primary}
                    />
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 12,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      Pro
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                Recap quality + volume trends
              </Text>
            </View>
            <Ionicons name='bar-chart' size={24} color={colors.primary} />
          </View>
          <RecapCard
            data={recap}
            loading={isPro ? recapLoading : false}
            error={isPro ? recapError : false}
            locked={!isPro}
            onRetry={isPro ? refetchRecap : undefined}
            onPress={handleAnalyticsPress}
            ctaLabel={isPro ? "Open recap" : "Unlock"}
            variant='compact'
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }}
          />
          <Pressable
            onPress={handleAnalyticsPress}
            style={({ pressed }) => ({
              marginTop: 10,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: isPro ? colors.primary : colors.surface,
              borderWidth: isPro ? 0 : 1,
              borderColor: isPro ? colors.primary : colors.border,
              opacity: pressed ? 0.85 : 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            })}
          >
            {!isPro ? (
              <Ionicons
                name='lock-closed'
                size={16}
                color={colors.textPrimary}
              />
            ) : null}
            <Text
              style={{
                color: isPro ? colors.surface : colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 14,
                textAlign: "center",
              }}
            >
              {isPro ? "View Analytics" : "Unlock Analytics"}
            </Text>
          </Pressable>
        </Pressable>
      </View>

      <SwapModal
        visible={swapOpen}
        onClose={() => setSwapOpen(false)}
        templates={templates ?? []}
        onSelect={(t) => {
          setSelectedTemplateId(t.id);
          setSwapOpen(false);
        }}
        onOpenTemplate={(t) => {
          setSwapOpen(false);
          navigation.navigate("WorkoutTemplateDetail", {
            templateId: t.id,
          });
        }}
        showPaywallModal={() => {
          setSwapOpen(false);
          openPaywall("ai");
        }}
      />

      <PaywallComparisonModal
        visible={showPaywallModal}
        onClose={closePaywall}
        triggeredBy={paywallTrigger ?? undefined}
        aiFreeUsed={paywallTrigger === "ai" ? aiFreeUsed : undefined}
        aiFreeRemaining={
          paywallTrigger === "ai" && Number.isFinite(aiRemaining)
            ? aiRemaining
            : undefined
        }
      />
    </ScreenContainer>
  );
};

const Chip = ({ label }: { label: string }) => (
  <View
    style={{
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Text
      style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}
    >
      {label}
    </Text>
  </View>
);

const PrefsChip = ({ label }: { label: string }) => (
  <View
    style={{
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: `${colors.primary}15`,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    }}
  >
    <Text
      style={{
        color: colors.textPrimary,
        fontFamily: fontFamilies.medium,
        fontSize: 12,
      }}
    >
      {label}
    </Text>
  </View>
);

const MUSCLE_GROUPS = [
  { value: "chest", label: "Chest", emoji: "💪" },
  { value: "back", label: "Back", emoji: "🦾" },
  { value: "legs", label: "Legs", emoji: "🦵" },
  { value: "glutes", label: "Glutes", emoji: "🍑" },
  { value: "shoulders", label: "Shoulders", emoji: "🏋️" },
  { value: "biceps", label: "Biceps", emoji: "💪" },
  { value: "triceps", label: "Triceps", emoji: "💪" },
];

const SPLIT_EMOJIS: Record<string, string> = {
  push: "💪",
  pull: "🦾",
  legs: "🦵",
  upper: "🏅",
  lower: "🔥",
  full_body: "⚡",
  chest: "💪",
  back: "🦾",
  shoulders: "🏋️",
  arms: "💪",
};

const DURATION_OPTIONS = [30, 45, 60] as const;

type EquipmentMode = "gym_full" | "home_limited" | "bodyweight";

const EQUIPMENT_OPTIONS: Array<{ value: EquipmentMode; label: string }> = [
  { value: "gym_full", label: "Gym" },
  { value: "home_limited", label: "Home" },
  { value: "bodyweight", label: "Bodyweight" },
];

const SwapModal = ({
  visible,
  onClose,
  templates,
  onSelect,
  onOpenTemplate,
  showPaywallModal,
}: {
  visible: boolean;
  onClose: () => void;
  templates: WorkoutTemplate[];
  onSelect: (template: WorkoutTemplate) => void;
  onOpenTemplate: (template: WorkoutTemplate) => void;
  showPaywallModal: () => void;
  }) => {
    const navigation = useNavigation<RootNavigation>();
    const queryClient = useQueryClient();
    const { user, refresh } = useCurrentUser();
    const { hasProAccess } = useSubscriptionAccess();
    const insets = useSafeAreaInsets();
    const smartScrollRef = useRef<ScrollView>(null);
    const savedListRef = useRef<FlatList<WorkoutTemplate>>(null);
    const [showSaved, setShowSaved] = useState(false);
    const [showMuscleFocus, setShowMuscleFocus] = useState(false);
    const [showSmartNext, setShowSmartNext] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [smartSessionDuration, setSmartSessionDuration] = useState<number>(45);
  const [smartEquipment, setSmartEquipment] = useState<EquipmentMode | null>(null);
  const [smartAvoidMuscles, setSmartAvoidMuscles] = useState<string[]>([]);
  const [manualSplitKey, setManualSplitKey] = useState<string | null>(null);
  const [smartOptionsExpanded, setSmartOptionsExpanded] = useState(false);
  const [smartSoreExpanded, setSmartSoreExpanded] = useState(false);
    const [smartIsNearBottom, setSmartIsNearBottom] = useState(false);
    const [smartIsNearTop, setSmartIsNearTop] = useState(true);
    const [smartScrollContentHeight, setSmartScrollContentHeight] = useState(0);
    const [smartScrollLayoutHeight, setSmartScrollLayoutHeight] = useState(1);
    const [savedIsNearBottom, setSavedIsNearBottom] = useState(false);
    const [savedIsNearTop, setSavedIsNearTop] = useState(true);
    const [savedScrollContentHeight, setSavedScrollContentHeight] = useState(0);
    const [savedScrollLayoutHeight, setSavedScrollLayoutHeight] = useState(1);

    const isPro = hasProAccess;
    const aiRemaining = getAiWorkoutGenerationsRemaining(user, { hasProAccess });
    const canUseAi = canGenerateAiWorkout(user, { hasProAccess });
  const aiFreeAvailable = !hasProAccess && aiRemaining > 0;
    const templateCount = templates?.length ?? 0;
    const safeBottomPadding = Math.max(insets.bottom, 12);

    const scrollSmartToTop = useCallback((animated = false) => {
      smartScrollRef.current?.scrollTo({ y: 0, animated });
    }, []);

    const scrollSavedToTop = useCallback((animated = false) => {
      savedListRef.current?.scrollToOffset({ offset: 0, animated });
    }, []);

    // Reset all state when modal is opened
    const resetModalState = () => {
      setShowSaved(false);
      setShowMuscleFocus(false);
      setShowSmartNext(false);
      setSelectedMuscles([]);
      setSmartAvoidMuscles([]);
      setManualSplitKey(null);
      setSmartOptionsExpanded(false);
      setSmartSoreExpanded(false);
      setSmartIsNearTop(true);
      setSmartIsNearBottom(false);
      setSmartScrollContentHeight(0);
      setSmartScrollLayoutHeight(1);
      setSavedIsNearTop(true);
      setSavedIsNearBottom(false);
      setSavedScrollContentHeight(0);
      setSavedScrollLayoutHeight(1);

      const durationFromOnboarding = user?.onboardingData?.sessionDuration ?? 45;
    const preferredDuration = DURATION_OPTIONS.includes(
      durationFromOnboarding as (typeof DURATION_OPTIONS)[number]
    )
      ? durationFromOnboarding
      : 45;
    setSmartSessionDuration(preferredDuration);

    const equipment = user?.onboardingData?.availableEquipment ?? [];
    const nextEquipment: EquipmentMode | null = equipment.includes("gym_full")
      ? "gym_full"
      : equipment.includes("home_limited")
        ? "home_limited"
        : equipment.includes("bodyweight")
          ? "bodyweight"
          : null;
    setSmartEquipment(nextEquipment);
  };

    // Reset state when modal visibility changes
    useEffect(() => {
      if (visible) {
        resetModalState();
        requestAnimationFrame(() => {
          scrollSmartToTop(false);
          scrollSavedToTop(false);
        });
      }
    }, [visible, scrollSavedToTop, scrollSmartToTop]);

    useEffect(() => {
      if (showSaved) {
        setSavedIsNearTop(true);
        setSavedIsNearBottom(false);
        requestAnimationFrame(() => scrollSavedToTop(false));
      }
    }, [showSaved, templateCount, scrollSavedToTop]);

    useEffect(() => {
      if (showMuscleFocus || showSmartNext) {
        setSmartIsNearTop(true);
        setSmartIsNearBottom(false);
        requestAnimationFrame(() => scrollSmartToTop(false));
      }
    }, [showMuscleFocus, showSmartNext, scrollSmartToTop]);

  const generateMutation = useMutation({
    mutationFn: async ({
      split,
      muscles,
      overrides,
    }: {
      split?: string;
      muscles?: string[];
      overrides?: {
        sessionDuration?: number;
        availableEquipment?: string[];
        avoidMuscles?: string[];
      };
    }) => {
      const workout = await generateWorkout({
        requestedSplit: split,
        specificRequest:
          muscles && muscles.length > 0
            ? `Focus on ${muscles.join(", ")}`
            : undefined,
        overrides,
      });
      return workout;
    },
    onSuccess: (workout) => {
      if (!hasProAccess) {
        void refresh();
      }
      onClose();
      navigation.navigate("WorkoutPreview", { workout });
    },
    onError: (error: any) => {
      if (error?.response?.data?.requiresUpgrade || error?.requiresUpgrade) {
        showPaywallModal();
        return;
      }
      Alert.alert(
        "Generation Failed",
        error?.response?.data?.message ||
          error?.message ||
          "Failed to generate workout. Please try again."
      );
    },
  });

    const handleAIWorkout = (
      type: "muscle" | "smartNext",
      showPaywallCallback: () => void
    ) => {
    if (!canUseAi) {
      showPaywallCallback();
      return;
    }

      if (type === "muscle") {
        setShowMuscleFocus(true);
        setShowSaved(false);
        setShowSmartNext(false);
        setSelectedMuscles([]);
        setSmartIsNearTop(true);
        setSmartIsNearBottom(false);
      } else {
        setShowSmartNext(true);
        setShowSaved(false);
        setShowMuscleFocus(false);
        setSmartIsNearTop(true);
        setSmartIsNearBottom(false);
      }
    };

  const toggleMuscle = (muscle: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  const toggleAvoidMuscle = (muscle: string) => {
    setSmartAvoidMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  const smartNextQueryKey = useMemo(() => {
    const avoidKey = [...smartAvoidMuscles].sort().join(",");
    return ["ai", "recommend-next-workout", smartSessionDuration, smartEquipment, avoidKey];
  }, [smartAvoidMuscles, smartSessionDuration, smartEquipment]);

  const smartNextQuery = useQuery({
    queryKey: smartNextQueryKey,
    enabled: visible && showSmartNext,
    staleTime: 30_000,
    queryFn: async () => {
      return recommendNextWorkout({
        overrides: {
          sessionDuration: smartSessionDuration,
          availableEquipment: smartEquipment ? [smartEquipment] : undefined,
          avoidMuscles: smartAvoidMuscles,
        },
      });
    },
  });

  useEffect(() => {
    if (!showSmartNext) return;
    setManualSplitKey(null);
  }, [showSmartNext, smartSessionDuration, smartEquipment, smartAvoidMuscles]);

  const handleSavedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromTop = contentOffset.y;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;

    const nextNearTop = distanceFromTop < 10;
    const nextNearBottom = distanceFromBottom < 10;
    setSavedIsNearTop((prev) => (prev === nextNearTop ? prev : nextNearTop));
    setSavedIsNearBottom((prev) =>
      prev === nextNearBottom ? prev : nextNearBottom
    );
  };

  const savedCanScroll = savedScrollContentHeight > savedScrollLayoutHeight + 8;
  const showSavedTopShadow = templateCount > 0 && savedCanScroll && !savedIsNearTop;
  const showSavedBottomShadow = templateCount > 0 && savedCanScroll && !savedIsNearBottom;
  const smartCanScroll =
    smartScrollContentHeight > smartScrollLayoutHeight + 8;
  const showSmartTopShadow =
    (showMuscleFocus || showSmartNext) && smartCanScroll && !smartIsNearTop;
  const showSmartBottomShadow =
    (showMuscleFocus || showSmartNext) && smartCanScroll && !smartIsNearBottom;

  const handleSmartScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromTop = contentOffset.y;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;

    const nextNearTop = distanceFromTop < 10;
    const nextNearBottom = distanceFromBottom < 10;
    setSmartIsNearTop((prev) => (prev === nextNearTop ? prev : nextNearTop));
    setSmartIsNearBottom((prev) =>
      prev === nextNearBottom ? prev : nextNearBottom
    );
  };

  const actionOptions = [
    {
      label: "Smart Next Workout",
      helper: isPro
        ? `Uses your ${user?.onboardingData?.preferredSplit ? TRAINING_SPLIT_LABELS[user.onboardingData.preferredSplit] : "split"} + recovery`
        : "Made for you",
      action: "smart" as const,
      icon: "🎯",
    },
    {
      label: "Muscle Focus",
      helper: isPro
        ? "Target specific muscles"
        : canUseAi
        ? "Target specific muscles"
        : "Muscle focus (Upgrade)",
      action: "muscle" as const,
      icon: "💪",
    },
    {
      label: "Saved Workouts",
      helper: "Your saved templates",
      action: "saved" as const,
      icon: "📋",
    },
    {
      label: "Create New",
      helper: "Build from scratch",
      action: "scratch" as const,
      icon: "✏️",
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType='slide'
      transparent
      presentationStyle='overFullScreen'
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          onPress={onClose}
          accessibilityRole='button'
          accessibilityLabel='Close workout chooser'
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.6)" },
          ]}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 16,
            paddingBottom: 16 + safeBottomPadding,
            maxHeight: "80%",
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
            marginBottom: -1,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 48,
              height: 5,
              borderRadius: 999,
              backgroundColor: `${colors.textSecondary}35`,
              marginTop: 2,
              marginBottom: 6,
            }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
              Choose a workout
            </Text>
            <Pressable onPress={onClose}>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                Close
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 12,
            }}
          >
            {actionOptions.map((option) => {
              const isActive =
                (option.action === "saved" && showSaved) ||
                (option.action === "muscle" && showMuscleFocus) ||
                (option.action === "smart" && showSmartNext);

              return (
                <Pressable
                  key={option.label}
                  disabled={generateMutation.isPending}
                  onPress={() => {
                    if (option.action === "scratch") {
                      onClose();
                      navigation.navigate("WorkoutTemplateBuilder", {});
                      return;
                    }
                    if (option.action === "saved") {
                      if (showSaved) {
                        // Toggle off
                        setShowSaved(false);
                      } else {
                        // Toggle on, turn others off
                        setShowSaved(true);
                        setShowMuscleFocus(false);
                        setShowSmartNext(false);
                        setSavedIsNearTop(true);
                        setSavedIsNearBottom(false);
                        requestAnimationFrame(() => scrollSavedToTop(false));
                      }
                      return;
                    }
                    if (option.action === "muscle") {
                      if (showMuscleFocus) {
                        // Toggle off
                        setShowMuscleFocus(false);
                        setSelectedMuscles([]);
                      } else {
                        handleAIWorkout("muscle", showPaywallModal);
                      }
                      return;
                    }
                    if (option.action === "smart") {
                      if (showSmartNext) {
                        // Toggle off
                        setShowSmartNext(false);
                      } else {
                        handleAIWorkout("smartNext", showPaywallModal);
                        requestAnimationFrame(() => scrollSmartToTop(false));
                      }
                      return;
                    }
                  }}
                  style={({ pressed }) => ({
                    width: "47%",
                    padding: 14,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                    backgroundColor: isActive
                      ? `${colors.primary}15`
                      : pressed
                      ? colors.surfaceMuted
                      : colors.surface,
                    opacity: generateMutation.isPending ? 0.5 : 1,
                    alignItems: "center",
                    gap: 8,
                  })}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: `${colors.primary}15`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{option.icon}</Text>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 14,
                          textAlign: "center",
                        }}
                      >
                        {option.label}
                      </Text>
                      {!hasProAccess &&
                        (option.action === "muscle" ||
                          option.action === "smart") && (
                          <View
                            style={{
                              backgroundColor: colors.primary,
                              paddingHorizontal: aiFreeAvailable ? 7 : 5,
                              paddingVertical: 3,
                              borderRadius: 4,
                              minWidth: aiFreeAvailable ? 34 : 28,
                              alignItems: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#0B1220",
                                fontSize: aiFreeAvailable ? 8 : 8,
                                fontWeight: "700",
                                includeFontPadding: false,
                              }}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.85}
                            >
                              {aiFreeAvailable ? "FREE" : "PRO"}
                            </Text>
                          </View>
                        )}
                    </View>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 10,
                        marginTop: 4,
                        textAlign: "center",
                      }}
                      numberOfLines={2}
                    >
                      {option.helper}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!showSaved && (
            <View style={{ flex: 1, position: "relative" }}>
              {showSmartTopShadow && (
                <LinearGradient
                  colors={[colors.surface, `${colors.surface}00`]}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 24,
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )}
              <ScrollView
                ref={smartScrollRef}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                bounces
                overScrollMode='auto'
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: safeBottomPadding + 12, flexGrow: 1 }}
                keyboardShouldPersistTaps='handled'
                onScroll={handleSmartScroll}
                scrollEventThrottle={16}
                onLayout={(e) => setSmartScrollLayoutHeight(e.nativeEvent.layout.height)}
                onContentSizeChange={(_, height) => setSmartScrollContentHeight(height)}
              >
              {!showMuscleFocus && !showSmartNext && (
                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 14,
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 15,
                    }}
                  >
                    Pick how you want to start
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
                    Use{" "}
                    <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                      Smart Next
                    </Text>{" "}
                    for an auto-recommended session,{" "}
                    <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                      Muscle Focus
                    </Text>{" "}
                    to target a specific area, or{" "}
                    <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                      Saved Workouts
                    </Text>{" "}
                    to pick a template.
                  </Text>
                </View>
              )}
          {/* Muscle Group Selection */}
          {showMuscleFocus && (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 4,
                }}
              />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  marginBottom: 4,
                }}
              >
                Select muscle groups
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                Choose one or more muscle groups to focus on
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {MUSCLE_GROUPS.map((muscle) => {
                  const isSelected = selectedMuscles.includes(
                    muscle.label.toLowerCase()
                  );
                  return (
                    <Pressable
                      key={muscle.value}
                      onPress={() => toggleMuscle(muscle.label.toLowerCase())}
                      disabled={generateMutation.isPending}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        backgroundColor: isSelected
                          ? `${colors.primary}20`
                          : colors.surfaceMuted,
                        opacity:
                          pressed || generateMutation.isPending ? 0.6 : 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      })}
                    >
                      <Text style={{ fontSize: 18 }}>{muscle.emoji}</Text>
                      <Text
                        style={{
                          color: isSelected
                            ? colors.primary
                            : colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {muscle.label}
                      </Text>
                      {isSelected && (
                        <Ionicons
                          name='checkmark-circle'
                          size={16}
                          color={colors.primary}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
              {selectedMuscles.length > 0 && (
                <Pressable
                  onPress={() => {
                    generateMutation.mutate({ muscles: selectedMuscles });
                  }}
                  disabled={generateMutation.isPending}
                  style={({ pressed }) => ({
                    marginTop: 12,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    opacity: pressed || generateMutation.isPending ? 0.85 : 1,
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 10,
                  })}
                >
                  {generateMutation.isPending && (
                    <ActivityIndicator color={colors.surface} />
                  )}
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    {generateMutation.isPending ? "Generating..." : "Generate Workout"}
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {/* Smart Next Workout */}
          {showSmartNext && (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 4,
                }}
              />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  marginBottom: 6,
                }}
              >
                Smart Next Workout
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 10 }}>
                Next in your split, adjusted for recovery and today’s constraints.
              </Text>

              <View style={{ gap: 10 }}>
                <View style={{ gap: 8 }}>
                  <Pressable
                    onPress={() => setSmartOptionsExpanded((prev) => !prev)}
                    style={({ pressed }) => ({
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    })}
                  >
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                        Options
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {smartSessionDuration} min •{" "}
                        {(EQUIPMENT_OPTIONS.find((e) => e.value === smartEquipment)?.label ?? "Any equipment")}
                        {smartAvoidMuscles.length > 0 ? ` • Sore: ${smartAvoidMuscles.length}` : ""}
                      </Text>
                    </View>
                    <Ionicons
                      name={smartOptionsExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </Pressable>

                  {smartOptionsExpanded && (
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceMuted,
                        gap: 10,
                      }}
                    >
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {DURATION_OPTIONS.map((minutes) => {
                          const isSelected = smartSessionDuration === minutes;
                          return (
                            <Pressable
                              key={minutes}
                              onPress={() => setSmartSessionDuration(minutes)}
                              disabled={generateMutation.isPending}
                              style={({ pressed }) => ({
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: isSelected ? colors.primary : colors.border,
                                backgroundColor: isSelected ? `${colors.primary}18` : colors.surface,
                                opacity: pressed || generateMutation.isPending ? 0.7 : 1,
                              })}
                            >
                              <Text
                                style={{
                                  color: isSelected ? colors.primary : colors.textPrimary,
                                  fontFamily: fontFamilies.semibold,
                                  fontSize: 13,
                                }}
                              >
                                {minutes} min
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {EQUIPMENT_OPTIONS.map((option) => {
                          const isSelected = smartEquipment === option.value;
                          return (
                            <Pressable
                              key={option.value}
                              onPress={() => setSmartEquipment(option.value)}
                              disabled={generateMutation.isPending}
                              style={({ pressed }) => ({
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: isSelected ? colors.primary : colors.border,
                                backgroundColor: isSelected ? `${colors.primary}18` : colors.surface,
                                opacity: pressed || generateMutation.isPending ? 0.7 : 1,
                              })}
                            >
                              <Text
                                style={{
                                  color: isSelected ? colors.primary : colors.textPrimary,
                                  fontFamily: fontFamilies.semibold,
                                  fontSize: 13,
                                }}
                              >
                                {option.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Pressable
                        onPress={() => setSmartSoreExpanded((prev) => !prev)}
                        style={({ pressed }) => ({
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: pressed ? colors.surface : colors.surfaceMuted,
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                        })}
                      >
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontFamily: fontFamilies.semibold,
                            fontSize: 13,
                          }}
                        >
                          Sore today
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                            {smartAvoidMuscles.length > 0 ? `${smartAvoidMuscles.length} selected` : "None"}
                          </Text>
                          <Ionicons
                            name={smartSoreExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={colors.textSecondary}
                          />
                        </View>
                      </Pressable>

                      {smartSoreExpanded && (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {MUSCLE_GROUPS.map((muscle) => {
                            const isSelected = smartAvoidMuscles.includes(muscle.value);
                            return (
                              <Pressable
                                key={muscle.value}
                                onPress={() => toggleAvoidMuscle(muscle.value)}
                                disabled={generateMutation.isPending}
                                style={({ pressed }) => ({
                                  paddingHorizontal: 12,
                                  paddingVertical: 10,
                                  borderRadius: 12,
                                  borderWidth: 1,
                                  borderColor: isSelected ? colors.primary : colors.border,
                                  backgroundColor: isSelected ? `${colors.primary}18` : colors.surface,
                                  opacity: pressed || generateMutation.isPending ? 0.7 : 1,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 6,
                                })}
                              >
                                <Text style={{ fontSize: 14 }}>{muscle.emoji}</Text>
                                <Text
                                  style={{
                                    color: isSelected ? colors.primary : colors.textPrimary,
                                    fontFamily: fontFamilies.semibold,
                                    fontSize: 13,
                                  }}
                                >
                                  {muscle.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    gap: 6,
                  }}
                >
                  {smartNextQuery.isLoading && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <ActivityIndicator color={colors.primary} />
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        Finding your best next session...
                      </Text>
                    </View>
                  )}

                  {smartNextQuery.isError && (
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      Couldn’t load a recommendation. You can still use Muscle Focus.
                    </Text>
                  )}

                  {smartNextQuery.data && (() => {
                    const options = [smartNextQuery.data.selected, ...smartNextQuery.data.alternates];
                    const effectiveSplitKey = manualSplitKey ?? smartNextQuery.data.selected.splitKey;
                    const effectiveLabel =
                      options.find((c) => c.splitKey === effectiveSplitKey)?.label ??
                      smartNextQuery.data.selected.label;
                    const effectiveEmoji = SPLIT_EMOJIS[effectiveSplitKey] ?? "🎯";
                    const effectiveReason =
                      options.find((c) => c.splitKey === effectiveSplitKey)?.reason ??
                      smartNextQuery.data.selected.reason;
                    const effectiveTags =
                      options.find((c) => c.splitKey === effectiveSplitKey)?.tags ??
                      smartNextQuery.data.selected.tags;

                    return (
                      <>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Text style={{ fontSize: 22 }}>{effectiveEmoji}</Text>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: colors.textPrimary,
                                fontFamily: fontFamilies.semibold,
                                fontSize: 16,
                              }}
                            >
                              Next: {effectiveLabel}
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                              {effectiveReason}
                            </Text>
                          </View>
                        </View>

                        {effectiveTags.length > 0 && (
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                            {effectiveTags.map((tag) => (
                              <View
                                key={tag}
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 999,
                                  backgroundColor: `${colors.primary}15`,
                                  borderWidth: 1,
                                  borderColor: `${colors.primary}25`,
                                }}
                              >
                                <Text style={{ color: colors.textPrimary, fontSize: 12 }}>
                                  {tag}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {smartNextQuery.data.alternates.length > 0 && (
                          <View style={{ marginTop: 10, gap: 8 }}>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              {smartNextQuery.data.alternates.map((alt) => {
                                const isSelected = manualSplitKey === alt.splitKey;
                                return (
                                  <Pressable
                                    key={alt.splitKey}
                                    onPress={() => setManualSplitKey(alt.splitKey)}
                                    style={({ pressed }) => ({
                                      flex: 1,
                                      padding: 12,
                                      borderRadius: 12,
                                      borderWidth: 1,
                                      borderColor: isSelected ? colors.primary : colors.border,
                                      backgroundColor: isSelected ? `${colors.primary}18` : colors.surface,
                                      opacity: pressed ? 0.8 : 1,
                                      gap: 2,
                                    })}
                                  >
                                    <Text
                                      style={{
                                        color: colors.textPrimary,
                                        fontFamily: fontFamilies.semibold,
                                        fontSize: 13,
                                      }}
                                    >
                                      {alt.label}
                                    </Text>
                                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                                      {alt.reason}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        )}

                        <Pressable
                          onPress={() => {
                            generateMutation.mutate({
                              split: effectiveSplitKey,
                              overrides: {
                                sessionDuration: smartSessionDuration,
                                availableEquipment: smartEquipment ? [smartEquipment] : undefined,
                                avoidMuscles: smartAvoidMuscles,
                              },
                            });
                          }}
                          disabled={generateMutation.isPending}
                          style={({ pressed }) => ({
                            marginTop: 12,
                            paddingVertical: 14,
                            borderRadius: 12,
                            backgroundColor: colors.primary,
                            alignItems: "center",
                            opacity: pressed || generateMutation.isPending ? 0.85 : 1,
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 10,
                          })}
                        >
                          {generateMutation.isPending && (
                            <ActivityIndicator color={colors.surface} />
                          )}
                          <Text
                            style={{
                              color: colors.surface,
                              fontFamily: fontFamilies.semibold,
                              fontSize: 16,
                            }}
                          >
                            {generateMutation.isPending
                              ? "Generating..."
                              : `Generate ${effectiveLabel}`}
                          </Text>
                        </Pressable>
                      </>
                    );
                  })()}
                </View>
              </View>
            </>
          )}

              </ScrollView>
              {showSmartBottomShadow && (
                <LinearGradient
                  colors={[
                    "transparent",
                    `${colors.surface}40`,
                    `${colors.surface}90`,
                    colors.surface,
                  ]}
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 42,
                    pointerEvents: "none",
                    zIndex: 2,
                  }}
                />
              )}
            </View>
          )}

          {/* Saved Workouts */}
          {showSaved && (
            <>
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  marginVertical: 8,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                  }}
                >
                  Saved Workouts
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {templates.length}{" "}
                  {templates.length === 1 ? "template" : "templates"}
                </Text>
              </View>
              <View
                style={{
                  position: "relative",
                  flex: 1,
                }}
              >
                {showSavedTopShadow && (
                  <LinearGradient
                    colors={[colors.surface, `${colors.surface}00`]}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 40,
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  />
                )}
                <FlatList
                  ref={savedListRef}
                  data={templates}
                  keyExtractor={(item) => item.id}
                  removeClippedSubviews={false}
                  renderItem={({ item: template }) => (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 12,
                      }}
                    >
                      <Pressable
                        style={{ flex: 1 }}
                        onPress={() => {
                          onSelect(template);
                          onClose();
                        }}
                      >
                        <View>
                          <Text
                            style={{
                              color: colors.textPrimary,
                              fontFamily: fontFamilies.semibold,
                              fontSize: 15,
                              marginBottom: 4,
                            }}
                          >
                            {template.name}
                          </Text>
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: 12,
                            }}
                          >
                            {template.exercises.length} exercises
                            {template.splitType && ` · ${template.splitType}`}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Alert.alert(
                            "Delete Workout",
                            `Are you sure you want to delete "${template.name}"? This cannot be undone.`,
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: async () => {
                                  try {
                                    await deleteTemplate(template.id);
                                    // Invalidate and refetch the templates query to update UI
                                    queryClient.invalidateQueries({
                                      queryKey: ["templates"],
                                    });
                                  } catch (error) {
                                    Alert.alert(
                                      "Error",
                                      "Failed to delete workout. Please try again."
                                    );
                                  }
                                },
                              },
                            ]
                          );
                        }}
                        style={({ pressed }) => ({
                          padding: 10,
                          borderRadius: 8,
                          backgroundColor: pressed
                            ? `${colors.border}50`
                            : "transparent",
                        })}
                      >
                        <Ionicons
                          name='trash-outline'
                          size={20}
                          color='#ef4444'
                        />
                      </Pressable>
                    </View>
                  )}
                  contentContainerStyle={{
                    paddingBottom: 12,
                    paddingTop: templateCount > 3 ? 12 : 6,
                    paddingHorizontal: 2,
                  }}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  bounces
                  overScrollMode='auto'
                  keyboardShouldPersistTaps='handled'
                  style={{ flex: 1 }}
                  onScroll={handleSavedScroll}
                  scrollEventThrottle={16}
                  onLayout={(e) => setSavedScrollLayoutHeight(e.nativeEvent.layout.height)}
                  onContentSizeChange={(_, height) => setSavedScrollContentHeight(height)}
                  scrollIndicatorInsets={{
                    right: 1,
                    bottom: safeBottomPadding,
                  }}
                  ListHeaderComponent={<View style={{ height: 4 }} />}
                  ListEmptyComponent={
                    <View
                      style={{
                        padding: 32,
                        alignItems: "center",
                        backgroundColor: colors.surfaceMuted,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderStyle: "dashed",
                      }}
                    >
                      <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                          marginBottom: 4,
                        }}
                      >
                        No saved workouts yet
                      </Text>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 13,
                          textAlign: "center",
                        }}
                      >
                        Create a workout template to get started
                      </Text>
                    </View>
                  }
                />
                {showSavedBottomShadow && (
                  <LinearGradient
                    colors={[
                      "transparent",
                      `${colors.surface}10`,
                      `${colors.surface}30`,
                      `${colors.surface}60`,
                      `${colors.surface}90`,
                      colors.surface,
                    ]}
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 80,
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  />
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default HomeScreen;
