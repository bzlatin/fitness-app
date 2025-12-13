import { useState, useEffect } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  TextInput,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { swapExercise } from "../../api/ai";
import { searchExercises } from "../../api/exercises";
import { API_BASE_URL } from "../../api/client";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import UpgradePrompt from "../premium/UpgradePrompt";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { Exercise } from "../../types/workouts";

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

const getValidMuscleGroup = (primaryMuscleGroup?: string): string => {
  if (!primaryMuscleGroup) return "all";
  const normalized = primaryMuscleGroup.toLowerCase();
  return muscleGroups.includes(normalized) ? normalized : "all";
};

interface ExerciseSwapModalProps {
  visible: boolean;
  onClose: () => void;
  exercise: {
    exerciseId: string;
    exerciseName: string;
    primaryMuscleGroup?: string;
    sets?: number;
    reps?: number;
    restSeconds?: number;
  };
  onSwap: (newExercise: {
    exerciseId: string;
    exerciseName: string;
    sets?: number;
    reps?: number;
    restSeconds?: number;
  }) => void;
}

const ExerciseSwapModal = ({
  visible,
  onClose,
  exercise,
  onSwap,
}: ExerciseSwapModalProps) => {
  const subscriptionAccess = useSubscriptionAccess();
  const [swapMode, setSwapMode] = useState<"choose" | "ai" | "manual">("choose");
  const [isSwapping, setIsSwapping] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [query, setQuery] = useState("");
  const [muscleGroup, setMuscleGroup] = useState(
    getValidMuscleGroup(exercise.primaryMuscleGroup)
  );

  const debouncedQuery = useDebouncedValue(query, 350);

  const isPro = subscriptionAccess.hasProAccess;

  // Reset state when modal opens or when switching to manual mode
  useEffect(() => {
    if (visible) {
      setMuscleGroup(getValidMuscleGroup(exercise.primaryMuscleGroup));
      setQuery("");
    }
  }, [visible, exercise.primaryMuscleGroup]);

  // Reset muscle group when switching to manual swap mode
  useEffect(() => {
    if (swapMode === "manual") {
      const validGroup = getValidMuscleGroup(exercise.primaryMuscleGroup);
      console.log("Setting muscle group:", validGroup, "from", exercise.primaryMuscleGroup);
      setMuscleGroup(validGroup);
      setQuery("");
    }
  }, [swapMode, exercise.primaryMuscleGroup]);

  // Query for manual exercise selection
  const manualExercisesQuery = useQuery({
    queryKey: ["exercises", debouncedQuery, muscleGroup],
    queryFn: () =>
      searchExercises({
        query: debouncedQuery || undefined,
        muscleGroup: muscleGroup === "all" ? undefined : muscleGroup,
      }),
    enabled: swapMode === "manual",
    staleTime: 1000 * 60 * 5,
  });

  const handleAISwap = async () => {
    if (!isPro) {
      setShowUpgradePrompt(true);
      return;
    }

    setIsSwapping(true);
    try {
      const result = await swapExercise({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        primaryMuscleGroup: exercise.primaryMuscleGroup || "chest",
        reason: "User requested alternative exercise",
      });

      if (!result.exerciseId) {
        Alert.alert(
          "No Alternative Found",
          "AI couldn't find a suitable alternative for this exercise."
        );
        setIsSwapping(false);
        return;
      }

      onSwap({
        exerciseId: result.exerciseId,
        exerciseName: result.exerciseName || "Unknown Exercise",
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
      });

      Alert.alert(
        "Exercise Swapped!",
        `Swapped to ${result.exerciseName}${
          result.reasoning ? `\n\n${result.reasoning}` : ""
        }`
      );

      resetAndClose();
    } catch (error: any) {
      Alert.alert(
        "Swap Failed",
        error?.response?.data?.message ||
          "Failed to swap exercise. Please try again."
      );
      setIsSwapping(false);
    }
  };

  const resetAndClose = () => {
    setSwapMode("choose");
    setIsSwapping(false);
    onClose();
  };

  const apiHost = API_BASE_URL.replace(/\/api$/, "");

  const getImageUrl = (exerciseId: string) => {
    return `${API_BASE_URL}/exercises/${exerciseId}/image/0`;
  };

  const handleManualSwapSelect = (selectedExercise: Exercise) => {
    onSwap({
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      restSeconds: exercise.restSeconds,
    });

    Alert.alert("Exercise Swapped!", `Swapped to ${selectedExercise.name}`);
    resetAndClose();
  };

  const renderManualExercise = ({ item }: { item: Exercise }) => {
    const imageUri =
      item.gifUrl && item.gifUrl.startsWith("http")
        ? item.gifUrl
        : item.gifUrl
        ? `${apiHost}${item.gifUrl}`
        : undefined;

    return (
      <Pressable
        onPress={() => handleManualSwapSelect(item)}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: 14,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 10,
          opacity: pressed ? 0.7 : 1,
        })}
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
          <Ionicons
            name="chevron-forward"
            size={20}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>
    );
  };

  return (
    <>
      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="AI Exercise Swap"
      />

      <Modal visible={visible && swapMode !== "manual"} animationType="slide" transparent>
        <Pressable
          onPress={resetAndClose}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "85%",
              borderWidth: 1,
              borderColor: colors.border,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
                  Swap Exercise
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, marginTop: 2 }}>
                  {exercise.exerciseName}
                </Text>
              </View>
              <Pressable
                onPress={resetAndClose}
                style={({ pressed }) => ({
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                })}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            {/* Content */}
            {swapMode === "choose" && (
              <View style={{ padding: 16, gap: 12 }}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 14,
                    marginBottom: 4,
                  }}
                >
                  Choose how you'd like to swap this exercise:
                </Text>

                {/* AI Swap Option */}
                <Pressable
                  onPress={() => setSwapMode("ai")}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    padding: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    backgroundColor: pressed
                      ? `${colors.primary}10`
                      : colors.surfaceMuted,
                  })}
                >
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 12,
                      backgroundColor: `${colors.primary}20`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>🎯</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 16,
                        }}
                      >
                        AI Swap
                      </Text>
                      {!isPro && (
                        <View
                          style={{
                            backgroundColor: colors.primary,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                          }}
                        >
                          <Text
                            style={{ color: "#0B1220", fontSize: 9, fontWeight: "700" }}
                          >
                            PRO
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      Let AI find the best alternative based on your goals
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>

                {/* Manual Swap Option */}
                <Pressable
                  onPress={() => setSwapMode("manual")}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    padding: 16,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                  })}
                >
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 12,
                      backgroundColor: `${colors.secondary}20`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>📋</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 16,
                      }}
                    >
                      Manual Swap
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                      Browse and choose from available exercises
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}

            {/* AI Swap Confirmation */}
            {swapMode === "ai" && (
              <View style={{ padding: 16, gap: 16 }}>
                <Pressable
                  onPress={() => setSwapMode("choose")}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    opacity: pressed ? 0.6 : 1,
                    alignSelf: "flex-start",
                  })}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Back</Text>
                </Pressable>

                <View
                  style={{
                    backgroundColor: colors.surfaceMuted,
                    padding: 16,
                    borderRadius: 14,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Text style={{ fontSize: 32 }}>🎯</Text>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                          fontSize: 16,
                        }}
                      >
                        AI Exercise Swap
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
                        AI will analyze your profile and find the best alternative
                      </Text>
                    </View>
                  </View>
                </View>

                <Pressable
                  onPress={handleAISwap}
                  disabled={isSwapping}
                  style={({ pressed }) => ({
                    paddingVertical: 16,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    alignItems: "center",
                    opacity: pressed || isSwapping ? 0.7 : 1,
                  })}
                >
                  {isSwapping ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text
                      style={{
                        color: colors.surface,
                        fontFamily: fontFamilies.semibold,
                        fontSize: 16,
                      }}
                    >
                      Find Alternative with AI
                    </Text>
                  )}
                </Pressable>

                {isSwapping && (
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    This may take a few seconds...
                  </Text>
                )}
              </View>
            )}

            {/* Manual Swap - Not rendered in bottom sheet, handled separately */}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Manual Swap Full-Screen Modal */}
      <Modal
        visible={swapMode === "manual"}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSwapMode("choose")}
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
                Swap Exercise
              </Text>
              <Pressable onPress={() => setSwapMode("choose")} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                marginTop: 4,
                marginBottom: 12,
              }}
            >
              Swapping: {exercise.exerciseName}
            </Text>

            <View
              style={{
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
            data={manualExercisesQuery.data?.filter(
              (ex) => ex.id !== exercise.exerciseId
            ) ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 120,
            }}
            renderItem={renderManualExercise}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              manualExercisesQuery.isFetching ? (
                <View style={{ paddingVertical: 8 }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              !manualExercisesQuery.isFetching ? (
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
                    Try another muscle group or a simpler search.
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </Modal>
    </>
  );
};

export default ExerciseSwapModal;
