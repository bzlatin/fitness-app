import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { searchExercises } from "../../api/exercises";
import { API_BASE_URL } from "../../api/client";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { Exercise, TemplateExerciseForm } from "../../types/workouts";
import { isCardioExercise } from "../../utils/exercises";

type Props = {
  visible: boolean;
  onClose: () => void;
  selected: TemplateExerciseForm[];
  onAdd: (exerciseForm: Omit<TemplateExerciseForm, "formId">) => void;
  onRemove: (exerciseId: string) => void;
};

const muscleGroups = [
  "all",
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "glutes",
  "core",
];

const ExercisePicker = ({ visible, onClose, selected, onAdd, onRemove }: Props) => {
  const [query, setQuery] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("all");
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [restSeconds, setRestSeconds] = useState("90");
  const [incline, setIncline] = useState("1");
  const [duration, setDuration] = useState("20");
  const [distance, setDistance] = useState("1.0");

  const debouncedQuery = useDebouncedValue(query, 350);

  useEffect(() => {
    if (!visible) {
      setActiveExercise(null);
    }
  }, [visible]);

  const exercisesQuery = useQuery({
    queryKey: ["exercises", debouncedQuery, muscleGroup],
    queryFn: () =>
      searchExercises({
        query: debouncedQuery || undefined,
        muscleGroup: muscleGroup === "all" ? undefined : muscleGroup,
      }),
    staleTime: 1000 * 60 * 5,
    enabled: visible,
  });

  const handleSelect = (exercise: Exercise) => {
    const existing = selected.find((item) => item.exercise.id === exercise.id);
    if (existing) {
      onRemove(exercise.id);
      setActiveExercise(null);
      return;
    }

    setActiveExercise(exercise);
    setSets("3");
    setReps("10");
    setRestSeconds("90");
    setIncline("1");
    setDuration("20");
    setDistance("1.0");
  };

  const confirmAdd = () => {
    if (!activeExercise) return;
    const cardio = isCardioExercise(activeExercise);
    const parsedSets = Number(sets) || 3;
    const parsedReps = Number(reps) || 10;
    const parsedRest = restSeconds ? Number(restSeconds) : undefined;
    const parsedIncline = incline ? Number(incline) : undefined;
    const parsedDuration = duration ? Number(duration) : undefined;
    const parsedDistance = distance ? Number(distance) : undefined;

    onAdd({
      exercise: activeExercise,
      sets: parsedSets,
      reps: parsedReps,
      restSeconds: parsedRest,
      incline: cardio ? parsedIncline : undefined,
      durationMinutes: cardio ? parsedDuration : undefined,
      distance: cardio ? parsedDistance : undefined,
    });
    setActiveExercise(null);
  };

  const apiHost = API_BASE_URL.replace(/\/api$/, "");

  const renderExercise = ({ item }: { item: Exercise }) => {
    const isAdded = selected.some((ex) => ex.exercise.id === item.id);
    const isConfiguring = activeExercise?.id === item.id;
    const cardio = isCardioExercise(item);
    const imageUri =
      item.gifUrl && item.gifUrl.startsWith("http")
        ? item.gifUrl
        : item.gifUrl
        ? `${apiHost}${item.gifUrl}`
        : undefined;
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 10,
        }}
      >
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={{
                width: 68,
                height: 68,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
              }}
              resizeMode="cover"
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
              }}
            >
              <Ionicons name="fitness-outline" color={colors.textSecondary} size={28} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...typography.title,
                color: colors.textPrimary,
              }}
            >
              {item.name}
            </Text>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              {item.primaryMuscleGroup} • {item.equipment || "Bodyweight"}
            </Text>
          </View>
          <Pressable
            onPress={() => handleSelect(item)}
            style={({ pressed }) => ({
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: isAdded ? "rgba(34,197,94,0.12)" : colors.surfaceMuted,
              borderWidth: 1,
              borderColor: isAdded ? colors.primary : colors.border,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: fontFamilies.semibold,
                color: isAdded ? colors.primary : colors.textPrimary,
              }}
            >
              {isAdded ? "Added" : "Add"}
            </Text>
          </Pressable>
        </View>

        {isConfiguring ? (
          <View
            style={{
              marginTop: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: 10,
              gap: 10,
            }}
          >
            <Text
              style={{
                fontFamily: fontFamilies.semibold,
                color: colors.textPrimary,
              }}
            >
              Quick add
            </Text>
            {cardio ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <InputChip
                  label="Incline"
                  value={incline}
                  onChangeText={setIncline}
                  keyboardType="decimal-pad"
                />
                <InputChip
                  label="Duration (min)"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="decimal-pad"
                />
                <InputChip
                  label="Distance (mi)"
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                />
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <InputChip label="Sets" value={sets} onChangeText={setSets} />
                <InputChip label="Reps" value={reps} onChangeText={setReps} />
                <InputChip
                  label="Rest (s)"
                  value={restSeconds}
                  onChangeText={setRestSeconds}
                />
              </View>
            )}
            <Pressable
              onPress={confirmAdd}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: fontFamilies.semibold,
                  color: colors.surface,
                }}
              >
                Drop into workout
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
        }}
      >
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                ...typography.heading2,
                color: colors.textPrimary,
              }}
            >
              Add exercise
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View
            style={{
              marginTop: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Ionicons name="search" color={colors.textSecondary} size={18} />
            <TextInput
              placeholder="Search by name"
              placeholderTextColor={colors.textSecondary}
              style={{
                flex: 1,
                paddingVertical: 10,
                paddingHorizontal: 10,
                color: colors.textPrimary,
                fontFamily: fontFamilies.regular,
              }}
              value={query}
              onChangeText={setQuery}
            />
          </View>

          <FlatList
            data={muscleGroups}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
            renderItem={({ item }) => {
              const isActive = item === muscleGroup;
              return (
                <Pressable
                  onPress={() => setMuscleGroup(item)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: isActive ? colors.primary : colors.surfaceMuted,
                    borderWidth: 1,
                    borderColor: isActive ? colors.primary : colors.border,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.semibold,
                      color: isActive ? colors.surface : colors.textPrimary,
                      textTransform: "capitalize",
                    }}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        <FlatList
          data={exercisesQuery.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 32,
          }}
          renderItem={renderExercise}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            exercisesQuery.isFetching ? (
              <View style={{ paddingVertical: 8 }}>
                <ActivityIndicator color={colors.secondary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !exercisesQuery.isFetching ? (
              <View
                style={{
                  padding: 20,
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    ...typography.title,
                    color: colors.textPrimary,
                  }}
                >
                  No exercises found
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                  }}
                >
                  Try another muscle or a simpler search.
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
};

type InputChipProps = {
  label: string;
  value: string;
  onChangeText: (val: string) => void;
  keyboardType?: "numeric" | "decimal-pad";
};

const InputChip = ({
  label,
  value,
  onChangeText,
  keyboardType = "numeric",
}: InputChipProps) => (
  <View
    style={{
      flex: 1,
      gap: 6,
    }}
  >
    <Text
      style={{
        ...typography.caption,
        color: colors.textSecondary,
      }}
    >
      {label}
    </Text>
    <TextInput
      keyboardType={keyboardType}
      value={value}
      onChangeText={onChangeText}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceMuted,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        color: colors.textPrimary,
        fontFamily: fontFamilies.medium,
      }}
    />
  </View>
);

export default ExercisePicker;
