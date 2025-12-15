import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Linking,
  AppState,
  NativeModules,
  PanResponder,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import ScreenContainer from "../components/layout/ScreenContainer";
import {
  completeSession,
  fetchSession,
  startSessionFromTemplate,
  updateSession,
} from "../api/sessions";
import { API_BASE_URL } from "../api/client";
import { RootRoute, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { SetDifficultyRating, WorkoutSet, ExerciseDetails } from "../types/workouts";
import { fetchExerciseDetails } from "../api/exercises";
import { templatesKey, useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useActiveWorkoutStatus } from "../hooks/useActiveWorkoutStatus";
import { fatigueQueryKey, recommendationsQueryKey } from "../hooks/useFatigue";
import { Visibility } from "../types/social";
import MuscleGroupBreakdown from "../components/MuscleGroupBreakdown";
import ExerciseSwapModal from "../components/workouts/ExerciseSwapModal";
import TimerAdjustmentModal from "../components/workouts/TimerAdjustmentModal";
import ExercisePicker from "../components/workouts/ExercisePicker";
import ProgressionSuggestionModal, {
  ProgressionData,
} from "../components/ProgressionSuggestion";
import {
  fetchProgressionSuggestions,
  applyProgressionSuggestions,
  fetchStartingSuggestion,
} from "../api/analytics";
import { useCurrentUser } from "../hooks/useCurrentUser";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import {
  cancelScheduledRestTimerFinishSound,
  playTimerHaptics,
  playTimerSound,
  scheduleRestTimerFinishSound,
} from "../utils/timerSound";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
import { syncActiveSessionToWidget } from "../services/widgetSync";
import { exportWorkoutToAppleHealth } from "../services/appleHealth";
import {
  startWorkoutLiveActivity,
  updateWorkoutLiveActivity,
  endWorkoutLiveActivityForSession,
  endWorkoutLiveActivityWithSummary,
  addLogSetListener,
} from "../services/liveActivity";
import {
  getStoredShowWarmupSets,
  setStoredShowWarmupSets,
} from "../utils/warmupPreference";
import { useMuscleGroupDistribution } from "../hooks/useMuscleGroupDistribution";
import { formatMuscleGroup, getTopMuscleGroups } from "../utils/muscleGroupCalculations";
import { getWarmupSuggestionsForMuscleGroups } from "../utils/warmupSuggestions";
import { StartingSuggestion } from "../types/analytics";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const DEFAULT_WORKING_REST_SECONDS = 90; // Increased from 75s to 90s for better recovery
const DEFAULT_WARMUP_REST_SECONDS = 45; // Shorter rest for warm-up sets
const DEFAULT_HEAVY_REST_SECONDS = 180; // 3 minutes for heavy sets (>85% estimated 1RM)

const visibilityOptions: {
  value: Visibility;
  label: string;
  helper: string;
}[] = [
  { value: "private", label: "Private", helper: "Only you can see." },
  {
    value: "followers",
    label: "Friends",
    helper: "Gym buddies who follow back.",
  },
  { value: "squad", label: "Squad", helper: "Friends + squads" },
];

const VisibilityModal = ({
  visible,
  value,
  onChange,
  onClose,
  disabled,
}: {
  visible: boolean;
  value: Visibility;
  onChange: (next: Visibility) => void;
  onClose: () => void;
  disabled?: boolean;
}) => (
  <Modal visible={visible} transparent animationType='fade'>
    <Pressable
      onPress={onClose}
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Pressable
        onPress={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 18,
              fontWeight: "700",
            }}
          >
            Live visibility
          </Text>
          <Pressable onPress={onClose}>
            <Ionicons name='close' color={colors.textSecondary} size={20} />
          </Pressable>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Choose who sees you working out. Nothing is public by default.
        </Text>
        {visibilityOptions.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              onPress={() => {
                onChange(option.value);
                onClose();
              }}
              style={({ pressed }) => ({
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active
                  ? "rgba(34,197,94,0.12)"
                  : colors.surfaceMuted,
                opacity: disabled || pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: active ? colors.primary : colors.textPrimary,
                  fontWeight: "700",
                }}
              >
                {option.label}
              </Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                {option.helper}
              </Text>
            </Pressable>
          );
        })}
      </Pressable>
    </Pressable>
  </Modal>
);

// Exercise Instructions Modal
const ExerciseInstructionsModal = ({
  visible,
  exerciseId,
  exerciseName,
  onClose,
}: {
  visible: boolean;
  exerciseId: string | null;
  exerciseName: string | null;
  onClose: () => void;
}) => {
  const [details, setDetails] = useState<ExerciseDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && exerciseId) {
      setLoading(true);
      setError(null);
      fetchExerciseDetails(exerciseId)
        .then((data) => {
          setDetails(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch exercise details:", err);
          setError("Could not load instructions");
          setLoading(false);
        });
    } else if (!visible) {
      // Reset when modal closes
      setDetails(null);
      setError(null);
    }
  }, [visible, exerciseId]);

  const formatMuscle = (muscle: string) =>
    muscle.charAt(0).toUpperCase() + muscle.slice(1).replace(/_/g, " ");

  return (
    <Modal visible={visible} transparent animationType="slide">
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
            maxHeight: "85%",
            borderWidth: 1,
            borderColor: colors.border,
            width: "100%",
            flexShrink: 1,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: "800",
                }}
                numberOfLines={2}
              >
                {exerciseName ?? "Exercise"}
              </Text>
              {details?.level && (
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  {details.level.charAt(0).toUpperCase() + details.level.slice(1)} •{" "}
                  {details.mechanic ?? "—"} • {details.equipment ?? "—"}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              style={{
                padding: 8,
                borderRadius: 20,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Ionicons name="close" color={colors.textSecondary} size={20} />
            </Pressable>
          </View>

          {/* Content */}
          <ScrollView
            style={{ maxHeight: "100%" }}
            contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 0 }}
            showsVerticalScrollIndicator
            bounces
          >
            {loading ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
                  Loading instructions...
                </Text>
              </View>
            ) : error ? (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
                  {error}
                </Text>
              </View>
            ) : details ? (
              <View style={{ gap: 20 }}>
                {/* Muscles */}
                {(details.primaryMuscles.length > 0 || details.secondaryMuscles.length > 0) && (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                      Muscles Worked
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {details.primaryMuscles.map((muscle) => (
                        <View
                          key={muscle}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            backgroundColor: `${colors.primary}20`,
                            borderWidth: 1,
                            borderColor: `${colors.primary}40`,
                          }}
                        >
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "600" }}>
                            {formatMuscle(muscle)}
                          </Text>
                        </View>
                      ))}
                      {details.secondaryMuscles.map((muscle) => (
                        <View
                          key={muscle}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 5,
                            borderRadius: 8,
                            backgroundColor: colors.surfaceMuted,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>
                            {formatMuscle(muscle)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Instructions */}
                {details.instructions.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>
                      How to Perform
                    </Text>
                    {details.instructions.map((instruction, index) => (
                      <View
                        key={index}
                        style={{
                          flexDirection: "row",
                          gap: 12,
                          alignItems: "flex-start",
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: `${colors.primary}20`,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: colors.primary,
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            {index + 1}
                          </Text>
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            color: colors.textPrimary,
                            fontSize: 14,
                            lineHeight: 20,
                          }}
                        >
                          {instruction}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ alignItems: "center", paddingVertical: 20 }}>
                    <Ionicons name="document-text-outline" size={32} color={colors.textSecondary} />
                    <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
                      No detailed instructions available for this exercise.
                    </Text>
                  </View>
                )}
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const summarizeSets = (sessionSets: WorkoutSet[]) => {
  const workingSets = sessionSets.filter((set) => set.setKind !== "warmup");
  const totalSets = workingSets.length;
  const totalVolume = workingSets.reduce((acc, cur) => {
    const reps = cur.actualReps ?? 0;
    const weight = cur.actualWeight ?? 0;
    return acc + reps * weight;
  }, 0);
  const prCount = workingSets.filter(
    (set) =>
      set.actualWeight !== undefined &&
      set.targetWeight !== undefined &&
      set.actualWeight > set.targetWeight
  ).length;

  return {
    totalSets,
    totalVolume: totalVolume > 0 ? totalVolume : undefined,
    prCount: prCount > 0 ? prCount : undefined,
  };
};

const formatStopwatch = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return hrs > 0
    ? `${hrs}:${two(mins)}:${two(secs)}`
    : `${two(mins)}:${two(secs)}`;
};

const formatSeconds = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(mins)}:${two(secs)}`;
};

const formatExerciseName = (id: string) =>
  id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

// Helper to identify cardio exercises
const isCardioExercise = (
  exerciseId: string,
  exerciseName?: string
): boolean => {
  const name = (exerciseName || exerciseId).toLowerCase();
  const cardioKeywords = [
    "treadmill",
    "running",
    "jogging",
    "walking",
    "bike",
    "cycling",
    "bicycle",
    "biking",
    "rowing",
    "rower",
    "elliptical",
    "stair",
    "stepper",
    "swimming",
    "swim",
    "jumping rope",
    "jump rope",
    "air bike",
  ];
  return cardioKeywords.some((keyword) => name.includes(keyword));
};

const resolveExerciseImageUri = (uri?: string) => {
  if (!uri) return undefined;
  if (uri.startsWith("http")) return uri;
  return `${API_BASE_URL.replace(/\/api$/, "")}${uri}`;
};

type ExerciseGroup = {
  key: string;
  exerciseId: string;
  name: string;
  imageUrl?: string;
  sets: WorkoutSet[];
  restSeconds?: number;
};

const groupSetsByExercise = (
  sessionSets: WorkoutSet[],
  restLookup?: Record<string, number | undefined>,
  sessionRestTimes?: Record<string, number>
): ExerciseGroup[] => {
  const grouped = new Map<string, ExerciseGroup>();
  sessionSets.forEach((set) => {
    const key = set.templateExerciseId ?? set.exerciseId;
    const resolved: ExerciseGroup = grouped.get(key) ?? {
      key,
      exerciseId: set.exerciseId,
      name: set.exerciseName ?? formatExerciseName(set.exerciseId),
      imageUrl: resolveExerciseImageUri(set.exerciseImageUrl),
      sets: [],
      restSeconds:
        sessionRestTimes?.[key] ?? // Prioritize session-specific rest times
        restLookup?.[key] ??
        restLookup?.[set.exerciseId] ??
        set.targetRestSeconds,
    };
    if (!resolved.restSeconds) {
      resolved.restSeconds =
        sessionRestTimes?.[key] ??
        restLookup?.[key] ??
        restLookup?.[set.exerciseId] ??
        set.targetRestSeconds;
    }
    resolved.sets.push(set);
    grouped.set(key, resolved);
  });
  return Array.from(grouped.values()).map((group) => ({
    ...group,
    sets: [...group.sets].sort((a, b) => a.setIndex - b.setIndex),
  }));
};

const trimCardioSetsToSingle = (sessionSets: WorkoutSet[]) => {
  const grouped = new Map<string, WorkoutSet[]>();
  sessionSets.forEach((set) => {
    const key = set.templateExerciseId ?? set.exerciseId;
    const list = grouped.get(key) ?? [];
    list.push(set);
    grouped.set(key, list);
  });

  const keepIds = new Set<string>();
  grouped.forEach((groupSets) => {
    const sorted = [...groupSets].sort((a, b) => a.setIndex - b.setIndex);
    const representative = sorted[0];
    if (!representative) return;

    const cardio = isCardioExercise(
      representative.exerciseId,
      representative.exerciseName
    );

    if (cardio) {
      keepIds.add(representative.id);
      return;
    }

    sorted.forEach((set) => keepIds.add(set.id));
  });

  return sessionSets.filter((set) => keepIds.has(set.id));
};

const WorkoutSessionScreen = () => {
  const route = useRoute<RootRoute<"WorkoutSession">>();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [sessionId, setSessionId] = useState(route.params.sessionId);
  const [hasHydratedSession, setHasHydratedSession] = useState(false);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [startTime, setStartTime] = useState<string | undefined>(undefined);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [elapsedBaseSeconds, setElapsedBaseSeconds] = useState(0);
  const [timerAnchor, setTimerAnchor] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [timerLocked, setTimerLocked] = useState(false);
  const [activeExerciseKey, setActiveExerciseKey] = useState<string | null>(
    null
  );
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [autoRestTimer, setAutoRestTimer] = useState(true);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [loggedSetIds, setLoggedSetIds] = useState<Set<string>>(new Set());
  const [lastLoggedSetId, setLastLoggedSetId] = useState<string | null>(null);
  const [pendingDifficultyFeedbackKey, setPendingDifficultyFeedbackKey] = useState<string | null>(null);
  const [autoFocusEnabled, setAutoFocusEnabled] = useState(true);
  const [swapExerciseKey, setSwapExerciseKey] = useState<string | null>(null);
  const [timerAdjustExerciseKey, setTimerAdjustExerciseKey] = useState<
    string | null
  >(null);
  const [sessionRestTimes, setSessionRestTimes] = useState<
    Record<string, number>
  >({});
  const [sessionWarmupRestTimes, setSessionWarmupRestTimes] = useState<
    Record<string, number>
  >({});
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showTopGradient, setShowTopGradient] = useState(false);
  const [showBottomGradient, setShowBottomGradient] = useState(true);
  const [progressionData, setProgressionData] =
    useState<ProgressionData | null>(null);
  const [showProgressionModal, setShowProgressionModal] = useState(false);
  const [progressionChecked, setProgressionChecked] = useState(false);
  const [progressionModalBlockingTimer, setProgressionModalBlockingTimer] =
    useState(false);
  const [isUpdatingProgressionSetting, setIsUpdatingProgressionSetting] =
    useState(false);
  const [progressionModalAcknowledged, setProgressionModalAcknowledged] =
    useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<
    "progression" | "analytics"
  >("progression");
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showWarmupSets, setShowWarmupSets] = useState(true);
  const [instructionsExercise, setInstructionsExercise] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [hasHydratedWarmupPreference, setHasHydratedWarmupPreference] =
    useState(false);
  const { data: templates } = useWorkoutTemplates();
  const { user, updateProfile } = useCurrentUser();
  const subscriptionAccess = useSubscriptionAccess();

  // Refs to access latest state in deep link handler without causing re-renders
  const activeSetIdRef = useRef<string | null>(null);
  const setsRef = useRef<WorkoutSet[]>([]);
  const sessionRestTimesRef = useRef<Record<string, number>>({});
  const sessionWarmupRestTimesRef = useRef<Record<string, number>>({});
  const loggedSetIdsRef = useRef<Set<string>>(new Set());
  // Lock to prevent duplicate processing of pending log set actions
  const isProcessingLogSetRef = useRef<boolean>(false);
  // Track the last processed timestamp to prevent duplicate processing
  const lastProcessedTimestampRef = useRef<number>(0);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosavePromiseRef = useRef<Promise<void> | null>(null);
  const lastSavedSetsFingerprintRef = useRef<string>("");
  const isEndingSessionRef = useRef<boolean>(false);
  const autosaveRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autosaveRetryAttemptsRef = useRef<number>(0);
  const timerLockedRef = useRef<boolean>(false);
  const previousRestEndsAtRef = useRef<number | null>(null);
  const nativeScheduledRestEndsAtRef = useRef<number | null>(null);
  const exercisesListRef = useRef<any>(null);
  const shouldAutoScrollToActiveExerciseRef = useRef(false);
  const hasUserChangedWarmupPreferenceRef = useRef(false);
  const startingSuggestionFetchRef = useRef<Set<string>>(new Set());
  const [startingSuggestions, setStartingSuggestions] = useState<
    Record<string, StartingSuggestion>
  >({});

  // Keep refs in sync with state
  useEffect(() => {
    activeSetIdRef.current = activeSetId;
  }, [activeSetId]);

  useEffect(() => {
    setsRef.current = sets;
  }, [sets]);

  useEffect(() => {
    sessionRestTimesRef.current = sessionRestTimes;
  }, [sessionRestTimes]);

  useEffect(() => {
    sessionWarmupRestTimesRef.current = sessionWarmupRestTimes;
  }, [sessionWarmupRestTimes]);

  useEffect(() => {
    loggedSetIdsRef.current = loggedSetIds;
  }, [loggedSetIds]);

  useEffect(() => {
    timerLockedRef.current = timerLocked;
  }, [timerLocked]);

  // Check if user currently has Pro access (blocks grace/expired)
  const isPro = subscriptionAccess.hasProAccess;

  const template = useMemo(
    () => templates?.find((t) => t.id === route.params.templateId),
    [templates, route.params.templateId]
  );

  const { distribution: muscleDistribution } = useMuscleGroupDistribution(template);
  const warmupSuggestions = useMemo(() => {
    const topMuscles = getTopMuscleGroups(muscleDistribution, 2).map(
      (group) => group.muscleGroup
    );
    return getWarmupSuggestionsForMuscleGroups(topMuscles, { maxSuggestions: 4 });
  }, [muscleDistribution]);

  const warmupTargetsLabel = useMemo(() => {
    const topMuscles = getTopMuscleGroups(muscleDistribution, 2)
      .map((group) => group.muscleGroup)
      .filter(Boolean);
    if (topMuscles.length === 0) return "Warm up";
    return `Warm up ${topMuscles.map(formatMuscleGroup).join(" + ")}`;
  }, [muscleDistribution]);

  const restLookup = useMemo(() => {
    if (!template) return {};
    const lookup: Record<string, number | undefined> = {};
    template.exercises.forEach((ex) => {
      lookup[ex.id] = ex.defaultRestSeconds;
      lookup[ex.exerciseId] = ex.defaultRestSeconds;
    });
    return lookup;
  }, [template]);

  const queryClient = useQueryClient();

  const edgeSwipePanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          if (gestureState.dx <= 0) return false;
          if (Math.abs(gestureState.dy) > 24) return false;
          return gestureState.dx > 14;
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dx > 80 && gestureState.vx > 0.2) {
            navigation.goBack();
          }
        },
      }),
    [navigation]
  );

  const buildSetsFingerprint = useCallback((currentSets: WorkoutSet[]) => {
    return currentSets
      .map((set) =>
        [
          set.id,
          set.setIndex,
          set.actualReps ?? "",
          set.actualWeight ?? "",
          set.actualDistance ?? "",
          set.actualIncline ?? "",
          set.actualDurationMinutes ?? "",
          set.rpe ?? "",
        ].join(":")
      )
      .join("|");
  }, []);

  const persistSessionSets = useCallback(
    async ({ force }: { force?: boolean } = {}) => {
      if (!sessionId) return;
      if (isEndingSessionRef.current) return;

      const currentSets = setsRef.current;
      const fingerprint = buildSetsFingerprint(currentSets);
      if (!force && fingerprint === lastSavedSetsFingerprintRef.current) {
        return;
      }

      if (autosavePromiseRef.current) {
        return autosavePromiseRef.current;
      }

      if (autosaveRetryTimeoutRef.current) {
        clearTimeout(autosaveRetryTimeoutRef.current);
        autosaveRetryTimeoutRef.current = null;
      }

      autosavePromiseRef.current = updateSession(sessionId, {
        sets: currentSets,
      }, { timeoutMs: 45000 })
        .then(() => {
          autosaveRetryAttemptsRef.current = 0;
          lastSavedSetsFingerprintRef.current = fingerprint;
          queryClient.setQueryData(["activeSession"], (prev: any) => {
            if (!prev?.session) return prev;
            return {
              ...prev,
              session: {
                ...prev.session,
                sets: currentSets,
              },
            };
          });
        })
        .catch((err) => {
          console.error("❌ Failed to autosave workout sets:", err);

          const attempts = autosaveRetryAttemptsRef.current;
          if (attempts < 2) {
            autosaveRetryAttemptsRef.current = attempts + 1;
            const delayMs = attempts === 0 ? 3000 : 10000;
            autosaveRetryTimeoutRef.current = setTimeout(() => {
              void persistSessionSets({ force: true });
            }, delayMs);
          }
        })
        .finally(() => {
          autosavePromiseRef.current = null;
        });

      return autosavePromiseRef.current;
    },
    [buildSetsFingerprint, queryClient, sessionId]
  );

  const scheduleAutosave = useCallback(() => {
    if (!sessionId || !hasHydratedSession) return;
    if (isEndingSessionRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      void persistSessionSets();
    }, 2500);
  }, [hasHydratedSession, persistSessionSets, sessionId]);

  const flushAutosave = useCallback(async (): Promise<boolean> => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    let success = true;
    try {
      await persistSessionSets({ force: true });
    } catch {
      // Keep workout active; user can resume and retry saving.
      success = false;
    }

    if (autosavePromiseRef.current) {
      try {
        await autosavePromiseRef.current;
      } catch {
        // ignore
        success = false;
      }
    }

    return success;
  }, [persistSessionSets]);

  useEffect(() => {
    scheduleAutosave();
  }, [sets, scheduleAutosave]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        void flushAutosave();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [flushAutosave]);

  useEffect(
    () => () => {
      if (!sessionId) return;
      if (isEndingSessionRef.current) return;
      void flushAutosave();
    },
    [flushAutosave, sessionId]
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("blur", () => {
      if (!sessionId) return;
      if (isEndingSessionRef.current) return;
      void flushAutosave();
    });

    return unsubscribe;
  }, [flushAutosave, navigation, sessionId]);

  const getLoggedSetIdsKey = useCallback(
    (activeSessionId: string) => `workout_logged_set_ids:${activeSessionId}`,
    []
  );

  const loadPersistedLoggedSetIds = useCallback(
    async (activeSessionId: string) => {
      try {
        const raw = await AsyncStorage.getItem(
          getLoggedSetIdsKey(activeSessionId)
        );
        if (!raw) return new Set<string>();
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return new Set<string>();
        return new Set<string>(parsed.filter((v) => typeof v === "string"));
      } catch {
        return new Set<string>();
      }
    },
    [getLoggedSetIdsKey]
  );

  const persistLoggedSetIds = useCallback(
    async (activeSessionId: string, ids: Set<string>) => {
      try {
        await AsyncStorage.setItem(
          getLoggedSetIdsKey(activeSessionId),
          JSON.stringify(Array.from(ids))
        );
      } catch {
        // Ignore persistence failures; logging still works in-memory.
      }
    },
    [getLoggedSetIdsKey]
  );

  const clearPersistedLoggedSetIds = useCallback(
    async (activeSessionId: string) => {
      try {
        await AsyncStorage.removeItem(getLoggedSetIdsKey(activeSessionId));
      } catch {
        // ignore
      }
    },
    [getLoggedSetIdsKey]
  );

  useEffect(() => {
    if (!sessionId) return;
    const timeout = setTimeout(() => {
      void persistLoggedSetIds(sessionId, loggedSetIdsRef.current);
    }, 250);
    return () => clearTimeout(timeout);
  }, [sessionId, loggedSetIds, persistLoggedSetIds]);

  useEffect(() => {
    lastSavedSetsFingerprintRef.current = "";
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    if (autosaveRetryTimeoutRef.current) {
      clearTimeout(autosaveRetryTimeoutRef.current);
      autosaveRetryTimeoutRef.current = null;
    }
    autosavePromiseRef.current = null;
    autosaveRetryAttemptsRef.current = 0;
  }, [sessionId]);

  const initializeTimer = (
    {
      startedAt,
      finishedAt,
      durationSeconds,
    }: {
      startedAt: string;
      finishedAt?: string;
      durationSeconds?: number;
    },
    autoStart?: boolean
  ) => {
    const startedAtMs = new Date(startedAt).getTime();
    const finishedAtMs = finishedAt ? new Date(finishedAt).getTime() : null;

    const derivedBaseSeconds =
      typeof durationSeconds === "number" &&
      Number.isFinite(durationSeconds) &&
      durationSeconds >= 0
        ? Math.floor(durationSeconds)
        : finishedAtMs !== null &&
          Number.isFinite(finishedAtMs) &&
          Number.isFinite(startedAtMs)
        ? Math.max(0, Math.floor((finishedAtMs - startedAtMs) / 1000))
        : Number.isFinite(startedAtMs)
        ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
        : 0;

    const shouldAutoStart = autoStart ?? !finishedAt;
    const nextLocked = Boolean(finishedAt);

    timerLockedRef.current = nextLocked;
    setTimerLocked(nextLocked);
    setStartTime(startedAt);
    setElapsedBaseSeconds(derivedBaseSeconds);
    setElapsedSeconds(derivedBaseSeconds);

    if (nextLocked || !shouldAutoStart) {
      setTimerAnchor(null);
      setTimerActive(false);
      return;
    }

    setTimerAnchor(Date.now());
    setTimerActive(true);
  };

  const pauseTimer = () => {
    if (!timerActive && timerAnchor === null) {
      return;
    }
    const elapsedSinceAnchor =
      timerAnchor !== null
        ? Math.max(0, Math.floor((Date.now() - timerAnchor) / 1000))
        : 0;
    const nextBase = elapsedBaseSeconds + elapsedSinceAnchor;
    setElapsedBaseSeconds(nextBase);
    setElapsedSeconds(nextBase);
    setTimerAnchor(null);
    setTimerActive(false);
  };

  const resumeTimer = () => {
    if (timerLockedRef.current) return;
    if (timerActive) return;
    setTimerAnchor(Date.now());
    setTimerActive(true);
  };

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchSession(sessionId!),
    onError: () => {
      Alert.alert("Could not load workout", "Please try again.");
      navigation.goBack();
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startSessionFromTemplate(route.params.templateId),
    onSuccess: (session) => {
      const trimmedSets = trimCardioSetsToSingle(session.sets);
      setSessionId(session.id);
      setSets(trimmedSets);
      initializeTimer({ startedAt: session.startedAt });
      setHasHydratedSession(true);
      queryClient.setQueryData(["activeSession"], {
        session: { ...session, sets: trimmedSets },
        autoEndedSession: null,
      });
    },
    onError: () => {
      Alert.alert("Could not start session", "Please try again.");
      navigation.goBack();
    },
  });

  const applyProgressionWeightsToSession = useCallback(
    (
      exerciseIds?: string[],
      { persist }: { persist?: boolean } = {}
    ) => {
      if (!progressionData) return;

      const suggestions = progressionData.suggestions.filter((suggestion) => {
        if (suggestion.increment === 0) return false;
        if (!exerciseIds) return true;
        return exerciseIds.includes(suggestion.exerciseId);
      });

      if (suggestions.length === 0) return;

      const suggestedWeightByExerciseId = new Map(
        suggestions.map((suggestion) => [
          suggestion.exerciseId,
          suggestion.suggestedWeight,
        ])
      );

      const currentLoggedSetIds = loggedSetIdsRef.current;
      const currentSets = setsRef.current;

      const updatedSets = currentSets.map((set) => {
        const suggestedWeight = suggestedWeightByExerciseId.get(set.exerciseId);
        if (suggestedWeight === undefined) return set;
        if (currentLoggedSetIds.has(set.id)) return set;

        const previousTargetWeight = set.targetWeight;
        const shouldUpdateActualWeight =
          set.actualWeight === undefined || set.actualWeight === previousTargetWeight;

        return {
          ...set,
          targetWeight: suggestedWeight,
          actualWeight: shouldUpdateActualWeight ? suggestedWeight : set.actualWeight,
        };
      });

      setsRef.current = updatedSets;
      setSets(updatedSets);

      queryClient.setQueryData(["activeSession"], (prev: any) => {
        if (!prev?.session) return prev;
        return {
          ...prev,
          session: {
            ...prev.session,
            sets: updatedSets,
          },
        };
      });

      if (sessionId) {
        queryClient.setQueryData(["session", sessionId], (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            sets: updatedSets,
          };
        });
      }

      if (persist) {
        void persistSessionSets({ force: true });
      }
    },
    [persistSessionSets, progressionData, queryClient, sessionId]
  );

  const applyProgressionMutation = useMutation({
    mutationFn: (exerciseIds?: string[]) =>
      applyProgressionSuggestions(route.params.templateId, exerciseIds),
    onMutate: (exerciseIds?: string[]) => {
      const previousSets = setsRef.current;
      applyProgressionWeightsToSession(exerciseIds);
      return { previousSets };
    },
    onSuccess: (result, exerciseIds) => {
      setShowProgressionModal(false);
      applyProgressionWeightsToSession(exerciseIds, { persist: true });
      queryClient.invalidateQueries({ queryKey: templatesKey });
      Alert.alert(
        "Progression Applied",
        `Updated ${result.updated} exercise${
          result.updated === 1 ? "" : "s"
        } in your template. Your current workout weights were updated too.`,
        [{ text: "Got it" }]
      );
      // Optionally refresh the template
      // refetch templates if needed
    },
    onError: (_err, _exerciseIds, context) => {
      if (context?.previousSets) {
        setsRef.current = context.previousSets;
        setSets(context.previousSets);
        queryClient.setQueryData(["activeSession"], (prev: any) => {
          if (!prev?.session) return prev;
          return {
            ...prev,
            session: {
              ...prev.session,
              sets: context.previousSets,
            },
          };
        });
        if (sessionId) {
          queryClient.setQueryData(["session", sessionId], (prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              sets: context.previousSets,
            };
          });
        }
      }
      Alert.alert(
        "Could not apply progression",
        "Please try again or update weights manually."
      );
    },
  });

  useEffect(() => {
    if (!route.params.sessionId) {
      startMutation.mutate();
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !sessionQuery.data || hasHydratedSession) return;
    const data = sessionQuery.data;
    let cancelled = false;

    void (async () => {
      const trimmedSets = trimCardioSetsToSingle(data.sets);
      setSets(trimmedSets);
      initializeTimer({
        startedAt: data.startedAt,
        finishedAt: data.finishedAt,
        durationSeconds: data.durationSeconds,
      });
      queryClient.setQueryData(["activeSession"], {
        session: { ...data, sets: trimmedSets },
        autoEndedSession: null,
      });

      const validSetIds = new Set(data.sets.map((set) => set.id));
      const persisted = await loadPersistedLoggedSetIds(sessionId);
      if (cancelled) return;

      const filtered = new Set<string>();
      persisted.forEach((id) => {
        if (validSetIds.has(id)) filtered.add(id);
      });

      loggedSetIdsRef.current = filtered;
      setLoggedSetIds(filtered);
      setHasHydratedSession(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    sessionQuery.data,
    hasHydratedSession,
    queryClient,
    loadPersistedLoggedSetIds,
  ]);

  const isBootstrappingSession = route.params.sessionId
    ? !hasHydratedSession
    : startMutation.isPending || !sessionId;

  useEffect(() => {
    if (!timerActive || timerAnchor === null) {
      return;
    }
    const tick = () => {
      const runningSeconds = Math.max(
        0,
        Math.floor((Date.now() - timerAnchor) / 1000)
      );
      setElapsedSeconds(elapsedBaseSeconds + runningSeconds);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timerActive, timerAnchor, elapsedBaseSeconds]);

  useEffect(() => {
    if (timerActive) return;
    setElapsedSeconds(elapsedBaseSeconds);
  }, [timerActive, elapsedBaseSeconds]);

  // Check for progression suggestions when session starts
  useEffect(() => {
    const checkProgression = async () => {
      // Only check once per session load
      if (progressionChecked || !route.params.templateId || !sessionId) return;

      // Check if user has Pro access
      if (!isPro) {
        setProgressionChecked(true);
        return;
      }

      // Check user and template settings
      const userEnabled = user?.progressiveOverloadEnabled !== false;
      const templateEnabled = template?.progressiveOverloadEnabled !== false;

      if (!userEnabled || !templateEnabled) {
        setProgressionChecked(true);
        return;
      }

      try {
        const data = await fetchProgressionSuggestions(route.params.templateId);

        // Only show if we have significant data and suggestions
        if (data.hasSignificantData && data.readyForProgression) {
          setProgressionData(data);
          setProgressionModalAcknowledged(false);
          // Small delay to let the workout screen render first
          setTimeout(() => setShowProgressionModal(true), 1500);
        }
      } catch (err) {
        console.error("Failed to fetch progression suggestions:", err);
      } finally {
        setProgressionChecked(true);
      }
    };

    checkProgression();
  }, [
    sessionId,
    route.params.templateId,
    progressionChecked,
    user,
    template,
    isPro,
  ]);

  useEffect(() => {
    if (showProgressionModal && !progressionModalAcknowledged) {
      if (!progressionModalBlockingTimer) {
        pauseTimer();
        setElapsedBaseSeconds(0);
        setElapsedSeconds(0);
        setTimerAnchor(null);
        setTimerActive(false);
        setProgressionModalBlockingTimer(true);
      }
      return;
    }

    if (!showProgressionModal && progressionModalBlockingTimer) {
      resumeTimer();
      setProgressionModalBlockingTimer(false);
    }
  }, [
    showProgressionModal,
    progressionModalAcknowledged,
    progressionModalBlockingTimer,
  ]);

  const templateName = useMemo(
    () => template?.name ?? sessionQuery.data?.templateName,
    [template?.name, sessionQuery.data?.templateName]
  );

  const { visibility, setVisibility, endActiveStatus, isUpdating } =
    useActiveWorkoutStatus({
      sessionId,
      templateId: route.params.templateId,
      templateName,
      initialVisibility: route.params.initialVisibility,
      autoClearOnUnmount: false,
    });

  const cancelRestTimerSounds = useCallback(() => {
    void cancelScheduledRestTimerFinishSound();
    nativeScheduledRestEndsAtRef.current = null;
  }, []);

  const rescheduleRestTimerSoundsIfNeeded = useCallback(() => {
    const soundEnabled = user?.restTimerSoundEnabled !== false;
    if (!soundEnabled) return;
    if (!sessionId) return;
    if (!restEndsAt || restEndsAt <= Date.now()) return;
    if (isEndingSessionRef.current) return;
    if (sessionQuery.data?.endedReason) return;

    void (async () => {
      const scheduled = await scheduleRestTimerFinishSound(sessionId, restEndsAt);
      nativeScheduledRestEndsAtRef.current = scheduled ? restEndsAt : null;
    })();
  }, [
    restEndsAt,
    sessionId,
    sessionQuery.data?.endedReason,
    user?.restTimerSoundEnabled,
  ]);

  const finishMutation = useMutation({
    mutationFn: () => {
      // Pause timer before finishing
      pauseTimer();
      return completeSession(sessionId!, sets);
    },
    onMutate: () => {
      isEndingSessionRef.current = true;
      cancelRestTimerSounds();
    },
    onSuccess: (session) => {
      endActiveStatus();
      void clearPersistedLoggedSetIds(sessionId!);
      // Clear widget data when workout completes
      void syncActiveSessionToWidget(null);
      // Only include logged sets in summary
      const loggedSets = sets.filter((set) => loggedSetIds.has(set.id));
      const summary = summarizeSets(loggedSets);

      // End Live Activity with completion summary
      void endWorkoutLiveActivityWithSummary({
        totalSets: summary.totalSets,
        totalVolume: summary.totalVolume ?? 0,
        durationMinutes: Math.floor(elapsedSeconds / 60),
      });

      void exportWorkoutToAppleHealth({
        sessionId: session.id,
        startedAt: session.startedAt,
        finishedAt: session.finishedAt ?? new Date().toISOString(),
        templateName,
        totalEnergyBurned: session.totalEnergyBurned ?? null,
        enabled: user?.appleHealthEnabled === true,
        permissions: user?.appleHealthPermissions ?? null,
      });

      // Invalidate fatigue query to refresh recovery data
      queryClient.invalidateQueries({ queryKey: fatigueQueryKey });
      queryClient.invalidateQueries({ queryKey: recommendationsQueryKey });

      // Immediately remove "Resume Workout" banner
      queryClient.setQueryData(["activeSession"], {
        session: null,
        autoEndedSession: null,
      });
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });

      navigation.navigate("PostWorkoutShare", {
        sessionId: session.id,
        templateId: session.templateId,
        templateName: templateName,
        totalSets: summary.totalSets,
        totalVolume: summary.totalVolume,
        prCount: summary.prCount,
        durationSeconds: elapsedSeconds,
      });
    },
    onError: () => {
      isEndingSessionRef.current = false;
      rescheduleRestTimerSoundsIfNeeded();
      Alert.alert("Could not finish workout");
    },
  });

  const acknowledgeProgressionModal = () => {
    if (!progressionModalAcknowledged) {
      setProgressionModalAcknowledged(true);
    }
    if (progressionModalBlockingTimer) {
      setProgressionModalBlockingTimer(false);
    }
    resumeTimer();
  };

  const handleProgressionSettingChange = async (enabled: boolean) => {
    setIsUpdatingProgressionSetting(true);
    try {
      await updateProfile({ progressiveOverloadEnabled: enabled });
      if (!enabled) {
        acknowledgeProgressionModal();
        setShowProgressionModal(false);
      }
    } catch (err) {
      Alert.alert("Could not update setting", "Please try again.");
    } finally {
      setIsUpdatingProgressionSetting(false);
    }
  };

  const handleCloseProgressionModal = () => {
    acknowledgeProgressionModal();
    setShowProgressionModal(false);
  };

  const handleApplyAllProgression = () => {
    acknowledgeProgressionModal();
    applyProgressionMutation.mutate(undefined);
  };

  const handleApplySelectedProgression = (exerciseIds: string[]) => {
    acknowledgeProgressionModal();
    applyProgressionMutation.mutate(exerciseIds);
  };

  const applySetUpdates = (updatedList: WorkoutSet[]) => {
    setSets((prev) =>
      prev.map((set) => {
        const next = updatedList.find((u) => u.id === set.id);
        return next ?? set;
      })
    );
  };

  const updateSet = (updated: WorkoutSet) => {
    applySetUpdates([updated]);
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getStoredShowWarmupSets();
      if (cancelled) return;
      if (!hasUserChangedWarmupPreferenceRef.current) {
        setShowWarmupSets(stored);
      }
      setHasHydratedWarmupPreference(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedWarmupPreference) return;
    void setStoredShowWarmupSets(showWarmupSets);
  }, [hasHydratedWarmupPreference, showWarmupSets]);

  const visibleSets = useMemo(() => {
    if (showWarmupSets) return sets;
    return sets.filter((set) => set.setKind !== "warmup");
  }, [sets, showWarmupSets]);

  const groupedSets = useMemo(
    () => groupSetsByExercise(visibleSets, restLookup, sessionRestTimes),
    [visibleSets, restLookup, sessionRestTimes]
  );

  useEffect(() => {
    const missingExerciseIds = Array.from(
      new Set(
        groupedSets
          .filter((group) => !isCardioExercise(group.exerciseId, group.name))
          .filter((group) =>
            group.sets.some(
              (set) =>
                set.setKind !== "warmup" &&
                set.actualWeight === undefined &&
                set.targetWeight === undefined
            )
          )
          .map((group) => group.exerciseId)
      )
    );

    if (missingExerciseIds.length === 0) return;

    missingExerciseIds.forEach((exerciseId) => {
      if (startingSuggestionFetchRef.current.has(exerciseId)) return;
      startingSuggestionFetchRef.current.add(exerciseId);
      void (async () => {
        try {
          const suggestion = await fetchStartingSuggestion(exerciseId);
          setStartingSuggestions((prev) => ({
            ...prev,
            [exerciseId]: suggestion,
          }));
        } catch {
          // ignore
        }
      })();
    });
  }, [groupedSets]);

  useEffect(() => {
    if (!activeExerciseKey) return;
    if (!shouldAutoScrollToActiveExerciseRef.current) return;
    const index = groupedSets.findIndex((group) => group.key === activeExerciseKey);
    if (index < 0) return;

    shouldAutoScrollToActiveExerciseRef.current = false;
    const id = setTimeout(() => {
      try {
        exercisesListRef.current?.scrollToIndex?.({
          index,
          animated: true,
          viewPosition: 0,
          viewOffset: 70,
        });
      } catch {
        // ignore
      }
    }, 50);

    return () => clearTimeout(id);
  }, [activeExerciseKey, groupedSets]);

  // Auto-focus logic - only runs when autoFocusEnabled is true
  // This should NOT override activeSetId that was just set by logSet
  useEffect(() => {
    // Skip if auto-focus is disabled
    if (!autoFocusEnabled) return;

    const firstIncompleteGroup = groupedSets.find((group) =>
      group.sets.some((set) => !loggedSetIds.has(set.id))
    );

    // Only set activeExerciseKey if it's currently null
    if (!activeExerciseKey && firstIncompleteGroup) {
      setActiveExerciseKey(firstIncompleteGroup.key);
    }

    // Only set activeSetId if it's currently null OR if the current activeSetId
    // is already logged (meaning we need to find the next one)
    // IMPORTANT: Don't override if activeSetId was just set by logSet
    if (activeSetId === null && firstIncompleteGroup) {
      const firstUnloggedSet = firstIncompleteGroup.sets.find(
        (s) => !loggedSetIds.has(s.id)
      );
      if (firstUnloggedSet) {
        setActiveSetId(firstUnloggedSet.id);
        activeSetIdRef.current = firstUnloggedSet.id;
      }
    }
  }, [
    activeExerciseKey,
    activeSetId,
    groupedSets,
    loggedSetIds,
    autoFocusEnabled,
  ]);

  useEffect(() => {
    if (showWarmupSets) return;
    if (!activeSetId) return;
    const activeSet = setsRef.current.find((set) => set.id === activeSetId);
    if (!activeSet || activeSet.setKind !== "warmup") return;

    const key = activeSet.templateExerciseId ?? activeSet.exerciseId;
    const group = groupedSets.find((g) => g.key === key);
    const fallback = group?.sets.find((s) => !loggedSetIds.has(s.id)) ?? group?.sets[0];
    if (!fallback) {
      setActiveSetId(null);
      activeSetIdRef.current = null;
      return;
    }
    setActiveSetId(fallback.id);
    activeSetIdRef.current = fallback.id;
  }, [activeSetId, groupedSets, loggedSetIds, showWarmupSets]);

  // Sync initial session state to widget AND start Live Activity when session loads
  useEffect(() => {
    if (!sessionId || !startTime || groupedSets.length === 0) return;
    if (timerLocked) return;
    if (sessionQuery.data?.endedReason) return;

    // Find the first exercise with unlogged sets
    const firstIncompleteGroup = groupedSets.find((group) =>
      group.sets.some((set) => !loggedSetIds.has(set.id))
    );

    if (firstIncompleteGroup) {
      // Find the first unlogged set in this exercise
      const firstUnloggedSet = firstIncompleteGroup.sets.find(
        (set) => !loggedSetIds.has(set.id)
      );
      if (firstUnloggedSet) {
        const setIndex = firstIncompleteGroup.sets.findIndex(
          (s) => s.id === firstUnloggedSet.id
        );
        syncCurrentExerciseToWidget(firstIncompleteGroup.key, setIndex);

        // Start Live Activity (Dynamic Island + Lock Screen)
        void startWorkoutLiveActivity({
          sessionId,
          templateName: templateName || "Workout",
          exerciseName: firstIncompleteGroup.name,
          currentSet: setIndex + 1,
          totalSets: firstIncompleteGroup.sets.length,
          targetReps: firstUnloggedSet.targetReps,
          targetWeight: firstUnloggedSet.targetWeight,
          totalExercises: groupedSets.length,
          completedExercises: 0,
        });
      }
    }
  }, [sessionId, startTime, groupedSets.length, timerLocked, sessionQuery.data?.endedReason]);

  useEffect(() => {
    const prev = previousRestEndsAtRef.current;
    previousRestEndsAtRef.current = restEndsAt;

    const soundEnabled = user?.restTimerSoundEnabled !== false;

    if (
      restEndsAt &&
      soundEnabled &&
      sessionId &&
      !isEndingSessionRef.current &&
      !sessionQuery.data?.endedReason
    ) {
      void (async () => {
        const scheduled = await scheduleRestTimerFinishSound(sessionId, restEndsAt);
        nativeScheduledRestEndsAtRef.current = scheduled ? restEndsAt : null;
      })();
      return;
    }

    // Only cancel scheduled sound if the timer ended early (i.e. it was cleared while still in the future).
    if ((!restEndsAt || !soundEnabled) && prev && prev > Date.now()) {
      void cancelScheduledRestTimerFinishSound();
      nativeScheduledRestEndsAtRef.current = null;
      return;
    }

    if (!restEndsAt) {
      nativeScheduledRestEndsAtRef.current = null;
    }
  }, [restEndsAt, sessionId, sessionQuery.data?.endedReason, user?.restTimerSoundEnabled]);

  useEffect(() => {
    if (!sessionQuery.data?.endedReason) return;
    cancelRestTimerSounds();
    setRestRemaining(null);
    setRestEndsAt(null);
  }, [cancelRestTimerSounds, sessionQuery.data?.endedReason]);

  useEffect(() => {
    if (!restEndsAt) return;
    let hasPlayedSound = false;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((restEndsAt - Date.now()) / 1000)
      );
      setRestRemaining(remaining);
      if (remaining <= 0) {
        setRestEndsAt(null);
        setTimeout(() => setRestRemaining(null), 400);

        // Play sound when timer completes (if enabled)
        if (
          !hasPlayedSound &&
          user?.restTimerSoundEnabled !== false &&
          !isEndingSessionRef.current &&
          !sessionQuery.data?.endedReason
        ) {
          hasPlayedSound = true;
          const nativeScheduledForThisTimer =
            nativeScheduledRestEndsAtRef.current === restEndsAt;
          nativeScheduledRestEndsAtRef.current = null;
          if (nativeScheduledForThisTimer) {
            void playTimerHaptics();
          } else {
            playTimerSound();
          }
        }

        // Clear Live Activity rest timer so "Log Set" button appears
        if (sessionId) {
          void updateWorkoutLiveActivity({
            sessionId,
            restDuration: 0, // Pass 0 to explicitly clear timer
            restEndsAt: null,
          });
        }
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [restEndsAt, sessionQuery.data?.endedReason, user?.restTimerSoundEnabled]);

  // Listen for "Log Set" button from Live Activity (via App Group shared storage)
  useEffect(() => {
    const { WidgetSyncModule } = NativeModules;

    const checkPendingLogSet = async () => {
      if (!WidgetSyncModule) {
        return;
      }

      // Prevent concurrent processing
      if (isProcessingLogSetRef.current) {
        return;
      }

      try {
        // Read from App Group shared UserDefaults
        const pendingSessionId = await new Promise<string | null>((resolve) => {
          WidgetSyncModule.readFromAppGroup(
            "pendingLogSetSessionId",
            (value: string | null) => {
              resolve(value);
            }
          );
        });

        const timestamp = await new Promise<number | null>((resolve) => {
          WidgetSyncModule.readFromAppGroup(
            "pendingLogSetTimestamp",
            (value: number | null) => {
              resolve(value);
            }
          );
        });

        // Only process if we have both values
        if (!pendingSessionId || !timestamp) {
          return;
        }

        // Check if we already processed this exact timestamp
        if (timestamp === lastProcessedTimestampRef.current) {
          return;
        }

        // Only process if it's recent (within last 10 seconds)
        const now = Date.now() / 1000;
        if (now - timestamp >= 10) {
          // Clear stale actions
          WidgetSyncModule.writeToAppGroup("pendingLogSetSessionId", null);
          WidgetSyncModule.writeToAppGroup("pendingLogSetTimestamp", null);
          return;
        }

        // Verify this is the current session
        if (pendingSessionId !== sessionId) {
          return;
        }

        // Set processing lock and mark timestamp as processed BEFORE doing anything
        isProcessingLogSetRef.current = true;
        lastProcessedTimestampRef.current = timestamp;

        // Clear the pending action IMMEDIATELY to prevent re-processing
        WidgetSyncModule.writeToAppGroup("pendingLogSetSessionId", null);
        WidgetSyncModule.writeToAppGroup("pendingLogSetTimestamp", null);

        // Use the activeSetId from the ref - this is what the user sees as highlighted
        const setToLog = activeSetIdRef.current;

        if (setToLog) {
          const currentLoggedSetIds = loggedSetIdsRef.current;

          // Verify this set hasn't already been logged
          if (!currentLoggedSetIds.has(setToLog)) {
            logSet(setToLog);
          }
        }

        // Release lock after a short delay to let state settle
        setTimeout(() => {
          isProcessingLogSetRef.current = false;
        }, 500);
      } catch (error) {
        console.error("❌ Failed to check pending log set:", error);
        isProcessingLogSetRef.current = false;
      }
    };

    // Check immediately when component mounts
    checkPendingLogSet();

    // Poll for pending actions every 500ms while workout is active (faster response)
    const pollInterval = setInterval(checkPendingLogSet, 500);

    // Listen for app state changes (when app comes to foreground)
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        checkPendingLogSet();
      }
    });

    return () => {
      clearInterval(pollInterval);
      subscription.remove();
    };
  }, [sessionId]);

  // Listen for "Log Set" button from Live Activity (via deep link)
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;

      // Parse the URL to extract sessionId
      // Expected format: push-pull://workout/log-set?sessionId=xxx
      if (url.includes("workout/log-set")) {
        const urlObj = new URL(url);
        const urlSessionId = urlObj.searchParams.get("sessionId");

        // Verify this is the current session
        if (urlSessionId !== sessionId) {
          return;
        }

        // Use the activeSetId - this is what the user sees as highlighted
        const setToLog = activeSetIdRef.current;

        if (setToLog) {
          const currentLoggedSetIds = loggedSetIdsRef.current;

          // Verify this set hasn't already been logged
          if (!currentLoggedSetIds.has(setToLog)) {
            // Check if user has custom rest duration for this exercise
            const currentSet = setsRef.current.find((s) => s.id === setToLog);
            if (currentSet) {
              const groupKey =
                currentSet.templateExerciseId ?? currentSet.exerciseId;
              const customRestDuration = sessionRestTimesRef.current[groupKey];

              // Call logSet with custom rest duration if it was adjusted
              logSet(setToLog, customRestDuration);
            } else {
              logSet(setToLog);
            }
          }
        }
      }
    };

    // Add listener for incoming deep links (when app is already open)
    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Check if app was opened via deep link (when app was closed)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]); // Only re-register when sessionId changes

  // Legacy: Listen for "Log Set" button from Live Activity (via NotificationCenter - deprecated)
  // This is kept for backwards compatibility but shouldn't be triggered anymore
  useEffect(() => {
    const cleanup = addLogSetListener((liveActivitySessionId) => {
      // Verify this is the current session
      if (liveActivitySessionId !== sessionId) {
        return;
      }

      // Find the active set to log
      if (activeSetId) {
        logSet(activeSetId);
      }
    });

    return cleanup;
  }, [sessionId, activeSetId]);

  /**
   * Calculate intelligent rest time based on set intensity
   * Uses weight progression and reps to estimate intensity
   */
  const calculateSmartRestTime = (
    currentSet: WorkoutSet,
    groupedSets: WorkoutSet[],
    setKind: "warmup" | "working"
  ): number => {
    if (setKind === "warmup") {
      return DEFAULT_WARMUP_REST_SECONDS;
    }

    // Get all completed sets with weight for this exercise
    const completedSetsWithWeight = groupedSets
      .filter((s) => s.actualReps != null && s.actualWeight != null && s.actualWeight > 0)
      .sort((a, b) => (b.actualWeight ?? 0) - (a.actualWeight ?? 0));

    if (completedSetsWithWeight.length === 0) {
      return DEFAULT_WORKING_REST_SECONDS;
    }

    const currentWeight = currentSet.actualWeight ?? 0;
    const maxWeight = completedSetsWithWeight[0].actualWeight ?? 0;

    // If current set is close to max weight (within 10%), assume heavy set
    const isHeavySet = maxWeight > 0 && currentWeight >= maxWeight * 0.9;

    // Also consider low reps as indicator of heavy set
    const currentReps = currentSet.actualReps ?? 0;
    const isLowRep = currentReps > 0 && currentReps <= 5;

    if (isHeavySet || isLowRep) {
      return DEFAULT_HEAVY_REST_SECONDS; // 3 minutes for heavy sets
    }

    return DEFAULT_WORKING_REST_SECONDS; // 90 seconds for normal working sets
  };

  const startRestTimer = (seconds?: number) => {
    // If timer is explicitly set to 0, skip the timer entirely
    if (seconds === 0) {
      setRestRemaining(null);
      setRestEndsAt(null);
      return;
    }
    const duration = Math.max(10, seconds ?? DEFAULT_WORKING_REST_SECONDS);
    setRestRemaining(duration);
    setRestEndsAt(Date.now() + duration * 1000);
  };

  // Helper function to sync current exercise state to widget AND Live Activity
  const syncCurrentExerciseToWidget = (
    exerciseKey: string,
    currentSetIndex: number,
    lastReps?: number,
    lastWeight?: number,
    restDuration?: number,
    restEndsAtTimestamp?: number // Pass the actual restEndsAt timestamp from state
  ) => {
    if (!sessionId || !startTime) return;
    if (timerLockedRef.current) return;

    const group = groupedSets.find((g) => g.key === exerciseKey);
    if (!group) return;

    const currentSet = group.sets[currentSetIndex];
    if (!currentSet) return;

    // Determine actual rest duration for widgets
    // If restDuration is explicitly 0, pass 0 to clear the timer
    // If undefined, use the group's rest seconds as fallback
    const actualRestDuration =
      restDuration !== undefined
        ? restDuration
        : group.restSeconds ?? DEFAULT_WORKING_REST_SECONDS;

    // Calculate restEndsAt ISO string if we have a timestamp
    const restEndsAtISO =
      restEndsAtTimestamp && restEndsAtTimestamp > 0
        ? new Date(restEndsAtTimestamp).toISOString()
        : actualRestDuration === 0
        ? undefined
        : undefined;

    // Sync to home screen widget
    void syncActiveSessionToWidget({
      sessionId,
      exerciseName: group.name,
      currentSet: currentSetIndex + 1, // 1-indexed for display
      totalSets: group.sets.length,
      lastReps,
      lastWeight,
      targetReps: currentSet.targetReps,
      targetWeight: currentSet.targetWeight,
      startedAt: startTime,
      restDuration: actualRestDuration,
      restEndsAt: restEndsAtISO,
    });

    // Sync to Live Activity (Dynamic Island + Lock Screen)
    void updateWorkoutLiveActivity({
      sessionId,
      exerciseName: group.name,
      currentSet: currentSetIndex + 1,
      totalSets: group.sets.length,
      lastReps,
      lastWeight,
      targetReps: currentSet.targetReps,
      targetWeight: currentSet.targetWeight,
      completedExercises: groupedSets.filter((g) =>
        g.sets.every((s) => loggedSetIds.has(s.id))
      ).length,
      restDuration: actualRestDuration, // Always pass a defined value
      restEndsAt: restEndsAtISO,
    });
  };

  const logSet = (setId: string, restSeconds?: number) => {
    // CRITICAL: Use refs for all reads to avoid stale closure issues
    // This is especially important when called from the polling interval
    const currentLoggedSetIds = loggedSetIdsRef.current;
    const currentSets = setsRef.current;

    const currentSet = currentSets.find((s) => s.id === setId);
    if (!currentSet) {
      return;
    }

    // Check if this set is already logged using the ref (most up-to-date)
    if (currentLoggedSetIds.has(setId)) {
      return;
    }

    // Create updated loggedSetIds from the ref (not stale state)
    const updatedLoggedSetIds = new Set(currentLoggedSetIds);
    updatedLoggedSetIds.add(setId);

    // IMMEDIATELY update the ref BEFORE any async operations
    // This prevents race conditions with the pending log set handler
    loggedSetIdsRef.current = updatedLoggedSetIds;

    const updated: WorkoutSet = {
      ...currentSet,
      actualWeight: currentSet.actualWeight ?? currentSet.targetWeight,
      actualReps: currentSet.actualReps ?? currentSet.targetReps,
    };
    applySetUpdates([updated]);
    setLoggedSetIds(updatedLoggedSetIds);
    setLastLoggedSetId(setId);
    if (sessionId) {
      void persistLoggedSetIds(sessionId, updatedLoggedSetIds);
    }

    if (!timerLockedRef.current) {
      if (!startTime) {
        initializeTimer({ startedAt: new Date().toISOString() });
      } else if (!timerActive) {
        resumeTimer();
      }
    }

    // Calculate rest duration (needed for both timer and widget sync)
    const groupKey = currentSet.templateExerciseId ?? currentSet.exerciseId;
    const group = groupedSets.find((g) => g.key === groupKey);
    // Use ref to get current session rest times to avoid stale closure
    const currentSessionRestTimes = sessionRestTimesRef.current;
    const currentWarmupRestTimes = sessionWarmupRestTimesRef.current;
    const isWarmupSet = (currentSet.setKind ?? "working") === "warmup";

    // Calculate smart default rest time based on set intensity and type
    const smartDefaultRestSeconds = calculateSmartRestTime(
      updated,
      group?.sets ?? [],
      currentSet.setKind ?? "working"
    );

    // Priority: user-adjusted session rest times > passed restSeconds (per-set) > smart defaults
    // Warm-up sets intentionally skip template rest to keep their timer shorter by default
    const fallbackRest = isWarmupSet
      ? currentWarmupRestTimes[groupKey] ?? restSeconds
      : currentSessionRestTimes[groupKey] ??
        restSeconds ??
        currentSet.targetRestSeconds;

    // Start rest timer and capture the end timestamp
    let calculatedRestEndsAt: number | null = null;
    if (autoRestTimer) {
      const restDuration = fallbackRest ?? smartDefaultRestSeconds;
      calculatedRestEndsAt = Date.now() + restDuration * 1000;
      startRestTimer(restDuration);
    } else {
      setRestRemaining(null);
      setRestEndsAt(null);
    }

    if (group) {
      const sorted = [...group.sets]
        .map((s) => (s.id === setId ? updated : s))
        .sort((a, b) => a.setIndex - b.setIndex);
      const currentSortedIndex = sorted.findIndex((s) => s.id === setId);
      const nextSetAfterCurrent =
        currentSortedIndex >= 0
          ? sorted
              .slice(currentSortedIndex + 1)
              .find((s) => !updatedLoggedSetIds.has(s.id))
          : undefined;

      // Keep widgets/live activity in sync with the set that was just logged (no auto-advance between sets).
      const restDuration = fallbackRest ?? smartDefaultRestSeconds;
      syncCurrentExerciseToWidget(
        groupKey,
        Math.max(0, currentSortedIndex),
        updated.actualReps,
        updated.actualWeight,
        autoRestTimer ? restDuration : 0,
        autoRestTimer ? calculatedRestEndsAt ?? undefined : undefined
      );

      // Auto-carry weight + reps to the next set (strength only, working sets only).
      if (
        nextSetAfterCurrent &&
        updated.setKind !== "warmup" &&
        !isCardioExercise(updated.exerciseId, updated.exerciseName) &&
        nextSetAfterCurrent.setKind !== "warmup"
      ) {
        const carryWeight =
          updated.actualWeight !== undefined &&
          nextSetAfterCurrent.actualWeight === undefined;
        const carryReps =
          updated.actualReps !== undefined &&
          nextSetAfterCurrent.actualReps === undefined;

        if (carryWeight || carryReps) {
          setSets((prev) =>
            prev.map((set) => {
              if (set.id !== nextSetAfterCurrent.id) return set;
              return {
                ...set,
                actualWeight:
                  carryWeight && set.actualWeight === undefined
                    ? updated.actualWeight
                    : set.actualWeight,
                actualReps:
                  carryReps && set.actualReps === undefined
                    ? updated.actualReps
                    : set.actualReps,
              };
            })
          );
        }
      }

      // All sets in this exercise are logged - show difficulty feedback before advancing
      const allLogged = sorted.every((s) => updatedLoggedSetIds.has(s.id));
      if (allLogged) {
        // Check if any working set in this exercise already has a difficulty rating
        const workingSets = sorted.filter((s) => s.setKind !== "warmup");
        const hasExistingRating = workingSets.some((s) => s.difficultyRating);

        if (!hasExistingRating && workingSets.length > 0) {
          // Show difficulty feedback prompt - don't auto-advance yet
          setPendingDifficultyFeedbackKey(group.key);
          // Keep the exercise expanded and don't advance
          const lastSetIndex = sorted.length - 1;
          syncCurrentExerciseToWidget(
            groupKey,
            lastSetIndex,
            updated.actualReps,
            updated.actualWeight,
            0
          );
        } else {
          // Already has rating or no working sets, advance normally
          advanceToNextExercise(group.key, updatedLoggedSetIds);
        }
      }
    }
  };

  // Helper to advance to next exercise (extracted for reuse after difficulty feedback)
  const advanceToNextExercise = useCallback(
    (currentExerciseKey: string, currentLoggedSetIds: Set<string>) => {
      const currentIndex = groupedSets.findIndex((g) => g.key === currentExerciseKey);
      const nextGroup = groupedSets[currentIndex + 1];
      if (nextGroup) {
        setAutoFocusEnabled(true);
        shouldAutoScrollToActiveExerciseRef.current = true;
        setActiveExerciseKey(nextGroup.key);
        const firstUnloggedInNextGroup = nextGroup.sets.find(
          (s) => !currentLoggedSetIds.has(s.id)
        );
        const nextSetId =
          firstUnloggedInNextGroup?.id ?? nextGroup.sets[0]?.id ?? null;

        activeSetIdRef.current = nextSetId;
        setActiveSetId(nextSetId);

        if (firstUnloggedInNextGroup) {
          const nextSetIndex = nextGroup.sets.findIndex(
            (s) => s.id === firstUnloggedInNextGroup.id
          );
          syncCurrentExerciseToWidget(nextGroup.key, nextSetIndex);
        }
      } else {
        activeSetIdRef.current = null;
        setActiveExerciseKey(null);
        setActiveSetId(null);
      }
    },
    [groupedSets, syncCurrentExerciseToWidget]
  );

  const applyStartingSuggestionToGroup = useCallback(
    (exerciseKey: string, suggestion: StartingSuggestion | undefined) => {
      if (!suggestion) return;
      setSets((prev) =>
        prev.map((set) => {
          const setKey = set.templateExerciseId ?? set.exerciseId;
          if (setKey !== exerciseKey) return set;
          if (set.setKind === "warmup") return set;
          if (loggedSetIdsRef.current.has(set.id)) return set;

          const shouldFillWeight =
            suggestion.suggestedWeight !== undefined &&
            set.actualWeight === undefined &&
            set.targetWeight === undefined;
          const shouldFillReps =
            suggestion.suggestedReps !== undefined &&
            set.actualReps === undefined &&
            set.targetReps === undefined;
          if (!shouldFillWeight && !shouldFillReps) return set;

          return {
            ...set,
            targetWeight: shouldFillWeight ? suggestion.suggestedWeight : set.targetWeight,
            actualWeight: shouldFillWeight ? suggestion.suggestedWeight : set.actualWeight,
            targetReps: shouldFillReps ? suggestion.suggestedReps : set.targetReps,
            actualReps: shouldFillReps ? suggestion.suggestedReps : set.actualReps,
          };
        })
      );
    },
    []
  );

  const undoSet = (setId: string) => {
    // Create updated loggedSetIds without the undone set
    const updatedLoggedSetIds = new Set(loggedSetIds);
    updatedLoggedSetIds.delete(setId);

    // IMMEDIATELY update refs BEFORE any async operations
    loggedSetIdsRef.current = updatedLoggedSetIds;
    activeSetIdRef.current = setId;

    setLoggedSetIds(updatedLoggedSetIds);
    setLastLoggedSetId((prev) => (prev === setId ? null : prev));
    if (sessionId) {
      void persistLoggedSetIds(sessionId, updatedLoggedSetIds);
    }
    if (restEndsAt && lastLoggedSetId === setId) {
      setRestRemaining(null);
      setRestEndsAt(null);
    }
    setActiveSetId(setId);
    setAutoFocusEnabled(false);

    // Sync Live Activity to reflect undo
    // Find the undone set and update widget to show it as active again
    const undoneSet = sets.find((s) => s.id === setId);
    if (undoneSet) {
      const groupKey = undoneSet.templateExerciseId ?? undoneSet.exerciseId;
      const group = groupedSets.find((g) => g.key === groupKey);
      if (group) {
        const setIndex = group.sets.findIndex((s) => s.id === setId);
        // Sync without rest timer since we're undoing
        syncCurrentExerciseToWidget(
          groupKey,
          setIndex,
          undefined,
          undefined,
          0
        );
      }
    }
  };

  const handleSwapExercise = (
    exerciseKey: string,
    newExercise: {
      exerciseId: string;
      exerciseName: string;
      sets?: number;
      reps?: number;
      restSeconds?: number;
    }
  ) => {
    setSets((prev) =>
      prev.map((set) => {
        const setKey = set.templateExerciseId ?? set.exerciseId;
        if (setKey === exerciseKey) {
          return {
            ...set,
            exerciseId: newExercise.exerciseId,
            exerciseName: newExercise.exerciseName,
            targetReps: newExercise.reps ?? set.targetReps,
            targetRestSeconds: newExercise.restSeconds ?? set.targetRestSeconds,
            actualReps: newExercise.reps ?? set.actualReps,
            targetWeight: undefined,
            actualWeight: undefined,
            targetDistance: undefined,
            actualDistance: undefined,
            targetIncline: undefined,
            actualIncline: undefined,
            targetDurationMinutes: undefined,
            actualDurationMinutes: undefined,
          };
        }
        return set;
      })
    );
    setSwapExerciseKey(null);
  };

  const handleAdjustTimer = (
    exerciseKey: string,
    newWorkingRestSeconds: number,
    newWarmupRestSeconds?: number
  ) => {
    setSessionRestTimes((prev) => ({
      ...prev,
      [exerciseKey]: newWorkingRestSeconds,
    }));
    if (newWarmupRestSeconds !== undefined) {
      setSessionWarmupRestTimes((prev) => ({
        ...prev,
        [exerciseKey]: newWarmupRestSeconds,
      }));
    }
  };

  const handleAddExerciseToSession = (exerciseForm: any) => {
    if (!sessionId) return;

    // Get the highest setIndex to append at the end
    const maxSetIndex =
      sets.length > 0 ? Math.max(...sets.map((s) => s.setIndex)) : -1;

    const baseIndex = maxSetIndex + 100;
    const cardio = isCardioExercise(
      exerciseForm.exercise.id,
      exerciseForm.exercise.name
    );
    const numSets = cardio ? 1 : exerciseForm.sets || 3;
    const newSets: WorkoutSet[] = [];

    for (let i = 0; i < numSets; i++) {
      const newSet: WorkoutSet = {
        id: `temp-${Date.now()}-${i}`,
        sessionId,
        exerciseId: exerciseForm.exercise.id,
        exerciseName: exerciseForm.exercise.name,
        exerciseImageUrl: exerciseForm.exercise.gifUrl,
        setKind: "working",
        setIndex: baseIndex + i,
        targetReps: exerciseForm.reps || 10,
        targetWeight: undefined,
        actualReps: exerciseForm.reps || 10,
        actualWeight: undefined,
        targetRestSeconds: exerciseForm.restSeconds || 90,
        templateExerciseId: exerciseForm.exercise.id, // Use exercise ID as key
      };
      newSets.push(newSet);
    }

    setSets((prev) => [...prev, ...newSets]);
    setShowExercisePicker(false);
  };

  const handleDeleteExercise = (exerciseKey: string) => {
    Alert.alert(
      "Delete Exercise",
      "Are you sure you want to remove this exercise from the workout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Remove all sets for this exercise
            setSets((prev) =>
              prev.filter((set) => {
                const setKey = set.templateExerciseId ?? set.exerciseId;
                return setKey !== exerciseKey;
              })
            );

            // Clear active exercise if it was deleted
            if (activeExerciseKey === exerciseKey) {
              setActiveExerciseKey(null);
              setActiveSetId(null);
            }
          },
        },
      ]
    );
  };

  const handleReorderExercises = (newGroupedSets: ExerciseGroup[]) => {
    const allSets = setsRef.current;
    const fullGroups = groupSetsByExercise(
      allSets,
      restLookup,
      sessionRestTimesRef.current
    );
    const fullGroupMap = new Map(fullGroups.map((group) => [group.key, group]));

    const reorderedSets: WorkoutSet[] = [];
    newGroupedSets.forEach((group, groupIndex) => {
      const full = fullGroupMap.get(group.key);
      const nextSets = full?.sets ?? group.sets;
      nextSets.forEach((set, setIndex) => {
        reorderedSets.push({
          ...set,
          setIndex: groupIndex * 100 + setIndex,
        });
      });
    });

    setSets(reorderedSets);
  };

  const handleAddSet = (exerciseKey: string) => {
    const group = groupedSets.find((g) => g.key === exerciseKey);
    if (!group) return;

    const lastSet = group.sets[group.sets.length - 1];
    if (!lastSet) return;

    if (isCardioExercise(lastSet.exerciseId, lastSet.exerciseName)) {
      Alert.alert("Cardio is single-log", "Cardio exercises only have one log.");
      return;
    }

    const newSet: WorkoutSet = {
      id: `${Date.now()}-${Math.random()}`,
      sessionId: sessionId!,
      templateExerciseId: lastSet.templateExerciseId,
      exerciseId: lastSet.exerciseId,
      exerciseName: lastSet.exerciseName,
      exerciseImageUrl: lastSet.exerciseImageUrl,
      setKind: "working",
      setIndex: lastSet.setIndex + 1,
      targetReps: lastSet.targetReps,
      targetWeight: lastSet.targetWeight,
      targetRestSeconds: lastSet.targetRestSeconds,
      actualReps: lastSet.actualReps,
      actualWeight: lastSet.actualWeight,
    };

    setSets((prev) => [...prev, newSet]);
  };

  const handleRemoveSet = (setId: string) => {
    const setToRemove = sets.find((s) => s.id === setId);
    if (!setToRemove) return;

    const groupKey = setToRemove.templateExerciseId ?? setToRemove.exerciseId;
    const group = groupedSets.find((g) => g.key === groupKey);
    if (!group || group.sets.length <= 1) {
      Alert.alert(
        "Cannot Remove",
        "Each exercise must have at least one set. To remove this exercise, use the swap feature."
      );
      return;
    }

    Alert.alert("Remove Set", "Are you sure you want to remove this set?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setSets((prev) => prev.filter((s) => s.id !== setId));
          setLoggedSetIds((prev) => {
            const next = new Set(prev);
            next.delete(setId);
            return next;
          });
          if (activeSetId === setId) {
            setActiveSetId(null);
          }
          if (lastLoggedSetId === setId) {
            setLastLoggedSetId(null);
          }
        },
      },
    ]);
  };

  const sessionTitle = templateName ?? "Workout Session";
  const stopwatchLabel = startTime ? formatStopwatch(elapsedSeconds) : "00:00";
  const timerStatusLabel = timerActive
    ? "Running"
    : elapsedSeconds > 0
    ? "Paused"
    : "Ready";
  const restLabel = !autoRestTimer
    ? "Off"
    : restRemaining !== null
    ? formatSeconds(restRemaining)
    : "On";
  const visibilityLabel =
    visibilityOptions.find((o) => o.value === visibility)?.label ?? "Private";
  const hasWorkoutProgress = loggedSetIds.size > 0 || elapsedSeconds > 0;

  if (isBootstrappingSession) {
    return (
      <ScreenContainer>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <ActivityIndicator size='large' color={colors.primary} />
          <Text
            style={{
              marginTop: 12,
              color: colors.textSecondary,
              fontSize: 14,
            }}
          >
            Loading your workout...
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  const handleConfirmLeaveSession = async () => {
    if (!sessionId) {
      endActiveStatus();
      navigation.goBack();
      return;
    }

    isEndingSessionRef.current = true;
    cancelRestTimerSounds();
    try {
      await updateSession(sessionId, {
        endedReason: "user_exit",
      });
      void clearPersistedLoggedSetIds(sessionId);
      // Clear widget + Live Activity when workout is explicitly ended
      void syncActiveSessionToWidget(null);
      void endWorkoutLiveActivityForSession(sessionId);

      // Optimistically clear any active session on the client
      queryClient.setQueryData(["activeSession"], {
        session: null,
        autoEndedSession: null,
      });
      queryClient.invalidateQueries({ queryKey: ["activeSession"] });
    } catch (err) {
      isEndingSessionRef.current = false;
      rescheduleRestTimerSoundsIfNeeded();
      Alert.alert(
        "Could not leave workout",
        "We couldn't end your current workout. Please try again."
      );
      return;
    }

    endActiveStatus();
    navigation.goBack();
  };

  const handleExitSession = () => {
    if (!hasWorkoutProgress) {
      void handleConfirmLeaveSession();
      return;
    }

    Alert.alert(
      "Leave workout?",
      "You have an active timer and sets in progress. The workout will only count if you finish it.",
      [
        { text: "Keep going", style: "cancel" },
        {
          text: "Leave workout",
          style: "destructive",
          onPress: () => {
            pauseTimer();
            void handleConfirmLeaveSession();
          },
        },
      ]
    );
  };

  const swapExerciseGroup = groupedSets.find((g) => g.key === swapExerciseKey);
  const timerAdjustGroup = groupedSets.find(
    (g) => g.key === timerAdjustExerciseKey
  );

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const scrollY = contentOffset.y;
    const scrollViewHeight = layoutMeasurement.height;
    const contentHeight = contentSize.height;

    // Show top gradient when scrolled down
    setShowTopGradient(scrollY > 24);

    // Show bottom gradient when not at the bottom
    const isNearBottom = scrollY + scrollViewHeight >= contentHeight - 20;
    setShowBottomGradient(!isNearBottom && contentHeight > scrollViewHeight);
  };

  const renderHeader = () => (
    <View style={{ gap: 12, marginTop: 8, marginBottom: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          alignSelf: "flex-start",
          gap: 8,
        }}
      >
        <Pressable
          accessibilityLabel='Exit workout'
          onPress={handleExitSession}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name='close' size={18} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          accessibilityLabel={
            timerActive ? "Pause workout timer" : "Resume workout timer"
          }
          onPress={timerActive ? pauseTimer : resumeTimer}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Ionicons
            name={timerActive ? "pause" : "play"}
            size={18}
            color={colors.textPrimary}
          />
        </Pressable>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 20,
              fontWeight: "700",
            }}
          >
            {sessionTitle}
          </Text>
        </View>
        {template && (
          <View style={{ marginTop: -4 }}>
            <MuscleGroupBreakdown template={template} maxGroups={3} />
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            alignItems: "stretch",
          }}
        >
          <View
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
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
                gap: 10,
              }}
            >
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Session timer
                </Text>
                <Text
                  style={{
                    color: timerActive ? colors.primary : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: "700",
                    marginTop: 2,
                  }}
                >
                  {timerStatusLabel}
                </Text>
              </View>
              <Ionicons
                name={timerActive ? "pause" : "play"}
                size={16}
                color={colors.textSecondary}
              />
            </View>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                fontWeight: "800",
                letterSpacing: 0.5,
              }}
            >
              {stopwatchLabel}
            </Text>
          </View>
          <View
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Rest timer
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Switch
                  value={autoRestTimer}
                  onValueChange={setAutoRestTimer}
                  trackColor={{
                    false: colors.border,
                    true: "rgba(34,197,94,0.35)",
                  }}
                  thumbColor={autoRestTimer ? colors.primary : "#6B7280"}
                />
              </View>
            </View>
            <Text
              style={{
                color:
                  restRemaining !== null ? colors.primary : colors.textPrimary,
                fontSize: 22,
                fontWeight: "800",
                letterSpacing: 0.5,
              }}
            >
              {restLabel}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            hasUserChangedWarmupPreferenceRef.current = true;
            setShowWarmupSets((prev) => !prev);
          }}
          style={({ pressed }) => ({
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
              Warm-up sets
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {showWarmupSets ? "Shown before working sets" : "Hidden (working sets only)"}
            </Text>
          </View>
          <View pointerEvents='none'>
            <Switch
              value={showWarmupSets}
              onValueChange={setShowWarmupSets}
              trackColor={{
                false: colors.border,
                true: "rgba(56,189,248,0.35)",
              }}
              thumbColor={showWarmupSets ? colors.secondary : "#6B7280"}
            />
          </View>
        </Pressable>

        {showWarmupSets && warmupSuggestions.length > 0 && (
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: `${colors.secondary}15`,
                  borderWidth: 1,
                  borderColor: `${colors.secondary}25`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name='flash-outline' size={18} color={colors.secondary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
                  {warmupTargetsLabel}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Quick routine (2–4 min)
                </Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              {warmupSuggestions.map((item) => (
                <View
                  key={`${item.title}-${item.note ?? ""}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      backgroundColor: `${colors.secondary}12`,
                      borderWidth: 1,
                      borderColor: `${colors.secondary}25`,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 1,
                    }}
                  >
                    <Ionicons name='checkmark' size={14} color={colors.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                      {item.title}
                    </Text>
                    {item.note ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                        {item.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <Pressable
          onPress={() => {
            if (isPro) {
              navigation.navigate("Analytics");
              return;
            }
            setPaywallTrigger("analytics");
            setShowPaywallModal(true);
          }}
          style={({ pressed }) => ({
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: colors.border,
            opacity: pressed ? 0.9 : 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: `${colors.primary}15`,
                borderWidth: 1,
                borderColor: `${colors.primary}25`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name='bar-chart' size={18} color={colors.primary} />
            </View>
            <View style={{ gap: 2, flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                Advanced analytics
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                View trends and training insights
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {!isPro && (
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
                    fontWeight: "800",
                  }}
                >
                  Pro
                </Text>
              </View>
            )}
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name='chevron-forward'
                size={18}
                color={colors.textSecondary}
              />
            </View>
          </View>
        </Pressable>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 12,
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
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
              Live visibility
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Currently: {visibilityLabel}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowVisibilityModal(true)}
            style={({ pressed }) => ({
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
              Change
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={{ gap: 12, marginTop: 12 }}>
      {groupedSets.length === 0 ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ color: colors.textSecondary }}>
            No sets yet for this workout.
          </Text>
        </View>
      ) : null}

      {/* Add Exercise Button */}
      <Pressable
        onPress={() => setShowExercisePicker(true)}
        style={({ pressed }) => ({
          backgroundColor: colors.surfaceMuted,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
          flexDirection: "row",
          justifyContent: "center",
          gap: 8,
        })}
      >
        <Ionicons name='add-circle-outline' size={20} color={colors.primary} />
        <Text
          style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 15 }}
        >
          Add Exercise
        </Text>
      </Pressable>

      <Pressable
        disabled={!sessionId || finishMutation.isPending}
        onPress={() => {
          const unloggedSets = sets.filter((set) => !loggedSetIds.has(set.id));
          if (unloggedSets.length === 0) {
            finishMutation.mutate();
            return;
          }

          const unloggedExercises = new Set(unloggedSets.map((s) => s.exerciseId)).size;
          const title =
            loggedSetIds.size === 0 ? "Finish without logging?" : "Some sets are unlogged";
          const message =
            loggedSetIds.size === 0
              ? "You haven't logged any sets yet. If you finish now, this workout will count as 0 logged sets."
              : `You have ${unloggedSets.length} unlogged set${unloggedSets.length === 1 ? "" : "s"} across ${unloggedExercises} exercise${unloggedExercises === 1 ? "" : "s"}.`;

          Alert.alert(title, message, [
            { text: "Keep logging", style: "cancel" },
            {
              text: "Finish anyway",
              style: "destructive",
              onPress: () => finishMutation.mutate(),
            },
          ]);
        }}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: "center",
          marginTop: 4,
          marginBottom: 24,
          opacity: !sessionId || finishMutation.isPending || pressed ? 0.8 : 1,
          flexDirection: "row",
          justifyContent: "center",
          gap: 10,
        })}
      >
        {finishMutation.isPending ? (
          <ActivityIndicator color='#0B1220' />
        ) : null}
        <Text style={{ color: "#0B1220", fontWeight: "800", fontSize: 16 }}>
          {finishMutation.isPending ? "Finishing..." : "Finish Workout"}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <ScreenContainer paddingTop={0} includeTopInset={false}>
      <View
        pointerEvents='box-only'
        style={{
          position: "absolute",
          left: -16,
          top: 0,
          bottom: 0,
          width: 44,
          zIndex: 1000,
        }}
        {...edgeSwipePanResponder.panHandlers}
      />
      <VisibilityModal
        visible={showVisibilityModal}
        value={visibility}
        onChange={setVisibility}
        onClose={() => setShowVisibilityModal(false)}
        disabled={isUpdating || !sessionId}
      />
      {swapExerciseGroup && (
        <ExerciseSwapModal
          visible={!!swapExerciseKey}
          onClose={() => setSwapExerciseKey(null)}
          exercise={{
            exerciseId: swapExerciseGroup.exerciseId,
            exerciseName: swapExerciseGroup.name,
            sets: swapExerciseGroup.sets.length,
            reps: swapExerciseGroup.sets[0]?.targetReps,
            restSeconds: swapExerciseGroup.restSeconds,
          }}
          onSwap={(newExercise) =>
            handleSwapExercise(swapExerciseKey!, newExercise)
          }
        />
      )}
      {timerAdjustGroup && (
        <TimerAdjustmentModal
          visible={!!timerAdjustExerciseKey}
          onClose={() => setTimerAdjustExerciseKey(null)}
          currentWorkingSeconds={
            sessionRestTimes[timerAdjustGroup.key] ??
            timerAdjustGroup.restSeconds ??
            DEFAULT_WORKING_REST_SECONDS
          }
          currentWarmupSeconds={
            sessionWarmupRestTimes[timerAdjustGroup.key] ?? DEFAULT_WARMUP_REST_SECONDS
          }
          showWarmupOption={showWarmupSets}
          exerciseName={timerAdjustGroup.name}
          onSave={({ workingSeconds, warmupSeconds }) => {
            handleAdjustTimer(
              timerAdjustExerciseKey!,
              workingSeconds,
              warmupSeconds
            );
            setTimerAdjustExerciseKey(null);
          }}
        />
      )}
      <ExerciseInstructionsModal
        visible={!!instructionsExercise}
        exerciseId={instructionsExercise?.id ?? null}
        exerciseName={instructionsExercise?.name ?? null}
        onClose={() => setInstructionsExercise(null)}
      />
      <ExercisePicker
        visible={showExercisePicker}
        onClose={() => setShowExercisePicker(false)}
        selected={[]}
        onAdd={handleAddExerciseToSession}
        onRemove={() => {}}
      />
      <ProgressionSuggestionModal
        visible={showProgressionModal}
        data={progressionData}
        onClose={handleCloseProgressionModal}
        onApplyAll={handleApplyAllProgression}
        onApplySelected={handleApplySelectedProgression}
        isApplying={applyProgressionMutation.isPending}
        progressiveOverloadEnabled={user?.progressiveOverloadEnabled ?? true}
        onToggleProgressiveOverload={handleProgressionSettingChange}
        isUpdatingPreference={isUpdatingProgressionSetting}
        isPro={isPro}
        onUpgrade={() => {
          setShowProgressionModal(false);
          setPaywallTrigger("progression");
          setShowPaywallModal(true);
        }}
      />
      <PaywallComparisonModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        triggeredBy={paywallTrigger}
      />
      <Modal
        visible={!!imagePreviewUrl}
        transparent
        animationType='fade'
        onRequestClose={() => setImagePreviewUrl(null)}
      >
        <Pressable
          onPress={() => setImagePreviewUrl(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {imagePreviewUrl && (
            <Image
              source={{ uri: imagePreviewUrl }}
              style={{
                width: Dimensions.get("window").width - 40,
                height: Dimensions.get("window").width - 40,
                borderRadius: 12,
              }}
              resizeMode='contain'
            />
          )}
          <Pressable
            onPress={() => setImagePreviewUrl(null)}
            style={{
              position: "absolute",
              top: 60,
              right: 20,
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 8,
            }}
          >
            <Ionicons name='close' size={24} color={colors.textPrimary} />
          </Pressable>
        </Pressable>
      </Modal>
      {/* Full-bleed container so gradients span full width */}
      <View style={{ flex: 1, marginHorizontal: -18 }}>
        <View style={{ flex: 1, paddingTop: insets.top }}>
          <DraggableFlatList
            ref={exercisesListRef}
            data={groupedSets}
            keyExtractor={(item) => item.key}
            onDragEnd={({ data }) => handleReorderExercises(data)}
            onScroll={handleScroll}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              const offset = Math.max(0, index * (averageItemLength || 180));
              exercisesListRef.current?.scrollToOffset?.({ offset, animated: true });
              setTimeout(() => {
                exercisesListRef.current?.scrollToIndex?.({
                  index,
                  animated: true,
                  viewPosition: 0,
                  viewOffset: 70,
                });
              }, 50);
            }}
            onScrollOffsetChange={(offset) => {
              setShowTopGradient(offset > 24);
            }}
            scrollEventThrottle={16}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 24 + insets.bottom,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={({
              item: group,
              drag,
              isActive,
            }: RenderItemParams<ExerciseGroup>) => (
              <ScaleDecorator>
                <ExerciseCard
                  group={group}
                  expanded={group.key === activeExerciseKey}
                  onToggle={() => {
                    setAutoFocusEnabled(false);
                    setActiveExerciseKey((prev) => {
                      const next = prev === group.key ? null : group.key;
                      if (next === group.key) {
                        setActiveSetId(group.sets[0]?.id ?? null);
                        // Sync newly expanded exercise to widget
                        const firstUnloggedSet = group.sets.find(
                          (s) => !loggedSetIds.has(s.id)
                        );
                        if (firstUnloggedSet) {
                          const setIndex = group.sets.findIndex(
                            (s) => s.id === firstUnloggedSet.id
                          );
                          syncCurrentExerciseToWidget(group.key, setIndex);
                        }
                      }
                      return next;
                    });
                  }}
                  onChangeSet={updateSet}
                  startingSuggestion={startingSuggestions[group.exerciseId]}
                  onApplyStartingSuggestion={() =>
                    applyStartingSuggestionToGroup(
                      group.key,
                      startingSuggestions[group.exerciseId]
                    )
                  }
                  onLogSet={logSet}
                  activeSetId={activeSetId}
                  onSelectSet={setActiveSetId}
                  autoRestTimer={autoRestTimer}
                  loggedSetIds={loggedSetIds}
                  restRemaining={restRemaining}
                  lastLoggedSetId={lastLoggedSetId}
                  sessionRestSeconds={sessionRestTimes[group.key]}
                  warmupRestSeconds={sessionWarmupRestTimes[group.key]}
                  onUndo={undoSet}
                  onSwap={() => setSwapExerciseKey(group.key)}
                  onAdjustTimer={() => setTimerAdjustExerciseKey(group.key)}
                  onDrag={drag}
                  isDragging={isActive}
                  onAddSet={() => handleAddSet(group.key)}
                  onRemoveSet={handleRemoveSet}
                  onDeleteExercise={() => handleDeleteExercise(group.key)}
                  onImagePress={() =>
                    group.imageUrl && setImagePreviewUrl(group.imageUrl)
                  }
                  onShowInstructions={() =>
                    setInstructionsExercise({
                      id: group.exerciseId,
                      name: group.name,
                    })
                  }
                  showExerciseDifficultyFeedback={pendingDifficultyFeedbackKey === group.key}
                  onExerciseDifficultyFeedback={(rating: SetDifficultyRating) => {
                    // Apply rating to all working sets in this exercise
                    const workingSetsInGroup = setsRef.current.filter(
                      (s) =>
                        (s.templateExerciseId ?? s.exerciseId) === group.key &&
                        s.setKind !== "warmup"
                    );
                    const updatedSets = workingSetsInGroup.map((s) => ({
                      ...s,
                      difficultyRating: rating,
                    }));
                    if (updatedSets.length > 0) {
                      applySetUpdates(updatedSets);
                    }
                    // Clear pending state and advance to next exercise
                    setPendingDifficultyFeedbackKey(null);
                    advanceToNextExercise(group.key, loggedSetIds);
                  }}
                  onSkipDifficultyFeedback={() => {
                    // Clear pending state and advance to next exercise without saving rating
                    setPendingDifficultyFeedbackKey(null);
                    advanceToNextExercise(group.key, loggedSetIds);
                  }}
                />
              </ScaleDecorator>
            )}
          />
        </View>

        {/* Scroll fade gradients */}
        {showTopGradient && (
          <LinearGradient
            colors={[
              colors.background,
              `${colors.background}F5`,
              `${colors.background}E8`,
              `${colors.background}D0`,
              `${colors.background}B0`,
              `${colors.background}88`,
              `${colors.background}60`,
              `${colors.background}38`,
              `${colors.background}18`,
              `${colors.background}08`,
              "transparent",
            ]}
            locations={[0, 0.08, 0.15, 0.25, 0.35, 0.45, 0.55, 0.68, 0.82, 0.92, 1]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 140 + insets.top,
              pointerEvents: "none",
              zIndex: 20,
              elevation: 20,
            }}
          />
        )}
        {showBottomGradient && (
          <LinearGradient
            colors={[
              "transparent",
              `${colors.background}10`,
              `${colors.background}30`,
              `${colors.background}60`,
              `${colors.background}90`,
              `${colors.background}C0`,
              `${colors.background}E0`,
              colors.background,
            ]}
            locations={[0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 60 + insets.bottom,
              pointerEvents: "none",
              zIndex: 20,
              elevation: 20,
            }}
          />
        )}
      </View>
    </ScreenContainer>
  );
};

type SetInputRowProps = {
  set: WorkoutSet;
  displayIndex: number;
  isWarmup?: boolean;
  onChange: (updated: WorkoutSet) => void;
  onLog: () => void;
  restSeconds?: number;
  isActive?: boolean;
  autoRestTimer: boolean;
  logged: boolean;
  onUndo: () => void;
  onRemove: () => void;
  canRemove: boolean;
};

const SetInputRow = ({
  set,
  displayIndex,
  isWarmup,
  onChange,
  onLog,
  restSeconds,
  isActive,
  autoRestTimer,
  logged,
  onUndo,
  onRemove,
  canRemove,
}: SetInputRowProps) => {
  const isCardio = isCardioExercise(set.exerciseId, set.exerciseName);
  const [weightText, setWeightText] = useState(set.actualWeight?.toString() ?? "");
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const restLabelSeconds =
    restSeconds ??
    (isWarmup ? DEFAULT_WARMUP_REST_SECONDS : DEFAULT_WORKING_REST_SECONDS);

  useEffect(() => {
    if (isEditingWeight) return;
    setWeightText(set.actualWeight?.toString() ?? "");
  }, [isEditingWeight, set.actualWeight, set.id]);

  const targetLine = isCardio
    ? [
        set.targetDistance !== undefined
          ? `${set.targetDistance} mi`
          : undefined,
        set.targetIncline !== undefined
          ? `${set.targetIncline}% incline`
          : undefined,
        set.targetDurationMinutes !== undefined
          ? `${set.targetDurationMinutes} min`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · ")
    : [
        set.targetWeight !== undefined ? `${set.targetWeight} lb` : undefined,
        set.targetReps !== undefined ? `${set.targetReps} reps` : undefined,
      ]
        .filter(Boolean)
        .join(" · ");

  const updateField = (field: keyof WorkoutSet, text: string) => {
    // Allow empty string, decimals in progress (e.g., "135."), and valid numbers
    if (text === "") {
      onChange({ ...set, [field]: undefined });
      return;
    }

    // Allow partial decimal input (e.g., "135." or "135.5")
    // Only parse to number if it's a complete valid number
    const numValue = parseFloat(text);
    if (!isNaN(numValue)) {
      onChange({ ...set, [field]: numValue });
    }
  };

  return (
    <View
      style={{
        gap: 8,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isActive
          ? colors.primary
          : isWarmup
          ? `${colors.secondary}35`
          : colors.border,
        backgroundColor: isActive
          ? "rgba(34,197,94,0.12)"
          : isWarmup
          ? "rgba(56,189,248,0.08)"
          : colors.surfaceMuted,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
              Set {displayIndex + 1}
            </Text>
            {isWarmup ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: `${colors.secondary}20`,
                  borderWidth: 1,
                  borderColor: `${colors.secondary}35`,
                }}
              >
                <Text
                  style={{
                    color: colors.secondary,
                    fontSize: 10,
                    fontWeight: "900",
                    letterSpacing: 0.4,
                  }}
                >
                  WARM UP
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {targetLine ? `Target ${targetLine}` : "Log this effort"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {canRemove && (
            <Pressable
              onPress={onRemove}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons
                name='trash-outline'
                color={colors.textSecondary}
                size={16}
              />
            </Pressable>
          )}
          <Pressable
            onPress={logged ? undefined : onLog}
            disabled={logged}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: logged ? colors.primary : colors.surfaceMuted,
              borderWidth: 1,
              borderColor: logged ? colors.primary : colors.border,
              opacity: logged ? 1 : pressed ? 0.9 : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            })}
          >
            {!logged ? (
              <Ionicons
                name='radio-button-off'
                color={colors.textSecondary}
                size={18}
              />
            ) : null}
            <Text
              style={{
                color: logged ? "#0B1220" : colors.textPrimary,
                fontWeight: "800",
              }}
            >
              {logged ? "Logged" : "Log set"}
            </Text>
          </Pressable>
          {logged ? (
            <Pressable
              onPress={onUndo}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surfaceMuted,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>
                Undo
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {isCardio ? (
        // Cardio inputs: Distance, Incline, Duration
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Distance (mi)
              </Text>
              <TextInput
                style={{
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                keyboardType='decimal-pad'
                placeholder='--'
                placeholderTextColor={colors.textSecondary}
                value={set.actualDistance?.toString() ?? ""}
                onChangeText={(text) => updateField("actualDistance", text)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Incline (%)
              </Text>
              <TextInput
                style={{
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                keyboardType='decimal-pad'
                placeholder='--'
                placeholderTextColor={colors.textSecondary}
                value={set.actualIncline?.toString() ?? ""}
                onChangeText={(text) => updateField("actualIncline", text)}
              />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Duration (min)
              </Text>
              <TextInput
                style={{
                  color: colors.textPrimary,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                keyboardType='decimal-pad'
                placeholder='--'
                placeholderTextColor={colors.textSecondary}
                value={set.actualDurationMinutes?.toString() ?? ""}
                onChangeText={(text) =>
                  updateField("actualDurationMinutes", text)
                }
              />
            </View>
            <View style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        // Strength training inputs: Weight & Reps
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Weight
            </Text>
            <TextInput
              style={{
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              keyboardType='decimal-pad'
              placeholder='--'
              placeholderTextColor={colors.textSecondary}
              value={weightText}
              onFocus={() => setIsEditingWeight(true)}
              onBlur={() => {
                setIsEditingWeight(false);
                setWeightText(set.actualWeight?.toString() ?? "");
              }}
              onChangeText={(text) => {
                const next = text.replace(/[^0-9.]/g, "");
                const parts = next.split(".");
                const normalized =
                  parts.length <= 2
                    ? next
                    : `${parts[0]}.${parts.slice(1).join("")}`;
                setWeightText(normalized);
                updateField("actualWeight", normalized);
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Reps
            </Text>
            <TextInput
              style={{
                color: colors.textPrimary,
                backgroundColor: colors.surface,
                borderRadius: 8,
                padding: 10,
                borderWidth: 1,
                borderColor: colors.border,
              }}
              keyboardType='number-pad'
              placeholder='--'
              placeholderTextColor={colors.textSecondary}
              value={set.actualReps?.toString() ?? ""}
              onChangeText={(text) => updateField("actualReps", text)}
            />
          </View>
        </View>
      )}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Rest after set: {restLabelSeconds}s
        </Text>
        {!autoRestTimer ? (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Auto rest off
          </Text>
        ) : null}
      </View>
    </View>
  );
};

type ExerciseCardProps = {
  group: ExerciseGroup;
  expanded: boolean;
  onToggle: () => void;
  onChangeSet: (updated: WorkoutSet) => void;
  startingSuggestion?: StartingSuggestion;
  onApplyStartingSuggestion?: () => void;
  onLogSet: (setId: string, restSeconds?: number) => void;
  activeSetId: string | null;
  onSelectSet: (setId: string | null) => void;
  autoRestTimer: boolean;
  loggedSetIds: Set<string>;
  restRemaining: number | null;
  lastLoggedSetId: string | null;
  sessionRestSeconds?: number;
  warmupRestSeconds?: number;
  onUndo: (setId: string) => void;
  onSwap: () => void;
  onAdjustTimer: () => void;
  onDrag: () => void;
  isDragging: boolean;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onDeleteExercise: () => void;
  onImagePress: () => void;
  onShowInstructions: () => void;
  showExerciseDifficultyFeedback: boolean;
  onExerciseDifficultyFeedback: (rating: SetDifficultyRating) => void;
  onSkipDifficultyFeedback: () => void;
};

const ExerciseCard = ({
  group,
  expanded,
  onToggle,
  onChangeSet,
  startingSuggestion,
  onApplyStartingSuggestion,
  onLogSet,
  activeSetId,
  onSelectSet,
  autoRestTimer,
  loggedSetIds,
  restRemaining,
  lastLoggedSetId,
  sessionRestSeconds,
  warmupRestSeconds,
  onUndo,
  onSwap,
  onAdjustTimer,
  onDrag,
  isDragging,
  onAddSet,
  onRemoveSet,
  onDeleteExercise,
  onImagePress,
  onShowInstructions,
  showExerciseDifficultyFeedback,
  onExerciseDifficultyFeedback,
  onSkipDifficultyFeedback,
}: ExerciseCardProps) => {
  const loggedSetsCount = group.sets.filter((s) =>
    loggedSetIds.has(s.id)
  ).length;
  const allSetsLogged = loggedSetsCount === group.sets.length;
  const isCardioGroup = isCardioExercise(group.exerciseId, group.name);

  const warmupSetCount = group.sets.filter((set) => set.setKind === "warmup").length;
  const workingSetCount = group.sets.length - warmupSetCount;
  const primaryWorkingSet =
    group.sets.find((set) => set.setKind !== "warmup") ?? group.sets[0];
  const exerciseRestSeconds =
    sessionRestSeconds ?? group.restSeconds ?? DEFAULT_WORKING_REST_SECONDS;

  const summaryLine = `${workingSetCount} working${
    warmupSetCount > 0 ? ` · ${warmupSetCount} warm-up` : ""
  } · ${
    primaryWorkingSet?.targetReps
      ? `${primaryWorkingSet.targetReps} reps`
      : "adjust as you go"
  }`;

  const hasWeightSuggestion =
    typeof startingSuggestion?.suggestedWeight === "number" &&
    Number.isFinite(startingSuggestion.suggestedWeight);
  const hasRepsSuggestion =
    typeof startingSuggestion?.suggestedReps === "number" &&
    Number.isFinite(startingSuggestion.suggestedReps);

  const hasMissingWeight = group.sets.some(
    (set) =>
      set.setKind !== "warmup" &&
      !loggedSetIds.has(set.id) &&
      set.actualWeight === undefined &&
      set.targetWeight === undefined
  );
  const hasMissingReps = group.sets.some(
    (set) =>
      set.setKind !== "warmup" &&
      !loggedSetIds.has(set.id) &&
      set.actualReps === undefined &&
      set.targetReps === undefined
  );

  const canApplyStartingSuggestion =
    Boolean(startingSuggestion) &&
    ((hasWeightSuggestion && hasMissingWeight) ||
      (hasRepsSuggestion && hasMissingReps));

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDragging
          ? colors.primary
          : allSetsLogged && !expanded
          ? colors.primary
          : colors.border,
        backgroundColor:
          allSetsLogged && !expanded ? "rgba(34,197,94,0.08)" : colors.surface,
        marginBottom: 12,
        opacity: isDragging ? 0.7 : 1,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: 12,
          gap: 10,
        }}
      >
        <Pressable
          onLongPress={onDrag}
          delayLongPress={100}
          style={({ pressed }) => ({
            padding: 4,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Ionicons name='menu' size={20} color={colors.textSecondary} />
        </Pressable>
        <Pressable
          onPress={onToggle}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: "700",
              }}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {group.name}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {allSetsLogged && !expanded
                ? `Complete · ${loggedSetsCount}/${group.sets.length} sets logged`
                : summaryLine}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textPrimary}
          />
        </Pressable>
        <Pressable
          onPress={onDeleteExercise}
          style={({ pressed }) => ({
            padding: 4,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Ionicons
            name='trash-outline'
            size={20}
            color={colors.error || "#EF4444"}
          />
        </Pressable>
      </View>

      {expanded ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Pressable onPress={onImagePress}>
              {group.imageUrl ? (
                <Image
                  source={{ uri: group.imageUrl }}
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceMuted,
                  }}
                />
              ) : (
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 12,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: colors.textSecondary, fontWeight: "700" }}
                  >
                    {group.name[0]?.toUpperCase() ?? "?"}
                  </Text>
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                Fine tune before you log
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Use your saved defaults or tweak weight/reps below for this set.
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={onShowInstructions}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons
                name='information-circle-outline'
                size={18}
                color={colors.secondary}
              />
            </Pressable>
            <Pressable
              onPress={onSwap}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons
                name='swap-horizontal'
                size={16}
                color={colors.textPrimary}
              />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Swap
              </Text>
            </Pressable>
            <Pressable
              onPress={onAdjustTimer}
              style={({ pressed }) => ({
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons
                name='timer-outline'
                size={16}
                color={colors.textPrimary}
              />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Rest: {exerciseRestSeconds}s
              </Text>
            </Pressable>
          </View>

          {canApplyStartingSuggestion ? (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 10,
              }}
            >
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>
                  Suggested start
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {startingSuggestion?.suggestedWeight
                    ? `${startingSuggestion.suggestedWeight} lb`
                    : "—"}
                  {startingSuggestion?.suggestedReps
                    ? ` · ${startingSuggestion.suggestedReps} reps`
                    : ""}
                  {startingSuggestion?.reason ? ` · ${startingSuggestion.reason}` : ""}
                </Text>
              </View>
              <Pressable
                onPress={onApplyStartingSuggestion}
                style={({ pressed }) => ({
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                  alignItems: "center",
                })}
              >
                <Text style={{ color: "#0B1220", fontWeight: "900" }}>
                  Apply to working sets
                </Text>
              </Pressable>
            </View>
          ) : null}

          {group.sets.map((set, displayIndex) => {
            // Use a shorter default rest for warm-ups unless the user explicitly set a session timer.
            const restSecondsForSet =
              set.setKind === "warmup"
                ? warmupRestSeconds ?? DEFAULT_WARMUP_REST_SECONDS
                : exerciseRestSeconds;

            return (
              <View key={set.id} style={{ gap: 8 }}>
                <SetInputRow
                  set={set}
                  displayIndex={displayIndex}
                  isWarmup={set.setKind === "warmup"}
                  onChange={onChangeSet}
                  onLog={() => onLogSet(set.id, restSecondsForSet)}
                  restSeconds={restSecondsForSet}
                  isActive={activeSetId === set.id}
                  autoRestTimer={autoRestTimer}
                  logged={loggedSetIds.has(set.id)}
                  onUndo={() => onUndo(set.id)}
                  onRemove={() => onRemoveSet(set.id)}
                  canRemove={group.sets.length > 1}
                />
                {restRemaining !== null && lastLoggedSetId === set.id && !showExerciseDifficultyFeedback ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Ionicons name='timer' size={18} color={colors.primary} />
                      <Text
                        style={{ color: colors.textPrimary, fontWeight: "700" }}
                      >
                        Rest
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: colors.primary,
                        fontWeight: "800",
                        fontSize: 16,
                      }}
                    >
                      {formatSeconds(restRemaining)}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* Exercise difficulty feedback - shown after all sets logged */}
          {showExerciseDifficultyFeedback && (
            <View
              style={{
                padding: 14,
                borderRadius: 14,
                backgroundColor: `${colors.primary}12`,
                borderWidth: 1,
                borderColor: `${colors.primary}30`,
                gap: 12,
              }}
            >
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "800" }}>
                  How did this exercise feel?
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  This helps personalize your weight suggestions
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => onExerciseDifficultyFeedback("too_easy")}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: pressed ? `${colors.secondary}35` : `${colors.secondary}20`,
                    borderWidth: 1,
                    borderColor: `${colors.secondary}50`,
                    alignItems: "center",
                  })}
                >
                  <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: "800" }}>
                    Too Easy
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onExerciseDifficultyFeedback("just_right")}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: pressed ? `${colors.primary}35` : `${colors.primary}20`,
                    borderWidth: 1,
                    borderColor: `${colors.primary}50`,
                    alignItems: "center",
                  })}
                >
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "800" }}>
                    Just Right
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onExerciseDifficultyFeedback("too_hard")}
                  style={({ pressed }) => ({
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: pressed ? `${colors.error}35` : `${colors.error}20`,
                    borderWidth: 1,
                    borderColor: `${colors.error}50`,
                    alignItems: "center",
                  })}
                >
                  <Text style={{ color: colors.error, fontSize: 13, fontWeight: "800" }}>
                    Too Hard
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={onSkipDifficultyFeedback}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 10,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
                  Skip
                </Text>
                <Ionicons name="arrow-forward" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {/* Add Set button (disabled for cardio) */}
          {!isCardioGroup ? (
            <Pressable
              onPress={onAddSet}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Ionicons
                name='add-circle-outline'
                size={16}
                color={colors.primary}
              />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Add Set
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

export default WorkoutSessionScreen;
