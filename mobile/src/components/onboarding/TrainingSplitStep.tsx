import { View, Text, Pressable } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

type TrainingSplit =
  | "push_pull_legs"
  | "upper_lower"
  | "full_body"
  | "bro_split"
  | "custom";

const SPLIT_OPTIONS: {
  id: TrainingSplit;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    id: "push_pull_legs",
    label: "Push/Pull/Legs",
    description: "3-6 days: Push, pull, and leg days",
    emoji: "🔄",
  },
  {
    id: "upper_lower",
    label: "Upper/Lower",
    description: "4 days: Alternating upper and lower body",
    emoji: "⬆️",
  },
  {
    id: "full_body",
    label: "Full Body",
    description: "3-4 days: Train everything each session",
    emoji: "💪",
  },
  {
    id: "bro_split",
    label: "Body Part Split",
    description: "5-6 days: One muscle group per day",
    emoji: "🎯",
  },
  {
    id: "custom",
    label: "Custom / Flexible",
    description: "I'll create my own split",
    emoji: "✨",
  },
];

type TrainingSplitStepProps = {
  preferredSplit: string;
  onSplitChange: (split: string) => void;
};

export const TrainingSplitStep = ({
  preferredSplit,
  onSplitChange,
}: TrainingSplitStepProps) => {
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
          🗓️ Training split
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Choose the workout split that fits your schedule and goals.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {SPLIT_OPTIONS.map((option) => {
          const isSelected = preferredSplit === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => onSplitChange(option.id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
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
                <Text style={{ fontSize: 24 }}>{option.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                    marginBottom: 2,
                  }}
                >
                  {option.label}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    lineHeight: 17,
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

      {preferredSplit && (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
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
            ✨ Great choice! We'll suggest workouts for your{" "}
            {SPLIT_OPTIONS.find((o) => o.id === preferredSplit)?.label} split
          </Text>
        </View>
      )}
    </View>
  );
};
