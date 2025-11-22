import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import ScreenContainer from "../components/layout/ScreenContainer";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { RootNavigation } from "../navigation/RootNavigator";
import { WorkoutTemplate } from "../types/workouts";
import WorkoutTemplateCard from "../components/workouts/WorkoutTemplateCard";
import MuscleGroupBreakdown from "../components/MuscleGroupBreakdown";

const HomeScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { data: templates } = useWorkoutTemplates();
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
                  label={
                    upNext.splitType ? upNext.splitType.toUpperCase() : "Custom"
                  }
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
  const [showSaved, setShowSaved] = useState(false);
  const actionOptions = [
    {
      label: "Pick muscle focus",
      helper: "Curated for chest, back, legs",
      comingSoon: true,
    },
    {
      label: "Saved workouts",
      helper: "Use templates you built",
      action: "saved" as const,
    },
    {
      label: "Create from scratch",
      helper: "Build a fresh workout",
      action: "scratch" as const,
    },
    { label: "On-demand", helper: "Follow-along programs", comingSoon: true },
  ];

  return (
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

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 16,
            }}
          >
            {actionOptions.map((option) => {
              const disabled = Boolean(option.comingSoon);
              return (
                <Pressable
                  key={option.label}
                  disabled={disabled}
                  onPress={() => {
                    if (option.action === "scratch") {
                      onClose();
                      navigation.navigate("WorkoutTemplateBuilder", {});
                      return;
                    }
                    if (option.action === "saved") {
                      setShowSaved((prev) => !prev);
                    }
                  }}
                  style={({ pressed }) => ({
                    flexBasis: "48%",
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: disabled ? colors.border : colors.primary,
                    backgroundColor: disabled
                      ? colors.surfaceMuted
                      : "rgba(34,197,94,0.12)",
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <Text
                    style={{
                      color: disabled ? colors.textSecondary : colors.primary,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    {option.label}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    {option.comingSoon ? "Coming soon" : option.helper}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {showSaved ? (
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
                {templates.length === 0 ? (
                  <Text style={{ color: colors.textSecondary }}>
                    No saved workouts yet.
                  </Text>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default HomeScreen;
