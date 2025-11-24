import { Text, View, ActivityIndicator } from "react-native";
import { WorkoutTemplate } from "../types/workouts";
import { useMuscleGroupDistribution } from "../hooks/useMuscleGroupDistribution";
import {
  formatMuscleGroup,
  getTopMuscleGroups,
} from "../utils/muscleGroupCalculations";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";

type MuscleGroupBreakdownProps = {
  template: WorkoutTemplate | null | undefined;
  maxGroups?: number;
  variant?: "compact" | "detailed";
};

/**
 * Displays the muscle group distribution for a workout template
 * Shows the top muscle groups targeted by the workout with percentages
 */
export const MuscleGroupBreakdown = ({
  template,
  maxGroups = 3,
  variant = "compact",
}: MuscleGroupBreakdownProps) => {
  const { distribution, isLoading, isError } =
    useMuscleGroupDistribution(template);

  if (isLoading) {
    return (
      <View
        style={{
          padding: 12,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (isError || !template) {
    return null;
  }

  if (distribution.length === 0) {
    return (
      <View>
        <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
          Target muscles
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>
          Add exercises to see muscle group breakdown
        </Text>
      </View>
    );
  }

  const topGroups = getTopMuscleGroups(distribution, maxGroups);

  if (variant === "detailed") {
    return (
      <View style={{ gap: 12 }}>
        <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
          Target muscles
        </Text>
        <View style={{ gap: 8 }}>
          {topGroups.map((group) => (
            <View
              key={group.muscleGroup}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 14,
                  }}
                >
                  {formatMuscleGroup(group.muscleGroup)}
                </Text>
                <Text
                  style={{
                    color: colors.secondary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 14,
                  }}
                >
                  {group.percentage}%
                </Text>
              </View>
              <View
                style={{
                  height: 6,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${group.percentage}%`,
                    backgroundColor: colors.secondary,
                    borderRadius: 3,
                  }}
                />
              </View>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {group.setCount} {group.setCount === 1 ? "set" : "sets"}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  // Compact variant (default)
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
        Target muscles
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {topGroups.map((group) => (
          <View
            key={group.muscleGroup}
            style={{
              flex: 1,
              minWidth: 100,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 14,
                marginBottom: 6,
              }}
            >
              {formatMuscleGroup(group.muscleGroup)}
            </Text>
            <Text
              style={{
                color: colors.secondary,
                fontFamily: fontFamilies.bold,
                fontSize: 22,
                letterSpacing: -0.5,
              }}
            >
              {group.percentage}%
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 11,
                marginTop: 4,
              }}
            >
              {group.setCount} {group.setCount === 1 ? "set" : "sets"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default MuscleGroupBreakdown;
