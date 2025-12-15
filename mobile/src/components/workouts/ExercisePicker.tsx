import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { deleteCustomExercise, getCustomExercises, searchAllExercises } from "../../api/exercises";
import { API_BASE_URL } from "../../api/client";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { CustomExercise, Exercise, TemplateExerciseForm } from "../../types/workouts";
import { isCardioExercise } from "../../utils/exercises";
import EditCustomExerciseModal from "./EditCustomExerciseModal";

type Props = {
  visible: boolean;
  onClose: () => void;
  selected: TemplateExerciseForm[];
  onAdd: (exerciseForm: Omit<TemplateExerciseForm, "formId">) => void;
  onRemove: (exerciseId: string) => void;
  onCreateCustomExercise?: (suggestedName?: string) => void;
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
  "custom",
];

const ExercisePicker = ({ visible, onClose, selected, onAdd, onRemove, onCreateCustomExercise }: Props) => {
  const [query, setQuery] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("all");
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [editingCustomExercise, setEditingCustomExercise] = useState<CustomExercise | null>(null);
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [restSeconds, setRestSeconds] = useState("90");
  const [weight, setWeight] = useState("");
  const [incline, setIncline] = useState("1");
  const [duration, setDuration] = useState("20");
  const [distance, setDistance] = useState("1.0");

  const debouncedQuery = useDebouncedValue(query, 350);

  useEffect(() => {
    if (!visible) {
      setActiveExercise(null);
    }
  }, [visible]);

  const queryClient = useQueryClient();
  const isCustomCategory = muscleGroup === "custom";

  const exercisesQuery = useQuery({
    queryKey: ["exercises-all", debouncedQuery, muscleGroup],
    queryFn: () =>
      searchAllExercises({
        query: debouncedQuery || undefined,
        muscleGroup: muscleGroup === "all" ? undefined : muscleGroup,
      }),
    staleTime: 1000 * 60 * 5,
    enabled: visible && !isCustomCategory,
  });

  const customExercisesQuery = useQuery({
    queryKey: ["custom-exercises"],
    queryFn: getCustomExercises,
    staleTime: 1000 * 60 * 5,
    enabled: visible && isCustomCategory,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomExercise,
    onSuccess: (_, deletedId) => {
      if (activeExercise?.id === deletedId) {
        setActiveExercise(null);
      }
      queryClient.invalidateQueries({ queryKey: ["custom-exercises"] });
      queryClient.invalidateQueries({ queryKey: ["exercises-all"] });
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error?.response?.data?.error || "Failed to delete custom exercise. Please try again."
      );
    },
  });

  const customExercisesById = new Map(
    (customExercisesQuery.data ?? []).map((exercise) => [exercise.id, exercise])
  );

  const customExercisesFiltered = (customExercisesQuery.data ?? []).filter((exercise) =>
    debouncedQuery ? exercise.name.toLowerCase().includes(debouncedQuery.toLowerCase()) : true
  );

  const customExercisesAsExercises: Exercise[] = customExercisesFiltered.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    primaryMuscleGroup: exercise.primaryMuscleGroup,
    equipment: exercise.equipment || "bodyweight",
    gifUrl: exercise.imageUrl || undefined,
    isCustom: true,
    createdBy: exercise.userId,
  }));

  const allExercises = isCustomCategory
    ? customExercisesAsExercises
    : [...(exercisesQuery.data?.library ?? []), ...(exercisesQuery.data?.custom ?? [])];

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
    setWeight("");
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
    const parsedWeight = weight ? Number(weight) : undefined;
    const parsedIncline = incline ? Number(incline) : undefined;
    const parsedDuration = duration ? Number(duration) : undefined;
    const parsedDistance = distance ? Number(distance) : undefined;

    onAdd({
      exercise: activeExercise,
      sets: parsedSets,
      reps: parsedReps,
      restSeconds: parsedRest,
      weight:
        !cardio && parsedWeight !== undefined && !Number.isNaN(parsedWeight)
          ? String(parsedWeight)
          : undefined,
      incline:
        cardio && parsedIncline !== undefined ? String(parsedIncline) : undefined,
      durationMinutes:
        cardio && parsedDuration !== undefined ? String(parsedDuration) : undefined,
      distance:
        cardio && parsedDistance !== undefined ? String(parsedDistance) : undefined,
    });
    setActiveExercise(null);
  };

  const apiHost = API_BASE_URL.replace(/\/api$/, "");

  const handleCreateCustom = () => {
    onCreateCustomExercise?.(debouncedQuery || undefined);
  };

  const openCustomExerciseActions = (exerciseId: string) => {
    const customExercise = customExercisesById.get(exerciseId);
    if (!customExercise) return;

    Alert.alert(customExercise.name, undefined, [
      {
        text: "Edit",
        onPress: () => setEditingCustomExercise(customExercise),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Delete exercise?",
            `Delete "${customExercise.name}"? This can't be undone.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => deleteMutation.mutate(customExercise.id),
              },
            ]
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

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
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 }}>
              <Text
                style={{
                  ...typography.title,
                  color: colors.textPrimary,
                  flexShrink: 1,
                }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {item.isCustom && (
                <View
                  style={{
                    backgroundColor: "rgba(34,197,94,0.15)",
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    flexShrink: 0,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontFamily: fontFamilies.semibold,
                      color: colors.primary,
                    }}
                  >
                    CUSTOM
                  </Text>
                </View>
              )}
            </View>
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
          {isCustomCategory && item.isCustom ? (
            <Pressable
              onPress={() => openCustomExerciseActions(item.id)}
              hitSlop={8}
              disabled={deleteMutation.isPending}
              style={({ pressed }) => ({
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                opacity: deleteMutation.isPending ? 0.6 : 1,
              })}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => handleSelect(item)}
            style={({ pressed }) => ({
              marginLeft: 6,
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
              <>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <InputChip label="Sets" value={sets} onChangeText={setSets} />
                  <InputChip label="Reps" value={reps} onChangeText={setReps} />
                  <InputChip
                    label="Rest (s)"
                    value={restSeconds}
                    onChangeText={setRestSeconds}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <InputChip
                    label="Weight (lb)"
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                  />
                </View>
              </>
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

  const showCreateCta = Boolean(onCreateCustomExercise && debouncedQuery);
  const isFetching = exercisesQuery.isFetching || customExercisesQuery.isFetching;

  return (
    <>
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
          data={allExercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 32,
          }}
          renderItem={renderExercise}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            isFetching ? (
              <View style={{ paddingVertical: 8 }}>
                <ActivityIndicator color={colors.secondary} />
              </View>
            ) : null
          }
          ListFooterComponent={
            showCreateCta ? (
              <View style={{ paddingTop: 10 }}>
                <Pressable
                  onPress={handleCreateCustom}
                  style={({ pressed }) => ({
                    backgroundColor: colors.surface,
                    borderRadius: 14,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  })}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      backgroundColor: `${colors.primary}18`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.body, color: colors.textPrimary }}>
                      Create custom exercise
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                      {debouncedQuery ? `Add "${debouncedQuery}" to your library` : "Create a new exercise"}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <View style={{ height: 8 }} />
            )
          }
          ListEmptyComponent={
            !isFetching ? (
              <View
                style={{
                  padding: 20,
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Ionicons name="fitness-outline" size={48} color={colors.textSecondary} />
                <Text
                  style={{
                    ...typography.title,
                    color: colors.textPrimary,
                    textAlign: "center",
                  }}
                >
                  No exercises found
                </Text>
                <Text
                  style={{
                    ...typography.caption,
                    color: colors.textSecondary,
                    textAlign: "center",
                  }}
                >
                  {debouncedQuery
                    ? "Can't find what you're looking for?"
                    : "Try searching for an exercise"}
                </Text>
                {debouncedQuery && onCreateCustomExercise && (
                  <Pressable
                    onPress={handleCreateCustom}
                    style={({ pressed }) => ({
                      marginTop: 8,
                      backgroundColor: colors.primary,
                      paddingVertical: 12,
                      paddingHorizontal: 20,
                      borderRadius: 12,
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <Text
                      style={{
                        fontFamily: fontFamilies.semibold,
                        color: colors.surface,
                      }}
                    >
                      Create custom exercise
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : null
          }
        />
      </View>
      </Modal>

      {editingCustomExercise ? (
        <EditCustomExerciseModal
          visible={!!editingCustomExercise}
          onClose={() => setEditingCustomExercise(null)}
          onUpdated={() => setEditingCustomExercise(null)}
          onDeleted={() => setEditingCustomExercise(null)}
          exercise={editingCustomExercise}
        />
      ) : null}
    </>
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
