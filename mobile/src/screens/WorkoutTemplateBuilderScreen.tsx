import Ionicons from "@expo/vector-icons/Ionicons";
import DraggableFlatList, {
  RenderItemParams,
} from "react-native-draggable-flatlist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { UNSTABLE_usePreventRemove as usePreventRemove } from "@react-navigation/core";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardTypeOptions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import ExercisePicker from "../components/workouts/ExercisePicker";
import ExerciseSwapModal from "../components/workouts/ExerciseSwapModal";
import ScreenContainer from "../components/layout/ScreenContainer";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import {
  createTemplate,
  fetchTemplate,
  updateTemplate,
  deleteTemplate,
} from "../api/templates";
import { templatesKey, useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { RootRoute, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import {
  Exercise,
  TemplateExerciseForm,
  WorkoutTemplate,
  WorkoutTemplateExercise,
} from "../types/workouts";
import { isCardioExercise } from "../utils/exercises";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { canCreateAnotherTemplate } from "../utils/featureGating";
import type { ApiClientError } from "../api/client";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const splitOptions: { value: WorkoutTemplate["splitType"]; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "upper", label: "Upper Body" },
  { value: "lower", label: "Lower Body" },
  { value: "full_body", label: "Full Body" },
  { value: "custom", label: "Custom" },
];

const formatExerciseName = (id: string) =>
  id
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

const createFallbackExercise = (
  exerciseId: string,
  options?: { name?: string; primaryMuscleGroup?: Exercise["primaryMuscleGroup"] }
): Exercise => ({
  id: exerciseId,
  name: options?.name ?? formatExerciseName(exerciseId),
  primaryMuscleGroup: options?.primaryMuscleGroup ?? "custom",
  equipment: "custom",
});

const generateFormId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type CreateTemplatePayload = Parameters<typeof createTemplate>[0];
const mapPersistedExercise = (
  exercise: WorkoutTemplateExercise
): TemplateExerciseForm => ({
  formId: exercise.id,
  exercise: createFallbackExercise(exercise.exerciseId, {
    name: exercise.exerciseName,
    primaryMuscleGroup: exercise.primaryMuscleGroup as Exercise["primaryMuscleGroup"],
  }),
  sets: exercise.defaultSets,
  reps: exercise.defaultReps,
  restSeconds: exercise.defaultRestSeconds,
  weight:
    exercise.defaultWeight !== undefined
      ? String(exercise.defaultWeight)
      : undefined,
  incline:
    exercise.defaultIncline !== undefined
      ? String(exercise.defaultIncline)
      : undefined,
  distance:
    exercise.defaultDistance !== undefined
      ? String(exercise.defaultDistance)
      : undefined,
  durationMinutes:
    exercise.defaultDurationMinutes !== undefined
      ? String(exercise.defaultDurationMinutes)
      : undefined,
  notes: exercise.notes,
});

const WorkoutTemplateBuilderScreen = () => {
  const route = useRoute<RootRoute<"WorkoutTemplateBuilder">>();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const { data: listData } = useWorkoutTemplates();
  const { user } = useCurrentUser();
  const subscriptionAccess = useSubscriptionAccess();
  const hasProAccess = subscriptionAccess.hasProAccess;
  const isProPlan = subscriptionAccess.hasProPlan;
  const [isNearTop, setIsNearTop] = useState(true);
  const [isNearBottom, setIsNearBottom] = useState(false);

  const existingTemplate = useMemo(
    () => listData?.find((t) => t.id === route.params?.templateId),
    [listData, route.params?.templateId]
  );
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  const detailQuery = useQuery({
    queryKey: [...templatesKey, route.params?.templateId],
    queryFn: () => fetchTemplate(route.params!.templateId!),
    enabled: Boolean(route.params?.templateId && !existingTemplate),
    initialData: existingTemplate,
  });

  const [name, setName] = useState(existingTemplate?.name ?? "");
  const [description, setDescription] = useState(
    existingTemplate?.description ?? ""
  );
  const [splitType, setSplitType] = useState<WorkoutTemplate["splitType"]>(
    existingTemplate?.splitType ?? "push"
  );
  const [exercises, setExercises] = useState<TemplateExerciseForm[]>(
    existingTemplate?.exercises
      ? existingTemplate.exercises.map(mapPersistedExercise)
      : []
  );
  const [pickerVisible, setPickerVisible] = useState(false);
  const [swapExerciseFormId, setSwapExerciseFormId] = useState<string | null>(
    null
  );
  const [errors, setErrors] = useState<{ name?: string; exercises?: string }>(
    {}
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    if (detailQuery.data) {
      setName(detailQuery.data.name);
      setDescription(detailQuery.data.description ?? "");
      setSplitType(detailQuery.data.splitType ?? "push");
      setExercises(detailQuery.data.exercises.map(mapPersistedExercise));
      setHasUnsavedChanges(false);
    }
  }, [detailQuery.data]);

  const isEditing = Boolean(route.params?.templateId);

  // Mark as having unsaved changes when form data changes
  useEffect(() => {
    if (!detailQuery.data && !existingTemplate) {
      // New template - mark as changed if any field has content
      if (name.trim() || description.trim() || exercises.length > 0) {
        setHasUnsavedChanges(true);
      }
    } else {
      // Editing - compare with original
      const original = detailQuery.data || existingTemplate;
      if (original) {
        const hasChanges =
          name !== original.name ||
          description !== (original.description ?? "") ||
          splitType !== original.splitType ||
          exercises.length !== original.exercises.length ||
          JSON.stringify(exercises) !==
            JSON.stringify(original.exercises.map(mapPersistedExercise));
        setHasUnsavedChanges(hasChanges);
      }
    }
  }, [
    name,
    description,
    splitType,
    exercises,
    detailQuery.data,
    existingTemplate,
  ]);

  const createMutation = useMutation<WorkoutTemplate, ApiClientError, CreateTemplatePayload>({
    mutationFn: (payload) => createTemplate(payload),
    onSuccess: (template) => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: templatesKey });
      navigation.replace("WorkoutTemplateDetail", { templateId: template.id });
    },
    onError: (err) => {
      if (err.requiresUpgrade) {
        setShowPaywallModal(true);
        return;
      }
      Alert.alert(
        "Could not save template",
        err.message || "Please try again."
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      splitType: WorkoutTemplate["splitType"];
      exercises: {
        exerciseId: string;
        defaultSets: number;
        defaultReps: number;
        defaultRestSeconds?: number;
        defaultWeight?: number;
        defaultIncline?: number;
        defaultDistance?: number;
        defaultDurationMinutes?: number;
        notes?: string;
      }[];
    }) =>
      updateTemplate(
        route.params!.templateId!,
        payload as unknown as Partial<WorkoutTemplate>
      ),
    onSuccess: (template) => {
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: templatesKey });
      navigation.replace("WorkoutTemplateDetail", { templateId: template.id });
    },
    onError: () =>
      Alert.alert("Could not update template", "Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTemplate(route.params!.templateId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKey });
      navigation.goBack();
    },
    onError: () =>
      Alert.alert("Could not delete workout", "Please try again."),
  });

  const saving = createMutation.isPending || updateMutation.isPending;
  const preventRemove = hasUnsavedChanges && !saving;

  const save = useCallback(() => {
    const validationErrors: { name?: string; exercises?: string } = {};
    if (!name.trim()) {
      validationErrors.name = "Name is required.";
    }
    if (exercises.length < 1) {
      validationErrors.exercises = "Add at least one exercise.";
    }
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    if (!isEditing) {
      const templateCount = listData?.length ?? 0;
      const canCreate = canCreateAnotherTemplate(user, templateCount, {
        hasProAccess,
      });
      if (!canCreate) {
        if (isProPlan && !hasProAccess) {
          Alert.alert(
            "Subscription inactive",
            "Update billing or renew to keep unlimited templates."
          );
        } else {
          Alert.alert(
            "Free limit reached",
            "Upgrade to Pro for unlimited templates.",
            [
              { text: "Maybe later", style: "cancel" },
              {
                text: "Upgrade to Pro",
                onPress: () => navigation.navigate("Upgrade"),
              },
            ]
          );
        }
        return;
      }
    }

    const parseDecimal = (input?: string) => {
      if (input === undefined) return undefined;
      const normalized = input.replace(",", ".");
      const parsed = Number(normalized);
      return Number.isNaN(parsed) ? undefined : parsed;
    };

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      splitType,
      exercises: exercises.map((ex) => ({
        exerciseId: ex.exercise.id,
        defaultSets: ex.sets,
        defaultReps: ex.reps,
        defaultRestSeconds: ex.restSeconds,
        defaultWeight: parseDecimal(ex.weight),
        defaultIncline: parseDecimal(ex.incline),
        defaultDistance: parseDecimal(ex.distance),
        defaultDurationMinutes: parseDecimal(ex.durationMinutes),
        notes: ex.notes,
      })),
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }, [
    name,
    description,
    exercises,
    splitType,
    isEditing,
    listData?.length,
    user,
    updateMutation,
    createMutation,
  ]);

  // Set navigation options to prevent native back gesture when there are unsaved changes
  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !preventRemove,
      headerBackButtonMenuEnabled: false,
    });
  }, [navigation, preventRemove]);

  // Use dedicated hook to guard against native-stack removing the screen before JS state updates
  usePreventRemove(preventRemove, (event) => {
    const actionType = event.data.action.type;
    if (actionType !== "GO_BACK" && actionType !== "POP") {
      return;
    }

    Alert.alert(
      "Discard changes?",
      "You have unsaved changes. Do you want to save before leaving?",
      [
        {
          text: "Don't save",
          style: "destructive",
          onPress: () => {
            setHasUnsavedChanges(false);
            setTimeout(() => navigation.dispatch(event.data.action), 0);
          },
        },
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: () => {
            save();
          },
        },
      ]
    );
  });

  const handleAddExercise = (
    exerciseForm: Omit<TemplateExerciseForm, "formId">
  ) => {
    setExercises((prev) => [
      ...prev,
      { ...exerciseForm, formId: generateFormId() },
    ]);
    setPickerVisible(false);
    setErrors((prev) => ({ ...prev, exercises: undefined }));
  };

  const removeExerciseByFormId = (formId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.formId !== formId));
  };

  const removeExerciseByExerciseId = (exerciseId: string) => {
    setExercises((prev) => {
      const index = prev.findIndex((ex) => ex.exercise.id === exerciseId);
      if (index === -1) return prev;
      const clone = [...prev];
      clone.splice(index, 1);
      return clone;
    });
  };

  const updateExerciseField = (
    formId: string,
    field:
      | "sets"
      | "reps"
      | "restSeconds"
      | "weight"
      | "incline"
      | "distance"
      | "durationMinutes",
    value: string
  ) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.formId !== formId) return ex;
        if (field === "sets" || field === "reps") {
          const parsed = Number(value);
          const nextValue =
            value === "" ? 1 : Math.max(1, Math.round(parsed || 1));
          return { ...ex, [field]: nextValue };
        }
        if (field === "restSeconds") {
          if (value === "") {
            return { ...ex, restSeconds: undefined };
          }
          const parsed = Number(value);
          if (Number.isNaN(parsed)) {
            return ex;
          }
          return { ...ex, restSeconds: Math.max(0, Math.round(parsed)) };
        }
        return {
          ...ex,
          [field]: value === "" ? undefined : value,
        };
      })
    );
  };

  const handleSwapExercise = (newExercise: {
    exerciseId: string;
    exerciseName: string;
    sets?: number;
    reps?: number;
    restSeconds?: number;
  }) => {
    if (!swapExerciseFormId) return;

    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.formId !== swapExerciseFormId) return ex;
        return {
          ...ex,
          exercise: createFallbackExercise(newExercise.exerciseId, {
            name: newExercise.exerciseName,
          }),
        };
      })
    );

    setSwapExerciseFormId(null);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Workout",
      "Are you sure you want to delete this workout? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate(),
        },
      ]
    );
  };

  const headerComponent = (
    <View style={{ gap: 16, paddingBottom: 16, marginTop: 72 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          {isEditing ? "Edit workout" : "Build a workout"}
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Name it, define the split, then arrange exercises with long-press
          drag.
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
        }}
      >
        <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
          Template info
        </Text>
        <View style={{ gap: 6 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            Workout name
          </Text>
          <TextInput
            placeholder='Push power'
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 12,
              padding: 12,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: errors.name ? "#ef4444" : colors.border,
              fontFamily: fontFamilies.medium,
            }}
          />
          {errors.name ? (
            <Text style={{ color: "#ef4444", ...typography.caption }}>
              {errors.name}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            Description (optional)
          </Text>
          <TextInput
            placeholder='Heavy pressing, then accessory shoulders.'
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 12,
              padding: 12,
              color: colors.textPrimary,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 64,
              fontFamily: fontFamilies.regular,
            }}
          />
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            Split type
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {splitOptions.map((option) => {
              const active = splitType === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSplitType(option.value)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? "rgba(34,197,94,0.12)"
                      : colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: fontFamilies.semibold,
                      color: active ? colors.primary : colors.textPrimary,
                    }}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
            Exercises
          </Text>
          <Pressable
            onPress={() => setPickerVisible(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.secondary,
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Ionicons name='add' size={18} color={colors.secondary} />
            <Text
              style={{
                fontFamily: fontFamilies.semibold,
                color: colors.secondary,
              }}
            >
              Add exercise
            </Text>
          </Pressable>
        </View>

        {errors.exercises ? (
          <Text style={{ color: "#ef4444", ...typography.caption }}>
            {errors.exercises}
          </Text>
        ) : null}

        {exercises.length === 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderStyle: "dashed",
              borderRadius: 12,
              padding: 14,
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              No exercises yet
            </Text>
            <Text
              style={{
                ...typography.caption,
                color: colors.textSecondary,
                marginTop: 4,
              }}
            >
              Tap “Add exercise” to pull from the Push / Pull library with
              visuals.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  const footerComponent = (
    <View style={{ gap: 12, paddingTop: 16, paddingBottom: 32 }}>
      <Pressable
        onPress={save}
        disabled={saving}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          paddingVertical: 16,
          borderRadius: 14,
          alignItems: "center",
          opacity: pressed || saving ? 0.85 : 1,
          shadowColor: colors.primary,
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        })}
      >
        <Text
          style={{
            color: colors.surface,
            fontFamily: fontFamilies.semibold,
            fontSize: 16,
          }}
        >
          {saving ? "Saving..." : "Save workout"}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setPickerVisible(true)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.secondary,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.9 : 1,
          gap: 8,
        })}
      >
        <Ionicons
          name='add-circle-outline'
          size={20}
          color={colors.secondary}
        />
        <Text
          style={{ color: colors.secondary, fontFamily: fontFamilies.semibold }}
        >
          Add another exercise
        </Text>
      </Pressable>
      {isEditing && (
        <Pressable
          onPress={handleDelete}
          disabled={deleteMutation.isPending}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingVertical: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#ef4444",
            backgroundColor: colors.surface,
            opacity: pressed || deleteMutation.isPending ? 0.7 : 1,
            gap: 8,
          })}
        >
          <Ionicons
            name='trash-outline'
            size={20}
            color="#ef4444"
          />
          <Text
            style={{ color: "#ef4444", fontFamily: fontFamilies.semibold }}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete workout"}
          </Text>
        </Pressable>
      )}
    </View>
  );

  const renderExerciseItem = ({
    item,
    drag,
    isActive,
  }: RenderItemParams<TemplateExerciseForm>) => {
    const cardio = isCardioExercise(item.exercise);
    return (
      <View
        style={{
          backgroundColor: colors.surfaceMuted,
          borderRadius: 14,
          padding: 12,
          borderWidth: 1,
          borderColor: isActive ? colors.secondary : colors.border,
          gap: 10,
          marginBottom: 12,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Pressable
            onLongPress={drag}
            style={({ pressed }) => ({
              padding: 6,
              borderRadius: 999,
              backgroundColor: pressed ? colors.surface : "transparent",
            })}
          >
            <Ionicons
              name='reorder-three'
              size={24}
              color={colors.textSecondary}
            />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.title, color: colors.textPrimary }}>
              {item.exercise.name}
            </Text>
            <Text
              style={{ ...typography.caption, color: colors.textSecondary }}
            >
              {item.exercise.primaryMuscleGroup} • {item.exercise.equipment}
            </Text>
          </View>
          <Pressable
            onPress={() => setSwapExerciseFormId(item.formId)}
            hitSlop={8}
            style={({ pressed }) => ({
              opacity: pressed ? 0.7 : 1,
              marginRight: 8,
            })}
          >
            <Ionicons
              name='swap-horizontal-outline'
              color={colors.primary}
              size={20}
            />
          </Pressable>
          <Pressable
            onPress={() => removeExerciseByFormId(item.formId)}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons
              name='trash-outline'
              color={colors.textSecondary}
              size={20}
            />
          </Pressable>
        </View>

        {cardio ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <InlineNumberInput
              label='Incline'
              value={item.incline ?? ""}
              onChangeText={(val) =>
                updateExerciseField(item.formId, "incline", val)
              }
              keyboardType='decimal-pad'
            />
            <InlineNumberInput
              label='Duration (min)'
              value={item.durationMinutes ?? ""}
              onChangeText={(val) =>
                updateExerciseField(item.formId, "durationMinutes", val)
              }
              keyboardType='decimal-pad'
            />
            <InlineNumberInput
              label='Distance (mi)'
              value={item.distance ?? ""}
              onChangeText={(val) =>
                updateExerciseField(item.formId, "distance", val)
              }
              keyboardType='decimal-pad'
            />
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <InlineNumberInput
                label='Sets'
                value={String(item.sets)}
                onChangeText={(val) =>
                  updateExerciseField(item.formId, "sets", val)
                }
              />
              <InlineNumberInput
                label='Reps'
                value={String(item.reps)}
                onChangeText={(val) =>
                  updateExerciseField(item.formId, "reps", val)
                }
              />
              <InlineNumberInput
                label='Rest (s)'
                value={item.restSeconds ? String(item.restSeconds) : ""}
                onChangeText={(val) =>
                  updateExerciseField(item.formId, "restSeconds", val)
                }
              />
            </View>
            <InlineNumberInput
              label='Weight (lb)'
              value={item.weight ?? ""}
              onChangeText={(val) =>
                updateExerciseField(item.formId, "weight", val)
              }
              keyboardType='decimal-pad'
            />
          </>
        )}
      </View>
    );
  };

  const currentSwapExercise = exercises.find(
    (ex) => ex.formId === swapExerciseFormId
  );

  return (
    <ScreenContainer
      showGradient={!isNearBottom}
      showTopGradient={!isNearTop}
      paddingTop={16}
      includeTopInset={false}
    >
      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 32 : 0}
        >
          <DraggableFlatList
            data={exercises}
            keyExtractor={(item) => item.formId}
            renderItem={renderExerciseItem}
            onDragEnd={({ data }) => setExercises(data)}
            ListHeaderComponent={headerComponent}
            ListFooterComponent={footerComponent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40, paddingTop: 40 }}
            keyboardShouldPersistTaps='handled'
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } =
                e.nativeEvent;
              const distanceFromTop = contentOffset.y;
              const distanceFromBottom =
                contentSize.height - layoutMeasurement.height - contentOffset.y;
              setIsNearTop(distanceFromTop < 10);
              setIsNearBottom(distanceFromBottom < 50);
            }}
            scrollEventThrottle={16}
          />
        </KeyboardAvoidingView>

        <ExercisePicker
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          selected={exercises}
          onAdd={handleAddExercise}
          onRemove={removeExerciseByExerciseId}
        />

        {currentSwapExercise && (
          <ExerciseSwapModal
            visible={swapExerciseFormId !== null}
            onClose={() => setSwapExerciseFormId(null)}
            exercise={{
              exerciseId: currentSwapExercise.exercise.id,
              exerciseName: currentSwapExercise.exercise.name,
              primaryMuscleGroup:
                currentSwapExercise.exercise.primaryMuscleGroup,
              sets: currentSwapExercise.sets,
              reps: currentSwapExercise.reps,
              restSeconds: currentSwapExercise.restSeconds,
            }}
            onSwap={handleSwapExercise}
          />
        )}
      </View>
      <PaywallComparisonModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        triggeredBy="templates"
      />
    </ScreenContainer>
  );
};

type InlineNumberInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: KeyboardTypeOptions;
};

const InlineNumberInput = ({
  label,
  value,
  onChangeText,
  keyboardType = "numeric",
}: InlineNumberInputProps) => (
  <View style={{ flex: 1, gap: 6 }}>
    <Text style={{ ...typography.caption, color: colors.textSecondary }}>
      {label}
    </Text>
    <TextInput
      keyboardType={keyboardType}
      value={value}
      onChangeText={onChangeText}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 10,
        color: colors.textPrimary,
        fontFamily: fontFamilies.medium,
      }}
    />
  </View>
);

export default WorkoutTemplateBuilderScreen;
