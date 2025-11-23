import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, ActivityIndicator, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";
import { nanoid } from "nanoid";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { useCurrentUser } from "../hooks/useCurrentUser";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { WorkoutTemplate } from "../types/workouts";
import WorkoutTemplateCard from "../components/workouts/WorkoutTemplateCard";
import MuscleGroupBreakdown from "../components/MuscleGroupBreakdown";
import UpgradePrompt from "../components/premium/UpgradePrompt";
import { generateWorkout } from "../api/ai";
import { createWorkoutTemplate } from "../api/templates";
import {
  TRAINING_SPLIT_LABELS,
  EXPERIENCE_LEVEL_LABELS,
} from "../types/onboarding";

const HomeScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { data: templates } = useWorkoutTemplates();
  const { user } = useCurrentUser();
  const [swapOpen, setSwapOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const upNext = useMemo<WorkoutTemplate | null>(() => {
    if (!templates || templates.length === 0) return null;
    return (
      templates.find((t) => t.id === selectedTemplateId) ??
      templates[0]
    );
  }, [templates, selectedTemplateId]);

  const startWorkout = (template: WorkoutTemplate | null) => {
    if (!template) return;
    navigation.navigate("WorkoutSession", { templateId: template.id });
  };

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12 }}>
        <View
          style={{
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
              Up Next
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>
              Built from your history. Swap for another saved workout anytime.
            </Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate("WorkoutTemplateBuilder", {})}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
              }}
            >
              New workout
            </Text>
          </Pressable>
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
          {upNext ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...typography.heading2,
                      color: colors.textPrimary,
                    }}
                  >
                    {upNext.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {upNext.exercises.length} exercises ·{" "}
                    {upNext.splitType ?? "Custom"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setSwapOpen(true)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.secondary,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.secondary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    Swap
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Chip label='Duration · 60-75m' />
                <Chip
                  label={upNext.splitType ?? "Custom"}
                />
                <Chip label='Hypertrophy' />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable
                  onPress={() => startWorkout(upNext)}
                  style={({ pressed }) => ({
                    backgroundColor: colors.primary,
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: "center",
                    flex: 1,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    Start workout
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    navigation.navigate("WorkoutTemplateDetail", {
                      templateId: upNext.id,
                    })
                  }
                  style={({ pressed }) => ({
                    paddingVertical: 16,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    Edit
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={{ gap: 10 }}>
              <Text style={{ ...typography.title, color: colors.textPrimary }}>
                No saved workouts yet
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                Create a template to get personalized Up Next suggestions.
              </Text>
              <Pressable
                onPress={() =>
                  navigation.navigate("WorkoutTemplateBuilder", {})
                }
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.secondary,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.secondary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Build a workout
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <MuscleGroupBreakdown template={upNext} />

        {user?.onboardingData && (
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 14,
              padding: 14,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 10,
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
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 14,
                }}
              >
                Your Training Plan
              </Text>
              <Pressable
                onPress={() => {
                  navigation.navigate("Onboarding", { isRetake: true });
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontFamily: fontFamilies.medium,
                  }}
                >
                  Update
                </Text>
                <Ionicons name="settings-outline" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {user.onboardingData.preferredSplit && (
                <PrefsChip
                  label={TRAINING_SPLIT_LABELS[user.onboardingData.preferredSplit]}
                />
              )}
              {user.onboardingData.experienceLevel && (
                <PrefsChip
                  label={EXPERIENCE_LEVEL_LABELS[user.onboardingData.experienceLevel]}
                />
              )}
              {user.onboardingData.weeklyFrequency && (
                <PrefsChip label={`${user.onboardingData.weeklyFrequency}x/week`} />
              )}
              {user.onboardingData.sessionDuration && (
                <PrefsChip label={`${user.onboardingData.sessionDuration} min`} />
              )}
            </View>
          </View>
        )}
      </View>

        <SwapModal
          visible={swapOpen}
          onClose={() => setSwapOpen(false)}
          templates={templates ?? []}
        onSelect={(t) => {
          setSelectedTemplateId(t.id);
          setSwapOpen(false);
        }}
        onOpenTemplate={(t) => {
          setSwapOpen(false);
          navigation.navigate("WorkoutTemplateDetail", {
            templateId: t.id,
          });
        }}
      />
    </ScreenContainer>
  );
};

const Chip = ({ label }: { label: string }) => (
  <View
    style={{
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Text
      style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}
    >
      {label}
    </Text>
  </View>
);

const PrefsChip = ({ label }: { label: string }) => (
  <View
    style={{
      paddingHorizontal: 10,
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

const MUSCLE_GROUPS = [
  { value: "chest", label: "Chest", emoji: "💪" },
  { value: "back", label: "Back", emoji: "🦾" },
  { value: "legs", label: "Legs", emoji: "🦵" },
  { value: "shoulders", label: "Shoulders", emoji: "🏋️" },
  { value: "arms", label: "Arms", emoji: "💪" },
];

const SPLIT_OPTIONS = [
  { value: "push", label: "Push", emoji: "💪" },
  { value: "pull", label: "Pull", emoji: "🦾" },
  { value: "legs", label: "Legs", emoji: "🦵" },
  { value: "upper", label: "Upper", emoji: "🏅" },
  { value: "lower", label: "Lower", emoji: "🔥" },
  { value: "full_body", label: "Full Body", emoji: "⚡" },
];

const SwapModal = ({
  visible,
  onClose,
  templates,
  onSelect,
  onOpenTemplate,
}: {
  visible: boolean;
  onClose: () => void;
  templates: WorkoutTemplate[];
  onSelect: (template: WorkoutTemplate) => void;
  onOpenTemplate: (template: WorkoutTemplate) => void;
}) => {
  const navigation = useNavigation<RootNavigation>();
  const { user } = useCurrentUser();
  const [showSaved, setShowSaved] = useState(false);
  const [showMuscleFocus, setShowMuscleFocus] = useState(false);
  const [showAISplits, setShowAISplits] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const isPro = user?.plan === "pro";

  const generateMutation = useMutation({
    mutationFn: async ({ split, muscle }: { split?: string; muscle?: string }) => {
      const workout = await generateWorkout({
        requestedSplit: split,
        specificRequest: muscle ? `Focus on ${muscle}` : undefined,
      });

      // Auto-save the generated workout
      const template = {
        id: nanoid(),
        name: workout.name,
        description: workout.reasoning,
        splitType: workout.splitType as any,
        isFavorite: false,
        exercises: workout.exercises.map((ex) => ({
          id: nanoid(),
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
      onClose();
      Alert.alert("AI Workout Ready!", `"${template.name}" has been created and selected.`, [
        {
          text: "Start Workout",
          onPress: () => {
            navigation.navigate("WorkoutSession", { templateId: template.id });
          },
        },
        {
          text: "View Template",
          onPress: () => {
            navigation.navigate("WorkoutTemplateDetail", { templateId: template.id });
          },
        },
      ]);
    },
    onError: (error: any) => {
      Alert.alert(
        "Generation Failed",
        error?.response?.data?.message || "Failed to generate workout. Please try again."
      );
    },
  });

  const handleAIWorkout = (type: "muscle" | "split") => {
    if (!isPro) {
      setShowUpgradePrompt(true);
      return;
    }

    if (type === "muscle") {
      setShowMuscleFocus(true);
      setShowSaved(false);
      setShowAISplits(false);
    } else {
      setShowAISplits(true);
      setShowSaved(false);
      setShowMuscleFocus(false);
    }
  };

  const actionOptions = [
    {
      label: "Pick muscle focus",
      helper: isPro ? "AI-generated for specific muscles" : "AI-generated (Pro)",
      action: "muscle" as const,
      icon: "💪",
    },
    {
      label: "AI workout",
      helper: isPro ? "Smart split selection" : "Smart workouts (Pro)",
      action: "ai" as const,
      icon: "🤖",
    },
    {
      label: "Saved workouts",
      helper: "Use templates you built",
      action: "saved" as const,
      icon: "📋",
    },
    {
      label: "Create from scratch",
      helper: "Build a fresh workout",
      action: "scratch" as const,
      icon: "✏️",
    },
  ];

  return (
    <>
      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="AI Workout Generation"
      />

      <Modal visible={visible} animationType="slide" transparent>
        <Pressable
          onPress={onClose}
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
              padding: 16,
              maxHeight: "80%",
              borderWidth: 1,
              borderColor: colors.border,
              gap: 12,
              marginBottom: -1,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
                Choose a workout
              </Text>
              <Pressable onPress={onClose}>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Close
                </Text>
              </Pressable>
            </View>

            {generateMutation.isPending && (
              <View
                style={{
                  padding: 16,
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 12,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>
                  Generating your personalized workout...
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  This may take 10-30 seconds
                </Text>
              </View>
            )}

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {actionOptions.map((option) => (
                <Pressable
                  key={option.label}
                  disabled={generateMutation.isPending}
                  onPress={() => {
                    if (option.action === "scratch") {
                      onClose();
                      navigation.navigate("WorkoutTemplateBuilder", {});
                      return;
                    }
                    if (option.action === "saved") {
                      setShowSaved((prev) => !prev);
                      setShowMuscleFocus(false);
                      setShowAISplits(false);
                      return;
                    }
                    if (option.action === "muscle") {
                      handleAIWorkout("muscle");
                      return;
                    }
                    if (option.action === "ai") {
                      handleAIWorkout("split");
                      return;
                    }
                  }}
                  style={({ pressed }) => ({
                    flexBasis: "48%",
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    backgroundColor: "rgba(34,197,94,0.12)",
                    opacity: pressed || generateMutation.isPending ? 0.6 : 1,
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={{ fontSize: 16 }}>{option.icon}</Text>
                    <Text
                      style={{
                        color: colors.primary,
                        fontFamily: fontFamilies.semibold,
                        flex: 1,
                      }}
                    >
                      {option.label}
                    </Text>
                    {!isPro && (option.action === "muscle" || option.action === "ai") && (
                      <View
                        style={{
                          backgroundColor: colors.primary,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                        }}
                      >
                        <Text style={{ color: "#0B1220", fontSize: 9, fontWeight: "700" }}>
                          PRO
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {option.helper}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Muscle Group Selection */}
            {showMuscleFocus && (
              <>
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginVertical: 4,
                  }}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    marginBottom: 8,
                  }}
                >
                  Select muscle group
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {MUSCLE_GROUPS.map((muscle) => (
                    <Pressable
                      key={muscle.value}
                      onPress={() => {
                        generateMutation.mutate({ muscle: muscle.label.toLowerCase() });
                      }}
                      disabled={generateMutation.isPending}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        backgroundColor: colors.surfaceMuted,
                        opacity: pressed || generateMutation.isPending ? 0.6 : 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      })}
                    >
                      <Text style={{ fontSize: 18 }}>{muscle.emoji}</Text>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {muscle.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* AI Split Selection */}
            {showAISplits && (
              <>
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginVertical: 4,
                  }}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    marginBottom: 8,
                  }}
                >
                  Select workout split
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {SPLIT_OPTIONS.map((split) => (
                    <Pressable
                      key={split.value}
                      onPress={() => {
                        generateMutation.mutate({ split: split.value });
                      }}
                      disabled={generateMutation.isPending}
                      style={({ pressed }) => ({
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.primary,
                        backgroundColor: colors.surfaceMuted,
                        opacity: pressed || generateMutation.isPending ? 0.6 : 1,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        minWidth: 100,
                      })}
                    >
                      <Text style={{ fontSize: 18 }}>{split.emoji}</Text>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {split.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Saved Workouts */}
            {showSaved && (
              <>
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginVertical: 4,
                  }}
                />
                <ScrollView style={{ marginTop: 4 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      marginBottom: 8,
                    }}
                  >
                    Saved workouts
                  </Text>
                  {templates.map((template) => (
                    <WorkoutTemplateCard
                      key={template.id}
                      template={template}
                      onPress={() => {
                        onSelect(template);
                        onClose();
                      }}
                    />
                  ))}
                  {templates.length === 0 && (
                    <Text style={{ color: colors.textSecondary }}>
                      No saved workouts yet.
                    </Text>
                  )}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

export default HomeScreen;
