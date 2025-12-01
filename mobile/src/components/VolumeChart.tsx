import { useMemo } from "react";
import { View, Text, Dimensions, ScrollView, Pressable, StyleSheet } from "react-native";
import Svg, { Line, Circle, G, Text as SvgText, Path } from "react-native-svg";
import { WeeklyVolumeData } from "../types/analytics";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import { formatMuscleGroup } from "../utils/muscleGroupCalculations";

const { width: screenWidth } = Dimensions.get("window");

type VolumeChartProps = {
  data: WeeklyVolumeData[];
  selectedMuscles?: string[];
  onMuscleToggle?: (muscle: string) => void;
  weeks?: number;
};

// Color palette for muscle groups
const muscleColors: Record<string, string> = {
  chest: "#22C55E",
  back: "#38BDF8",
  "middle back": "#38BDF8", // Same as back
  shoulders: "#F59E0B",
  biceps: "#8B5CF6",
  triceps: "#EC4899",
  legs: "#EF4444",
  quads: "#EF4444", // Same as legs
  hamstrings: "#DC2626", // Darker red
  glutes: "#F97316",
  calves: "#FB923C", // Orange
  core: "#10B981",
  abs: "#10B981", // Same as core
  lats: "#0EA5E9", // Bright blue
  traps: "#FCD34D", // Yellow
  forearms: "#A78BFA", // Purple
  other: "#6B7280",
};

const VolumeChart = ({ data, selectedMuscles, onMuscleToggle, weeks = 12 }: VolumeChartProps) => {
  const chartWidth = Math.max(screenWidth - 48, weeks * 50);
  const chartHeight = 250;
  const paddingTop = 20;
  const paddingBottom = 40;
  const paddingLeft = 45;
  const paddingRight = 20;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const allMuscles = useMemo(() => {
    const muscles = new Set<string>();
    data.forEach((week) => muscles.add(week.muscleGroup));
    return Array.from(muscles).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    if (!selectedMuscles || selectedMuscles.length === 0) {
      return data;
    }
    return data.filter((d) => selectedMuscles.includes(d.muscleGroup));
  }, [data, selectedMuscles]);

  const chartData = useMemo(() => {
    const grouped = new Map<
      string,
      Array<{ weekStartDate: string; totalVolume: number }>
    >();

    filteredData.forEach((week) => {
      if (!grouped.has(week.muscleGroup)) {
        grouped.set(week.muscleGroup, []);
      }
      grouped.get(week.muscleGroup)!.push({
        weekStartDate: week.weekStartDate,
        totalVolume: week.totalVolume,
      });
    });

    grouped.forEach((weeks) => {
      weeks.sort((a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime());
    });

    return grouped;
  }, [filteredData]);

  const allWeeks = useMemo(() => {
    const weeks = new Set<string>();
    filteredData.forEach((d) => weeks.add(d.weekStartDate));
    return Array.from(weeks).sort();
  }, [filteredData]);

  const maxVolume = useMemo(() => {
    const max = Math.max(...filteredData.map((d) => d.totalVolume), 0);
    return Math.ceil(max / 1000) * 1000 || 1000;
  }, [filteredData]);

  const yAxisLabels = useMemo(() => {
    const count = 5;
    const step = maxVolume / count;
    return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i));
  }, [maxVolume]);

  const xAxisLabels = useMemo(() => {
    return allWeeks.filter((_, i) => i % 2 === 0 || i === allWeeks.length - 1);
  }, [allWeeks]);

  const getX = (weekIndex: number) => {
    return paddingLeft + (weekIndex / (allWeeks.length - 1 || 1)) * innerWidth;
  };

  const getY = (volume: number) => {
    return paddingTop + innerHeight - (volume / maxVolume) * innerHeight;
  };

  const generateLinePath = (muscleWeeks: Array<{ weekStartDate: string; totalVolume: number }>) => {
    if (muscleWeeks.length === 0) return "";

    const points = muscleWeeks.map((week) => {
      const weekIndex = allWeeks.indexOf(week.weekStartDate);
      return { x: getX(weekIndex), y: getY(week.totalVolume) };
    });

    return points.map((point, i) => `${i === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  };

  if (filteredData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No volume data available</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.legendContainer}>
        {allMuscles.map((muscle) => {
          const isSelected = !selectedMuscles || selectedMuscles.includes(muscle);
          return (
            <Pressable
              key={muscle}
              onPress={() => onMuscleToggle?.(muscle)}
              style={[
                styles.legendChip,
                {
                  backgroundColor: isSelected
                    ? muscleColors[muscle] + "33"
                    : colors.surfaceMuted,
                  borderColor: isSelected ? muscleColors[muscle] : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.legendText,
                  { color: isSelected ? muscleColors[muscle] : colors.textSecondary },
                ]}
              >
                {formatMuscleGroup(muscle)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={chartWidth} height={chartHeight}>
          {yAxisLabels.map((volume) => {
            const y = getY(volume);
            return (
              <G key={volume}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth="1"
                  opacity={0.3}
                />
                <SvgText
                  x={paddingLeft - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill={colors.textSecondary}
                  fontFamily={fontFamilies.regular}
                >
                  {volume >= 1000 ? `${(volume / 1000).toFixed(0)}k` : volume}
                </SvgText>
              </G>
            );
          })}

          {xAxisLabels.map((weekDate) => {
            const weekIndex = allWeeks.indexOf(weekDate);
            const x = getX(weekIndex);
            const date = new Date(weekDate);
            const label = `${date.getMonth() + 1}/${date.getDate()}`;
            return (
              <SvgText
                key={weekDate}
                x={x}
                y={chartHeight - 15}
                textAnchor="middle"
                fontSize="9"
                fill={colors.textSecondary}
                fontFamily={fontFamilies.regular}
              >
                {label}
              </SvgText>
            );
          })}

          {Array.from(chartData.entries()).map(([muscle, muscleWeeks]) => {
            const path = generateLinePath(muscleWeeks);
            const color = muscleColors[muscle] || muscleColors.other;

            return (
              <G key={muscle}>
                <Path d={path} stroke={color} strokeWidth="2.5" fill="none" />
                {muscleWeeks.map((week) => {
                  const weekIndex = allWeeks.indexOf(week.weekStartDate);
                  const x = getX(weekIndex);
                  const y = getY(week.totalVolume);

                  return (
                    <Circle
                      key={`${muscle}-${weekIndex}`}
                      cx={x}
                      cy={y}
                      r="4"
                      fill={color}
                      stroke={colors.surface}
                      strokeWidth="1.5"
                    />
                  );
                })}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    height: 250,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#9CA3AF",
    fontFamily: fontFamilies.medium,
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
    justifyContent: "flex-start",
  },
  legendChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  legendText: {
    fontSize: 13,
    fontFamily: fontFamilies.semibold,
    textAlign: "center",
  },
});

export default VolumeChart;
