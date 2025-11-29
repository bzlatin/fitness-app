import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery } from "@tanstack/react-query";
import ScreenContainer from "../components/layout/ScreenContainer";
import FatigueIndicator from "../components/FatigueIndicator";
import { useFatigue, useTrainingRecommendations } from "../hooks/useFatigue";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { MuscleFatigue } from "../types/analytics";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { formatMuscleGroup } from "../utils/muscleGroupCalculations";
import RecoveryBodyMap from "../components/RecoveryBodyMap";
import { generateWorkout } from "../api/ai";
import { useWorkoutHistory } from "../hooks/useWorkoutHistory";
import { fetchExercisesByIds } from "../api/exercises";
import {
  fatigueStatusColors,
  readinessFromFatigueScore,
} from "../utils/fatigueReadiness";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { isPro as checkIsPro } from "../utils/featureGating";

const statusOrder: Record<MuscleFatigue["status"], number> = {
  "high-fatigue": 0,
  "moderate-fatigue": 1,
  optimal: 2,
  "under-trained": 3,
  "no-data": 4,
}

const RecoveryScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { user } = useCurrentUser();
  const [showFresh, setShowFresh] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const muscleStatusSectionRef = useRef<View>(null);
  const [bodySide, setBodySide] = useState<"front" | "back">("front");
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  // Check if user has Pro or Lifetime plan
  const isPro = checkIsPro(user);

  const bodyGender =
    (user?.onboardingData?.bodyGender as "male" | "female" | undefined) ??
    "male";

  // Fetch fatigue data for all users (free users can see heatmap)
  const {
    data: fatigue,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useFatigue(true);
  const {
    data: recommendations,
    isLoading: recLoading,
    isRefetching: recRefetching,
    refetch: refetchRecommendations,
  } = useTrainingRecommendations(isPro && !!fatigue);
  const aiWorkout = useMutation({
    mutationFn: async () => {
      const targetMuscles = recommendations?.targetMuscles ?? [];
      const highFatigue = (fatigue?.perMuscle ?? [])
        .filter((m) => m.fatigued)
        .map((m) => formatMuscleGroup(m.muscleGroup));

      // Build the instruction for the AI
      const requestParts: string[] = [];
      if (targetMuscles.length > 0) {
        requestParts.push(
          `Prioritize: ${targetMuscles.map(formatMuscleGroup).join(", ")}`
        );
      }
      if (highFatigue.length > 0) {
        requestParts.push(`Limit volume for: ${highFatigue.join(", ")}`);
      }
      requestParts.push("Stay near recent baseline volume");

      const workout = await generateWorkout({
        specificRequest: requestParts.join(" | "),
      });
      return workout;
    },
    onSuccess: (workout) => {
      navigation.navigate("WorkoutPreview", { workout });
    },
    onError: (err: any) => {
      Alert.alert(
        "AI could not generate workout",
        err?.response?.data?.message || "Please try again."
      );
    },
  });

  const sortedMuscles = useMemo(
    () =>
      (fatigue?.perMuscle ?? []).slice().sort((a, b) => {
        const order = statusOrder[a.status] - statusOrder[b.status];
        if (order !== 0) return order;
        if (a.status === "under-trained")
          return a.fatigueScore - b.fatigueScore;
        return b.fatigueScore - a.fatigueScore;
      }),
    [fatigue]
  );

  const readinessByMuscle = useMemo(
    () =>
      (fatigue?.perMuscle ?? []).map((item) => ({
        ...item,
        readiness: readinessFromFatigueScore(item.fatigueScore),
      })),
    [fatigue?.perMuscle]
  );

  const weakestMuscle = useMemo(() => {
    if (readinessByMuscle.length === 0) return null;
    return readinessByMuscle
      .slice()
      .sort((a, b) => a.readiness.percent - b.readiness.percent)[0];
  }, [readinessByMuscle]);

  const fatiguedMuscles = useMemo(
    () =>
      readinessByMuscle
        .filter(
          (m) => m.status === "high-fatigue" || m.status === "moderate-fatigue"
        )
        .sort((a, b) => a.readiness.percent - b.readiness.percent)
        .slice(0, 3),
    [readinessByMuscle]
  );

  const freshestMusclesDetailed = useMemo(
    () =>
      readinessByMuscle
        .filter((m) => m.status === "optimal" || m.status === "under-trained")
        .sort((a, b) => b.readiness.percent - a.readiness.percent)
        .slice(0, 3),
    [readinessByMuscle]
  );

  const averageReadiness =
    readinessByMuscle.length === 0
      ? null
      : Math.round(
          readinessByMuscle.reduce(
            (acc, item) => acc + item.readiness.percent,
            0
          ) / readinessByMuscle.length
        );

  const averageReadinessLabel =
    averageReadiness === null
      ? "Calibrating"
      : averageReadiness >= 85
      ? "Fresh"
      : averageReadiness >= 65
      ? "Ready to train"
      : averageReadiness >= 45
      ? "Rest recommended"
      : "Needs rest";

  const averageReadinessColor =
    averageReadiness === null
      ? colors.textSecondary
      : averageReadiness >= 85
      ? fatigueStatusColors["under-trained"]
      : averageReadiness >= 65
      ? fatigueStatusColors.optimal
      : averageReadiness >= 45
      ? fatigueStatusColors["moderate-fatigue"]
      : fatigueStatusColors["high-fatigue"];

  const lastWorkoutDays = useMemo(() => {
    if (!fatigue?.lastWorkoutAt) return null;
    const diff =
      (Date.now() - new Date(fatigue.lastWorkoutAt).getTime()) /
      (1000 * 60 * 60 * 24);
    return Math.max(0, Math.floor(diff));
  }, [fatigue?.lastWorkoutAt]);

  // Pull recent history for muscle drill-downs (last 30d)
  const historyEnd = useMemo(() => new Date(), []);
  const historyStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);
  const { data: history } = useWorkoutHistory(historyStart, historyEnd);
  const exerciseIds = useMemo(() => {
    const ids = new Set<string>();
    history?.days.forEach((day) =>
      day.sessions.forEach((session) =>
        session.exercises.forEach((ex) => ids.add(ex.exerciseId))
      )
    );
    return Array.from(ids);
  }, [history]);
  const { data: exerciseMap } = useQuery({
    queryKey: ["exercises", "history-batch", exerciseIds.join(",")],
    queryFn: async () => {
      const exercises = await fetchExercisesByIds(exerciseIds);
      const map = new Map<string, { name: string; muscle: string }>();
      exercises.forEach((ex) =>
        map.set(ex.id, { name: ex.name, muscle: ex.primaryMuscleGroup })
      );
      return map;
    },
    enabled: exerciseIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const selectedMuscleExercises = useMemo(() => {
    if (!selectedMuscle || !history || !exerciseMap) return [];
    const normalizeMuscle = (muscle: string) => {
      const key = muscle.toLowerCase().replace(/\s+/g, "-");
      const aliases: Record<string, string> = {
        "upper-back": "back",
        upper_back: "back",
        trapezius: "back",
        traps: "back",
        lats: "back",
        "latissimus-dorsi": "back",
        "latissimus dorsi": "back",
        "lower-back": "back",
        lower_back: "back",
        back: "back",
        chest: "chest",
        pectorals: "chest",
        pecs: "chest",
        deltoids: "shoulders",
        delts: "shoulders",
        shoulders: "shoulders",
        "rear-delts": "shoulders",
        biceps: "biceps",
        triceps: "triceps",
        quadriceps: "legs",
        quads: "legs",
        hamstring: "legs",
        hamstrings: "legs",
        calves: "legs",
        calves_both: "legs",
        adductors: "legs",
        gluteal: "glutes",
        glutes: "glutes",
        abs: "core",
        abdominals: "core",
        core: "core",
        obliques: "core",
      };
      if (aliases[key]) return aliases[key];
      if (key.includes("back") || key.includes("lat")) return "back";
      if (key.includes("shoulder") || key.includes("delt")) return "shoulders";
      if (key.includes("chest") || key.includes("pec")) return "chest";
      if (key.includes("quad") || key.includes("ham") || key.includes("leg"))
        return "legs";
      if (key.includes("glute")) return "glutes";
      if (key.includes("ab") || key.includes("core") || key.includes("oblique"))
        return "core";
      return muscle.toLowerCase();
    };
    const target = normalizeMuscle(selectedMuscle);
    const matches: {
      name: string;
      date: string;
      sets: number;
      volume?: number;
    }[] = [];
    history.days.forEach((day) => {
      day.sessions.forEach((session) => {
        session.exercises.forEach((ex) => {
          const meta = exerciseMap.get(ex.exerciseId);
          if (meta?.muscle && normalizeMuscle(meta.muscle) === target) {
            matches.push({
              name: meta.name,
              date: session.finishedAt || session.startedAt,
              sets: ex.sets,
              volume: ex.volumeLbs,
            });
          }
        });
      });
    });
    return matches.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [selectedMuscle, history, exerciseMap]);
  const safeMuscleExercises = useMemo(
    () =>
      selectedMuscleExercises.filter(
        (item) => item && typeof item === "object" && "name" in item && "date" in item
      ),
    [selectedMuscleExercises]
  );

  const selectedMuscleMeta = useMemo(
    () => readinessByMuscle.find((item) => item.muscleGroup === selectedMuscle),
    [readinessByMuscle, selectedMuscle]
  );

  const weakestReadinessColor =
    weakestMuscle?.readiness.color ?? colors.textSecondary;

  const guidanceCopy = useMemo(() => {
    const fatigueList = fatiguedMuscles.map((m) =>
      formatMuscleGroup(m.muscleGroup)
    );
    const readyList = freshestMusclesDetailed.map((m) =>
      formatMuscleGroup(m.muscleGroup)
    );

    if (fatigueList.length > 0 && readyList.length > 0) {
      return `Keep intensity low for ${fatigueList.join(
        ", "
      )}. Favor ${readyList.join(", ")} if you train today.`;
    }

    if (fatigueList.length > 0) {
      return `Dial back load for ${fatigueList.join(
        ", "
      )}. Mobility or technique work is safest.`;
    }

    if (readyList.length > 0) {
      return `You're cleared to push ${readyList.join(
        ", "
      )}. Keep total volume near your baseline.`;
    }

    return "Tap a muscle on the map to see per-muscle readiness and recent exercises.";
  }, [fatiguedMuscles, freshestMusclesDetailed]);

  const onRefresh = useCallback(async () => {
    await refetch();
    await refetchRecommendations();
  }, [refetch, refetchRecommendations]);

  const handleMuscleSelect = useCallback((muscle: string) => {
    // Free users can see the heatmap but not the detailed percentages modal
    if (!isPro) {
      setShowPaywallModal(true);
      return;
    }
    setSelectedMuscle(muscle);
  }, [isPro]);

  const emptyState =
    fatigue &&
    fatigue.perMuscle.every(
      (m) => m.status === "no-data" || m.last7DaysVolume === 0
    );

  const modalListMaxHeight = Math.round(Dimensions.get("window").height * 0.55);

  const EmptyExercises = () => (
    <View style={{ paddingVertical: 20, alignItems: "center" }}>
      <Text
        style={{
          color: colors.textSecondary,
          textAlign: "center",
        }}
      >
        No recent exercises logged for this muscle.
      </Text>
    </View>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ marginTop: 10, color: colors.textSecondary }}>
            Loading recovery insights...
          </Text>
        </View>
      );
    }

    if (isError) {
      return (
        <View style={{ gap: 12, paddingTop: 20 }}>
          <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
            Recovery & Fatigue
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.textSecondary }}>
              We couldn't load your recovery data right now.
            </Text>
            <Pressable
              onPress={() => onRefresh()}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.surface,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                Retry
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    const hasNoData = !fatigue || emptyState;

    if (hasNoData) {
      // Show empty state message but still show the body heatmap below
      return (
        <View style={{ gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
              Recovery & Fatigue
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {isPro
                ? "Track your muscle recovery with our interactive body heatmap and detailed analytics."
                : "Track your muscle recovery with our interactive body heatmap."}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 8,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
              }}
            >
              Building your recovery baseline
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Log a few workouts this week to see muscle fatigue levels, recovery trends, and
              {isPro ? " personalized training recommendations" : " which muscles need rest"}.
            </Text>
          </View>

          {/* Always show body heatmap even with no data */}
          <RecoveryBodyMap
            data={fatigue?.perMuscle ?? []}
            onSelectMuscle={handleMuscleSelect}
            side={bodySide}
            gender={bodyGender}
            onSideChange={setBodySide}
          />

          {/* Free users: Show upgrade prompt */}
          {!isPro && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 20 }}>👑</Text>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                    flex: 1,
                  }}
                >
                  Unlock Detailed Recovery Analytics
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
                Get detailed readiness percentages for each muscle, view your exercise history, and receive AI-powered training recommendations.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primary + "15", borderWidth: 1, borderColor: colors.primary + "30" }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>✓ Detailed percentages</Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primary + "15", borderWidth: 1, borderColor: colors.primary + "30" }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>✓ Exercise history</Text>
                </View>
                <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primary + "15", borderWidth: 1, borderColor: colors.primary + "30" }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>✓ AI recommendations</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowPaywallModal(true)}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  marginTop: 8,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.surface,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 15,
                  }}
                >
                  Upgrade to Pro
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      );
    }

    return (
      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
            Recovery & Fatigue
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {isPro
              ? "Per-muscle readiness from your last 7 days. Tap the heatmap to drill into exercises."
              : "Track your muscle recovery with our interactive body heatmap."}
          </Text>
        </View>

        {/* Pro users: Show detailed recovery & readiness card */}
        {isPro && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 14,
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
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              Recovery & Readiness
            </Text>
            {fatigue.deloadWeekDetected && (
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: `${colors.secondary}20`,
                  borderWidth: 1,
                  borderColor: `${colors.secondary}50`,
                }}
              >
                <Text
                  style={{
                    color: colors.secondary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 12,
                  }}
                >
                  Deload week
                </Text>
              </View>
            )}
            </View>

            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                lineHeight: 18,
              }}
            >
              {guidanceCopy}
            </Text>

            {fatiguedMuscles.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Needs rest
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {fatiguedMuscles.map((muscle) => (
                    <View
                      key={muscle.muscleGroup}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: muscle.readiness.color,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 13,
                        }}
                      >
                        {formatMuscleGroup(muscle.muscleGroup)}
                      </Text>
                      <Text
                        style={{
                          color: muscle.readiness.color,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 14,
                          marginTop: 2,
                        }}
                      >
                        {`${muscle.readiness.percent}% ready`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {freshestMusclesDetailed.length > 0 && (
              <View style={{ gap: 8 }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Good to push
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {freshestMusclesDetailed.map((muscle) => (
                    <View
                      key={muscle.muscleGroup}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 12,
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: muscle.readiness.color,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 13,
                        }}
                      >
                        {formatMuscleGroup(muscle.muscleGroup)}
                      </Text>
                      <Text
                        style={{
                          color: muscle.readiness.color,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 14,
                          marginTop: 2,
                        }}
                      >
                        {`${muscle.readiness.percent}% ready`}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {fatiguedMuscles.length === 0 &&
              freshestMusclesDetailed.length === 0 && (
                <Text
                  style={{
                    color: colors.textSecondary,
                    textAlign: "center",
                    paddingVertical: 8,
                  }}
                >
                  All muscle groups are balanced. Tap the heatmap for details.
                </Text>
              )}

            {lastWorkoutDays !== null && (
              <View
                style={{
                  paddingTop: 4,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Last workout:{" "}
                  {lastWorkoutDays === 0 ? "today" : `${lastWorkoutDays}d ago`}
                </Text>
              </View>
            )}
          </View>
        )}

        <RecoveryBodyMap
          data={fatigue.perMuscle}
          onSelectMuscle={handleMuscleSelect}
          side={bodySide}
          gender={bodyGender}
          onSideChange={setBodySide}
        />

        {/* Free users: Show upgrade prompt for detailed analytics */}
        {!isPro && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 20 }}>👑</Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 16,
                  flex: 1,
                }}
              >
                Unlock Detailed Recovery Analytics
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
              Tap any muscle to see detailed readiness percentages, recent exercises, and get AI-powered training recommendations.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primary + "15", borderWidth: 1, borderColor: colors.primary + "30" }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>✓ Detailed percentages</Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primary + "15", borderWidth: 1, borderColor: colors.primary + "30" }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>✓ Exercise history</Text>
              </View>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.primary + "15", borderWidth: 1, borderColor: colors.primary + "30" }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>✓ AI recommendations</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowPaywallModal(true)}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: "center",
                marginTop: 8,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.surface,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
              >
                Upgrade to Pro
              </Text>
            </Pressable>
          </View>
        )}

        {/* Pro users: Show fresh muscles section */}
        {isPro && (
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 14,
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
            <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
              Fresh muscles
            </Text>
            <Pressable
              onPress={() => setShowFresh((prev) => !prev)}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              })}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.medium,
                  fontSize: 12,
                }}
              >
                {showFresh ? "Hide" : "Show"}
              </Text>
            </Pressable>
            </View>
            <Text style={{ color: colors.textSecondary }}>
              Ready targets below fatigue threshold. Tap to reveal.
            </Text>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 18,
              }}
            >
              {`${fatigue.freshMuscles.length} muscle groups`}
            </Text>
            {showFresh && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {fatigue.freshMuscles.map((muscle) => (
                  <View
                    key={muscle}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: `${colors.primary}15`,
                      borderWidth: 1,
                      borderColor: `${colors.primary}35`,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.medium,
                      }}
                    >
                      {formatMuscleGroup(muscle)}
                    </Text>
                  </View>
                ))}
                {fatigue.freshMuscles.length === 0 && (
                  <Text style={{ color: colors.textSecondary }}>
                    No clear fresh targets—balance intensity today.
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Pro users: Show detailed muscle status list */}
        {isPro && (
          <View ref={muscleStatusSectionRef} style={{ gap: 10 }}>
            <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
              Muscle Group Status
            </Text>
            <View style={{ gap: 10 }}>
              {sortedMuscles.map((item) => (
                <FatigueIndicator key={item.muscleGroup} item={item} />
              ))}
            </View>
          </View>
        )}

        {/* Pro users: AI recommendations section */}
        {isPro && (
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
            <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
              What should I train today?
            </Text>
            <Pressable
              onPress={() => onRefresh()}
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.medium,
                }}
              >
                Refresh
              </Text>
            </Pressable>
            </View>

            <Pressable
              onPress={() => {
                if (!isPro) {
                  setShowPaywallModal(true);
                  return;
                }
                aiWorkout.mutate();
              }}
              disabled={aiWorkout.isPending}
              style={({ pressed }) => ({
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor:
                  pressed || aiWorkout.isPending
                    ? colors.surfaceMuted
                    : colors.surface,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              })}
            >
              {aiWorkout.isPending && (
                <ActivityIndicator color={colors.primary} size='small' />
              )}
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 14,
                }}
              >
                Generate fatigue-aware session
                {!isPro && " 👑"}
              </Text>
            </Pressable>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(recommendations?.targetMuscles ?? []).map((muscle) => (
                <View
                  key={muscle}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: `${colors.primary}18`,
                    borderWidth: 1,
                    borderColor: `${colors.primary}30`,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.medium,
                      fontSize: 13,
                    }}
                  >
                    {formatMuscleGroup(muscle)}
                  </Text>
                </View>
              ))}
              {(recommendations?.targetMuscles?.length ?? 0) === 0 && (
                <Text style={{ color: colors.textSecondary }}>
                  We'll balance volume across optimal muscle groups.
                </Text>
              )}
            </View>

            <View style={{ gap: 10 }}>
              {(recommendations?.recommendedWorkouts ?? []).map((workout) => {
                const canNavigate =
                  workout.id && !workout.id.startsWith("fallback");
                return (
                  <Pressable
                    key={workout.id}
                    disabled={!canNavigate}
                    onPress={() =>
                      canNavigate &&
                      navigation.navigate("WorkoutTemplateDetail", {
                        templateId: workout.id,
                      })
                    }
                    style={({ pressed }) => ({
                      backgroundColor: colors.surface,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 14,
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 16,
                        }}
                      >
                        {workout.name}
                      </Text>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: fontFamilies.medium,
                          fontSize: 12,
                        }}
                      >
                        {workout.muscleGroups.map(formatMuscleGroup).join(" • ")}
                      </Text>
                    </View>
                    <Text style={{ color: colors.textSecondary }}>
                      {workout.reason}
                    </Text>
                    {!canNavigate && (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: fontFamilies.medium,
                          marginTop: 6,
                        }}
                      >
                        Try a light full-body / mobility session.
                      </Text>
                    )}
                  </Pressable>
                );
              })}

              {recLoading && (
                <View
                  style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
                >
                  <ActivityIndicator color={colors.secondary} size='small' />
                  <Text style={{ color: colors.textSecondary }}>
                    Curating today's picks...
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <>
      <ScreenContainer
        ref={scrollViewRef}
        scroll
        paddingTop={16}
        includeTopInset={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || recRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {renderContent()}
      </ScreenContainer>

      <Modal visible={!!selectedMuscle} transparent animationType='fade'>
        <Pressable
          onPress={() => setSelectedMuscle(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            paddingHorizontal: 16,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              maxHeight: "80%",
            }}
          >
            {/* Header */}
            <View
              style={{
                paddingVertical: 18,
                paddingHorizontal: 18,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                gap: 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ flex: 1, gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 20,
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.bold,
                    }}
                  >
                    {formatMuscleGroup(selectedMuscle || "")}
                  </Text>
                  {selectedMuscleMeta && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: colors.surfaceMuted,
                          borderWidth: 1,
                          borderColor: colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 999,
                            backgroundColor: selectedMuscleMeta.readiness.color,
                          }}
                        />
                        <Text
                          style={{
                            color: colors.textPrimary,
                            fontFamily: fontFamilies.bold,
                            fontSize: 14,
                          }}
                        >
                          {`${selectedMuscleMeta.readiness.percent}% ready`}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontFamily: fontFamilies.medium,
                          fontSize: 13,
                        }}
                      >
                        {selectedMuscleMeta.readiness.label}
                      </Text>
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => setSelectedMuscle(null)}
                  style={{
                    padding: 8,
                    marginTop: -4,
                    marginRight: -4,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 14,
                    }}
                  >
                    ✕
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Content */}
            <View
              style={{ paddingHorizontal: 18, paddingVertical: 16, gap: 12 }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Recent exercises (last 30 days)
              </Text>
              <FlatList
                data={safeMuscleExercises}
                keyExtractor={(item, idx) =>
                  `${(item as any)?.name ?? "exercise"}-${(item as any)?.date ?? "date"}-${idx}`
                }
                renderItem={({ item }) => {
                  if (
                    !item ||
                    typeof item !== "object" ||
                    typeof (item as any).name !== "string" ||
                    typeof (item as any).date !== "string"
                  ) {
                    return null;
                  }

                  const safeItem = item as {
                    name: string;
                    date: string;
                    sets?: number;
                    volume?: number;
                  };

                  return (
                    <View
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceMuted,
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 15,
                        }}
                      >
                        {safeItem.name}
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            fontFamily: fontFamilies.medium,
                          }}
                        >
                          {new Date(safeItem.date).toLocaleDateString()}
                        </Text>
                        <View
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: 999,
                            backgroundColor: colors.textSecondary,
                            opacity: 0.5,
                          }}
                        />
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            fontFamily: fontFamilies.medium,
                          }}
                        >
                          {`${safeItem.sets ?? 0} sets`}
                        </Text>
                        {typeof safeItem.volume === "number" && (
                          <>
                            <View
                              style={{
                                width: 3,
                                height: 3,
                                borderRadius: 999,
                                backgroundColor: colors.textSecondary,
                                opacity: 0.5,
                              }}
                            />
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 12,
                                fontFamily: fontFamilies.medium,
                              }}
                            >
                              {`${Math.round(safeItem.volume).toLocaleString()} lb-load`}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>
                  );
                }}
                style={{ maxHeight: modalListMaxHeight }}
                contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                ListEmptyComponent={EmptyExercises}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <PaywallComparisonModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        triggeredBy="recovery"
      />
    </>
  );
};

export default RecoveryScreen;
