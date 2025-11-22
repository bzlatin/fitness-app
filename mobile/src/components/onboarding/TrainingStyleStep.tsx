import { Pressable, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { TrainingSplit, TRAINING_SPLIT_LABELS } from "../../types/onboarding";

interface TrainingStyleStepProps {
  selectedSplit?: TrainingSplit;
  onSplitChange: (split: TrainingSplit) => void;
}

const SPLIT_DESCRIPTIONS: Record<TrainingSplit, string> = {
  push_pull_legs: "Split workouts into push, pull, and leg days (3-6x/week)",
  upper_lower: "Alternate between upper and lower body (2-4x/week)",
  full_body: "Train all major muscle groups each session (2-3x/week)",
  custom: "Create your own training split",
};

const TrainingStyleStep = ({ selectedSplit, onSplitChange }: TrainingStyleStepProps) => {
  const splits: TrainingSplit[] = ["push_pull_legs", "upper_lower", "full_body", "custom"];

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          Choose your training split
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          This determines how you'll organize your workouts throughout the week.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {splits.map((split) => {
          const isSelected = selectedSplit === split;
          return (
            <Pressable
              key={split}
              onPress={() => onSplitChange(split)}
              style={({ pressed }) => ({
                padding: 16,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? `${colors.primary}15` : colors.surfaceMuted,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSelected && (
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: colors.surface,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    {TRAINING_SPLIT_LABELS[split]}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {SPLIT_DESCRIPTIONS[split]}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: `${colors.primary}15`,
          borderWidth: 1,
          borderColor: `${colors.primary}30`,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: fontFamilies.semibold,
            fontSize: 15,
            marginBottom: 4,
          }}
        >
          You're almost done!
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          After completing this step, we'll personalize your workout experience based on your preferences.
        </Text>
      </View>
    </View>
  );
};

export default TrainingStyleStep;
