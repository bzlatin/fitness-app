import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";
import { fetchHistoryRange } from "../../api/sessions";

type GoalProgressBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  weeklyGoal: number | null;
  workoutsThisWeek: number;
  onEditGoal: () => void;
};

const GoalProgressBottomSheet = ({
  visible,
  onClose,
  weeklyGoal,
  workoutsThisWeek,
  onEditGoal,
}: GoalProgressBottomSheetProps) => {
  const insets = useSafeAreaInsets();

  // Fetch last 8 weeks of workout data for history
  const eightWeeksAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 56); // 8 weeks
    return date.toISOString();
  }, []);

  const today = useMemo(() => new Date().toISOString(), []);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["workout-history-goal", eightWeeksAgo, today],
    queryFn: () => fetchHistoryRange(eightWeeksAgo, today),
    enabled: visible,
  });

  // Calculate weekly breakdown
  const weeklyBreakdown = useMemo(() => {
    if (!historyData?.days) return [];

    const weeks: Array<{
      weekStart: Date;
      weekEnd: Date;
      workoutCount: number;
      goalMet: boolean;
    }> = [];

    // Generate last 8 weeks
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const workoutsInWeek = historyData.days
        .filter((day) => {
          const dayDate = new Date(day.date);
          return dayDate >= weekStart && dayDate <= weekEnd;
        })
        .reduce((sum, day) => sum + day.sessions.length, 0);

      weeks.push({
        weekStart,
        weekEnd,
        workoutCount: workoutsInWeek,
        goalMet: weeklyGoal ? workoutsInWeek >= weeklyGoal : false,
      });
    }

    return weeks;
  }, [historyData, weeklyGoal]);

  // Calculate stats
  const stats = useMemo(() => {
    const weeksMetGoal = weeklyBreakdown.filter((w) => w.goalMet).length;
    const totalWorkouts = weeklyBreakdown.reduce(
      (sum, w) => sum + w.workoutCount,
      0
    );
    const avgWorkoutsPerWeek =
      weeklyBreakdown.length > 0
        ? (totalWorkouts / weeklyBreakdown.length).toFixed(1)
        : "0";
    const consistencyRate =
      weeklyBreakdown.length > 0 && weeklyGoal
        ? ((weeksMetGoal / weeklyBreakdown.length) * 100).toFixed(0)
        : "0";

    return {
      weeksMetGoal,
      totalWorkouts,
      avgWorkoutsPerWeek,
      consistencyRate,
    };
  }, [weeklyBreakdown, weeklyGoal]);

  const currentProgress = weeklyGoal
    ? Math.min((workoutsThisWeek / weeklyGoal) * 100, 100)
    : 0;

  const formatWeek = (weekStart: Date) => {
    const month = weekStart.toLocaleDateString("en-US", { month: "short" });
    const day = weekStart.getDate();
    return `${month} ${day}`;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: 24 + insets.bottom,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: "90%",
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: "center", paddingVertical: 8, paddingHorizontal: 20 }}>
            <View
              style={{
                width: 50,
                height: 5,
                borderRadius: 999,
                backgroundColor: colors.surfaceMuted,
              }}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 20 + insets.bottom,
              paddingHorizontal: 20,
            }}
          >
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.bold,
                      fontSize: 24,
                    }}
                  >
                    Goal Progress
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>
                    {weeklyGoal
                      ? `Your weekly goal: ${weeklyGoal} workouts`
                      : "Set a goal to track progress"}
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

            {/* Current Week Progress */}
            <View
              style={{
                padding: 20,
                borderRadius: 16,
                backgroundColor: `${colors.primary}16`,
                borderWidth: 1,
                borderColor: `${colors.primary}40`,
                marginBottom: 24,
                gap: 12,
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
                    fontSize: 18,
                  }}
                >
                  This Week
                </Text>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: fontFamilies.bold,
                    fontSize: 20,
                  }}
                >
                  {weeklyGoal ? `${workoutsThisWeek}/${weeklyGoal}` : workoutsThisWeek}
                </Text>
              </View>

              {/* Progress ring */}
              <View style={{ alignItems: "center", paddingVertical: 16 }}>
                <View
                  style={{
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: colors.surface,
                    borderWidth: 12,
                    borderColor: colors.surfaceMuted,
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  {/* Progress overlay */}
                  {weeklyGoal && (
                    <View
                      style={{
                        position: "absolute",
                        width: 140,
                        height: 140,
                        borderRadius: 70,
                        borderWidth: 12,
                        borderColor: colors.primary,
                        transform: [{ rotate: "-90deg" }],
                        borderTopColor: "transparent",
                        borderRightColor:
                          currentProgress >= 25 ? colors.primary : "transparent",
                        borderBottomColor:
                          currentProgress >= 50 ? colors.primary : "transparent",
                        borderLeftColor:
                          currentProgress >= 75 ? colors.primary : "transparent",
                      }}
                    />
                  )}

                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.bold,
                      fontSize: 36,
                    }}
                  >
                    {weeklyGoal ? Math.round(currentProgress) : workoutsThisWeek}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {weeklyGoal ? "%" : "workouts"}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                {weeklyGoal
                  ? workoutsThisWeek >= weeklyGoal
                    ? "🎉 Goal crushed! Keep the momentum going."
                    : `${weeklyGoal - workoutsThisWeek} more ${
                        weeklyGoal - workoutsThisWeek === 1 ? "workout" : "workouts"
                      } to hit your goal`
                  : "Set a weekly goal to track your progress"}
              </Text>
            </View>

            {weeklyGoal ? (
              <>
                {/* Stats Overview */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: 24,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.bold,
                        fontSize: 24,
                      }}
                    >
                      {stats.consistencyRate}%
                    </Text>
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}
                    >
                      Goal hit rate
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      padding: 16,
                      borderRadius: 16,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.bold,
                        fontSize: 24,
                      }}
                    >
                      {stats.avgWorkoutsPerWeek}
                    </Text>
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}
                    >
                      Avg per week
                    </Text>
                  </View>
                </View>

                {/* 8-Week History */}
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                    marginBottom: 20,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                      marginBottom: 16,
                    }}
                  >
                    8-Week History
                  </Text>

                  {isLoading ? (
                    <View style={{ paddingVertical: 20, alignItems: "center" }}>
                      <ActivityIndicator color={colors.primary} />
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {weeklyBreakdown.map((week, idx) => {
                        const isCurrentWeek = idx === weeklyBreakdown.length - 1;
                        return (
                          <View
                            key={idx}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 12,
                              padding: 12,
                              borderRadius: 12,
                              backgroundColor: isCurrentWeek
                                ? `${colors.primary}16`
                                : colors.surface,
                              borderWidth: 1,
                              borderColor: isCurrentWeek
                                ? colors.primary
                                : colors.border,
                            }}
                          >
                            <View
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: week.goalMet
                                  ? colors.primary
                                  : colors.surfaceMuted,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {week.goalMet ? (
                                <Ionicons
                                  name="checkmark"
                                  size={24}
                                  color={colors.surface}
                                />
                              ) : (
                                <Text
                                  style={{
                                    color: colors.textSecondary,
                                    fontFamily: fontFamilies.semibold,
                                    fontSize: 14,
                                  }}
                                >
                                  {week.workoutCount}
                                </Text>
                              )}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={{
                                  color: colors.textPrimary,
                                  fontFamily: fontFamilies.semibold,
                                  fontSize: 14,
                                }}
                              >
                                {formatWeek(week.weekStart)}
                                {isCurrentWeek ? " (Current)" : ""}
                              </Text>
                              <Text
                                style={{ color: colors.textSecondary, fontSize: 12 }}
                              >
                                {week.workoutCount} of {weeklyGoal} workouts
                              </Text>
                            </View>
                            {week.goalMet && (
                              <View
                                style={{
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 8,
                                  backgroundColor: `${colors.primary}20`,
                                }}
                              >
                                <Text
                                  style={{
                                    color: colors.primary,
                                    fontFamily: fontFamilies.semibold,
                                    fontSize: 11,
                                  }}
                                >
                                  Goal met
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </>
            ) : null}

            {/* Edit Goal CTA */}
            <Pressable
              onPress={() => {
                onClose();
                onEditGoal();
              }}
              style={({ pressed }) => ({
                padding: 16,
                borderRadius: 12,
                backgroundColor: pressed
                  ? `${colors.primary}DD`
                  : colors.primary,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              })}
            >
              <Ionicons name="create-outline" size={20} color={colors.surface} />
              <Text
                style={{
                  color: colors.surface,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 16,
                }}
              >
                {weeklyGoal ? "Edit Weekly Goal" : "Set Weekly Goal"}
              </Text>
            </Pressable>

            {/* Insight */}
            {weeklyGoal && (
              <View
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: `${colors.secondary}16`,
                  borderWidth: 1,
                  borderColor: `${colors.secondary}40`,
                  flexDirection: "row",
                  gap: 12,
                }}
              >
                <Ionicons name="trophy" size={24} color={colors.secondary} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 14,
                      marginBottom: 4,
                    }}
                  >
                    Keep Building Habits
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    {Number(stats.consistencyRate) >= 75
                      ? "Outstanding consistency! You're hitting your goals consistently. This builds long-term fitness habits."
                      : Number(stats.consistencyRate) >= 50
                      ? "You're on track! Try to hit your goal more consistently for better results and habit formation."
                      : "Stay consistent! Small wins add up. Focus on hitting your weekly goal to build momentum."}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default GoalProgressBottomSheet;
