import { Text, TextInput, View } from "react-native";
import { colors } from "../../theme/colors";
import { WorkoutSet } from "../../types/workouts";

type Props = {
  set: WorkoutSet;
  onChange?: (updated: WorkoutSet) => void;
};

const SetEditorRow = ({ set, onChange }: Props) => {
  const updateField = (field: keyof WorkoutSet, value: number | undefined) => {
    onChange?.({ ...set, [field]: value });
  };

  return (
    <View
      style={{
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        marginTop: 8,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Text style={{ color: colors.textSecondary, width: 28 }}>#{set.setIndex + 1}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Weight</Text>
        <TextInput
        style={{
          color: colors.textPrimary,
          backgroundColor: colors.surfaceMuted,
          borderRadius: 8,
          padding: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        keyboardType="numeric"
        placeholder="--"
        placeholderTextColor={colors.textSecondary}
        value={set.actualWeight?.toString() ?? ""}
        onChangeText={(text) =>
          updateField("actualWeight", text ? Number(text) : undefined)
        }
      />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Reps</Text>
        <TextInput
        style={{
          color: colors.textPrimary,
          backgroundColor: colors.surfaceMuted,
          borderRadius: 8,
          padding: 8,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        keyboardType="numeric"
        placeholder="--"
        placeholderTextColor={colors.textSecondary}
        value={set.actualReps?.toString() ?? ""}
        onChangeText={(text) =>
          updateField("actualReps", text ? Number(text) : undefined)
        }
      />
      </View>
    </View>
  );
};

export default SetEditorRow;
