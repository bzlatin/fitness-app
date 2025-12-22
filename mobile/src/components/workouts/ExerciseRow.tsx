import { Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { WorkoutTemplateExercise } from "../../types/workouts";
import { isPerSideMovement } from "../../utils/weightEstimates";

type Props = {
  item: WorkoutTemplateExercise;
  exerciseName?: string;
};

const formatExerciseName = (exerciseId: string) =>
  exerciseId
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const ExerciseRow = ({ item, exerciseName }: Props) => {
  const title = exerciseName ?? formatExerciseName(item.exerciseId);
  const weightSuffix = isPerSideMovement(
    exerciseName,
    item.exerciseId,
    item.equipment
  )
    ? ' per arm'
    : '';

  const cardioParts: string[] = [];
  if (item.defaultDurationMinutes) {
    cardioParts.push(`Duration ${item.defaultDurationMinutes} min`);
  }
  if (item.defaultDistance) {
    cardioParts.push(`Distance ${item.defaultDistance} mi`);
  }
  if (item.defaultIncline) {
    cardioParts.push(`Incline ${item.defaultIncline}%`);
  }

  // Determine if this is a rep range
  const hasRepRange =
    item.defaultRepsMin !== undefined &&
    item.defaultRepsMin !== null &&
    item.defaultRepsMax !== undefined &&
    item.defaultRepsMax !== null &&
    item.defaultRepsMin !== item.defaultRepsMax;

  const repsDisplay = hasRepRange
    ? `${item.defaultRepsMin}–${item.defaultRepsMax} reps`
    : `${item.defaultReps} reps`;

  return (
    <View
      style={{
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 16 }}>
        {title}
      </Text>
      <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
        {item.defaultSets} x {repsDisplay}
        {item.defaultRestSeconds ? ` • ${item.defaultRestSeconds}s rest` : ""}
      </Text>
      {item.defaultWeight ? (
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
          Target weight: {item.defaultWeight} lb{weightSuffix}
        </Text>
      ) : null}
      {cardioParts.length > 0 ? (
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
          {cardioParts.join(" • ")}
        </Text>
      ) : null}
      {item.notes ? (
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{item.notes}</Text>
      ) : null}
    </View>
  );
};

export default ExerciseRow;
