import { useCallback, useMemo, useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  Platform,
  Text,
  View,
  ActivityIndicator,
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { WorkoutSession, WorkoutTemplate } from "../types/workouts";
import MuscleGroupBreakdown from "../components/MuscleGroupBreakdown";
import { generateWorkout } from "../api/ai";
import { deleteTemplate } from "../api/templates";
import { deleteSession, undoAutoEndSession } from "../api/sessions";
import { fetchRecap } from "../api/analytics";
import { useFatigue } from "../hooks/useFatigue";
import { endWorkoutLiveActivity } from "../services/liveActivity";
import { syncActiveSessionToWidget } from "../services/widgetSync";
import { cancelScheduledRestTimerFinishSound } from "../utils/timerSound";
import {
  TRAINING_SPLIT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
} from "../types/onboarding";
import RecoveryBodyMap from "../components/RecoveryBodyMap";
import TrialBanner from "../components/premium/TrialBanner";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
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
    }, [refetchFatigue])
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
            Renew your plan to unlock AI workouts, analytics, and progression.
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
              Built from your history. Swap for another saved workout anytime.
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate("WorkoutTemplateBuilder", {})}
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

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          {upNext ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...typography.heading2,
                      color: colors.textPrimary,
                    }}
                  >
                    {upNext.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {upNext.exercises.length} exercises ·{" "}
                    {upNext.splitType ?? "Custom"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSwapOpen(true)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.secondary,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.secondary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    Swap
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Chip label='Duration · 60-75m' />
                <Chip label={upNext.splitType ?? "Custom"} />
                <Chip label='Hypertrophy' />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => startWorkout(upNext)}
                  style={({ pressed }) => ({
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: "center",
                    flex: 1,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    Start workout
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    navigation.navigate("WorkoutTemplateBuilder", {
                      templateId: upNext.id,
                    })
                  }
                  style={({ pressed }) => ({
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    Edit
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                No saved workouts yet
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Choose how to get started with your first workout.
              </Text>
              <Pressable
                onPress={() => setSwapOpen(true)}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.surface,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Get Started
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <MuscleGroupBreakdown template={upNext} />

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
  { value: "shoulders", label: "Shoulders", emoji: "🏋️" },
  { value: "biceps", label: "Biceps", emoji: "💪" },
  { value: "triceps", label: "Triceps", emoji: "💪" },
];

const SPLIT_OPTIONS = [
  { value: "push", label: "Push", emoji: "💪" },
  { value: "pull", label: "Pull", emoji: "🦾" },
  { value: "legs", label: "Legs", emoji: "🦵" },
  { value: "upper", label: "Upper", emoji: "🏅" },
  { value: "lower", label: "Lower", emoji: "🔥" },
  { value: "full_body", label: "Full Body", emoji: "⚡" },
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
  const { user } = useCurrentUser();
  const { hasProAccess } = useSubscriptionAccess();
  const insets = useSafeAreaInsets();
  const [showSaved, setShowSaved] = useState(false);
  const [showMuscleFocus, setShowMuscleFocus] = useState(false);
  const [showAISplits, setShowAISplits] = useState(false);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [savedIsNearBottom, setSavedIsNearBottom] = useState(false);
  const [savedIsNearTop, setSavedIsNearTop] = useState(true);

  const isPro = hasProAccess;
  const templateCount = templates?.length ?? 0;
  const safeBottomPadding = Math.max(insets.bottom, 12);

  // Reset all state when modal is opened
  const resetModalState = () => {
    setShowSaved(false);
    setShowMuscleFocus(false);
    setShowAISplits(false);
    setSelectedMuscles([]);
    setSavedIsNearTop(true);
    setSavedIsNearBottom(false);
  };

  // Reset state when modal visibility changes
  useEffect(() => {
    if (visible) {
      resetModalState();
    }
  }, [visible]);

  useEffect(() => {
    if (showSaved) {
      setSavedIsNearTop(true);
      setSavedIsNearBottom(false);
    }
  }, [showSaved, templateCount]);

  const generateMutation = useMutation({
    mutationFn: async ({
      split,
      muscles,
    }: {
      split?: string;
      muscles?: string[];
    }) => {
      const workout = await generateWorkout({
        requestedSplit: split,
        specificRequest:
          muscles && muscles.length > 0
            ? `Focus on ${muscles.join(", ")}`
            : undefined,
      });
      return workout;
    },
    onSuccess: (workout) => {
      onClose();
      navigation.navigate("WorkoutPreview", { workout });
    },
    onError: (error: any) => {
      Alert.alert(
        "Generation Failed",
        error?.response?.data?.message ||
          "Failed to generate workout. Please try again."
      );
    },
  });

  const handleAIWorkout = (
    type: "muscle" | "split",
    showPaywallCallback: () => void
  ) => {
    if (!isPro) {
      showPaywallCallback();
      return;
    }

    if (type === "muscle") {
      setShowMuscleFocus(true);
      setShowSaved(false);
      setShowAISplits(false);
      setSelectedMuscles([]);
    } else {
      setShowAISplits(true);
      setShowSaved(false);
      setShowMuscleFocus(false);
    }
  };

  const toggleMuscle = (muscle: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    );
  };

  // Determine next workout in split cycle based on recent history
  const getNextInCycle = () => {
    const preferredSplit = user?.onboardingData?.preferredSplit;

    if (!preferredSplit) {
      return "Smart AI-generated workout";
    }

    // Map splits to readable cycle names
    const splitCycles: Record<string, string[]> = {
      ppl: ["Push", "Pull", "Legs"],
      upper_lower: ["Upper", "Lower"],
      full_body: ["Full Body"],
      bro_split: ["Chest", "Back", "Legs", "Shoulders", "Arms"],
    };

    const cycle = splitCycles[preferredSplit];
    if (cycle && cycle.length > 1) {
      return `Suggests next in ${cycle.join("/")} cycle`;
    }

    return "Optimized for your goals";
  };

  const handleSavedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromTop = contentOffset.y;
    const distanceFromBottom =
      contentSize.height - layoutMeasurement.height - contentOffset.y;

    setSavedIsNearTop(distanceFromTop < 10);
    setSavedIsNearBottom(distanceFromBottom < 10);
  };

  const showSavedTopShadow = templateCount > 0 && !savedIsNearTop;
  const showSavedBottomShadow = templateCount > 0 && !savedIsNearBottom;

  const actionOptions = [
    {
      label: "Smart Next Workout",
      helper: isPro ? getNextInCycle() : "AI-generated (Pro)",
      action: "ai" as const,
      icon: "🎯",
    },
    {
      label: "Muscle Focus",
      helper: isPro ? "Target specific muscles" : "AI muscle focus (Pro)",
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
    <Modal visible={visible} animationType='slide' transparent>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 16,
            paddingBottom: 16 + safeBottomPadding,
            maxHeight: "80%",
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
            marginBottom: -1,
          }}
        >
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

          {generateMutation.isPending && (
            <View
              style={{
                padding: 16,
                backgroundColor: colors.surfaceMuted,
                borderRadius: 12,
                alignItems: "center",
                gap: 8,
              }}
            >
              <ActivityIndicator color={colors.primary} size='large' />
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                Generating your personalized workout...
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                This may take 10-30 seconds
              </Text>
            </View>
          )}

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
                (option.action === "ai" && showAISplits);

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
                        setShowAISplits(false);
                        setSavedIsNearTop(true);
                        setSavedIsNearBottom(false);
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
                    if (option.action === "ai") {
                      if (showAISplits) {
                        // Toggle off
                        setShowAISplits(false);
                      } else {
                        handleAIWorkout("split", showPaywallModal);
                      }
                      return;
                    }
                  }}
                  style={({ pressed }) => ({
                    width: "48%",
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
                      {!isPro &&
                        (option.action === "muscle" ||
                          option.action === "ai") && (
                          <View
                            style={{
                              backgroundColor: colors.primary,
                              paddingHorizontal: 5,
                              paddingVertical: 2,
                              borderRadius: 4,
                            }}
                          >
                            <Text
                              style={{
                                color: "#0B1220",
                                fontSize: 8,
                                fontWeight: "700",
                              }}
                            >
                              PRO
                            </Text>
                          </View>
                        )}
                    </View>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 11,
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
                    opacity: pressed || generateMutation.isPending ? 0.8 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    Generate Workout
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {/* AI Split Selection */}
          {showAISplits && (
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
                  marginBottom: 8,
                }}
              >
                Select workout split
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SPLIT_OPTIONS.map((split) => (
                  <Pressable
                    key={split.value}
                    onPress={() => {
                      generateMutation.mutate({ split: split.value });
                    }}
                    disabled={generateMutation.isPending}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.primary,
                      backgroundColor: colors.surfaceMuted,
                      opacity: pressed || generateMutation.isPending ? 0.6 : 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 100,
                    })}
                  >
                    <Text style={{ fontSize: 18 }}>{split.emoji}</Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                      }}
                    >
                      {split.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
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
                  height: 420 + safeBottomPadding,
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
                  data={templates}
                  keyExtractor={(item) => item.id}
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
                    paddingBottom: 48 + safeBottomPadding,
                    paddingTop: templateCount > 3 ? 12 : 4,
                    paddingHorizontal: 2,
                  }}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  style={{ maxHeight: 420 + safeBottomPadding }}
                  onScroll={handleSavedScroll}
                  scrollEventThrottle={16}
                  scrollIndicatorInsets={{
                    right: 1,
                    bottom: safeBottomPadding,
                  }}
                  ListHeaderComponent={<View style={{ height: 4 }} />}
                  ListFooterComponent={
                    <View style={{ height: safeBottomPadding + 64 }} />
                  }
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
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default HomeScreen;
