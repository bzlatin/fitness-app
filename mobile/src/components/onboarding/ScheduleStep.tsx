import { View, Text, Pressable } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

const FREQUENCY_OPTIONS = [3, 4, 5, 6, 7];

const DURATION_OPTIONS: { value: number; label: string }[] = [
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
];

type ScheduleStepProps = {
  weeklyFrequency: number;
  sessionDuration: number;
  onFrequencyChange: (frequency: number) => void;
  onDurationChange: (duration: number) => void;
};

export const ScheduleStep = ({
  weeklyFrequency,
  sessionDuration,
  onFrequencyChange,
  onDurationChange,
}: ScheduleStepProps) => {
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Text
          style={{
            ...typography.heading1,
            color: colors.textPrimary,
            fontSize: 28,
          }}
        >
          📅 Training schedule
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Tell us about your availability so we can plan workouts that fit your
          lifestyle.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: fontFamilies.semibold,
            fontSize: 16,
          }}
        >
          Workouts per week
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {FREQUENCY_OPTIONS.map((freq) => {
            const isSelected = weeklyFrequency === freq;
            return (
              <Pressable
                key={freq}
                onPress={() => onFrequencyChange(freq)}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 60,
                  paddingVertical: 16,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected
                    ? colors.primary
                    : colors.surfaceMuted,
                  alignItems: "center",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: isSelected ? colors.surface : colors.textPrimary,
                    fontFamily: fontFamilies.bold,
                    fontSize: 20,
                  }}
                >
                  {freq}
                </Text>
                <Text
                  style={{
                    color: isSelected ? colors.surface : colors.textSecondary,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  days
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: fontFamilies.semibold,
            fontSize: 16,
          }}
        >
          Session length
        </Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {DURATION_OPTIONS.map((option) => {
            const isSelected = sessionDuration === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onDurationChange(option.value)}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 70,
                  paddingVertical: 16,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected
                    ? colors.primary
                    : colors.surfaceMuted,
                  alignItems: "center",
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: isSelected ? colors.surface : colors.textPrimary,
                    fontFamily: fontFamilies.bold,
                    fontSize: 18,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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
            color: colors.textPrimary,
            fontSize: 14,
            textAlign: "center",
            fontFamily: fontFamilies.medium,
          }}
        >
          💪 You'll train{" "}
          <Text style={{ fontFamily: fontFamilies.bold }}>
            {weeklyFrequency} times
          </Text>{" "}
          per week for{" "}
          <Text style={{ fontFamily: fontFamilies.bold }}>
            {sessionDuration} minutes
          </Text>
        </Text>
      </View>
    </View>
  );
};
