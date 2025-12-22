import { Image, Text, TextInput, View } from "react-native";
import { API_BASE_URL } from "../../api/client";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";
import { WorkoutSet } from "../../types/workouts";
import { isPerSideMovement } from "../../utils/weightEstimates";

type Props = {
  set: WorkoutSet;
  onChange?: (updated: WorkoutSet) => void;
};

const formatExerciseName = (id: string) =>
  id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const SetEditorRow = ({ set, onChange }: Props) => {
  const updateField = (field: keyof WorkoutSet, value: number | undefined) => {
    onChange?.({ ...set, [field]: value });
  };

  const exerciseName = set.exerciseName ?? formatExerciseName(set.exerciseId);
  const weightSuffix = isPerSideMovement(exerciseName, set.exerciseId)
    ? ' per arm'
    : '';
  const targetLine = [
    set.targetWeight !== undefined
      ? `${set.targetWeight} lb${weightSuffix}`
      : undefined,
    set.targetReps !== undefined ? `${set.targetReps} reps` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const resolvedImageUri =
    set.exerciseImageUrl && !set.exerciseImageUrl.startsWith("http")
      ? `${API_BASE_URL.replace(/\/api$/, "")}${set.exerciseImageUrl}`
      : set.exerciseImageUrl;

  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        marginTop: 8,
        backgroundColor: colors.surface,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        {resolvedImageUri ? (
          <Image
            source={{ uri: resolvedImageUri }}
            style={{
              width: 68,
              height: 68,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
            }}
          />
        ) : (
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 12,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
              {exerciseName?.[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
              {exerciseName}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Set {set.setIndex + 1}</Text>
          </View>
          {targetLine ? (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              Target: {targetLine}
            </Text>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Log this effort</Text>
          )}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            {`Weight${weightSuffix ? ' (per arm)' : ''}`}
          </Text>
          <TextInput
            style={{
              color: colors.textPrimary,
              backgroundColor: colors.surfaceMuted,
              borderRadius: 8,
              padding: 10,
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
              padding: 10,
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
    </View>
  );
};

export default SetEditorRow;
