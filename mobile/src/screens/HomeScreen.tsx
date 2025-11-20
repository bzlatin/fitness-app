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

const HomeScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { data: templates } = useWorkoutTemplates();
  const [swapOpen, setSwapOpen] = useState(false);

  const upNext = useMemo<WorkoutTemplate | null>(() => {
    if (!templates || templates.length === 0) return null;
    return templates[0];
  }, [templates]);

  const startWorkout = (template: WorkoutTemplate | null) => {
    if (!template) return;
    navigation.navigate("WorkoutSession", { templateId: template.id });
  };

  return (
    <ScreenContainer scroll>
      <View style={{ gap: 12 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary, marginTop: 10 }}>
          Up Next
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Built from your history. Swap for another saved workout anytime.
        </Text>

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
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
                    {upNext.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary }}>
                    {upNext.exercises.length} exercises · {upNext.splitType ?? "Custom"}
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
                  <Text style={{ color: colors.secondary, fontFamily: fontFamilies.semibold }}>
                    Swap
                  </Text>
                </Pressable>
              </View>

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Chip label="Duration · 60-75m" />
                <Chip label={upNext.splitType ? upNext.splitType.toUpperCase() : "Custom"} />
                <Chip label="Hypertrophy" />
              </View>

              <Pressable
                onPress={() => startWorkout(upNext)}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  borderRadius: 14,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: colors.surface, fontFamily: fontFamilies.semibold, fontSize: 16 }}>
                  Start workout
                </Text>
              </Pressable>
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
                onPress={() => navigation.navigate("WorkoutTemplateBuilder", {})}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.secondary,
                  alignItems: "center",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: colors.secondary, fontFamily: fontFamilies.semibold }}>
                  Build a workout
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <TargetMuscles />
      </View>

      <SwapModal
        visible={swapOpen}
        onClose={() => setSwapOpen(false)}
        templates={templates ?? []}
        onSelect={(t) => {
          setSwapOpen(false);
          startWorkout(t);
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
    <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
      {label}
    </Text>
  </View>
);

const TargetMuscles = () => {
  const items = [
    { name: "Back", load: "84%" },
    { name: "Chest", load: "63%" },
    { name: "Legs", load: "91%" },
  ];
  return (
    <View style={{ marginTop: 12, gap: 10 }}>
      <Text style={{ ...typography.heading2, color: colors.textPrimary }}>Target muscles</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {items.map((item) => (
          <View
            key={item.name}
            style={{
              flex: 1,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textPrimary, fontFamily: fontFamilies.semibold }}>
              {item.name}
            </Text>
            <Text style={{ color: colors.secondary }}>{item.load}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const SwapModal = ({
  visible,
  onClose,
  templates,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  templates: WorkoutTemplate[];
  onSelect: (template: WorkoutTemplate) => void;
}) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "flex-end",
      }}
    >
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 16,
          maxHeight: "70%",
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ ...typography.heading2, color: colors.textPrimary }}>Swap workout</Text>
          <Pressable onPress={onClose}>
            <Text style={{ color: colors.textSecondary, fontFamily: fontFamilies.semibold }}>
              Close
            </Text>
          </Pressable>
        </View>
        <ScrollView style={{ marginTop: 12 }}>
          {templates.map((template) => (
            <Pressable key={template.id} onPress={() => onSelect(template)} style={{ marginBottom: 12 }}>
              <WorkoutTemplateCard template={template} />
            </Pressable>
          ))}
          {templates.length === 0 ? (
            <Text style={{ color: colors.textSecondary }}>No saved workouts yet.</Text>
          ) : null}
        </ScrollView>
      </View>
    </View>
  </Modal>
);

export default HomeScreen;
