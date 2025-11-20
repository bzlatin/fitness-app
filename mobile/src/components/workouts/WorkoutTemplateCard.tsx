import { Pressable, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { WorkoutTemplate } from "../../types/workouts";

type Props = {
  template: WorkoutTemplate;
  onPress?: () => void;
  onDuplicate?: () => void;
};

const Badge = ({ label }: { label: string }) => (
  <View
    style={{
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Text
      style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 12 }}
    >
      {label}
    </Text>
  </View>
);

const WorkoutTemplateCard = ({
  template,
  onPress,
  onDuplicate,
}: Props) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => ({
      backgroundColor: colors.surface,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      opacity: pressed ? 0.9 : 1,
      marginBottom: 12,
    })}
  >
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 10,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: "700",
          flex: 1,
        }}
        numberOfLines={1}
      >
        {template.name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {template.isFavorite ? (
          <Text style={{ color: colors.secondary, fontWeight: "700" }}>★</Text>
        ) : null}
      </View>
    </View>
    <View
      style={{
        marginTop: 8,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
      }}
    >
      {template.splitType ? (
        <Badge label={template.splitType.toUpperCase()} />
      ) : null}
      <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
        {template.exercises.length} exercises
      </Text>
      {onDuplicate ? (
        <Pressable onPress={onDuplicate}>
          <Text
            style={{
              color: colors.secondary,
              fontWeight: "600",
              textDecorationLine: "underline",
            }}
          >
            Duplicate
          </Text>
        </Pressable>
      ) : null}
    </View>
    {template.description ? (
      <Text
        style={{
          color: colors.textSecondary,
          marginTop: 8,
          lineHeight: 20,
        }}
      >
        {template.description}
      </Text>
    ) : null}
  </Pressable>
);

export default WorkoutTemplateCard;
