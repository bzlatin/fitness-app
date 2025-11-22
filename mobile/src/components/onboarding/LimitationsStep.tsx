import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

interface LimitationsStepProps {
  injuryNotes?: string;
  movementsToAvoid?: string[];
  onInjuryNotesChange: (notes: string) => void;
  onMovementsToAvoidChange: (movements: string[]) => void;
}

const COMMON_MOVEMENTS = [
  "Squats",
  "Deadlifts",
  "Bench Press",
  "Overhead Press",
  "Pull-ups",
  "Running",
  "Jumping",
];

const LimitationsStep = ({
  injuryNotes = "",
  movementsToAvoid = [],
  onInjuryNotesChange,
  onMovementsToAvoidChange,
}: LimitationsStepProps) => {
  const toggleMovement = (movement: string) => {
    if (movementsToAvoid.includes(movement)) {
      onMovementsToAvoidChange(movementsToAvoid.filter((m) => m !== movement));
    } else {
      onMovementsToAvoidChange([...movementsToAvoid, movement]);
    }
  };

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          Any injuries or limitations?
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          This is completely optional, but helps us recommend safer workouts for you.
        </Text>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Injury notes (optional)
        </Text>
        <TextInput
          value={injuryNotes}
          onChangeText={onInjuryNotesChange}
          placeholder="e.g., Lower back pain, shoulder injury..."
          placeholderTextColor={colors.textSecondary}
          multiline
          style={{
            backgroundColor: colors.surfaceMuted,
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.textPrimary,
            minHeight: 80,
            fontFamily: fontFamilies.medium,
          }}
        />
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          Movements to avoid (optional)
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {COMMON_MOVEMENTS.map((movement) => {
            const isSelected = movementsToAvoid.includes(movement);
            return (
              <Pressable
                key={movement}
                onPress={() => toggleMovement(movement)}
                style={({ pressed }) => ({
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? `${colors.primary}15` : colors.surfaceMuted,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    color: isSelected ? colors.primary : colors.textPrimary,
                    fontFamily: fontFamilies.medium,
                    fontSize: 14,
                  }}
                >
                  {movement}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View
        style={{
          padding: 12,
          borderRadius: 8,
          backgroundColor: `${colors.primary}10`,
          borderWidth: 1,
          borderColor: `${colors.primary}30`,
        }}
      >
        <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
          💡 This information is private and will only be used to personalize your workout recommendations.
        </Text>
      </View>
    </View>
  );
};

export default LimitationsStep;
