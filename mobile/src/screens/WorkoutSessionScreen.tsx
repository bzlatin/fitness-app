import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import ScreenContainer from "../components/layout/ScreenContainer";
import SetEditorRow from "../components/workouts/SetEditorRow";
import {
  completeSession,
  fetchSession,
  startSessionFromTemplate,
} from "../api/sessions";
import { RootRoute, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { WorkoutSet } from "../types/workouts";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useActiveWorkoutStatus } from "../hooks/useActiveWorkoutStatus";
import { Visibility } from "../types/social";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const VisibilityControl = ({
  value,
  onChange,
  disabled,
}: {
  value: Visibility;
  onChange: (next: Visibility) => void;
  disabled?: boolean;
}) => {
  const options: { value: Visibility; label: string; helper: string }[] = [
    { value: "private", label: "Private", helper: "Only you can see." },
    { value: "followers", label: "Friends", helper: "Gym buddies who follow back." },
    { value: "squad", label: "Squad", helper: "People you follow + accept." },
  ];

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "700" }}>
          Live visibility
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Defaults to private
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? "rgba(34,197,94,0.12)" : colors.surface,
                opacity: disabled || pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  textAlign: "center",
                  color: active ? colors.primary : colors.textPrimary,
                  fontWeight: "700",
                }}
              >
                {option.label}
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {option.helper}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

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
  return hrs > 0 ? `${hrs}:${two(mins)}:${two(secs)}` : `${two(mins)}:${two(secs)}`;
};

const WorkoutSessionScreen = () => {
  const route = useRoute<RootRoute<"WorkoutSession">>();
  const navigation = useNavigation<Nav>();
  const [sessionId, setSessionId] = useState(route.params.sessionId);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [startTime, setStartTime] = useState<string | undefined>(undefined);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const { data: templates } = useWorkoutTemplates();

  const template = useMemo(
    () => templates?.find((t) => t.id === route.params.templateId),
    [templates, route.params.templateId]
  );

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    enabled: Boolean(sessionId),
    queryFn: () => fetchSession(sessionId!),
    onSuccess: (data) => {
      setSets(data.sets);
      setStartTime(data.startedAt);
    },
  });

  const startMutation = useMutation({
    mutationFn: () => startSessionFromTemplate(route.params.templateId),
    onSuccess: (session) => {
      setSessionId(session.id);
      setSets(session.sets);
      setStartTime(session.startedAt);
    },
    onError: () =>
      Alert.alert("Could not start session", "Please try again."),
  });

  useEffect(() => {
    if (!route.params.sessionId) {
      startMutation.mutate();
    }
  }, []);

  useEffect(() => {
    if (!startTime) return;
    const tick = () => {
      const diff = Math.max(
        0,
        Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
      );
      setElapsedSeconds(diff);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

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

  const updateSet = (updated: WorkoutSet) => {
    setSets((prev) => prev.map((set) => (set.id === updated.id ? updated : set)));
  };

  const sessionTitle = templateName ?? "Workout Session";
  const stopwatchLabel = startTime ? formatStopwatch(elapsedSeconds) : "00:00";

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12 }}>
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
              gap: 12,
            }}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>
                {sessionTitle}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                Log your sets below. You can share or change visibility any time.
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                minWidth: 96,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Timer</Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 18,
                  fontWeight: "700",
                  marginTop: 4,
                  letterSpacing: 0.5,
                }}
              >
                {stopwatchLabel}
              </Text>
            </View>
          </View>
          <VisibilityControl
            value={visibility}
            onChange={setVisibility}
            disabled={isUpdating || !sessionId}
          />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Choose who can see that you{"'"}re working out. Nothing is public by default.
          </Text>
        </View>

        {sets.map((set) => (
          <SetEditorRow key={set.id} set={set} onChange={updateSet} />
        ))}

        <Pressable
          disabled={!sessionId}
          onPress={() => finishMutation.mutate()}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            marginTop: 12,
            marginBottom: 24,
            opacity: !sessionId || pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: "#0B1220", fontWeight: "800", fontSize: 16 }}>
            Finish Workout
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

export default WorkoutSessionScreen;
