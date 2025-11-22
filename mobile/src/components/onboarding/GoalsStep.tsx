import { View, Text, Pressable } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

type Goal =
  | "build_muscle"
  | "lose_weight"
  | "strength"
  | "endurance"
  | "general_fitness";

const GOAL_OPTIONS: { id: Goal; label: string; emoji: string }[] = [
  { id: "build_muscle", label: "Build Muscle", emoji: "💪" },
  { id: "lose_weight", label: "Lose Weight", emoji: "🔥" },
  { id: "strength", label: "Get Stronger", emoji: "🏋️" },
  { id: "endurance", label: "Improve Endurance", emoji: "🏃" },
  { id: "general_fitness", label: "General Fitness", emoji: "✨" },
];

type GoalsStepProps = {
  selectedGoals: string[];
  onGoalsChange: (goals: string[]) => void;
};

export const GoalsStep = ({
  selectedGoals,
  onGoalsChange,
}: GoalsStepProps) => {
  const toggleGoal = (goalId: string) => {
    if (selectedGoals.includes(goalId)) {
      onGoalsChange(selectedGoals.filter((g) => g !== goalId));
    } else {
      onGoalsChange([...selectedGoals, goalId]);
    }
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text
          style={{
            ...typography.heading1,
            color: colors.textPrimary,
            fontSize: 28,
          }}
        >
          🎯 What are your goals?
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Select all that apply. We'll use this to personalize your experience.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {GOAL_OPTIONS.map((goal) => {
          const isSelected = selectedGoals.includes(goal.id);
          return (
            <Pressable
              key={goal.id}
              onPress={() => toggleGoal(goal.id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                padding: 16,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected
                  ? `${colors.primary}15`
                  : colors.surfaceMuted,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 24 }}>{goal.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                  }}
                >
                  {goal.label}
                </Text>
              </View>
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && (
                  <Text style={{ color: colors.surface, fontSize: 14 }}>✓</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {selectedGoals.length > 0 && (
        <View
          style={{
            padding: 12,
            borderRadius: 10,
            backgroundColor: `${colors.primary}10`,
            borderWidth: 1,
            borderColor: `${colors.primary}30`,
          }}
        >
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 13,
              textAlign: "center",
            }}
          >
            ✨ {selectedGoals.length} goal{selectedGoals.length > 1 ? "s" : ""}{" "}
            selected
          </Text>
        </View>
      )}
    </View>
  );
};
