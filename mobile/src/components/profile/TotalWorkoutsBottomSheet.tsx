import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";
import { fetchHistoryRange } from "../../api/sessions";

type TotalWorkoutsBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  totalWorkouts: number;
};

const TotalWorkoutsBottomSheet = ({
  visible,
  onClose,
  totalWorkouts,
}: TotalWorkoutsBottomSheetProps) => {
  const insets = useSafeAreaInsets();

  // Fetch last 30 days of workout data
  const thirtyDaysAgo = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString();
  }, []);

  const today = useMemo(() => new Date().toISOString(), []);

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["workout-history", thirtyDaysAgo, today],
    queryFn: () => fetchHistoryRange(thirtyDaysAgo, today),
    enabled: visible,
  });

  // Build heatmap data structure
  const heatmapData = useMemo(() => {
    if (!historyData?.days) return [];

    // Count workouts per day
    const workoutsByDate: Record<string, number> = {};
    historyData.days.forEach((day) => {
      workoutsByDate[day.date] = day.sessions.length;
    });

    // Generate last 30 days
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      days.push({
        date: dateStr,
        count: workoutsByDate[dateStr] || 0,
        dayOfWeek: date.getDay(),
        dayOfMonth: date.getDate(),
      });
    }

    return days;
  }, [historyData]);

  // Calculate stats
  const stats = useMemo(() => {
    const workoutsLast30Days = heatmapData.reduce((sum, day) => sum + day.count, 0);
    const daysWithWorkouts = heatmapData.filter((day) => day.count > 0).length;
    const currentStreak = (() => {
      let streak = 0;
      for (let i = heatmapData.length - 1; i >= 0; i--) {
        if (heatmapData[i].count > 0) {
          streak++;
        } else if (streak > 0) {
          break;
        }
      }
      return streak;
    })();
    const maxWorkoutsInDay = Math.max(...heatmapData.map((d) => d.count), 0);

    return {
      workoutsLast30Days,
      daysWithWorkouts,
      currentStreak,
      consistency: daysWithWorkouts > 0 ? ((daysWithWorkouts / 30) * 100).toFixed(0) : "0",
      maxWorkoutsInDay,
    };
  }, [heatmapData]);

  // Color intensity based on workout count
  const getHeatmapColor = (count: number) => {
    if (count === 0) return colors.surfaceMuted;
    if (count === 1) return `${colors.primary}40`;
    if (count === 2) return `${colors.primary}80`;
    return colors.primary;
  };

  const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];

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
                    Total Workouts
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>
                    Your training consistency over time
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
                  backgroundColor: `${colors.primary}16`,
                  borderWidth: 1,
                  borderColor: `${colors.primary}40`,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: fontFamilies.bold,
                    fontSize: 28,
                  }}
                >
                  {totalWorkouts}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  All-time
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
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.bold,
                    fontSize: 28,
                  }}
                >
                  {stats.workoutsLast30Days}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                  Last 30 days
                </Text>
              </View>
            </View>

            {/* Additional Stats */}
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
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 18,
                  }}
                >
                  {stats.consistency}%
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Consistency
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 18,
                  }}
                >
                  {stats.daysWithWorkouts}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Active days
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 18,
                  }}
                >
                  {stats.currentStreak}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                  Day streak
                </Text>
              </View>
            </View>

            {/* Heatmap Title */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
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
                Last 30 Days
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: colors.surfaceMuted,
                  }}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Less</Text>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    backgroundColor: colors.primary,
                  }}
                />
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>More</Text>
              </View>
            </View>

            {isLoading ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <>
                {/* Heatmap Calendar */}
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  {/* Day labels */}
                  <View style={{ flexDirection: "row", marginBottom: 8, paddingLeft: 32 }}>
                    {dayLabels.map((label, idx) => (
                      <View key={idx} style={{ width: 32, alignItems: "center" }}>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 10,
                            fontFamily: fontFamilies.semibold,
                          }}
                        >
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Heatmap grid - organized by week */}
                  {(() => {
                    type DayData = {
                      date: string;
                      count: number;
                      dayOfWeek: number;
                      dayOfMonth: number;
                    };
                    const weeks: DayData[][] = [];
                    let currentWeek: DayData[] = [];

                    // Pad beginning to align with day of week
                    const firstDayOfWeek = heatmapData[0]?.dayOfWeek ?? 0;
                    for (let i = 0; i < firstDayOfWeek; i++) {
                      currentWeek.push({
                        date: "",
                        count: -1, // placeholder
                        dayOfWeek: i,
                        dayOfMonth: 0,
                      });
                    }

                    heatmapData.forEach((day) => {
                      currentWeek.push(day);
                      if (currentWeek.length === 7) {
                        weeks.push(currentWeek);
                        currentWeek = [];
                      }
                    });

                    // Add remaining days
                    if (currentWeek.length > 0) {
                      // Pad end
                      while (currentWeek.length < 7) {
                        currentWeek.push({
                          date: "",
                          count: -1,
                          dayOfWeek: currentWeek.length,
                          dayOfMonth: 0,
                        });
                      }
                      weeks.push(currentWeek);
                    }

                    return weeks.map((week, weekIdx) => (
                      <View
                        key={weekIdx}
                        style={{
                          flexDirection: "row",
                          marginBottom: 8,
                          alignItems: "center",
                        }}
                      >
                        {/* Week label */}
                        <View style={{ width: 28, marginRight: 4 }}>
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: 10,
                              textAlign: "right",
                            }}
                          >
                            W{weekIdx + 1}
                          </Text>
                        </View>

                        {/* Days in week */}
                        {week.map((day, dayIdx) => (
                          <View
                            key={`${weekIdx}-${dayIdx}`}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              backgroundColor:
                                day.count === -1
                                  ? "transparent"
                                  : getHeatmapColor(day.count),
                              marginHorizontal: 2,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: day.count === -1 ? 0 : 1,
                              borderColor:
                                day.count === 0 ? colors.border : "transparent",
                            }}
                          >
                            {day.count > 0 && (
                              <Text
                                style={{
                                  color: colors.surface,
                                  fontSize: 10,
                                  fontFamily: fontFamilies.bold,
                                }}
                              >
                                {day.count}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    ));
                  })()}
                </View>

                {/* Insight */}
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
                  <Ionicons name="bulb" size={24} color={colors.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      {Number(stats.consistency) >= 70
                        ? "Amazing consistency!"
                        : Number(stats.consistency) >= 50
                        ? "Keep it up!"
                        : "Let's build consistency"}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {Number(stats.consistency) >= 70
                        ? "You're training on " +
                          stats.daysWithWorkouts +
                          " out of 30 days. Elite consistency!"
                        : Number(stats.consistency) >= 50
                        ? "You're training " +
                          stats.consistency +
                          "% of days. Try to hit 4-5 days per week for optimal results."
                        : "Aim for 3-4 workouts per week to build momentum and see consistent progress."}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default TotalWorkoutsBottomSheet;
