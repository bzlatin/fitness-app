import { Pressable, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import {
  ExperienceLevel,
  EXPERIENCE_LEVEL_LABELS,
  EXPERIENCE_LEVEL_DESCRIPTIONS,
} from "../../types/onboarding";

interface ExperienceLevelStepProps {
  selectedLevel?: ExperienceLevel;
  onLevelChange: (level: ExperienceLevel) => void;
}

const ExperienceLevelStep = ({ selectedLevel, onLevelChange }: ExperienceLevelStepProps) => {
  const levels: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          What's your experience level?
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          This helps us recommend the right workout intensity and progression.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {levels.map((level) => {
          const isSelected = selectedLevel === level;
          return (
            <Pressable
              key={level}
              onPress={() => onLevelChange(level)}
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
                    {EXPERIENCE_LEVEL_LABELS[level]}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {EXPERIENCE_LEVEL_DESCRIPTIONS[level]}
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

export default ExperienceLevelStep;
