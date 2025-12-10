import { useEffect, useMemo, useState, useRef } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import ScreenContainer from "../components/layout/ScreenContainer";
import {
  completeSession,
  fetchSession,
  startSessionFromTemplate,
} from "../api/sessions";
import { API_BASE_URL } from "../api/client";
import { RootRoute, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { WorkoutSet } from "../types/workouts";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useActiveWorkoutStatus } from "../hooks/useActiveWorkoutStatus";
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
} from "../api/analytics";
import { useCurrentUser } from "../hooks/useCurrentUser";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { playTimerSound } from "../utils/timerSound";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
import { syncActiveSessionToWidget } from "../services/widgetSync";
import {
  startWorkoutLiveActivity,
  updateWorkoutLiveActivity,
  endWorkoutLiveActivity,
  endWorkoutLiveActivityWithSummary,
  addLogSetListener,
} from "../services/liveActivity";

type Nav = NativeStackNavigationProp<RootStackParamList>;

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

const summarizeSets = (sessionSets: WorkoutSet[]) => {
  const totalSets = sessionSets.length;
  const totalVolume = sessionSets.reduce((acc, cur) => {
    const reps = cur.actualReps ?? cur.targetReps ?? 0;
    const weight = cur.actualWeight ?? cur.targetWeight ?? 0;
    return acc + reps * weight;
  }, 0);
  const prCount = sessionSets.filter(
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
const isCardioExercise = (exerciseId: string, exerciseName?: string): boolean => {
  const name = (exerciseName || exerciseId).toLowerCase();
  const cardioKeywords = [
    'treadmill', 'running', 'jogging', 'walking',
    'bike', 'cycling', 'bicycle', 'biking',
    'rowing', 'rower',
    'elliptical',
    'stair', 'stepper',
    'swimming', 'swim',
    'jumping rope', 'jump rope',
    'air bike'
  ];
  return cardioKeywords.some(keyword => name.includes(keyword));
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

const WorkoutSessionScreen = () => {
  const route = useRoute<RootRoute<"WorkoutSession">>();
  const navigation = useNavigation<Nav>();
  const [sessionId, setSessionId] = useState(route.params.sessionId);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [startTime, setStartTime] = useState<string | undefined>(undefined);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [elapsedBaseSeconds, setElapsedBaseSeconds] = useState(0);
  const [timerAnchor, setTimerAnchor] = useState<number | null>(null);
  const [timerActive, setTimerActive] = useState(false);
  const [activeExerciseKey, setActiveExerciseKey] = useState<string | null>(
    null
  );
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [autoRestTimer, setAutoRestTimer] = useState(true);
  const [defaultsApplied, setDefaultsApplied] = useState(false);
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [loggedSetIds, setLoggedSetIds] = useState<Set<string>>(new Set());
  const [lastLoggedSetId, setLastLoggedSetId] = useState<string | null>(null);
  const [autoFocusEnabled, setAutoFocusEnabled] = useState(true);
  const [swapExerciseKey, setSwapExerciseKey] = useState<string | null>(null);
  const [timerAdjustExerciseKey, setTimerAdjustExerciseKey] = useState<
    string | null
  >(null);
  const [sessionRestTimes, setSessionRestTimes] = useState<
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
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const { data: templates } = useWorkoutTemplates();
  const { user, updateProfile } = useCurrentUser();
  const subscriptionAccess = useSubscriptionAccess();

  // Refs to access latest state in deep link handler without causing re-renders
  const activeSetIdRef = useRef<string | null>(null);
  const setsRef = useRef<WorkoutSet[]>([]);
  const sessionRestTimesRef = useRef<Record<string, number>>({});
  const loggedSetIdsRef = useRef<Set<string>>(new Set());
  // Lock to prevent duplicate processing of pending log set actions
  const isProcessingLogSetRef = useRef<boolean>(false);
  // Track the last processed timestamp to prevent duplicate processing
  const lastProcessedTimestampRef = useRef<number>(0);

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
    loggedSetIdsRef.current = loggedSetIds;
  }, [loggedSetIds]);

  // Check if user currently has Pro access (blocks grace/expired)
  const isPro = subscriptionAccess.hasProAccess;

  const template = useMemo(
    () => templates?.find((t) => t.id === route.params.templateId),
    [templates, route.params.templateId]
  );

  const restLookup = useMemo(() => {
    if (!template) return {};
    const lookup: Record<string, number | undefined> = {};
    template.exercises.forEach((ex) => {
      lookup[ex.id] = ex.defaultRestSeconds;
      lookup[ex.exerciseId] = ex.defaultRestSeconds;
    });
    return lookup;
  }, [template]);

  const initializeTimer = (startedAt: string, autoStart = true) => {
    const base = Math.max(
      0,
      Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    );
    setStartTime(startedAt);
    setElapsedBaseSeconds(base);
    setElapsedSeconds(base);
    if (autoStart) {
      setTimerAnchor(Date.now());
      setTimerActive(true);
    } else {
      setTimerAnchor(null);
      setTimerActive(false);
    }
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
    if (timerActive) return;
    setTimerAnchor(Date.now());
    setTimerActive(true);
  };

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchSession(sessionId!),
    onSuccess: (data) => {
      setDefaultsApplied(false);
      setSets(data.sets);
      initializeTimer(data.startedAt);
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startSessionFromTemplate(route.params.templateId),
    onSuccess: (session) => {
      setDefaultsApplied(false);
      setSessionId(session.id);
      setSets(session.sets);
      initializeTimer(session.startedAt);
    },
    onError: () => Alert.alert("Could not start session", "Please try again."),
  });

  const applyProgressionMutation = useMutation({
    mutationFn: (exerciseIds?: string[]) =>
      applyProgressionSuggestions(route.params.templateId, exerciseIds),
    onSuccess: (result) => {
      setShowProgressionModal(false);
      Alert.alert(
        "Progression Applied",
        `Updated ${result.updated} exercise${
          result.updated === 1 ? "" : "s"
        } in your template. The new weights will be used in future workouts.`,
        [{ text: "Got it" }]
      );
      // Optionally refresh the template
      // refetch templates if needed
    },
    onError: () => {
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

  useEffect(() => {
    if (defaultsApplied || sets.length === 0) return;
    setSets((prev) =>
      prev.map((set) => ({
        ...set,
        actualWeight: set.actualWeight ?? set.targetWeight,
        actualReps: set.actualReps ?? set.targetReps,
      }))
    );
    setDefaultsApplied(true);
  }, [defaultsApplied, sets.length]);

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
    });

  const queryClient = useQueryClient();

  const finishMutation = useMutation({
    mutationFn: () => {
      // Pause timer before finishing
      pauseTimer();
      return completeSession(sessionId!, sets);
    },
    onSuccess: (session) => {
      endActiveStatus();
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

      // Invalidate fatigue query to refresh recovery data
      queryClient.invalidateQueries({ queryKey: ["fatigue"] });
      queryClient.invalidateQueries({ queryKey: ["training-recommendations"] });

      // Invalidate active session query to remove "Resume Workout" banner
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
    onError: () => Alert.alert("Could not finish workout"),
  });

  useEffect(
    () => () => {
      endActiveStatus();
      // Clear widget when user navigates away from workout
      void syncActiveSessionToWidget(null);
      // End Live Activity when user navigates away
      void endWorkoutLiveActivity();
    },
    [endActiveStatus]
  );

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

  const groupedSets = useMemo(
    () => groupSetsByExercise(sets, restLookup, sessionRestTimes),
    [sets, restLookup, sessionRestTimes]
  );

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

  // Sync initial session state to widget AND start Live Activity when session loads
  useEffect(() => {
    if (!sessionId || !startTime || groupedSets.length === 0) return;

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
  }, [sessionId, startTime, groupedSets.length]);

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
        if (!hasPlayedSound && user?.restTimerSoundEnabled !== false) {
          hasPlayedSound = true;
          playTimerSound();
        }

        // Clear Live Activity rest timer so "Log Set" button appears
        void updateWorkoutLiveActivity({
          restDuration: 0, // Pass 0 to explicitly clear timer
          restEndsAt: null,
        });
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [restEndsAt, user?.restTimerSoundEnabled]);

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

  const startRestTimer = (seconds?: number) => {
    const duration = Math.max(10, seconds ?? 90);
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

    const group = groupedSets.find((g) => g.key === exerciseKey);
    if (!group) return;

    const currentSet = group.sets[currentSetIndex];
    if (!currentSet) return;

    // Determine actual rest duration for widgets
    // If restDuration is explicitly 0, pass 0 to clear the timer
    // If undefined, use the group's rest seconds as fallback
    const actualRestDuration =
      restDuration !== undefined ? restDuration : group.restSeconds ?? 90;

    // Calculate restEndsAt ISO string if we have a timestamp
    const restEndsAtISO =
      restEndsAtTimestamp && restEndsAtTimestamp > 0
        ? new Date(restEndsAtTimestamp).toISOString()
        : actualRestDuration === 0
        ? null
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

    if (!startTime) {
      initializeTimer(new Date().toISOString());
    } else if (!timerActive) {
      resumeTimer();
    }

    // Calculate rest duration (needed for both timer and widget sync)
    // Priority: user-adjusted session rest times > passed restSeconds > template rest times
    const groupKey = currentSet.templateExerciseId ?? currentSet.exerciseId;
    const group = groupedSets.find((g) => g.key === groupKey);
    // Use ref to get current session rest times to avoid stale closure
    const currentSessionRestTimes = sessionRestTimesRef.current;
    const fallbackRest =
      currentSessionRestTimes[groupKey] ?? // Check user-adjusted rest times first
      restSeconds ??
      currentSet.targetRestSeconds ??
      restLookup[groupKey];

    // Start rest timer and capture the end timestamp
    let calculatedRestEndsAt: number | null = null;
    if (autoRestTimer) {
      const restDuration = fallbackRest ?? 90;
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
      const nextSet = sorted.find((s) => !updatedLoggedSetIds.has(s.id));

      if (nextSet) {
        // Immediately update activeSetId to the next unlogged set
        const nextSetIndex = sorted.findIndex((s) => s.id === nextSet.id);

        // CRITICAL: Disable auto-focus to prevent the useEffect from overriding our state
        setAutoFocusEnabled(false);

        // IMMEDIATELY update the ref BEFORE React state update
        activeSetIdRef.current = nextSet.id;
        setActiveSetId(nextSet.id);

        // Sync next set to widget with rest timer
        const restDuration = fallbackRest ?? 90;
        syncCurrentExerciseToWidget(
          groupKey,
          nextSetIndex,
          updated.actualReps,
          updated.actualWeight,
          autoRestTimer ? restDuration : 0, // Pass 0 to explicitly clear timer when disabled
          autoRestTimer ? calculatedRestEndsAt ?? undefined : undefined
        );
      } else {
        // All sets in this exercise are logged, move to next exercise
        const allLogged = sorted.every((s) => updatedLoggedSetIds.has(s.id));
        if (allLogged) {
          const currentIndex = groupedSets.findIndex(
            (g) => g.key === group.key
          );
          const nextGroup = groupedSets[currentIndex + 1];
          if (nextGroup) {
            setAutoFocusEnabled(true);
            setActiveExerciseKey(nextGroup.key);
            const firstUnloggedInNextGroup = nextGroup.sets.find(
              (s) => !updatedLoggedSetIds.has(s.id)
            );
            const nextSetId =
              firstUnloggedInNextGroup?.id ?? nextGroup.sets[0]?.id ?? null;

            // IMMEDIATELY update the ref BEFORE React state update
            activeSetIdRef.current = nextSetId;
            setActiveSetId(nextSetId);

            // Sync next exercise to widget
            if (firstUnloggedInNextGroup) {
              const nextSetIndex = nextGroup.sets.findIndex(
                (s) => s.id === firstUnloggedInNextGroup.id
              );
              syncCurrentExerciseToWidget(nextGroup.key, nextSetIndex);
            }
          } else {
            // IMMEDIATELY update the ref BEFORE React state update
            activeSetIdRef.current = null;
            setActiveExerciseKey(null);
            setActiveSetId(null);
            // All exercises complete, keep showing last exercise with completed state
            const lastSetIndex = sorted.length - 1;
            syncCurrentExerciseToWidget(
              groupKey,
              lastSetIndex,
              updated.actualReps,
              updated.actualWeight,
              0 // No rest timer after workout complete
            );
          }
        }
      }
    }
  };

  const undoSet = (setId: string) => {
    // Create updated loggedSetIds without the undone set
    const updatedLoggedSetIds = new Set(loggedSetIds);
    updatedLoggedSetIds.delete(setId);

    // IMMEDIATELY update refs BEFORE any async operations
    loggedSetIdsRef.current = updatedLoggedSetIds;
    activeSetIdRef.current = setId;

    setLoggedSetIds(updatedLoggedSetIds);
    setLastLoggedSetId((prev) => (prev === setId ? null : prev));
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
          };
        }
        return set;
      })
    );
    setSwapExerciseKey(null);
  };

  const handleAdjustTimer = (exerciseKey: string, newRestSeconds: number) => {
    setSessionRestTimes((prev) => ({
      ...prev,
      [exerciseKey]: newRestSeconds,
    }));
  };

  const handleAddExerciseToSession = (exerciseForm: any) => {
    if (!sessionId) return;

    // Get the highest setIndex to append at the end
    const maxSetIndex =
      sets.length > 0 ? Math.max(...sets.map((s) => s.setIndex)) : -1;

    const baseIndex = maxSetIndex + 100;
    const numSets = exerciseForm.sets || 3;
    const newSets: WorkoutSet[] = [];

    for (let i = 0; i < numSets; i++) {
      const newSet: WorkoutSet = {
        id: `temp-${Date.now()}-${i}`,
        sessionId,
        exerciseId: exerciseForm.exercise.id,
        exerciseName: exerciseForm.exercise.name,
        exerciseImageUrl: exerciseForm.exercise.gifUrl,
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
    // Update all set indices based on new order
    const reorderedSets: WorkoutSet[] = [];
    newGroupedSets.forEach((group, groupIndex) => {
      group.sets.forEach((set, setIndex) => {
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

    const newSet: WorkoutSet = {
      id: `${Date.now()}-${Math.random()}`,
      sessionId: sessionId!,
      templateExerciseId: lastSet.templateExerciseId,
      exerciseId: lastSet.exerciseId,
      exerciseName: lastSet.exerciseName,
      exerciseImageUrl: lastSet.exerciseImageUrl,
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

  const handleExitSession = () => {
    if (!hasWorkoutProgress) {
      endActiveStatus();
      navigation.goBack();
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
            endActiveStatus();
            // Invalidate active session query so the "Resume Workout" banner appears
            queryClient.invalidateQueries({ queryKey: ["activeSession"] });
            navigation.goBack();
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
    setShowTopGradient(scrollY > 20);

    // Show bottom gradient when not at the bottom
    const isNearBottom = scrollY + scrollViewHeight >= contentHeight - 20;
    setShowBottomGradient(!isNearBottom && contentHeight > scrollViewHeight);
  };

  const renderHeader = () => (
    <View style={{ gap: 12, marginBottom: 12 }}>
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
        onPress={() => finishMutation.mutate()}
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
    <ScreenContainer>
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
          currentSeconds={timerAdjustGroup.restSeconds ?? 90}
          exerciseName={timerAdjustGroup.name}
          onSave={(seconds) => {
            handleAdjustTimer(timerAdjustExerciseKey!, seconds);
            setTimerAdjustExerciseKey(null);
          }}
        />
      )}
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
          setShowPaywallModal(true);
        }}
      />
      <PaywallComparisonModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        triggeredBy='progression'
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
      <View style={{ flex: 1 }}>
        <DraggableFlatList
          data={groupedSets}
          keyExtractor={(item) => item.key}
          onDragEnd={({ data }) => handleReorderExercises(data)}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 16 }}
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
                onLogSet={logSet}
                activeSetId={activeSetId}
                onSelectSet={setActiveSetId}
                autoRestTimer={autoRestTimer}
                loggedSetIds={loggedSetIds}
                restRemaining={restRemaining}
                lastLoggedSetId={lastLoggedSetId}
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
              />
            </ScaleDecorator>
          )}
        />
        {/* Top gradient fade */}
        {showTopGradient && (
          <LinearGradient
            colors={[colors.background, "transparent"]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 60,
              pointerEvents: "none",
            }}
          />
        )}
        {/* Bottom gradient fade */}
        {showBottomGradient && (
          <LinearGradient
            colors={["transparent", colors.background]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 80,
              pointerEvents: "none",
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

  const targetLine = isCardio
    ? [
        set.targetDistance !== undefined ? `${set.targetDistance} mi` : undefined,
        set.targetIncline !== undefined ? `${set.targetIncline}% incline` : undefined,
        set.targetDurationMinutes !== undefined ? `${set.targetDurationMinutes} min` : undefined,
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
        borderColor: isActive ? colors.primary : colors.border,
        backgroundColor: isActive
          ? "rgba(34,197,94,0.12)"
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
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
            Set {displayIndex + 1}
          </Text>
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
                onChangeText={(text) => updateField("actualDurationMinutes", text)}
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
              value={set.actualWeight?.toString() ?? ""}
              onChangeText={(text) => updateField("actualWeight", text)}
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
          Rest after set: {restSeconds ?? 90}s
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
  onLogSet: (setId: string, restSeconds?: number) => void;
  activeSetId: string | null;
  onSelectSet: (setId: string | null) => void;
  autoRestTimer: boolean;
  loggedSetIds: Set<string>;
  restRemaining: number | null;
  lastLoggedSetId: string | null;
  onUndo: (setId: string) => void;
  onSwap: () => void;
  onAdjustTimer: () => void;
  onDrag: () => void;
  isDragging: boolean;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onDeleteExercise: () => void;
  onImagePress: () => void;
};

const ExerciseCard = ({
  group,
  expanded,
  onToggle,
  onChangeSet,
  onLogSet,
  activeSetId,
  onSelectSet,
  autoRestTimer,
  loggedSetIds,
  restRemaining,
  lastLoggedSetId,
  onUndo,
  onSwap,
  onAdjustTimer,
  onDrag,
  isDragging,
  onAddSet,
  onRemoveSet,
  onDeleteExercise,
  onImagePress,
}: ExerciseCardProps) => {
  const loggedSetsCount = group.sets.filter((s) => loggedSetIds.has(s.id)).length;
  const allSetsLogged = loggedSetsCount === group.sets.length;

  const summaryLine = `${group.sets.length} sets · ${
    group.sets[0]?.targetReps
      ? `${group.sets[0].targetReps} reps`
      : "adjust as you go"
  }`;

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDragging ? colors.primary : allSetsLogged && !expanded ? colors.primary : colors.border,
        backgroundColor: allSetsLogged && !expanded ? "rgba(34,197,94,0.08)" : colors.surface,
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
                Rest: {group.restSeconds ?? 90}s
              </Text>
            </Pressable>
          </View>

          {group.sets.map((set, displayIndex) => (
            <View key={set.id} style={{ gap: 8 }}>
              <SetInputRow
                set={set}
                displayIndex={displayIndex}
                onChange={onChangeSet}
                onLog={() => onLogSet(set.id, group.restSeconds)}
                restSeconds={group.restSeconds}
                isActive={activeSetId === set.id}
                autoRestTimer={autoRestTimer}
                logged={loggedSetIds.has(set.id)}
                onUndo={() => onUndo(set.id)}
                onRemove={() => onRemoveSet(set.id)}
                canRemove={group.sets.length > 1}
              />
              {restRemaining !== null && lastLoggedSetId === set.id ? (
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
          ))}

          {/* Add Set button */}
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
        </View>
      ) : null}
    </View>
  );
};

export default WorkoutSessionScreen;
