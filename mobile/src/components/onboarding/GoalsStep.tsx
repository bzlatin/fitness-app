import { Pressable, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { FitnessGoal, FITNESS_GOAL_LABELS } from "../../types/onboarding";

interface GoalsStepProps {
  selectedGoals: FitnessGoal[];
  onGoalsChange: (goals: FitnessGoal[]) => void;
}

const GOAL_DESCRIPTIONS: Record<FitnessGoal, string> = {
  build_muscle: "Increase muscle mass and size",
  lose_weight: "Reduce body fat and lose weight",
  strength: "Build maximum strength and power",
  endurance: "Improve cardiovascular fitness",
  general_fitness: "Stay active and healthy",
};

const GoalsStep = ({ selectedGoals, onGoalsChange }: GoalsStepProps) => {
  const toggleGoal = (goal: FitnessGoal) => {
    if (selectedGoals.includes(goal)) {
      onGoalsChange(selectedGoals.filter((g) => g !== goal));
    } else {
      onGoalsChange([...selectedGoals, goal]);
    }
  };

  const goals: FitnessGoal[] = [
    "build_muscle",
    "lose_weight",
    "strength",
    "endurance",
    "general_fitness",
  ];

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          What are your fitness goals?
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Select all that apply. We'll use this to personalize your experience.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {goals.map((goal) => {
          const isSelected = selectedGoals.includes(goal);
          return (
            <Pressable
              key={goal}
              onPress={() => toggleGoal(goal)}
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
                    <Text style={{ color: colors.surface, fontSize: 14, fontFamily: fontFamilies.semibold }}>
                      ✓
                    </Text>
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
                    {FITNESS_GOAL_LABELS[goal]}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {GOAL_DESCRIPTIONS[goal]}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default GoalsStep;
