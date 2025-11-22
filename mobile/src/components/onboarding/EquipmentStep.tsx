import { View, Text, Pressable } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";

type Equipment = "gym_full" | "home_limited" | "bodyweight";

const EQUIPMENT_OPTIONS: {
  id: Equipment;
  label: string;
  description: string;
  emoji: string;
}[] = [
  {
    id: "gym_full",
    label: "Full Gym Access",
    description: "Barbells, dumbbells, machines, etc.",
    emoji: "🏋️",
  },
  {
    id: "home_limited",
    label: "Home Equipment",
    description: "Dumbbells, resistance bands, etc.",
    emoji: "🏠",
  },
  {
    id: "bodyweight",
    label: "Bodyweight Only",
    description: "No equipment needed",
    emoji: "💪",
  },
];

type EquipmentStepProps = {
  selectedEquipment: string[];
  onEquipmentChange: (equipment: string[]) => void;
};

export const EquipmentStep = ({
  selectedEquipment,
  onEquipmentChange,
}: EquipmentStepProps) => {
  const toggleEquipment = (equipmentId: string) => {
    if (selectedEquipment.includes(equipmentId)) {
      onEquipmentChange(selectedEquipment.filter((e) => e !== equipmentId));
    } else {
      onEquipmentChange([...selectedEquipment, equipmentId]);
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
          🏋️ Available equipment
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Select all the equipment you have access to. We'll recommend exercises
          accordingly.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {EQUIPMENT_OPTIONS.map((option) => {
          const isSelected = selectedEquipment.includes(option.id);
          return (
            <Pressable
              key={option.id}
              onPress={() => toggleEquipment(option.id)}
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

      {selectedEquipment.length > 0 && (
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
            ✨ {selectedEquipment.length} option
            {selectedEquipment.length > 1 ? "s" : ""} selected
          </Text>
        </View>
      )}
    </View>
  );
};
