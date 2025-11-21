import { useEffect, useMemo, useState } from "react";
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
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  restLookup?: Record<string, number | undefined>
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
        restLookup?.[key] ??
        restLookup?.[set.exerciseId] ??
        set.targetRestSeconds,
    };
    if (!resolved.restSeconds) {
      resolved.restSeconds =
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
  const { data: templates } = useWorkoutTemplates();

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

  const finishMutation = useMutation({
    mutationFn: () => completeSession(sessionId!, sets),
    onSuccess: (session) => {
      endActiveStatus();
      const summary = summarizeSets(sets);
      navigation.navigate("PostWorkoutShare", {
        sessionId: session.id,
        templateId: session.templateId,
        templateName: templateName,
        totalSets: summary.totalSets,
        totalVolume: summary.totalVolume,
        prCount: summary.prCount,
      });
    },
    onError: () => Alert.alert("Could not finish workout"),
  });

  useEffect(
    () => () => {
      endActiveStatus();
    },
    [endActiveStatus]
  );

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
    () => groupSetsByExercise(sets, restLookup),
    [sets, restLookup]
  );

  useEffect(() => {
    const firstIncompleteGroup = groupedSets.find((group) =>
      group.sets.some((set) => !loggedSetIds.has(set.id))
    );
    if (!autoFocusEnabled) return;
    if (!activeExerciseKey && firstIncompleteGroup) {
      setActiveExerciseKey(firstIncompleteGroup.key);
    }
    if (
      (!activeSetId || !loggedSetIds.has(activeSetId)) &&
      firstIncompleteGroup?.sets[0]
    ) {
      setActiveSetId(firstIncompleteGroup.sets[0].id);
    }
  }, [activeExerciseKey, activeSetId, groupedSets, loggedSetIds, autoFocusEnabled]);

  useEffect(() => {
    if (!restEndsAt) return;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((restEndsAt - Date.now()) / 1000)
      );
      setRestRemaining(remaining);
      if (remaining <= 0) {
        setRestEndsAt(null);
        setTimeout(() => setRestRemaining(null), 400);
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [restEndsAt]);

  const startRestTimer = (seconds?: number) => {
    const duration = Math.max(10, seconds ?? 90);
    setRestRemaining(duration);
    setRestEndsAt(Date.now() + duration * 1000);
  };

  const logSet = (setId: string, restSeconds?: number) => {
    const currentSet = sets.find((s) => s.id === setId);
    if (!currentSet) return;

    const updatedLoggedSetIds = new Set(loggedSetIds);
    updatedLoggedSetIds.add(setId);

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

    if (autoRestTimer) {
      const fallbackRest =
        restSeconds ??
        currentSet.targetRestSeconds ??
        restLookup[currentSet.templateExerciseId ?? currentSet.exerciseId];
      startRestTimer(fallbackRest ?? 90);
    } else {
      setRestRemaining(null);
      setRestEndsAt(null);
    }

    const groupKey = currentSet.templateExerciseId ?? currentSet.exerciseId;
    const group = groupedSets.find((g) => g.key === groupKey);
    if (group) {
      const sorted = [...group.sets]
        .map((s) => (s.id === setId ? updated : s))
        .sort((a, b) => a.setIndex - b.setIndex);
      const nextSet = sorted.find((s) => !updatedLoggedSetIds.has(s.id));
      if (nextSet) {
        setActiveSetId(nextSet.id);
      }

      const allLogged = sorted.every((s) => updatedLoggedSetIds.has(s.id));
      if (allLogged) {
        const currentIndex = groupedSets.findIndex((g) => g.key === group.key);
        const nextGroup = groupedSets[currentIndex + 1];
        if (nextGroup) {
          setAutoFocusEnabled(true);
          setActiveExerciseKey(nextGroup.key);
          setActiveSetId(nextGroup.sets[0]?.id ?? null);
        } else {
          setActiveExerciseKey(null);
          setActiveSetId(null);
        }
      }
    }
  };

  const undoSet = (setId: string) => {
    setLoggedSetIds((prev) => {
      const next = new Set(prev);
      next.delete(setId);
      return next;
    });
    setLastLoggedSetId((prev) => (prev === setId ? null : prev));
    if (restEndsAt && lastLoggedSetId === setId) {
      setRestRemaining(null);
      setRestEndsAt(null);
    }
    setActiveSetId(setId);
    setAutoFocusEnabled(false);
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
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <ScreenContainer scroll>
      <VisibilityModal
        visible={showVisibilityModal}
        value={visibility}
        onChange={setVisibility}
        onClose={() => setShowVisibilityModal(false)}
        disabled={isUpdating || !sessionId}
      />
      <View style={{ gap: 12 }}>
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
            accessibilityLabel={timerActive ? "Pause workout timer" : "Resume workout timer"}
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
                    restRemaining !== null
                      ? colors.primary
                      : colors.textPrimary,
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

        {groupedSets.map((group) => (
          <ExerciseCard
            key={group.key}
            group={group}
            expanded={group.key === activeExerciseKey}
            onToggle={() => {
              setAutoFocusEnabled(false);
              setActiveExerciseKey((prev) => {
                const next = prev === group.key ? null : group.key;
                if (next === group.key) {
                  setActiveSetId(group.sets[0]?.id ?? null);
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
          />
        ))}

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

        <Pressable
          disabled={!sessionId || finishMutation.isPending}
          onPress={() => finishMutation.mutate()}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            marginTop: 12,
            marginBottom: 24,
            opacity:
              !sessionId || finishMutation.isPending || pressed ? 0.8 : 1,
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
}: SetInputRowProps) => {
  const targetLine = [
    set.targetWeight !== undefined ? `${set.targetWeight} lb` : undefined,
    set.targetReps !== undefined ? `${set.targetReps} reps` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const updateField = (field: keyof WorkoutSet, value: number | undefined) => {
    onChange({ ...set, [field]: value });
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
        <View>
          <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
            Set {displayIndex + 1}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {targetLine ? `Target ${targetLine}` : "Log this effort"}
          </Text>
        </View>
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
          <Ionicons
            name={logged ? "checkmark-circle" : "radio-button-off"}
            color={logged ? "#0B1220" : colors.textSecondary}
            size={18}
          />
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
            keyboardType='numeric'
            placeholder='--'
            placeholderTextColor={colors.textSecondary}
            value={set.actualWeight?.toString() ?? ""}
            onChangeText={(text) =>
              updateField("actualWeight", text ? Number(text) : undefined)
            }
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
            keyboardType='numeric'
            placeholder='--'
            placeholderTextColor={colors.textSecondary}
            value={set.actualReps?.toString() ?? ""}
            onChangeText={(text) =>
              updateField("actualReps", text ? Number(text) : undefined)
            }
          />
        </View>
      </View>
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
}: ExerciseCardProps) => {
  const summaryLine = `${group.sets.length} sets · ${
    group.sets[0]?.targetReps
      ? `${group.sets[0].targetReps} reps`
      : "adjust as you go"
  }`;
  const nextIncompleteIndex = group.sets.findIndex(
    (set) => set.actualReps === undefined || set.actualWeight === undefined
  );
  const statusLabel =
    nextIncompleteIndex === -1
      ? "All sets logged"
      : `Set ${nextIncompleteIndex + 1} ready`;

  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 12,
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
            {summaryLine}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {statusLabel}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textPrimary}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 12, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
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
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                Fine tune before you log
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Use your saved defaults or tweak weight/reps below for this set.
              </Text>
            </View>
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
        </View>
      ) : null}
    </View>
  );
};

export default WorkoutSessionScreen;
