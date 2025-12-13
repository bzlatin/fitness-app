import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import {
  useCreateManualSession,
  useDeleteSession,
  useDuplicateSession,
  useUpdateSession,
  useWorkoutHistory,
} from "../hooks/useWorkoutHistory";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import {
  WorkoutHistoryDay,
  WorkoutHistorySession,
  WorkoutHistoryStats,
} from "../types/workouts";
import { RootStackParamList } from "../navigation/types";
import { fetchSession } from "../api/sessions";
import { createTemplate, fetchTemplate } from "../api/templates";
import { useQueryClient } from "@tanstack/react-query";
import ShareTemplateLinkSheet from "../components/workout/ShareTemplateLinkSheet";

const startOfMonth = (date: Date) => {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const addMonths = (date: Date, delta: number) =>
  startOfMonth(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
  );

const startOfDayUtc = (date: Date) => {
  const copy = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const startOfDayLocal = (date: Date) => {
  const copy = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const formatDateKey = (date: Date) =>
  startOfDayUtc(date).toISOString().split("T")[0];

const getWeekDates = (anchor: Date) => {
  const start = startOfDayUtc(anchor);
  const day = start.getUTCDay() === 0 ? 6 : start.getUTCDay() - 1;
  start.setUTCDate(start.getUTCDate() - day);
  return Array.from({ length: 7 }, (_value, idx) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + idx);
    return d;
  });
};

const buildMonthMatrix = (monthAnchor: Date) => {
  const first = startOfMonth(monthAnchor);
  const offset = first.getUTCDay() === 0 ? 6 : first.getUTCDay() - 1;
  const cursor = new Date(first);
  cursor.setUTCDate(first.getUTCDate() - offset);

  const weeks: Date[][] = [];
  for (let week = 0; week < 6; week += 1) {
    const days: Date[] = [];
    for (let day = 0; day < 7; day += 1) {
      days.push(new Date(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
};

const isSameDay = (a: Date, b: Date) => formatDateKey(a) === formatDateKey(b);
const isSameMonth = (a: Date, b: Date) =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth();

const HistoryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();

  // Get current date in local timezone to correctly identify "today"
  const today = startOfDayLocal(new Date());
  const currentMonth = startOfMonth(today);

  const [monthCursor, setMonthCursor] = useState<Date>(() => startOfMonth(startOfDayLocal(new Date())));
  const [showMonth, setShowMonth] = useState(false);
  const [menuSession, setMenuSession] = useState<WorkoutHistorySession | null>(
    null
  );
  const [durationSession, setDurationSession] =
    useState<WorkoutHistorySession | null>(null);
  const [durationHours, setDurationHours] = useState(1);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSession, setSelectedSession] =
    useState<WorkoutHistorySession | null>(null);
  const [shareLinkTemplate, setShareLinkTemplate] = useState<{
    templateId: string;
    templateName: string;
    sharingDisabled?: boolean;
  } | null>(null);
  const [shareLinkSheetVisible, setShareLinkSheetVisible] = useState(false);
  const [shareNeedsTemplate, setShareNeedsTemplate] =
    useState<WorkoutHistorySession | null>(null);
  const [postSaveAction, setPostSaveAction] = useState<null | "shareLink">(null);
  const [shareLinkLoading, setShareLinkLoading] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [saveTemplateSessionId, setSaveTemplateSessionId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    date: formatDateKey(today),
    templateId: "manual" as string | "manual",
    templateName: "Logged workout",
    exerciseName: "Bench Press / Chest",
    duration: "45",
  });

  // Fixed data range - fetch 2 years of history from today
  const rangeStart = useMemo(
    () => {
      const now = startOfDayLocal(new Date());
      return startOfMonth(addMonths(now, -24));
    },
    []
  );
  const rangeEnd = useMemo(
    () => {
      const now = startOfDayLocal(new Date());
      return startOfMonth(addMonths(now, 12));
    },
    []
  );

  const { data, isLoading, refetch } = useWorkoutHistory(rangeStart, rangeEnd);
  const { data: templates } = useWorkoutTemplates();
  const createManual = useCreateManualSession(rangeStart, rangeEnd);
  const duplicate = useDuplicateSession(rangeStart, rangeEnd);
  const deleteSession = useDeleteSession(rangeStart, rangeEnd);
  const updateSession = useUpdateSession(rangeStart, rangeEnd);

  // Auto-refresh history when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const dayMap = useMemo(() => {
    const map = new Map<string, WorkoutHistoryDay>();
    data?.days.forEach((day) => map.set(day.date, day));
    return map;
  }, [data]);

  const allSessions = useMemo(() => {
    return (data?.days ?? [])
      .flatMap((day) => day.sessions)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
  }, [data]);

  const monthMatrix = useMemo(
    () => buildMonthMatrix(monthCursor),
    [monthCursor]
  );

  const stats: WorkoutHistoryStats | undefined = data?.stats;
  const sessionsForSelectedDay = selectedDay
    ? dayMap.get(formatDateKey(selectedDay))?.sessions ?? []
    : [];

  const buildSessionMetrics = (session?: WorkoutHistorySession | null) => {
    if (!session) return null;
    const startDate = new Date(session.startedAt);
    const durationSeconds =
      session.durationSeconds ??
      (session.finishedAt
        ? Math.max(
            0,
            Math.round(
              (new Date(session.finishedAt).getTime() - startDate.getTime()) / 1000
            )
          )
        : null);

    return {
      durationMinutes:
        durationSeconds !== null && durationSeconds !== undefined
          ? Math.max(1, Math.round(durationSeconds / 60))
          : null,
      caloriesValue:
        session.totalEnergyBurned !== undefined
          ? `${Math.round(session.totalEnergyBurned)} kcal`
          : `${session.estimatedCalories}`,
      avgHr: session.avgHeartRate ? Math.round(session.avgHeartRate) : null,
      maxHr: session.maxHeartRate ? Math.round(session.maxHeartRate) : null,
      isImported: session.source === "apple_health",
    };
  };

  const selectedMetrics = buildSessionMetrics(selectedSession);

  // Reset month cursor to current month when opening
  const handleToggleMonth = () => {
    if (!showMonth) {
      // Opening: reset to current month
      setMonthCursor(currentMonth);
    }
    setShowMonth(!showMonth);
  };

  const handlePrevMonth = () => {
    setMonthCursor((prev) => {
      // Go back one month
      const year = prev.getUTCFullYear();
      const month = prev.getUTCMonth();
      const newMonth = month === 0 ? 11 : month - 1;
      const newYear = month === 0 ? year - 1 : year;
      return new Date(Date.UTC(newYear, newMonth, 1, 0, 0, 0, 0));
    });
  };

  const handleNextMonth = () => {
    setMonthCursor((prev) => {
      // Go forward one month
      const year = prev.getUTCFullYear();
      const month = prev.getUTCMonth();
      const newMonth = month === 11 ? 0 : month + 1;
      const newYear = month === 11 ? year + 1 : year;
      return new Date(Date.UTC(newYear, newMonth, 1, 0, 0, 0, 0));
    });
  };

  const dayStatus = (date: Date) => {
    const key = formatDateKey(date);
    const hasWorkouts = !!dayMap.get(key)?.sessions.length;
    if (isSameDay(date, today)) return "today";
    if (hasWorkouts) return "done";
    if (date < today) return "missed";
    return "idle";
  };
  const hasWorkouts = (date: Date) => !!dayMap.get(formatDateKey(date));

  const formatMonthLabel = (date: Date) => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return `${monthNames[month]} ${year}`;
  };

  const formatDateLong = (date: Date) => {
    const weekdayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const weekday = weekdayNames[date.getUTCDay()];
    const month = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    return `${weekday}, ${month} ${day}`;
  };

  const formatDateTimeShort = (date: Date) => {
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const weekday = weekdayNames[date.getUTCDay()];
    const month = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const formattedHours = hours % 12 || 12;
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedMinutes = minutes.toString().padStart(2, "0");
    return `${weekday}, ${month} ${day}, ${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const formatDateMedium = (date: Date) => {
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const weekday = weekdayNames[date.getUTCDay()];
    const month = monthNames[date.getUTCMonth()];
    const day = date.getUTCDate();
    return `${weekday}, ${month} ${day}`;
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const formattedHours = hours % 12 || 12;
    const ampm = hours >= 12 ? "PM" : "AM";
    const formattedMinutes = minutes.toString().padStart(2, "0");
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const openTemplateShareFromHistory = async (session: WorkoutHistorySession) => {
    setShareLinkLoading(true);
    try {
      const full = await fetchSession(session.id);
      if (!full.templateId) {
        setShareNeedsTemplate(session);
        return;
      }
      const template = await fetchTemplate(full.templateId).catch(() => null);
      setShareLinkTemplate({
        templateId: full.templateId,
        templateName: template?.name ?? session.templateName ?? "Workout",
        sharingDisabled: template?.sharingDisabled,
      });
      setShareLinkSheetVisible(true);
    } catch (error) {
      Alert.alert("Error", "Failed to prepare a share link");
    } finally {
      setShareLinkLoading(false);
    }
  };

  const applyDuration = async () => {
    if (!durationSession) return;
    const totalMinutes = durationHours * 60 + durationMinutes;
    const start = new Date(durationSession.startedAt);
    const finished = new Date(start.getTime() + totalMinutes * 60 * 1000);
    await updateSession.mutateAsync({
      id: durationSession.id,
      payload: {
        finishedAt: finished.toISOString(),
        startedAt: start.toISOString(),
      },
    });
    setDurationSession(null);
  };

  const handleDayClick = (date: Date) => {
    const key = formatDateKey(date);
    const dayData = dayMap.get(key);
    if (dayData && dayData.sessions.length > 0) {
      setSelectedDay(date);
    }
  };

  const handleSessionClick = (session: WorkoutHistorySession) => {
    setSelectedSession(session);
  };

  const handleAddManual = async () => {
    const start = new Date(`${manualForm.date}T07:00:00Z`);
    if (Number.isNaN(start.getTime())) {
      Alert.alert("Invalid date", "Please use YYYY-MM-DD");
      return;
    }
    const duration = Number(manualForm.duration) || 45;
    const finish = new Date(start.getTime() + duration * 60 * 1000);

    try {
      if (manualForm.templateId === "manual") {
        // Manual entry - simple workout log
        await createManual.mutateAsync({
          startedAt: start.toISOString(),
          finishedAt: finish.toISOString(),
          templateName: manualForm.templateName.trim() || "Logged workout",
          sets: [
            {
              exerciseId: manualForm.exerciseName.trim() || "custom-exercise",
              setIndex: 0,
            },
          ],
        });
      } else {
        // Template-based workout - fetch template and create sets from exercises
        const selectedTemplate = templates?.find(t => t.id === manualForm.templateId);
        if (!selectedTemplate) {
          Alert.alert("Error", "Template not found");
          return;
        }

        // Create sets from template exercises
        const sets = selectedTemplate.exercises.flatMap((exercise, exerciseIndex) => {
          return Array.from({ length: exercise.defaultSets }, (_, setIndex) => ({
            exerciseId: exercise.exerciseId,
            targetReps: exercise.defaultReps,
            targetWeight: exercise.defaultWeight,
            actualReps: exercise.defaultReps,
            actualWeight: exercise.defaultWeight,
            setIndex: setIndex,
            templateExerciseId: exercise.id,
          }));
        });

        await createManual.mutateAsync({
          startedAt: start.toISOString(),
          finishedAt: finish.toISOString(),
          templateName: selectedTemplate.name,
          sets,
        });
      }

      setManualOpen(false);
    } catch (error) {
      Alert.alert("Error", "Failed to create workout");
    }
  };

  const handleStartWorkout = async () => {
    if (!selectedSession) return;
    try {
      const session = await fetchSession(selectedSession.id);
      if (session.templateId) {
        setSelectedSession(null);
        navigation.navigate("WorkoutSession", { templateId: session.templateId });
      } else {
        Alert.alert(
          "No template found",
          "This workout doesn't have an associated template. Create a template first, then start a workout from it."
        );
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load workout details");
    }
  };

  const handleEditWorkout = async () => {
    if (!selectedSession) return;
    try {
      const session = await fetchSession(selectedSession.id);
      setSelectedSession(null);
      navigation.navigate("WorkoutSession", {
        templateId: session.templateId || "manual",
        sessionId: session.id,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to load workout details");
    }
  };

  const handleSaveAsTemplate = () => {
    if (!selectedSession) return;
    const defaultName = selectedSession.templateName || "Workout";
    setTemplateName(defaultName);
    setSaveTemplateSessionId(selectedSession.id); // Store the session ID
    setSelectedSession(null); // Close the session detail modal first
    setSaveTemplateOpen(true);
  };

  const confirmSaveAsTemplate = async () => {
    if (!saveTemplateSessionId) return;
    if (!templateName.trim()) {
      Alert.alert("Name required", "Please enter a name for the template");
      return;
    }

    try {
      const session = await fetchSession(saveTemplateSessionId);

      // Group sets by exercise
      const exerciseMap = new Map<string, typeof session.sets>();
      session.sets.forEach((set) => {
        const existing = exerciseMap.get(set.exerciseId) || [];
        exerciseMap.set(set.exerciseId, [...existing, set]);
      });

      // Create template exercises from the session sets
      const exercises = Array.from(exerciseMap.entries()).map(([exerciseId, sets]) => {
        const avgReps = Math.round(
          sets.reduce((sum, s) => sum + (s.actualReps || s.targetReps || 0), 0) / sets.length
        );
        const avgWeight = Math.round(
          sets.reduce((sum, s) => sum + (s.actualWeight || s.targetWeight || 0), 0) / sets.length
        );

        return {
          exerciseId,
          defaultSets: sets.length,
          defaultReps: avgReps,
          defaultWeight: avgWeight,
          defaultRestSeconds: sets[0]?.targetRestSeconds,
        };
      });

      const created = await createTemplate({
        name: templateName.trim(),
        description: `Saved from workout on ${formatDateTimeShort(new Date(session.startedAt))}`,
        exercises,
      });

      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setSaveTemplateOpen(false);
      setSaveTemplateSessionId(null);
      if (postSaveAction === "shareLink") {
        setPostSaveAction(null);
        setShareLinkTemplate({
          templateId: created.id,
          templateName: created.name,
          sharingDisabled: created.sharingDisabled,
        });
        setShareLinkSheetVisible(true);
      } else {
        Alert.alert("Success", "Workout saved as a new template!");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to save workout as template");
    }
  };

  const renderSessionCard = (session: WorkoutHistorySession) => {
    const startDate = new Date(session.startedAt);
    const durationSeconds =
      session.durationSeconds ??
      (session.finishedAt
        ? Math.max(
            0,
            Math.round(
              (new Date(session.finishedAt).getTime() - startDate.getTime()) / 1000
            )
          )
        : null);
    const durationMinutes =
      durationSeconds !== null && durationSeconds !== undefined
        ? Math.max(1, Math.round(durationSeconds / 60))
        : null;
    const caloriesValue =
      session.totalEnergyBurned !== undefined
        ? `${Math.round(session.totalEnergyBurned)} kcal`
        : `${session.estimatedCalories}`;
    const isImported = session.source === "apple_health";
    const avgHr = session.avgHeartRate ? Math.round(session.avgHeartRate) : null;
    const maxHr = session.maxHeartRate ? Math.round(session.maxHeartRate) : null;

    return (
      <Pressable
        key={session.id}
        onPress={() => handleSessionClick(session)}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 14,
          gap: 10,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              {session.templateName || "Logged workout"}
            </Text>
            {isImported ? (
              <View
                style={{
                  alignSelf: "flex-start",
                  marginTop: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 10,
                  backgroundColor: colors.primary + "22",
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 11,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Imported from Apple Health
                </Text>
              </View>
            ) : null}
            <Text style={{ color: colors.textSecondary }}>
              {formatDateMedium(startDate)}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {formatTime(startDate)} · {session.exercises.length} exercises
              {durationMinutes ? ` · ${durationMinutes} min` : ""}
            </Text>
          </View>
        <Pressable
          onPress={() => setMenuSession(session)}
          hitSlop={8}
          style={({ pressed }) => ({
            padding: 8,
            borderRadius: 10,
            backgroundColor: pressed ? colors.surfaceMuted : "transparent",
          })}
        >
          <Ionicons
            name='ellipsis-horizontal'
            color={colors.textPrimary}
            size={20}
          />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <MetricPill
          label='Volume'
          value={`${Math.round(session.totalVolumeLbs)} lbs`}
        />
        <MetricPill label='Calories' value={caloriesValue} />
        {durationMinutes ? (
          <MetricPill
            label='Duration'
            value={`${durationMinutes} min`}
          />
        ) : null}
        {avgHr ? <MetricPill label='Avg HR' value={`${avgHr} bpm`} /> : null}
        {maxHr ? <MetricPill label='Max HR' value={`${maxHr} bpm`} /> : null}
      </View>

      <View style={{ gap: 6 }}>
        {session.exercises.slice(0, 4).map((exercise, idx) => (
          <View
            key={`${exercise.exerciseId}-${idx}`}
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.medium,
              }}
            >
              {exercise.name}
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {exercise.sets} sets · {Math.round(exercise.volumeLbs)} lbs
            </Text>
          </View>
        ))}
        {session.exercises.length > 4 ? (
          <Text style={{ color: colors.textSecondary }}>
            +{session.exercises.length - 4} more
          </Text>
        ) : null}
      </View>
    </Pressable>
    );
  };

  return (
    <ScreenContainer scroll>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: 6,
        }}
      >
        <View>
          <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
            History
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            Track streaks, totals, and missed days.
          </Text>
        </View>
        <Pressable
          onPress={() => setManualOpen(true)}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            opacity: pressed ? 0.92 : 1,
            alignSelf: "flex-start",
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name='add' color={colors.surface} size={18} />
            <Text
              style={{
                color: colors.surface,
                fontFamily: fontFamilies.semibold,
                fontSize: 14,
              }}
            >
              Add past
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={{ marginTop: 14, gap: 10 }}>
        <SummaryRow stats={stats} />

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                This Week
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Your weekly activity
              </Text>
            </View>
            <Pressable
              onPress={handleToggleMonth}
              hitSlop={8}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 10,
                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
              })}
            >
              <Ionicons
                name={showMonth ? "chevron-up" : "chevron-down"}
                color={colors.textPrimary}
                size={20}
              />
            </Pressable>
          </View>

          <WeekView
            weekDates={getWeekDates(today)}
            onSelect={handleDayClick}
            dayStatus={dayStatus}
            hasWorkouts={hasWorkouts}
            today={today}
          />

          {showMonth && (
            <View style={{ marginTop: 8, gap: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Pressable
                  onPress={handlePrevMonth}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    padding: 8,
                    borderRadius: 10,
                    backgroundColor: pressed
                      ? colors.surfaceMuted
                      : "transparent",
                  })}
                >
                  <Ionicons
                    name='chevron-back'
                    color={colors.textPrimary}
                    size={20}
                  />
                </Pressable>
                <Text
                  style={{
                    ...typography.title,
                    color: colors.textPrimary,
                  }}
                >
                  {formatMonthLabel(monthCursor)}
                </Text>
                <Pressable
                  onPress={handleNextMonth}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    padding: 8,
                    borderRadius: 10,
                    backgroundColor: pressed
                      ? colors.surfaceMuted
                      : "transparent",
                  })}
                >
                  <Ionicons
                    name='chevron-forward'
                    color={colors.textPrimary}
                    size={20}
                  />
                </Pressable>
              </View>
              <MonthGrid
                monthDate={monthCursor}
                matrix={monthMatrix}
                onSelect={handleDayClick}
                dayStatus={dayStatus}
                hasWorkouts={hasWorkouts}
                today={today}
              />
            </View>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>
            All Workouts ({allSessions.length})
          </Text>
          {allSessions.length === 0 ? (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 24,
                alignItems: "center",
                gap: 8,
              }}
            >
              <Ionicons name='barbell-outline' size={48} color={colors.textSecondary} />
              <Text style={{ ...typography.title, color: colors.textPrimary, textAlign: "center" }}>
                No workouts yet
              </Text>
              <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
                Start your first workout to track your progress and build your fitness journey.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {allSessions.map((session) => (
                <View key={`${session.id}-all`}>
                  {renderSessionCard(session)}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {(isLoading ||
        shareLinkLoading ||
        createManual.isPending ||
        duplicate.isPending ||
        deleteSession.isPending) && (
        <View
          pointerEvents='none'
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{ flex: 1, backgroundColor: colors.primary, opacity: 0.9 }}
          />
        </View>
      )}

      <Modal
        transparent
        animationType='fade'
        visible={!!menuSession}
        onRequestClose={() => setMenuSession(null)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuSession(null)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              justifyContent: "flex-end",
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: colors.surface,
                  padding: 16,
                  borderTopLeftRadius: 20,
                  borderTopRightRadius: 20,
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
                    style={{ ...typography.title, color: colors.textPrimary }}
                  >
                    Actions
                  </Text>
                  <Pressable onPress={() => setMenuSession(null)}>
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
                <ActionRow
                  icon='share-social'
                  label='Share workout'
                  onPress={() => {
                    if (menuSession) void openTemplateShareFromHistory(menuSession);
                    setMenuSession(null);
                  }}
                />
                <ActionRow
                  icon='copy'
                  label='Save as new workout'
                  onPress={() => {
                    if (menuSession) {
                      const defaultName = menuSession.templateName || "Workout";
                      setTemplateName(defaultName);
                      setSaveTemplateSessionId(menuSession.id);
                      setMenuSession(null);
                      setSaveTemplateOpen(true);
                    }
                  }}
                />
                <ActionRow
                  icon='time'
                  label='Edit duration'
                  onPress={() => {
                    setDurationSession(menuSession);
                    setMenuSession(null);
                  }}
                />
                <ActionRow
                  icon='trash'
                  destructive
                  label='Delete workout'
                  onPress={() => {
                    if (!menuSession) return;
                    Alert.alert(
                      "Delete workout?",
                      "This will remove it from your history.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete",
                          style: "destructive",
                          onPress: async () => {
                            await deleteSession.mutateAsync(menuSession.id);
                          },
                        },
                      ]
                    );
                    setMenuSession(null);
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        transparent
        animationType='slide'
        visible={!!durationSession}
        onRequestClose={() => setDurationSession(null)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              padding: 16,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              gap: 16,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Adjust duration
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Keep the same start time, choose a new finish.
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
                paddingVertical: 20,
              }}
            >
              <View style={{ alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Hours
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      setDurationHours((prev) => Math.max(0, prev - 1))
                    }
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 20 }}>
                      −
                    </Text>
                  </Pressable>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 32,
                      fontFamily: fontFamilies.semibold,
                      minWidth: 50,
                      textAlign: "center",
                    }}
                  >
                    {durationHours}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setDurationHours((prev) => Math.min(5, prev + 1))
                    }
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 20 }}>
                      +
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={{ alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Minutes
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Pressable
                    onPress={() =>
                      setDurationMinutes((prev) => Math.max(0, prev - 5))
                    }
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 20 }}>
                      −
                    </Text>
                  </Pressable>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 32,
                      fontFamily: fontFamilies.semibold,
                      minWidth: 50,
                      textAlign: "center",
                    }}
                  >
                    {durationMinutes}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setDurationMinutes((prev) => Math.min(55, prev + 5))
                    }
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 20 }}>
                      +
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={applyDuration}
                style={({ pressed }) => ({
                  flex: 2,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.surface,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Apply
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDurationSession(null)}
                style={({ pressed }) => ({
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType='fade'
        visible={manualOpen}
        onRequestClose={() => setManualOpen(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <View
            style={{
              marginHorizontal: 16,
              backgroundColor: colors.surface,
              borderRadius: 18,
              padding: 18,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Add past workout
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Quick log a missed session. Use YYYY-MM-DD for date.
            </Text>
            <Field
              label='Date (YYYY-MM-DD)'
              value={manualForm.date}
              onChangeText={(text) =>
                setManualForm((prev) => ({ ...prev, date: text }))
              }
            />

            <View>
              <Text style={{ color: colors.textSecondary, marginBottom: 6 }}>
                Workout Template
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
              >
                <Pressable
                  onPress={() => setManualForm((prev) => ({
                    ...prev,
                    templateId: "manual",
                    templateName: "Logged workout"
                  }))}
                  style={({ pressed }) => ({
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: manualForm.templateId === "manual" ? colors.primary : colors.border,
                    backgroundColor: manualForm.templateId === "manual"
                      ? colors.primary + "22"
                      : pressed
                      ? colors.surfaceMuted
                      : colors.surface,
                  })}
                >
                  <Text
                    style={{
                      color: manualForm.templateId === "manual" ? colors.primary : colors.textPrimary,
                      fontFamily: manualForm.templateId === "manual" ? fontFamilies.semibold : fontFamilies.medium,
                    }}
                  >
                    Enter manually
                  </Text>
                </Pressable>
                {(templates ?? []).map((template) => (
                  <Pressable
                    key={template.id}
                    onPress={() => setManualForm((prev) => ({
                      ...prev,
                      templateId: template.id,
                      templateName: template.name
                    }))}
                    style={({ pressed }) => ({
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: manualForm.templateId === template.id ? colors.primary : colors.border,
                      backgroundColor: manualForm.templateId === template.id
                        ? colors.primary + "22"
                        : pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                    })}
                  >
                    <Text
                      style={{
                        color: manualForm.templateId === template.id ? colors.primary : colors.textPrimary,
                        fontFamily: manualForm.templateId === template.id ? fontFamilies.semibold : fontFamilies.medium,
                      }}
                    >
                      {template.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {manualForm.templateId === "manual" && (
              <>
                <Field
                  label='Title'
                  value={manualForm.templateName}
                  onChangeText={(text) =>
                    setManualForm((prev) => ({ ...prev, templateName: text }))
                  }
                />
                <Field
                  label='Primary Muscles / Exercise'
                  value={manualForm.exerciseName}
                  onChangeText={(text) =>
                    setManualForm((prev) => ({ ...prev, exerciseName: text }))
                  }
                />
              </>
            )}

            <Field
              label='Duration (min)'
              value={manualForm.duration}
              keyboardType='numeric'
              onChangeText={(text) =>
                setManualForm((prev) => ({ ...prev, duration: text }))
              }
            />
            <Pressable
              onPress={handleAddManual}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 14,
                alignItems: "center",
                borderRadius: 14,
                opacity: pressed ? 0.9 : 1,
                marginTop: 4,
              })}
            >
              <Text
                style={{
                  color: colors.surface,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                Save workout
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setManualOpen(false)}
              style={{
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                marginTop: 6,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType='fade'
        visible={!!selectedDay}
        onRequestClose={() => setSelectedDay(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedDay(null)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  padding: 18,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  maxHeight: "80%",
                }}
              >
                {selectedDay && (
                  <>
                    <Text
                      style={{ ...typography.title, color: colors.textPrimary }}
                    >
                      {formatDateLong(selectedDay)}
                    </Text>
                    <Text style={{ color: colors.textSecondary }}>
                      {sessionsForSelectedDay.length} workout(s)
                    </Text>
                    <ScrollView
                      style={{ maxHeight: 360 }}
                      contentContainerStyle={{ gap: 10, paddingVertical: 2 }}
                      showsVerticalScrollIndicator
                      nestedScrollEnabled
                    >
                      {sessionsForSelectedDay.map((session) => (
                        <Pressable
                          key={session.id}
                          onPress={() => {
                            setSelectedDay(null);
                            handleSessionClick(session);
                          }}
                          style={({ pressed }) => ({
                            backgroundColor: pressed
                              ? colors.surfaceMuted
                              : colors.surface,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                            padding: 12,
                            gap: 8,
                          })}
                        >
                          <Text
                            style={{
                              color: colors.textPrimary,
                              fontFamily: fontFamilies.semibold,
                            }}
                          >
                            {session.templateName || "Logged workout"}
                          </Text>
                          <Text style={{ color: colors.textSecondary }}>
                            {formatTime(new Date(session.startedAt))} ·{" "}
                            {session.exercises.length} exercises ·{" "}
                            {Math.round(session.totalVolumeLbs)} lbs
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    <Pressable
                      onPress={() => setSelectedDay(null)}
                      style={({ pressed }) => ({
                        paddingVertical: 12,
                        alignItems: "center",
                        borderRadius: 12,
                        backgroundColor: colors.surfaceMuted,
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <Text style={{ color: colors.textSecondary }}>Close</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        transparent
        animationType='fade'
        visible={!!selectedSession}
        onRequestClose={() => setSelectedSession(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedSession(null)}>
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.55)",
              justifyContent: "center",
              padding: 16,
            }}
      >
        <TouchableWithoutFeedback>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              padding: 18,
              gap: 14,
              borderWidth: 1,
              borderColor: colors.border,
              maxHeight: "80%",
              position: "relative",
            }}
          >
            {selectedSession && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                  }}
                >
                  <Pressable
                    onPress={() => setSelectedSession(null)}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      padding: 6,
                      borderRadius: 10,
                      backgroundColor: pressed
                        ? colors.surfaceMuted
                        : colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                    })}
                  >
                    <Ionicons name='close' size={18} color={colors.textPrimary} />
                  </Pressable>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{ ...typography.title, color: colors.textPrimary }}
                    >
                      {selectedSession.templateName || "Logged workout"}
                    </Text>
                    {selectedMetrics?.isImported ? (
                      <View
                        style={{
                          alignSelf: "flex-start",
                          marginTop: 2,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 10,
                          backgroundColor: colors.primary + "22",
                        }}
                      >
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: 11,
                            fontFamily: fontFamilies.semibold,
                          }}
                        >
                          Imported from Apple Health
                        </Text>
                      </View>
                    ) : null}
                    <Text style={{ color: colors.textSecondary }}>
                      {formatDateTimeShort(new Date(selectedSession.startedAt))}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <MetricPill
                    label='Volume'
                    value={`${Math.round(selectedSession.totalVolumeLbs)} lbs`}
                  />
                  <MetricPill
                    label='Calories'
                    value={
                      selectedMetrics?.caloriesValue ?? `${selectedSession.estimatedCalories}`
                    }
                  />
                  {selectedMetrics?.durationMinutes ? (
                    <MetricPill
                      label='Duration'
                      value={`${selectedMetrics.durationMinutes} min`}
                    />
                  ) : null}
                  {selectedMetrics?.avgHr ? (
                    <MetricPill label='Avg HR' value={`${selectedMetrics.avgHr} bpm`} />
                  ) : null}
                  {selectedMetrics?.maxHr ? (
                    <MetricPill label='Max HR' value={`${selectedMetrics.maxHr} bpm`} />
                  ) : null}
                </View>
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        paddingTop: 12,
                        gap: 8,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        Exercises
                      </Text>
                      {selectedSession.exercises.map((exercise, idx) => (
                        <View
                          key={`${exercise.exerciseId}-${idx}`}
                          style={{
                            backgroundColor: colors.surfaceMuted,
                            borderRadius: 10,
                            padding: 10,
                            flexDirection: "row",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text
                            style={{
                              color: colors.textPrimary,
                              fontFamily: fontFamilies.medium,
                            }}
                          >
                            {exercise.name}
                          </Text>
                          <Text style={{ color: colors.textSecondary }}>
                            {exercise.sets} sets · {Math.round(exercise.volumeLbs)}{" "}
                            lbs
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={{ gap: 8, marginTop: 6 }}>
                      <Pressable
                        onPress={handleStartWorkout}
                        style={({ pressed }) => ({
                          paddingVertical: 14,
                          alignItems: "center",
                          borderRadius: 12,
                          backgroundColor: colors.primary,
                          opacity: pressed ? 0.9 : 1,
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 8,
                        })}
                      >
                        <Ionicons name='play' color={colors.surface} size={18} />
                        <Text
                          style={{
                            color: colors.surface,
                            fontFamily: fontFamilies.semibold,
                            fontSize: 15,
                          }}
                        >
                          Start this workout
                        </Text>
                      </Pressable>

                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable
                          onPress={handleEditWorkout}
                          style={({ pressed }) => ({
                            flex: 1,
                            paddingVertical: 12,
                            alignItems: "center",
                            borderRadius: 12,
                            backgroundColor: colors.surfaceMuted,
                            opacity: pressed ? 0.9 : 1,
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 6,
                          })}
                        >
                          <Ionicons name='create-outline' color={colors.textPrimary} size={18} />
                          <Text
                            style={{
                              color: colors.textPrimary,
                              fontFamily: fontFamilies.medium,
                            }}
                          >
                            Edit
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={handleSaveAsTemplate}
                          style={({ pressed }) => ({
                            flex: 1,
                            paddingVertical: 12,
                            alignItems: "center",
                            borderRadius: 12,
                            backgroundColor: colors.surfaceMuted,
                            opacity: pressed ? 0.9 : 1,
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 6,
                          })}
                        >
                          <Ionicons name='bookmark-outline' color={colors.textPrimary} size={18} />
                          <Text
                            style={{
                              color: colors.textPrimary,
                              fontFamily: fontFamilies.medium,
                            }}
                          >
                            Save
                          </Text>
                        </Pressable>
                      </View>

                      <Pressable
                        onPress={() => {
                          if (!selectedSession) return;
                          Alert.alert(
                            "Delete workout?",
                            "This will permanently remove this workout from your history.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Delete",
                                style: "destructive",
                                onPress: async () => {
                                  await deleteSession.mutateAsync(selectedSession.id);
                                  setSelectedSession(null);
                                },
                              },
                            ]
                          );
                        }}
                        style={({ pressed }) => ({
                          paddingVertical: 12,
                          alignItems: "center",
                          borderRadius: 12,
                          backgroundColor: "transparent",
                          borderWidth: 1,
                          borderColor: colors.error,
                          opacity: pressed ? 0.7 : 1,
                          flexDirection: "row",
                          justifyContent: "center",
                          gap: 6,
                        })}
                      >
                        <Ionicons name='trash-outline' color={colors.error} size={18} />
                        <Text
                          style={{
                            color: colors.error,
                            fontFamily: fontFamilies.medium,
                          }}
                        >
                          Delete workout
                        </Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        transparent
        animationType='fade'
        visible={saveTemplateOpen}
        onRequestClose={() => {
          setSaveTemplateOpen(false);
          setSaveTemplateSessionId(null);
          setPostSaveAction(null);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        >
          <View
            style={{
              marginHorizontal: 16,
              backgroundColor: colors.surface,
              borderRadius: 18,
              padding: 18,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Save as template
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Choose a name for this workout template.
            </Text>
            <View>
              <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
                Template name
              </Text>
              <TextInput
                value={templateName}
                onChangeText={setTemplateName}
                placeholder="e.g., Push Day, Upper Body"
                placeholderTextColor={colors.textSecondary}
                style={{
                  backgroundColor: colors.surfaceMuted,
                  padding: 12,
                  borderRadius: 12,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
            </View>
            <Pressable
              onPress={confirmSaveAsTemplate}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 14,
                alignItems: "center",
                borderRadius: 14,
                opacity: pressed ? 0.9 : 1,
                marginTop: 4,
              })}
            >
              <Text
                style={{
                  color: colors.surface,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                Save template
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSaveTemplateOpen(false);
                setSaveTemplateSessionId(null);
                setPostSaveAction(null);
              }}
              style={{
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                marginTop: 6,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType='fade'
        visible={!!shareNeedsTemplate}
        onRequestClose={() => setShareNeedsTemplate(null)}
      >
        <TouchableWithoutFeedback onPress={() => setShareNeedsTemplate(null)}>
          <View
            style={{
              flex: 1,
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.55)",
              paddingHorizontal: 16,
            }}
          >
            <TouchableWithoutFeedback>
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 18,
                  padding: 18,
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ ...typography.title, color: colors.textPrimary }}>
                  Share a link
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  This workout doesn’t have a template yet. Create a template from it to generate a share link.
                </Text>

                <Pressable
                  onPress={() => {
                    if (!shareNeedsTemplate) return;
                    const defaultName = shareNeedsTemplate.templateName || "Workout";
                    setTemplateName(defaultName);
                    setSaveTemplateSessionId(shareNeedsTemplate.id);
                    setPostSaveAction("shareLink");
                    setShareNeedsTemplate(null);
                    setSaveTemplateOpen(true);
                  }}
                  style={({ pressed }) => ({
                    backgroundColor: colors.primary,
                    paddingVertical: 14,
                    alignItems: "center",
                    borderRadius: 14,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: "#0B1220", fontFamily: fontFamilies.bold }}>
                    Create template & share
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShareNeedsTemplate(null)}
                  style={({ pressed }) => ({
                    paddingVertical: 12,
                    alignItems: "center",
                    borderRadius: 12,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </Pressable>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {shareLinkTemplate ? (
        <ShareTemplateLinkSheet
          visible={shareLinkSheetVisible}
          onClose={() => {
            setShareLinkSheetVisible(false);
            setShareLinkTemplate(null);
          }}
          templateId={shareLinkTemplate.templateId}
          templateName={shareLinkTemplate.templateName}
          sharingDisabled={shareLinkTemplate.sharingDisabled}
        />
      ) : null}
    </ScreenContainer>
  );
};

const SummaryRow = ({ stats }: { stats?: WorkoutHistoryStats }) => {
  const items = [
    { label: "Total workouts", value: stats?.totalWorkouts ?? "—" },
    {
      label: "Weekly goal",
      value: `${stats?.weeklyCompleted ?? 0}/${stats?.weeklyGoal ?? 4}`,
    },
    {
      label: "Current streak",
      value: stats?.currentStreak ? `${stats.currentStreak} days` : "0",
    },
  ];

  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 12,
            gap: 4,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamilies.medium,
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.bold,
              fontSize: 18,
            }}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
};

const MetricPill = ({ label, value }: { label: string; value: string }) => (
  <View
    style={{
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: colors.surfaceMuted,
      gap: 2,
    }}
  >
    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{label}</Text>
    <Text
      style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}
    >
      {value}
    </Text>
  </View>
);

const WeekView = ({
  weekDates,
  onSelect,
  dayStatus,
  hasWorkouts,
  today,
}: {
  weekDates: Date[];
  onSelect: (date: Date) => void;
  dayStatus: (date: Date) => string;
  hasWorkouts: (date: Date) => boolean;
  today: Date;
}) => (
  <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => (
        <Text
          key={`${day}-${idx}`}
          style={{
            color: colors.textSecondary,
            width: 44,
            textAlign: "center",
            fontFamily: fontFamilies.medium,
            fontSize: 12,
          }}
        >
          {day}
        </Text>
      ))}
    </View>
    <View
      style={{
        flexDirection: "row",
        gap: 6,
        justifyContent: "space-between",
      }}
    >
      {weekDates.map((date, dayIdx) => {
        const status = dayStatus(date);
        const isToday = isSameDay(date, today);
        const background =
          status === "done"
            ? colors.primary + "33"
            : status === "today"
            ? colors.secondary + "33"
            : colors.surface;
        return (
          <Pressable
            key={`${formatDateKey(date)}-${dayIdx}`}
            onPress={() => onSelect(date)}
            style={({ pressed }) => ({
              width: 44,
              height: 52,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isToday ? colors.secondary : colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : background,
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              {date.getUTCDate()}
            </Text>
            {hasWorkouts(date) ? (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  marginTop: 4,
                  backgroundColor:
                    status === "done" ? colors.primary : colors.secondary,
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  </View>
);

const MonthGrid = ({
  matrix,
  monthDate,
  onSelect,
  dayStatus,
  hasWorkouts,
  today,
}: {
  matrix: Date[][];
  monthDate: Date;
  onSelect: (date: Date) => void;
  dayStatus: (date: Date) => string;
  hasWorkouts: (date: Date) => boolean;
  today: Date;
}) => (
  <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => (
        <Text
          key={`${day}-${idx}`}
          style={{
            color: colors.textSecondary,
            width: 38,
            textAlign: "center",
            fontFamily: fontFamilies.medium,
          }}
        >
          {day}
        </Text>
      ))}
    </View>
    {matrix.map((week, idx) => (
      <View
        key={`week-${idx}`}
        style={{
          flexDirection: "row",
          gap: 6,
          justifyContent: "space-between",
        }}
      >
        {week.map((date, dayIdx) => {
          const status = dayStatus(date);
          const isToday = isSameDay(date, today);
          const dimmed = !isSameMonth(date, monthDate);
          const background =
            status === "done"
              ? colors.primary + "33"
              : status === "today"
              ? colors.secondary + "33"
              : colors.surface;
          return (
            <Pressable
              key={`${formatDateKey(date)}-${idx}-${dayIdx}`}
              onPress={() => onSelect(date)}
              style={({ pressed }) => ({
                width: 38,
                height: 44,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: isToday ? colors.secondary : colors.border,
                backgroundColor: pressed ? colors.surfaceMuted : background,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <Text
                style={{
                  color: dimmed ? colors.textSecondary : colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                }}
              >
                {date.getUTCDate()}
              </Text>
              {hasWorkouts(date) ? (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    marginTop: 4,
                    backgroundColor:
                      status === "done" ? colors.primary : colors.secondary,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    ))}
  </View>
);

const ActionRow = ({
  icon,
  label,
  destructive,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: pressed ? colors.surfaceMuted : "transparent",
    })}
  >
    <Ionicons
      name={icon}
      color={destructive ? colors.error : colors.textPrimary}
      size={20}
    />
    <Text
      style={{
        color: destructive ? colors.error : colors.textPrimary,
        fontFamily: fontFamilies.medium,
      }}
    >
      {label}
    </Text>
  </Pressable>
);

const Field = ({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: "default" | "numeric";
}) => (
  <View style={{ flexGrow: 1 }}>
    <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
      {label}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      placeholderTextColor={colors.textSecondary}
      style={{
        backgroundColor: colors.surfaceMuted,
        padding: 12,
        borderRadius: 12,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    />
  </View>
);

export default HistoryScreen;
