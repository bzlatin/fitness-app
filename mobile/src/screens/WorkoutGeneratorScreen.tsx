import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { generateWorkout, GeneratedWorkout } from "../api/ai";
import { RootNavigation } from "../navigation/RootNavigator";
import { createWorkoutTemplate } from "../api/templates";

// Generate unique ID for React Native (no crypto dependency)
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const SPLIT_OPTIONS = [
  { value: "push", label: "Push", emoji: "💪" },
  { value: "pull", label: "Pull", emoji: "🏋️" },
  { value: "legs", label: "Legs", emoji: "🦵" },
  { value: "upper", label: "Upper Body", emoji: "🏅" },
  { value: "lower", label: "Lower Body", emoji: "🔥" },
  { value: "full_body", label: "Full Body", emoji: "⚡" },
];

const WorkoutGeneratorScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const [selectedSplit, setSelectedSplit] = useState<string | null>(null);
  const [specificRequest, setSpecificRequest] = useState("");
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);

  const generateMutation = useMutation({
    mutationFn: generateWorkout,
    onSuccess: (data) => {
      setGeneratedWorkout(data);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to generate workout";

      Alert.alert("Generation Failed", errorMessage);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (workout: GeneratedWorkout) => {
      const template = {
        id: generateId(),
        name: workout.name,
        description: workout.reasoning,
        splitType: workout.splitType as any,
        isFavorite: false,
        exercises: workout.exercises.map((ex) => ({
          id: generateId(),
          exerciseId: ex.exerciseId,
          orderIndex: ex.orderIndex,
          defaultSets: ex.sets,
          defaultReps: ex.reps,
          defaultRestSeconds: ex.restSeconds,
          notes: ex.notes,
        })),
      };

      await createWorkoutTemplate(template);
      return template;
    },
    onSuccess: (template) => {
      Alert.alert("Success!", "Workout saved to your templates", [
        {
          text: "View Template",
          onPress: () => {
            navigation.navigate("WorkoutTemplateDetail", {
              templateId: template.id,
            });
          },
        },
        {
          text: "Done",
          onPress: () => navigation.goBack(),
        },
      ]);
    },
    onError: () => {
      Alert.alert("Error", "Failed to save workout template");
    },
  });

  const handleGenerate = () => {
    if (!selectedSplit) {
      Alert.alert("Select a Split", "Please choose a workout split type");
      return;
    }

    generateMutation.mutate({
      requestedSplit: selectedSplit,
      specificRequest: specificRequest.trim() || undefined,
    });
  };

  const handleRegenerate = () => {
    setGeneratedWorkout(null);
    handleGenerate();
  };

  const handleSave = () => {
    if (!generatedWorkout) return;
    saveMutation.mutate(generatedWorkout);
  };

  const isLoading = generateMutation.isPending;
  const isSaving = saveMutation.isPending;

  // Show generated workout preview
  if (generatedWorkout) {
    return (
      <ScreenContainer scroll>
        <View style={{ marginBottom: 20 }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 24,
              fontWeight: "700",
              marginBottom: 8,
            }}
          >
            {generatedWorkout.name}
          </Text>
          <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
            {generatedWorkout.reasoning}
          </Text>
          <View
            style={{
              flexDirection: "row",
              marginTop: 12,
              gap: 12,
            }}
          >
            <View
              style={{
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {generatedWorkout.exercises.length} exercises
              </Text>
            </View>
            <View
              style={{
                backgroundColor: colors.surface,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                ~{generatedWorkout.estimatedDurationMinutes} min
              </Text>
            </View>
          </View>
        </View>

        {/* Exercise List */}
        {generatedWorkout.exercises.map((exercise, index) => (
          <View
            key={index}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 14,
                  fontWeight: "600",
                  marginRight: 8,
                }}
              >
                #{index + 1}
              </Text>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                  flex: 1,
                }}
              >
                {exercise.exerciseName}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 16, marginBottom: 8 }}>
              <Text style={{ color: colors.textSecondary }}>
                {exercise.sets} sets × {exercise.reps} reps
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {exercise.restSeconds}s rest
              </Text>
            </View>

            {exercise.notes && (
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 13,
                  fontStyle: "italic",
                }}
              >
                💡 {exercise.notes}
              </Text>
            )}
          </View>
        ))}

        {/* Action Buttons */}
        <View style={{ marginTop: 12, gap: 12 }}>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed || isSaving ? 0.7 : 1,
            })}
          >
            {isSaving ? (
              <ActivityIndicator color="#0B1220" />
            ) : (
              <Text
                style={{ color: "#0B1220", fontWeight: "700", fontSize: 16 }}
              >
                Save as Template
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleRegenerate}
            disabled={isLoading}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              Regenerate
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setGeneratedWorkout(null);
              setSelectedSplit(null);
              setSpecificRequest("");
            }}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
              Start Over
            </Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  // Show generation form
  return (
    <ScreenContainer scroll>
      <View style={{ marginBottom: 20 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 24,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          AI Workout Generator
        </Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
          Let AI create a personalized workout based on your profile and recent
          training history.
        </Text>
      </View>

      {/* Split Selection */}
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "600",
          marginBottom: 12,
        }}
      >
        Select Workout Split
      </Text>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {SPLIT_OPTIONS.map((split) => (
          <Pressable
            key={split.value}
            onPress={() => setSelectedSplit(split.value)}
            style={({ pressed }) => ({
              backgroundColor:
                selectedSplit === split.value ? colors.primary : colors.surface,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor:
                selectedSplit === split.value ? colors.primary : colors.border,
              opacity: pressed ? 0.7 : 1,
              minWidth: 100,
              alignItems: "center",
            })}
          >
            <Text style={{ fontSize: 20, marginBottom: 4 }}>{split.emoji}</Text>
            <Text
              style={{
                color:
                  selectedSplit === split.value ? "#0B1220" : colors.textPrimary,
                fontWeight: "600",
              }}
            >
              {split.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Specific Request (Optional) */}
      <Text
        style={{
          color: colors.textPrimary,
          fontSize: 16,
          fontWeight: "600",
          marginBottom: 12,
        }}
      >
        Additional Notes (Optional)
      </Text>
      <TextInput
        value={specificRequest}
        onChangeText={setSpecificRequest}
        placeholder='e.g., "Focus on chest", "Include glute work", "Avoid squats"'
        placeholderTextColor={colors.textSecondary}
        multiline
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.textPrimary,
          minHeight: 100,
          textAlignVertical: "top",
          marginBottom: 24,
        }}
      />

      {/* Generate Button */}
      <Pressable
        onPress={handleGenerate}
        disabled={isLoading || !selectedSplit}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          opacity: pressed || isLoading || !selectedSplit ? 0.7 : 1,
        })}
      >
        {isLoading ? (
          <ActivityIndicator color="#0B1220" />
        ) : (
          <Text style={{ color: "#0B1220", fontWeight: "700", fontSize: 16 }}>
            Generate Workout
          </Text>
        )}
      </Pressable>

      {isLoading && (
        <View style={{ marginTop: 20, alignItems: "center" }}>
          <Text style={{ color: colors.textSecondary, marginBottom: 8 }}>
            Creating your personalized workout...
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            This may take 10-30 seconds
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
};

export default WorkoutGeneratorScreen;
