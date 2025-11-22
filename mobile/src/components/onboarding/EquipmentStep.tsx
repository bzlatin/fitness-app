import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { EquipmentType, EQUIPMENT_TYPE_LABELS } from "../../types/onboarding";

interface EquipmentStepProps {
  selectedEquipment: EquipmentType[];
  customEquipment?: string[];
  onEquipmentChange: (equipment: EquipmentType[]) => void;
  onCustomEquipmentChange: (equipment: string[]) => void;
}

const EQUIPMENT_DESCRIPTIONS: Record<EquipmentType, string> = {
  gym_full: "Access to barbells, machines, and free weights",
  home_limited: "Dumbbells, resistance bands, or basic equipment",
  bodyweight: "No equipment needed",
  custom: "Specify your available equipment",
};

const EquipmentStep = ({
  selectedEquipment,
  customEquipment = [],
  onEquipmentChange,
  onCustomEquipmentChange,
}: EquipmentStepProps) => {
  const toggleEquipment = (equipment: EquipmentType) => {
    if (selectedEquipment.includes(equipment)) {
      onEquipmentChange(selectedEquipment.filter((e) => e !== equipment));
    } else {
      onEquipmentChange([...selectedEquipment, equipment]);
    }
  };

  const equipment: EquipmentType[] = ["gym_full", "home_limited", "bodyweight", "custom"];
  const showCustomInput = selectedEquipment.includes("custom");

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          What equipment do you have access to?
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Select all that apply so we can suggest appropriate workouts.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {equipment.map((eq) => {
          const isSelected = selectedEquipment.includes(eq);
          return (
            <Pressable
              key={eq}
              onPress={() => toggleEquipment(eq)}
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
                    {EQUIPMENT_TYPE_LABELS[eq]}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {EQUIPMENT_DESCRIPTIONS[eq]}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {showCustomInput && (
        <View style={{ gap: 6 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            List your equipment (comma-separated)
          </Text>
          <TextInput
            value={customEquipment.join(", ")}
            onChangeText={(text) => {
              const items = text
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean);
              onCustomEquipmentChange(items);
            }}
            placeholder="e.g., Pull-up bar, Kettlebells, Yoga mat"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              color: colors.textPrimary,
              minHeight: 72,
              fontFamily: fontFamilies.medium,
            }}
          />
        </View>
      )}
    </View>
  );
};

export default EquipmentStep;
