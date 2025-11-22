import { View, Text, Pressable } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

type ExperienceLevel = "beginner" | "intermediate" | "advanced";

const EXPERIENCE_OPTIONS: {
  id: ExperienceLevel;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    id: "beginner",
    label: "Beginner",
    description: "Less than 6 months of training",
    emoji: "🌱",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    description: "6-24 months of consistent training",
    emoji: "🔥",
  },
  {
    id: "advanced",
    label: "Advanced",
    description: "2+ years of training experience",
    emoji: "💎",
  },
];

type ExperienceStepProps = {
  experienceLevel: string;
  onExperienceChange: (level: string) => void;
};

export const ExperienceStep = ({
  experienceLevel,
  onExperienceChange,
}: ExperienceStepProps) => {
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
          📊 Your experience level
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          This helps us tailor workout recommendations to your skill level.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {EXPERIENCE_OPTIONS.map((option) => {
          const isSelected = experienceLevel === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onExperienceChange(option.id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                padding: 18,
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
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 26 }}>{option.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 17,
                    marginBottom: 2,
                  }}
                >
                  {option.label}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    lineHeight: 18,
                  }}
                >
                  {option.description}
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
    </View>
  );
};
