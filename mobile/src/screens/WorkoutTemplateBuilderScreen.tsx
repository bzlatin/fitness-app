import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import { createTemplate, fetchTemplate, updateTemplate } from "../api/templates";
import { templatesKey, useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { RootRoute, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { WorkoutTemplate } from "../types/workouts";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type EditableExercise = {
  exerciseId: string;
  defaultSets: number;
  defaultReps: number;
  defaultRestSeconds?: number;
  notes?: string;
};

const exerciseOptions: EditableExercise[] = [
  { exerciseId: "ex-bench-press", defaultSets: 3, defaultReps: 8 },
  { exerciseId: "ex-back-squat", defaultSets: 4, defaultReps: 6 },
  { exerciseId: "ex-deadlift", defaultSets: 3, defaultReps: 5 },
  { exerciseId: "ex-ohp", defaultSets: 3, defaultReps: 8 },
];

const WorkoutTemplateBuilderScreen = () => {
  const route = useRoute<RootRoute<"WorkoutTemplateBuilder">>();
  const navigation = useNavigation<Nav>();
  const { data: listData } = useWorkoutTemplates();

  const existingTemplate = useMemo(
    () => listData?.find((t) => t.id === route.params?.templateId),
    [listData, route.params?.templateId]
  );

  const detailQuery = useQuery({
    queryKey: [...templatesKey, route.params?.templateId],
    queryFn: () => fetchTemplate(route.params!.templateId!),
    enabled: Boolean(route.params?.templateId && !existingTemplate),
    initialData: existingTemplate,
  });

  const [name, setName] = useState(existingTemplate?.name ?? "");
  const [description, setDescription] = useState(existingTemplate?.description ?? "");
  const [splitType, setSplitType] = useState<WorkoutTemplate["splitType"]>(
    existingTemplate?.splitType ?? "push"
  );
  const [exercises, setExercises] = useState<EditableExercise[]>(
    existingTemplate?.exercises ?? exerciseOptions.slice(0, 1)
  );

  useEffect(() => {
    if (detailQuery.data) {
      setName(detailQuery.data.name);
      setDescription(detailQuery.data.description ?? "");
      setSplitType(detailQuery.data.splitType);
      setExercises(
        detailQuery.data.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          defaultSets: ex.defaultSets,
          defaultReps: ex.defaultReps,
          defaultRestSeconds: ex.defaultRestSeconds,
          notes: ex.notes,
        }))
      );
    }
  }, [detailQuery.data]);

  const isEditing = Boolean(route.params?.templateId);

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: (template) =>
      navigation.replace("WorkoutTemplateDetail", { templateId: template.id }),
    onError: () => Alert.alert("Could not save template", "Please try again."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      splitType: WorkoutTemplate["splitType"];
      exercises: EditableExercise[];
    }) => updateTemplate(route.params!.templateId!, payload),
    onSuccess: (template) =>
      navigation.replace("WorkoutTemplateDetail", { templateId: template.id }),
    onError: () => Alert.alert("Could not update template", "Please try again."),
  });

  const addExercise = () => {
    const option = exerciseOptions[exercises.length % exerciseOptions.length];
    setExercises((prev) => [...prev, option]);
  };

  const updateExercise = (idx: number, field: keyof EditableExercise, value: string) => {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === idx
          ? {
              ...ex,
              [field]:
                field === "defaultSets" || field === "defaultReps" || field === "defaultRestSeconds"
                  ? Number(value)
                  : value,
            }
          : ex
      )
    );
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert("Workout needs a name");
      return;
    }
    if (exercises.length < 1) {
      Alert.alert("Add at least one exercise");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      splitType,
      exercises,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
          {isEditing ? "Edit Template" : "New Workout"}
        </Text>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>Name</Text>
          <TextInput
            style={{
              backgroundColor: colors.surfaceMuted,
              color: colors.textPrimary,
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            placeholder="Push Day"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
            Description
          </Text>
          <TextInput
            style={{
              backgroundColor: colors.surfaceMuted,
              color: colors.textPrimary,
              borderRadius: 10,
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
            placeholder="Heavy push day focus"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
            Split Type
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {["push", "pull", "legs", "upper", "lower", "full_body", "custom"].map(
              (option) => (
                <Pressable
                  key={option}
                  onPress={() => setSplitType(option as WorkoutTemplate["splitType"])}
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor:
                      splitType === option ? colors.surface : colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color:
                        splitType === option ? colors.textPrimary : colors.textSecondary,
                      fontWeight: "600",
                    }}
                  >
                    {option.replace("_", " ").toUpperCase()}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 8 }}>
            Exercises
          </Text>
          {exercises.map((exercise, idx) => (
            <View
              key={`${exercise.exerciseId}-${idx}`}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 10,
                gap: 8,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
                {exercise.exerciseId}
              </Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Sets</Text>
                  <TextInput
                    keyboardType="numeric"
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      color: colors.textPrimary,
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    value={String(exercise.defaultSets)}
                    onChangeText={(t) => updateExercise(idx, "defaultSets", t)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Reps</Text>
                  <TextInput
                    keyboardType="numeric"
                    style={{
                      backgroundColor: colors.surfaceMuted,
                      color: colors.textPrimary,
                      borderRadius: 8,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                    value={String(exercise.defaultReps)}
                    onChangeText={(t) => updateExercise(idx, "defaultReps", t)}
                  />
                </View>
              </View>
            </View>
          ))}

          <Pressable
            onPress={addExercise}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.secondary,
              alignItems: "center",
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.secondary, fontWeight: "700" }}>
              Add Exercise
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={save}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            marginTop: 12,
            marginBottom: 24,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: "#0B1220", fontWeight: "800", fontSize: 16 }}>
            Save Workout
          </Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
};

export default WorkoutTemplateBuilderScreen;
