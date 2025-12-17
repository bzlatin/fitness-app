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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { generateWorkout, GeneratedWorkout } from "../api/ai";
import { RootNavigation } from "../navigation/RootNavigator";
import { createTemplate } from "../api/templates";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  canGenerateAiWorkout,
  getAiWorkoutGenerationsRemaining,
} from "../utils/featureGating";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";

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
  const queryClient = useQueryClient();
  const { user, refresh } = useCurrentUser();
  const subscriptionAccess = useSubscriptionAccess();
  const hasProAccess = subscriptionAccess.hasProAccess;
  const aiRemaining = getAiWorkoutGenerationsRemaining(user, { hasProAccess });
  const canUseAi = canGenerateAiWorkout(user, { hasProAccess });
  const aiFreeAvailable = !hasProAccess && aiRemaining > 0;
  const aiFreeUsed = !hasProAccess && aiRemaining === 0;

  const [selectedSplit, setSelectedSplit] = useState<string | null>(null);
  const [specificRequest, setSpecificRequest] = useState("");
  const [generatedWorkout, setGeneratedWorkout] = useState<GeneratedWorkout | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paywallFreeUsed, setPaywallFreeUsed] = useState(false);

  const generateMutation = useMutation({
    mutationFn: generateWorkout,
    onSuccess: (data) => {
      setGeneratedWorkout(data);
      if (!hasProAccess) {
        void refresh();
      }
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to generate workout";

      if (error?.response?.data?.requiresUpgrade || error?.requiresUpgrade) {
        setPaywallFreeUsed(error?.response?.data?.error === "Free smart workout used");
        setShowPaywallModal(true);
        return;
      }

      Alert.alert("Generation Failed", errorMessage);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (workout: GeneratedWorkout) => {
      const payload = {
        name: workout.name,
        description: workout.reasoning,
        splitType: workout.splitType as any,
        exercises: workout.exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          orderIndex: ex.orderIndex,
          defaultSets: ex.sets,
          defaultReps: ex.reps,
          defaultRestSeconds: ex.restSeconds,
          notes: ex.notes,
        })),
      };

      const template = await createTemplate(payload);
      return template;
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
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

    if (!canUseAi) {
      setPaywallFreeUsed(aiFreeUsed);
      setShowPaywallModal(true);
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
  const closePaywall = () => {
    setShowPaywallModal(false);
    setPaywallFreeUsed(false);
  };

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

        <PaywallComparisonModal
          visible={showPaywallModal}
          onClose={closePaywall}
          triggeredBy="ai"
          aiFreeUsed={paywallFreeUsed || aiFreeUsed}
          aiFreeRemaining={Number.isFinite(aiRemaining) ? aiRemaining : undefined}
        />
      </ScreenContainer>
    );
  }

  // Show generation form
  return (
    <ScreenContainer scroll>
      {!hasProAccess && (
        <View
          style={{
            backgroundColor: aiFreeAvailable ? `${colors.primary}12` : colors.surface,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: aiFreeAvailable ? `${colors.primary}35` : colors.border,
            marginBottom: 14,
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 14,
              fontWeight: "700",
              marginBottom: 4,
            }}
          >
            {aiFreeAvailable ? "1 free smart workout" : "Smart workouts are a Pro feature"}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
            {aiFreeAvailable
              ? "Try it once—then upgrade for unlimited generation."
              : "You've used your free smart workout. Upgrade for unlimited!"}
          </Text>
        </View>
      )}

      <View style={{ marginBottom: 20 }}>
        <Text
          style={{
            color: colors.textPrimary,
            fontSize: 24,
            fontWeight: "700",
            marginBottom: 8,
          }}
        >
          Smart Workout Generator
        </Text>
        <Text style={{ color: colors.textSecondary, lineHeight: 20 }}>
          Get a made-for-you workout based on your profile and recent training history.
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

      <PaywallComparisonModal
        visible={showPaywallModal}
        onClose={closePaywall}
        triggeredBy="ai"
        aiFreeUsed={paywallFreeUsed || aiFreeUsed}
        aiFreeRemaining={Number.isFinite(aiRemaining) ? aiRemaining : undefined}
      />
    </ScreenContainer>
  );
};

export default WorkoutGeneratorScreen;
