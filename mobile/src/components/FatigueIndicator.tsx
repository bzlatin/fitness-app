import { Text, View } from "react-native";
import { MuscleFatigue } from "../types/analytics";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";
import { formatMuscleGroup } from "../utils/muscleGroupCalculations";
import { readinessFromFatigueScore } from "../utils/fatigueReadiness";

type FatigueIndicatorProps = {
  item: MuscleFatigue;
  compact?: boolean;
};

const hintForItem = (item: MuscleFatigue) => {
  if (item.fatigued) return "Needs rest";
  if (item.underTrained) return "Good to target";
  if (item.baselineMissing && item.last7DaysVolume > 0) return "Building baseline";
  return null;
};

const FatigueIndicator = ({ item, compact = false }: FatigueIndicatorProps) => {
  const readiness = readinessFromFatigueScore(item.fatigueScore);
  const hint = hintForItem(item);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: compact ? 10 : 14,
        padding: compact ? 10 : 14,
        borderWidth: 1,
        borderColor: colors.border,
        gap: compact ? 6 : 8,
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
            fontSize: compact ? 14 : 16,
          }}
        >
          {formatMuscleGroup(item.muscleGroup)}
        </Text>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Text
            style={{
              color: readiness.color,
              fontFamily: fontFamilies.bold,
              fontSize: compact ? 16 : 18,
            }}
          >
            {readiness.percent}%
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontFamily: fontFamilies.medium,
              fontSize: compact ? 11 : 12,
            }}
          >
            {readiness.label}
          </Text>
        </View>
      </View>

      {hint && (
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: fontFamilies.medium,
            fontSize: compact ? 12 : 13,
          }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
};

export default FatigueIndicator;
