import { useQuery } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";
import { fetchWeeklyVolume } from "../../api/analytics";
import { useMemo } from "react";

type TotalVolumeBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
};

const TotalVolumeBottomSheet = ({
  visible,
  onClose,
}: TotalVolumeBottomSheetProps) => {
  const { data: volumeData, isLoading } = useQuery({
    queryKey: ["weekly-volume", 12],
    queryFn: () => fetchWeeklyVolume(12),
    enabled: visible,
  });

  // Aggregate volume by week
  const weeklyTotals = useMemo(() => {
    if (!volumeData) return [];

    const weekMap: Record<
      string,
      { weekStartDate: string; totalVolume: number; workoutCount: number }
    > = {};

    volumeData.forEach((item) => {
      const key = item.weekStartDate;
      if (!weekMap[key]) {
        weekMap[key] = {
          weekStartDate: item.weekStartDate,
          totalVolume: 0,
          workoutCount: 0,
        };
      }
      weekMap[key].totalVolume += item.totalVolume;
      weekMap[key].workoutCount = Math.max(
        weekMap[key].workoutCount,
        item.workoutCount
      );
    });

    return Object.values(weekMap)
      .sort(
        (a, b) =>
          new Date(a.weekStartDate).getTime() -
          new Date(b.weekStartDate).getTime()
      )
      .slice(-12); // Last 12 weeks
  }, [volumeData]);

  // Calculate stats
  const stats = useMemo(() => {
    if (weeklyTotals.length === 0) {
      return {
        totalVolume: 0,
        avgWeeklyVolume: 0,
        peakWeek: 0,
        trend: "stable" as "up" | "down" | "stable",
      };
    }

    const totalVolume = weeklyTotals.reduce((sum, w) => sum + w.totalVolume, 0);
    const avgWeeklyVolume = Math.round(totalVolume / weeklyTotals.length);
    const peakWeek = Math.max(...weeklyTotals.map((w) => w.totalVolume));

    // Calculate trend (last 4 weeks vs previous 4 weeks)
    const recentWeeks = weeklyTotals.slice(-4);
    const previousWeeks = weeklyTotals.slice(-8, -4);
    const recentAvg =
      recentWeeks.reduce((sum, w) => sum + w.totalVolume, 0) / recentWeeks.length;
    const previousAvg =
      previousWeeks.length > 0
        ? previousWeeks.reduce((sum, w) => sum + w.totalVolume, 0) /
          previousWeeks.length
        : recentAvg;

    let trend: "up" | "down" | "stable" = "stable";
    if (recentAvg > previousAvg * 1.1) trend = "up";
    else if (recentAvg < previousAvg * 0.9) trend = "down";

    return {
      totalVolume,
      avgWeeklyVolume,
      peakWeek,
      trend,
    };
  }, [weeklyTotals]);

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Chart rendering
  const chartWidth = Dimensions.get("window").width - 80;
  const chartHeight = 200;
  const maxVolume = Math.max(...weeklyTotals.map((w) => w.totalVolume), 1);

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
            paddingBottom: 32,
            borderWidth: 1,
            borderColor: colors.border,
            maxHeight: "90%",
            overflow: "hidden",
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
            contentContainerStyle={{ paddingHorizontal: 20 }}
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
                  Total Volume
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>
                  Your training volume trends
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

            {isLoading ? (
              <View style={{ paddingVertical: 60, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
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
                      backgroundColor: `${colors.primary}16`,
                      borderWidth: 1,
                      borderColor: `${colors.primary}40`,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: fontFamilies.bold,
                        fontSize: 24,
                      }}
                    >
                      {formatVolume(stats.totalVolume)}
                    </Text>
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}
                    >
                      12-week total
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
                        fontSize: 24,
                      }}
                    >
                      {formatVolume(stats.avgWeeklyVolume)}
                    </Text>
                    <Text
                      style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}
                    >
                      Avg per week
                    </Text>
                  </View>
                </View>

                {/* Trend indicator */}
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
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Ionicons
                      name={
                        stats.trend === "up"
                          ? "trending-up"
                          : stats.trend === "down"
                          ? "trending-down"
                          : "remove"
                      }
                      size={20}
                      color={
                        stats.trend === "up"
                          ? colors.primary
                          : stats.trend === "down"
                          ? colors.error
                          : colors.textSecondary
                      }
                    />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                      }}
                    >
                      {stats.trend === "up"
                        ? "Volume trending up"
                        : stats.trend === "down"
                        ? "Volume trending down"
                        : "Volume stable"}
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
                        fontSize: 16,
                      }}
                    >
                      {formatVolume(stats.peakWeek)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      Peak week
                    </Text>
                  </View>
                </View>

                {/* Chart */}
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
                    12-Week Volume Trend
                  </Text>

                  {weeklyTotals.length > 0 ? (
                    <View style={{ height: chartHeight }}>
                      {/* Y-axis labels */}
                      <View
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          height: chartHeight,
                          justifyContent: "space-between",
                          paddingVertical: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 10,
                          }}
                        >
                          {formatVolume(maxVolume)}
                        </Text>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 10,
                          }}
                        >
                          {formatVolume(maxVolume / 2)}
                        </Text>
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 10,
                          }}
                        >
                          0
                        </Text>
                      </View>

                      {/* Chart bars */}
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-end",
                          height: chartHeight - 20,
                          marginLeft: 40,
                          gap: 4,
                        }}
                      >
                        {weeklyTotals.map((week, idx) => {
                          const barHeight =
                            (week.totalVolume / maxVolume) * (chartHeight - 30);
                          return (
                            <View
                              key={idx}
                              style={{
                                flex: 1,
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <View
                                style={{
                                  width: "100%",
                                  height: Math.max(barHeight, 2),
                                  backgroundColor:
                                    idx === weeklyTotals.length - 1
                                      ? colors.primary
                                      : `${colors.primary}60`,
                                  borderRadius: 4,
                                }}
                              />
                            </View>
                          );
                        })}
                      </View>

                      {/* X-axis labels */}
                      <View
                        style={{
                          flexDirection: "row",
                          marginLeft: 40,
                          marginTop: 8,
                          gap: 4,
                        }}
                      >
                        {weeklyTotals.map((week, idx) => (
                          <View
                            key={idx}
                            style={{
                              flex: 1,
                              alignItems: "center",
                            }}
                          >
                            {idx % 2 === 0 && (
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  fontSize: 9,
                                }}
                              >
                                {formatDate(week.weekStartDate)}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : (
                    <View style={{ paddingVertical: 40, alignItems: "center" }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                        No volume data yet. Complete workouts to see your trends!
                      </Text>
                    </View>
                  )}
                </View>

                {/* Insight */}
                <View
                  style={{
                    padding: 16,
                    borderRadius: 16,
                    backgroundColor: `${colors.secondary}16`,
                    borderWidth: 1,
                    borderColor: `${colors.secondary}40`,
                    flexDirection: "row",
                    gap: 12,
                  }}
                >
                  <Ionicons name="analytics" size={24} color={colors.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 14,
                        marginBottom: 4,
                      }}
                    >
                      Volume Insight
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {stats.trend === "up"
                        ? "Your volume is increasing! Progressive overload is the key to growth. Make sure to manage fatigue and recovery."
                        : stats.trend === "down"
                        ? "Volume has decreased recently. This could be a deload phase or reduced frequency. Maintain consistency for progress."
                        : "Your volume is stable. Consider progressive overload strategies like increasing weight, reps, or sets to drive adaptation."}
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

export default TotalVolumeBottomSheet;
