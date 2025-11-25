import { useMemo, useState } from "react";
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

// Conversion utilities
const cmToFeetInches = (cm: number): { feet: number; inches: number } => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return { feet, inches };
};

const feetInchesToCm = (feet: number, inches: number): number => {
  const totalInches = feet * 12 + inches;
  return Math.round(totalInches * 2.54);
};

const kgToLbs = (kg: number): number => {
  return Math.round(kg * 2.20462);
};

const lbsToKg = (lbs: number): number => {
  return Math.round(lbs / 2.20462 * 10) / 10;
};

const BodyProfileStep = ({
  gender,
  heightCm,
  weightKg,
  onGenderChange,
  onHeightChange,
  onWeightChange,
}: Props) => {
  // Convert stored metric values to imperial for display
  const initialHeight = useMemo(() => {
    if (!heightCm) return { feet: "", inches: "" };
    const { feet, inches } = cmToFeetInches(heightCm);
    return { feet: String(feet), inches: String(inches) };
  }, [heightCm]);

  const [heightFeet, setHeightFeet] = useState(initialHeight.feet);
  const [heightInches, setHeightInches] = useState(initialHeight.inches);

  const weightDisplay = useMemo(() => {
    if (!weightKg) return "";
    return String(kgToLbs(weightKg));
  }, [weightKg]);

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
            Height
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <TextInput
                value={heightFeet}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, "");
                  setHeightFeet(cleaned);

                  if (!cleaned && !heightInches) {
                    onHeightChange(undefined);
                    return;
                  }

                  const feet = cleaned ? Number(cleaned) : 0;
                  const inches = heightInches ? Number(heightInches) : 0;

                  if (!Number.isNaN(feet) && !Number.isNaN(inches)) {
                    onHeightChange(feetInchesToCm(feet, inches));
                  }
                }}
                keyboardType="numeric"
                placeholder="5"
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
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>feet</Text>
            </View>
            <View style={{ flex: 1 }}>
              <TextInput
                value={heightInches}
                onChangeText={(text) => {
                  const cleaned = text.replace(/[^0-9]/g, "");
                  setHeightInches(cleaned);

                  if (!heightFeet && !cleaned) {
                    onHeightChange(undefined);
                    return;
                  }

                  const feet = heightFeet ? Number(heightFeet) : 0;
                  const inches = cleaned ? Number(cleaned) : 0;

                  if (!Number.isNaN(feet) && !Number.isNaN(inches)) {
                    onHeightChange(feetInchesToCm(feet, inches));
                  }
                }}
                keyboardType="numeric"
                placeholder="7"
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
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>inches</Text>
            </View>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ ...typography.body, color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
            Weight (lbs)
          </Text>
          <TextInput
            value={weightDisplay}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9]/g, "");
              if (!cleaned) {
                onWeightChange(undefined);
                return;
              }
              const lbs = Number(cleaned);
              if (!Number.isNaN(lbs)) {
                onWeightChange(lbsToKg(lbs));
              }
            }}
            keyboardType="numeric"
            placeholder="150"
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
