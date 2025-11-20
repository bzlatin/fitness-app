import { Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { WorkoutTemplateExercise } from "../../types/workouts";

type Props = {
  item: WorkoutTemplateExercise;
  exerciseName?: string;
};

const ExerciseRow = ({ item, exerciseName }: Props) => (
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
      {exerciseName ?? "Exercise"}
    </Text>
    <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
      {item.defaultSets} x {item.defaultReps} reps
      {item.defaultRestSeconds ? ` • ${item.defaultRestSeconds}s rest` : ""}
    </Text>
    {item.notes ? (
      <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{item.notes}</Text>
    ) : null}
  </View>
);

export default ExerciseRow;
