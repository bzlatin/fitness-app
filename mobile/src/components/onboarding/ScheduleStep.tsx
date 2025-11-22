import { Pressable, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { SESSION_DURATIONS, WEEKLY_FREQUENCIES } from "../../types/onboarding";

interface ScheduleStepProps {
  weeklyFrequency?: number;
  sessionDuration?: number;
  onWeeklyFrequencyChange: (frequency: number) => void;
  onSessionDurationChange: (duration: number) => void;
}

const ScheduleStep = ({
  weeklyFrequency,
  sessionDuration,
  onWeeklyFrequencyChange,
  onSessionDurationChange,
}: ScheduleStepProps) => {
  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          Let's plan your schedule
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Choose a realistic schedule that fits your lifestyle. You can always adjust this later.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ ...typography.subheading, color: colors.textPrimary }}>
          How many days per week?
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {WEEKLY_FREQUENCIES.map((freq) => {
            const isSelected = weeklyFrequency === freq;
            return (
              <Pressable
                key={freq}
                onPress={() => onWeeklyFrequencyChange(freq)}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? `${colors.primary}15` : colors.surfaceMuted,
                  opacity: pressed ? 0.8 : 1,
                  minWidth: 70,
                  alignItems: "center",
                })}
              >
                <Text
                  style={{
                    color: isSelected ? colors.primary : colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                  }}
                >
                  {freq}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  {freq === 1 ? "day" : "days"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ ...typography.subheading, color: colors.textPrimary }}>
          Session duration
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {SESSION_DURATIONS.map((duration) => {
            const isSelected = sessionDuration === duration;
            return (
              <Pressable
                key={duration}
                onPress={() => onSessionDurationChange(duration)}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? `${colors.primary}15` : colors.surfaceMuted,
                  opacity: pressed ? 0.8 : 1,
                  flex: 1,
                  minWidth: 80,
                  alignItems: "center",
                })}
              >
                <Text
                  style={{
                    color: isSelected ? colors.primary : colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    fontSize: 16,
                  }}
                >
                  {duration}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                  }}
                >
                  minutes
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default ScheduleStep;
