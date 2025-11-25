import { useState } from "react";
import { ScrollView, Text, View, Pressable, Alert, ActivityIndicator, Image } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import ScreenContainer from "../components/layout/ScreenContainer";
import ExerciseSwapModal from "../components/workouts/ExerciseSwapModal";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { createTemplate } from "../api/templates";
import { RootNavigation } from "../navigation/RootNavigator";
import { RootStackParamList } from "../navigation/types";
import Ionicons from "@expo/vector-icons/Ionicons";
import { API_BASE_URL } from "../api/client";

type WorkoutPreviewRouteProp = RouteProp<RootStackParamList, "WorkoutPreview">;

const WorkoutPreviewScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<WorkoutPreviewRouteProp>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { workout: initialWorkout } = route.params;
  const apiHost = API_BASE_URL.replace(/\/api$/, "");

  const [workout, setWorkout] = useState(initialWorkout);
  const [swapExerciseIndex, setSwapExerciseIndex] = useState<number | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (workoutData: any) => {
      const payload = {
        name: workoutData.name,
        description: workoutData.reasoning,
        splitType: workoutData.splitType as any,
        exercises: workoutData.exercises.map((ex: any) => ({
          exerciseId: ex.exerciseId,
          orderIndex: ex.orderIndex,
          defaultSets: ex.sets,
          defaultReps: ex.reps,
          defaultRestSeconds: ex.restSeconds,
          notes: ex.notes,
        })),
      };
      const savedTemplate = await createTemplate(payload);
      return savedTemplate;
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      Alert.alert("Success", `"${template.name}" has been saved!`, [
        {
          text: "OK",
          onPress: () => {
            // Navigate back to home
            navigation.goBack();
          },
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert(
        "Save Failed",
        error?.response?.data?.message || "Failed to save workout. Please try again."
      );
    },
  });

  const handleSwapExercise = (newExercise: {
    exerciseId: string;
    exerciseName: string;
    sets?: number;
    reps?: number;
    restSeconds?: number;
  }) => {
    if (swapExerciseIndex === null) return;

    const updatedExercises = [...workout.exercises];
    updatedExercises[swapExerciseIndex] = {
      ...updatedExercises[swapExerciseIndex],
      exerciseId: newExercise.exerciseId,
      exerciseName: newExercise.exerciseName,
    };

    setWorkout({
      ...workout,
      exercises: updatedExercises,
    });

    setSwapExerciseIndex(null);
  };

  const handleRemoveExercise = (index: number) => {
    const nextExercises = workout.exercises
      .filter((_, idx) => idx !== index)
      .map((exercise, orderIndex) => ({
        ...exercise,
        orderIndex,
      }));

    setWorkout((prev) => ({
      ...prev,
      exercises: nextExercises,
    }));
  };

  const currentSwapExercise = swapExerciseIndex !== null ? workout.exercises[swapExerciseIndex] : null;

  return (
    <ScreenContainer>
      <View style={{ flex: 1, gap: 16 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 8,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            <Text style={{ color: colors.textPrimary, fontSize: 16 }}>Back</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Alert.alert(
                "Discard Workout",
                "Are you sure you want to discard this AI-generated workout?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => navigation.goBack(),
                  },
                ]
              );
            }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: "#ef4444", fontSize: 16 }}>Discard</Text>
          </Pressable>
        </View>

        {/* Workout Details */}
        <View style={{ flex: 1, position: "relative" }}>
          <LinearGradient
            colors={[colors.background, "transparent"]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 40,
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 20 }}
          >
            <View style={{ gap: 16, paddingBottom: 120 }}>
              {/* Header Card */}
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: colors.primary,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      backgroundColor: `${colors.primary}20`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 32 }}>🎯</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
                      {workout.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 4 }}>
                      {workout.exercises.length} exercises · ~{workout.estimatedDurationMinutes} min
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 14,
                      fontStyle: "italic",
                      lineHeight: 20,
                    }}
                  >
                    {workout.reasoning}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {workout.splitType && <Chip label={workout.splitType} />}
                  <Chip label={`${workout.estimatedDurationMinutes} min`} />
                  <Chip label="AI Generated" />
                </View>
              </View>

              {/* Exercises List */}
              <View style={{ gap: 12 }}>
                <Text
                  style={{
                    ...typography.heading2,
                    color: colors.textPrimary,
                    marginLeft: 4,
                  }}
                >
                  Exercises
                </Text>
                {workout.exercises.map((ex: any, idx: number) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: colors.surface,
                      padding: 16,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 8,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      {(() => {
                        const imageUri =
                          ex.gifUrl && typeof ex.gifUrl === "string"
                            ? ex.gifUrl.startsWith("http")
                              ? ex.gifUrl
                              : `${apiHost}${ex.gifUrl}`
                            : undefined;
                        if (imageUri) {
                          return (
                            <Image
                              source={{ uri: imageUri }}
                              style={{
                                width: 68,
                                height: 68,
                                borderRadius: 12,
                                backgroundColor: colors.surfaceMuted,
                              }}
                            />
                          );
                        }
                        return (
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
                            <Ionicons
                              name="fitness-outline"
                              size={26}
                              color={colors.textSecondary}
                            />
                          </View>
                        );
                      })()}
                      <View style={{ flex: 1, gap: 6 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: colors.textPrimary,
                                fontFamily: fontFamilies.semibold,
                                fontSize: 16,
                              }}
                            >
                              {idx + 1}. {ex.exerciseName}
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <Pressable
                              onPress={() => setSwapExerciseIndex(idx)}
                              style={({ pressed }) => ({
                                padding: 8,
                                borderRadius: 8,
                                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                              })}
                            >
                              <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary} />
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                Alert.alert(
                                  "Remove exercise?",
                                  "This will drop the exercise from this workout preview.",
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                      text: "Remove",
                                      style: "destructive",
                                      onPress: () => handleRemoveExercise(idx),
                                    },
                                  ]
                                )
                              }
                              style={({ pressed }) => ({
                                padding: 8,
                                borderRadius: 8,
                                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                              })}
                            >
                              <Ionicons name="trash-outline" size={20} color="#ef4444" />
                            </Pressable>
                          </View>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: 16,
                            flexWrap: "wrap",
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Ionicons name="barbell-outline" size={16} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                              {ex.sets} sets
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Ionicons name="repeat-outline" size={16} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                              {ex.reps} reps
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                              {ex.restSeconds}s rest
                            </Text>
                          </View>
                        </View>
                        {ex.notes && (
                          <View
                            style={{
                              backgroundColor: colors.surfaceMuted,
                              padding: 10,
                              borderRadius: 8,
                              marginTop: 4,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.textSecondary,
                                fontSize: 13,
                                fontStyle: "italic",
                              }}
                            >
                              💡 {ex.notes}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          <LinearGradient
            colors={["transparent", colors.background]}
            style={{
              position: "absolute",
              bottom: Math.max(insets.bottom, 16) + 74,
              left: 0,
              right: 0,
              height: 60,
              pointerEvents: "none",
            }}
          />
        </View>

        {/* Action Buttons - Fixed at bottom */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 16) + 8,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => saveMutation.mutate(workout)}
            disabled={saveMutation.isPending}
            style={({ pressed }) => ({
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: colors.primary,
              alignItems: "center",
              opacity: pressed || saveMutation.isPending ? 0.7 : 1,
            })}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text
                style={{
                  color: colors.surface,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 16,
                }}
              >
                Save & Use This Workout
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      {currentSwapExercise && (
        <ExerciseSwapModal
          visible={swapExerciseIndex !== null}
          onClose={() => setSwapExerciseIndex(null)}
          exercise={{
            exerciseId: currentSwapExercise.exerciseId,
            exerciseName: currentSwapExercise.exerciseName,
            primaryMuscleGroup: currentSwapExercise.primaryMuscleGroup || "chest",
            sets: currentSwapExercise.sets,
            reps: currentSwapExercise.reps,
            restSeconds: currentSwapExercise.restSeconds,
          }}
          onSwap={handleSwapExercise}
        />
      )}
    </ScreenContainer>
  );
};

const Chip = ({ label }: { label: string }) => (
  <View
    style={{
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: `${colors.primary}15`,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    }}
  >
    <Text
      style={{
        color: colors.textPrimary,
        fontFamily: fontFamilies.medium,
        fontSize: 12,
      }}
    >
      {label}
    </Text>
  </View>
);

export default WorkoutPreviewScreen;
