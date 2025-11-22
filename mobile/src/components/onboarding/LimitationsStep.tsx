import { View, Text, TextInput } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

type LimitationsStepProps = {
  injuryNotes: string;
  movementsToAvoid: string;
  onInjuryNotesChange: (notes: string) => void;
  onMovementsToAvoidChange: (movements: string) => void;
};

export const LimitationsStep = ({
  injuryNotes,
  movementsToAvoid,
  onInjuryNotesChange,
  onMovementsToAvoidChange,
}: LimitationsStepProps) => {
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
          🏥 Any limitations?
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Help us keep you safe by telling us about any injuries or movements to
          avoid. This is optional.
        </Text>
      </View>

      <View style={{ gap: 16 }}>
        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
              fontSize: 15,
            }}
          >
            💭 Current or past injuries (optional)
          </Text>
          <TextInput
            value={injuryNotes}
            onChangeText={onInjuryNotesChange}
            placeholder="E.g., Lower back issues, shoulder impingement..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontFamily: fontFamilies.medium,
              fontSize: 15,
              minHeight: 100,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontFamily: fontFamilies.semibold,
              fontSize: 15,
            }}
          >
            ⚠️ Movements to avoid (optional)
          </Text>
          <TextInput
            value={movementsToAvoid}
            onChangeText={onMovementsToAvoidChange}
            placeholder="E.g., Overhead press, squats below parallel..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.textPrimary,
              fontFamily: fontFamilies.medium,
              fontSize: 15,
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>
      </View>

      <View
        style={{
          padding: 14,
          borderRadius: 12,
          backgroundColor: `${colors.primary}10`,
          borderWidth: 1,
          borderColor: `${colors.primary}30`,
          gap: 4,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 13,
            fontFamily: fontFamilies.semibold,
          }}
        >
          💡 Pro tip
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          Being specific helps us recommend safer alternatives and avoid
          exercises that might aggravate your injuries.
        </Text>
      </View>
    </View>
  );
};
