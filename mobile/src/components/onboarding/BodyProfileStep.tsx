import { useMemo } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { BodyGender } from "../../types/onboarding";

type Props = {
  gender?: BodyGender;
  heightCm?: number;
  weightKg?: number;
  onGenderChange: (gender?: BodyGender) => void;
  onHeightChange: (height?: number) => void;
  onWeightChange: (weight?: number) => void;
};

const BodyProfileStep = ({
  gender,
  heightCm,
  weightKg,
  onGenderChange,
  onHeightChange,
  onWeightChange,
}: Props) => {
  const heightDisplay = useMemo(() => (heightCm ? String(heightCm) : ""), [heightCm]);
  const weightDisplay = useMemo(() => (weightKg ? String(weightKg) : ""), [weightKg]);

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
          Body profile
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          Optional: choose your avatar’s body view and add basic stats to improve recommendations later.
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.body, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
          Body type
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {(["male", "female"] as BodyGender[]).map((option) => {
            const selected = gender === option;
            return (
              <Pressable
                key={option}
                onPress={() => onGenderChange(selected ? undefined : option)}
                style={({ pressed }) => ({
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? `${colors.primary}15` : colors.surface,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    textTransform: "capitalize",
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          If left blank, we’ll default to a male figure—you can change this anytime.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ ...typography.body, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
            Height (cm)
          </Text>
          <TextInput
            value={heightDisplay}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, "");
              if (!cleaned) {
                onHeightChange(undefined);
                return;
              }
              const numeric = Number(cleaned);
              onHeightChange(Number.isNaN(numeric) ? undefined : numeric);
            }}
            keyboardType="numeric"
            placeholder="e.g. 178"
            placeholderTextColor={colors.textSecondary}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.textPrimary,
            }}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ ...typography.body, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
            Weight (kg)
          </Text>
          <TextInput
            value={weightDisplay}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9.]/g, "");
              if (!cleaned) {
                onWeightChange(undefined);
                return;
              }
              const numeric = Number(cleaned);
              onWeightChange(Number.isNaN(numeric) ? undefined : numeric);
            }}
            keyboardType="numeric"
            placeholder="e.g. 75"
            placeholderTextColor={colors.textSecondary}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              color: colors.textPrimary,
            }}
          />
        </View>
      </View>
    </View>
  );
};

export default BodyProfileStep;
