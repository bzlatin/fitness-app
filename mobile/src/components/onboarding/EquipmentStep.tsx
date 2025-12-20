import { Pressable, Text, View } from "react-native";
import EquipmentSelector from "../gym/EquipmentSelector";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { EquipmentType, EQUIPMENT_TYPE_LABELS } from "../../types/onboarding";

interface EquipmentStepProps {
  selectedEquipment: EquipmentType[];
  customEquipment?: string[];
  onEquipmentChange: (equipment: EquipmentType[]) => void;
  onCustomEquipmentChange: (equipment: string[]) => void;
  onSkip?: () => void;
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
  onSkip,
}: EquipmentStepProps) => {
  const equipment: EquipmentType[] = ["gym_full", "home_limited", "bodyweight", "custom"];
  const selectedPreset = selectedEquipment[0];
  const showCustomSelector = selectedPreset === "custom";

  const handleSelect = (preset: EquipmentType) => {
    if (selectedPreset === preset) return;
    onEquipmentChange([preset]);
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          What equipment do you have access to?
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Pick the setup that matches your gym, or choose Custom to fine-tune.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {equipment.map((eq) => {
          const isSelected = selectedPreset === eq;
          return (
            <Pressable
              key={eq}
              onPress={() => handleSelect(eq)}
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

      {showCustomSelector ? (
        <View style={{ gap: 12 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            Pick the equipment that is actually available.
          </Text>
          <EquipmentSelector
            selectedEquipment={customEquipment}
            bodyweightOnly={false}
            onSelectionChange={onCustomEquipmentChange}
            onBodyweightOnlyChange={() => undefined}
            onApplyPreset={() => undefined}
            showPresets={false}
            showBodyweightToggle={false}
          />
        </View>
      ) : null}

      {onSkip ? (
        <Pressable
          onPress={onSkip}
          style={({ pressed }) => ({
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            alignItems: "center",
            marginTop: 6,
          })}
        >
          <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
            Skip and use full gym defaults
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};

export default EquipmentStep;
