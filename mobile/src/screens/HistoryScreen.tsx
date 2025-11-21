import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
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
import {
  WorkoutHistoryDay,
  WorkoutHistorySession,
  WorkoutHistoryStats,
} from "../types/workouts";

const startOfMonth = (date: Date) => {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1));
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const addMonths = (date: Date, delta: number) =>
  startOfMonth(new Date(Date.UTC(date.getFullYear(), date.getMonth() + delta, 1)));

const startOfDayUtc = (date: Date) => {
  const copy = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const formatDateKey = (date: Date) => startOfDayUtc(date).toISOString().split("T")[0];

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
  a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();

const HistoryScreen = () => {
  const today = startOfDayUtc(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [monthCursor, setMonthCursor] = useState<Date>(startOfMonth(today));
  const [showMonth, setShowMonth] = useState(false);
  const [menuSession, setMenuSession] = useState<WorkoutHistorySession | null>(null);
  const [durationSession, setDurationSession] = useState<WorkoutHistorySession | null>(
    null
  );
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    date: formatDateKey(today),
    templateName: "Logged workout",
    exerciseName: "Bench Press",
    weight: "135",
    reps: "8",
    duration: "45",
  });

  const rangeStart = useMemo(
    () => startOfMonth(addMonths(monthCursor, -12)),
    [monthCursor]
  );
  const rangeEnd = useMemo(() => startOfMonth(addMonths(monthCursor, 12)), [monthCursor]);

  const { data, isLoading, isRefetching, refetch } = useWorkoutHistory(
    rangeStart,
    rangeEnd
  );
  const createManual = useCreateManualSession(rangeStart, rangeEnd);
  const duplicate = useDuplicateSession(rangeStart, rangeEnd);
  const deleteSession = useDeleteSession(rangeStart, rangeEnd);
  const updateSession = useUpdateSession(rangeStart, rangeEnd);

  const calendarWidth = Dimensions.get("window").width - 32;
  const monthScrollRef = useRef<ScrollView | null>(null);

  const dayMap = useMemo(() => {
    const map = new Map<string, WorkoutHistoryDay>();
    data?.days.forEach((day) => map.set(day.date, day));
    return map;
  }, [data]);

  const allSessionsUnique = useMemo(() => {
    const sessions = (data?.days ?? [])
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .flatMap((day) => day.sessions);
    const unique = new Map<string, WorkoutHistorySession>();
    sessions.forEach((session) => {
      if (!unique.has(session.id)) {
        unique.set(session.id, session);
      }
    });
    return Array.from(unique.values()).sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );
  }, [data]);

  const stats: WorkoutHistoryStats | undefined = data?.stats;
  const selectedKey = formatDateKey(selectedDate);
  const selectedDay = dayMap.get(selectedKey);

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

  useEffect(() => {
    if (showMonth && monthScrollRef.current) {
      monthScrollRef.current.scrollTo({ x: calendarWidth, animated: false });
    }
  }, [showMonth, monthCursor, calendarWidth]);

  const handleMonthSwipe = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const offset = event.nativeEvent.contentOffset.x;
    const page = Math.round(offset / calendarWidth);
    if (page === 0) {
      setMonthCursor((prev) => {
        const next = addMonths(prev, -1);
        setSelectedDate(next);
        return next;
      });
    } else if (page === 2) {
      setMonthCursor((prev) => {
        const next = addMonths(prev, 1);
        setSelectedDate(next);
        return next;
      });
    }
    requestAnimationFrame(() => {
      monthScrollRef.current?.scrollTo({ x: calendarWidth, animated: false });
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

  const formatFriendlyDate = (date: Date) =>
    date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  const formatMonthLabel = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const handleShare = async (session: WorkoutHistorySession) => {
    const title = session.templateName ?? "Workout";
    const volume = Math.round(session.totalVolumeLbs);
    await Share.share({
      title,
      message: `${title} · ${volume} lbs moved · ${session.exercises.length} exercises`,
    });
  };

  const applyDuration = async (session: WorkoutHistorySession, minutes: number) => {
    const start = new Date(session.startedAt);
    const finished = new Date(start.getTime() + minutes * 60 * 1000);
    await updateSession.mutateAsync({
      id: session.id,
      payload: { finishedAt: finished.toISOString(), startedAt: start.toISOString() },
    });
    setDurationSession(null);
  };

  const handleAddManual = async () => {
    const start = new Date(`${manualForm.date}T07:00:00Z`);
    if (Number.isNaN(start.getTime())) {
      Alert.alert("Invalid date", "Please use YYYY-MM-DD");
      return;
    }
    const duration = Number(manualForm.duration) || 45;
    const finish = new Date(start.getTime() + duration * 60 * 1000);
    await createManual.mutateAsync({
      startedAt: start.toISOString(),
      finishedAt: finish.toISOString(),
      templateName: manualForm.templateName.trim() || "Logged workout",
      sets: [
        {
          exerciseId: manualForm.exerciseName.trim() || "custom-exercise",
          actualReps: Number(manualForm.reps) || undefined,
          actualWeight: Number(manualForm.weight) || undefined,
          setIndex: 0,
        },
      ],
    });
    setManualOpen(false);
  };

  const renderSessionCard = (session: WorkoutHistorySession) => (
    <View
      key={session.id}
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>
            {session.templateName || "Logged workout"}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {new Date(session.startedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {session.exercises.length} exercises
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
          <Ionicons name="ellipsis-horizontal" color={colors.textPrimary} size={20} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricPill label="Volume" value={`${Math.round(session.totalVolumeLbs)} lbs`} />
        <MetricPill label="Calories" value={`${session.estimatedCalories}`} />
        {session.finishedAt ? (
          <MetricPill
            label="Duration"
            value={`${Math.max(
              10,
              Math.round(
                (new Date(session.finishedAt).getTime() -
                  new Date(session.startedAt).getTime()) /
                  60000
              )
            )} min`}
          />
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        {session.exercises.slice(0, 4).map((exercise, idx) => (
          <View
            key={`${exercise.exerciseId}-${idx}`}
            style={{ flexDirection: "row", justifyContent: "space-between" }}
          >
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.medium }}>
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
    </View>
  );

  return (
    <ScreenContainer scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
        <View>
          <Text style={{ ...typography.heading1, color: colors.textPrimary }}>History</Text>
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
            <Ionicons name="add" color={colors.surface} size={18} />
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
                {formatMonthLabel(monthCursor)}
              </Text>
              <Text style={{ color: colors.textSecondary }}>Tap a date to view workouts</Text>
            </View>
            <Pressable
              onPress={() => setShowMonth((prev) => !prev)}
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

          {!showMonth ? (
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between" }}>
              {weekDates.map((date) => {
                const status = dayStatus(date);
                const isSelected = isSameDay(date, selectedDate);
                const baseColor =
                  status === "done"
                    ? colors.primary
                    : status === "today"
                    ? colors.secondary
                    : colors.surfaceMuted;
                return (
                  <Pressable
                    key={formatDateKey(date)}
                    onPress={() => setSelectedDate(date)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: pressed ? colors.surfaceMuted : baseColor + "22",
                      alignItems: "center",
                      gap: 4,
                    })}
                  >
                    <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.medium }}>
                      {date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}
                    </Text>
                    <Text
                      style={{
                        color: isSelected ? colors.primary : colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 16,
                      }}
                    >
                      {date.getUTCDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <ScrollView
              ref={monthScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleMonthSwipe}
              contentOffset={{ x: calendarWidth, y: 0 }}
            >
              {[addMonths(monthCursor, -1), monthCursor, addMonths(monthCursor, 1)].map(
                (month, index) => (
                  <View key={month.toISOString() + index} style={{ width: calendarWidth }}>
                    <MonthGrid
                      monthDate={month}
                      matrix={buildMonthMatrix(month)}
                      onSelect={setSelectedDate}
                      selectedDate={selectedDate}
                      dayStatus={dayStatus}
                      hasWorkouts={hasWorkouts}
                    />
                  </View>
                )
              )}
            </ScrollView>
          )}
        </View>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              {formatFriendlyDate(selectedDate)}
            </Text>
            <Pressable
              onPress={() => refetch()}
              hitSlop={8}
              style={({ pressed }) => ({
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 12,
                opacity: pressed ? 0.9 : 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              })}
            >
              {isRefetching ? (
                <ActivityIndicator color={colors.textSecondary} size="small" />
              ) : (
                <Ionicons name="refresh" color={colors.textSecondary} size={16} />
              )}
              <Text style={{ color: colors.textSecondary }}>Refresh</Text>
            </Pressable>
          </View>

          {selectedDay && selectedDay.sessions.length > 0 ? (
            selectedDay.sessions.map(renderSessionCard)
          ) : (
            <View
              style={{
                padding: 14,
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
                Nothing logged
              </Text>
              <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
                Tap Add past to log a previous workout or swipe to another day.
              </Text>
            </View>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...typography.title, color: colors.textPrimary }}>All history</Text>
            <Text style={{ color: colors.textSecondary }}>
              {allSessionsUnique.length} workouts
            </Text>
          </View>
          <View style={{ gap: 10 }}>
            {allSessionsUnique.map((session) => (
              <View key={`${session.id}-all`} style={{ opacity: 0.95 }}>
                {renderSessionCard(session)}
              </View>
            ))}
          </View>
        </View>
      </View>

      {(isLoading || createManual.isPending || duplicate.isPending || deleteSession.isPending) && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flex: 1, backgroundColor: colors.primary, opacity: 0.9 }} />
        </View>
      )}

      <Modal transparent animationType="fade" visible={!!menuSession} onRequestClose={() => setMenuSession(null)}>
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
                  <Text style={{ ...typography.title, color: colors.textPrimary }}>
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
                  icon="share-social"
                  label="Share workout"
                  onPress={() => {
                    if (menuSession) handleShare(menuSession);
                    setMenuSession(null);
                  }}
                />
                <ActionRow
                  icon="copy"
                  label="Save as new workout"
                  onPress={async () => {
                    if (menuSession) {
                      await duplicate.mutateAsync(menuSession.id);
                    }
                    setMenuSession(null);
                  }}
                />
                <ActionRow
                  icon="time"
                  label="Edit duration"
                  onPress={() => {
                    setDurationSession(menuSession);
                    setMenuSession(null);
                  }}
                />
                <ActionRow
                  icon="trash"
                  destructive
                  label="Delete workout"
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

      <Modal transparent animationType="slide" visible={!!durationSession} onRequestClose={() => setDurationSession(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <View
            style={{
              backgroundColor: colors.surface,
              padding: 16,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              gap: 12,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              Adjust duration
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Keep the same start time, choose a new finish.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[30, 45, 60, 75, 90].map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => durationSession && applyDuration(durationSession, minutes)}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                  })}
                >
                  <Text style={{ color: colors.textPrimary }}>{minutes} min</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setDurationSession(null)}
              style={{
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={manualOpen} onRequestClose={() => setManualOpen(false)}>
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)" }}>
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
              label="Date (YYYY-MM-DD)"
              value={manualForm.date}
              onChangeText={(text) => setManualForm((prev) => ({ ...prev, date: text }))}
            />
            <Field
              label="Title"
              value={manualForm.templateName}
              onChangeText={(text) => setManualForm((prev) => ({ ...prev, templateName: text }))}
            />
            <Field
              label="Primary exercise"
              value={manualForm.exerciseName}
              onChangeText={(text) => setManualForm((prev) => ({ ...prev, exerciseName: text }))}
            />
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Field
                label="Weight (lbs)"
                value={manualForm.weight}
                keyboardType="numeric"
                onChangeText={(text) => setManualForm((prev) => ({ ...prev, weight: text }))}
              />
              <Field
                label="Reps"
                value={manualForm.reps}
                keyboardType="numeric"
                onChangeText={(text) => setManualForm((prev) => ({ ...prev, reps: text }))}
              />
              <Field
                label="Duration (min)"
                value={manualForm.duration}
                keyboardType="numeric"
                onChangeText={(text) => setManualForm((prev) => ({ ...prev, duration: text }))}
              />
            </View>
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
              <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold }}>
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
    </ScreenContainer>
  );
};

const SummaryRow = ({ stats }: { stats?: WorkoutHistoryStats }) => {
  const items = [
    { label: "Total workouts", value: stats?.totalWorkouts ?? "—" },
    { label: "Weekly goal", value: `${stats?.weeklyCompleted ?? 0}/${stats?.weeklyGoal ?? 4}` },
    { label: "Current streak", value: stats?.currentStreak ? `${stats.currentStreak} days` : "0" },
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
          <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.medium }}>
            {item.label}
          </Text>
          <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.bold, fontSize: 18 }}>
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
    <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>{value}</Text>
  </View>
);

const MonthGrid = ({
  matrix,
  monthDate,
  onSelect,
  selectedDate,
  dayStatus,
  hasWorkouts,
}: {
  matrix: Date[][];
  monthDate: Date;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  dayStatus: (date: Date) => string;
  hasWorkouts: (date: Date) => boolean;
}) => (
  <View style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {["M", "T", "W", "T", "F", "S", "S"].map((day) => (
        <Text
          key={day}
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
      <View key={`week-${idx}`} style={{ flexDirection: "row", gap: 6, justifyContent: "space-between" }}>
        {week.map((date, dayIdx) => {
          const status = dayStatus(date);
          const isSelected = isSameDay(date, selectedDate);
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
                borderColor: isSelected ? colors.primary : colors.border,
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
                    backgroundColor: status === "done" ? colors.primary : colors.secondary,
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
  <View style={{ flexGrow: 1, flexBasis: "30%" }}>
    <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
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
