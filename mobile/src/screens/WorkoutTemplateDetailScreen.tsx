import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import ScreenContainer from "../components/layout/ScreenContainer";
import ExerciseRow from "../components/workouts/ExerciseRow";
import { fetchTemplate, updateTemplate } from "../api/templates";
import { startSessionFromTemplate } from "../api/sessions";
import { useDuplicateTemplate, templatesKey, useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { RootRoute, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WorkoutTemplateDetailScreen = () => {
  const route = useRoute<RootRoute<"WorkoutTemplateDetail">>();
  const navigation = useNavigation<Nav>();
  const { data: listData } = useWorkoutTemplates();
  const duplicateMutation = useDuplicateTemplate();
  const queryClient = useQueryClient();

  const templateQuery = useQuery({
    queryKey: [...templatesKey, route.params.templateId],
    queryFn: () => fetchTemplate(route.params.templateId),
    initialData: () =>
      listData?.find((t) => t.id === route.params.templateId),
  });

  const startMutation = useMutation({
    mutationFn: () => startSessionFromTemplate(route.params.templateId),
    onSuccess: (session) =>
      navigation.navigate("WorkoutSession", {
        templateId: route.params.templateId,
        sessionId: session.id,
      }),
  });

  const template = templateQuery.data;
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(template?.name ?? "");

  useEffect(() => {
    setDraftName(template?.name ?? "");
  }, [template?.name]);

  const renameMutation = useMutation({
    mutationFn: (newName: string) =>
      updateTemplate(route.params.templateId, { name: newName }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: templatesKey });
      queryClient.invalidateQueries({
        queryKey: [...templatesKey, route.params.templateId],
      });
      setIsRenaming(false);
      setDraftName(updated.name);
    },
  });

  const handleRename = () => {
    const trimmed = draftName.trim();
    if (!trimmed || !template) return;
    renameMutation.mutate(trimmed);
  };

  return (
    <ScreenContainer scroll>
      {template ? (
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isRenaming ? (
              <>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Template name"
                  placeholderTextColor={colors.textSecondary}
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    color: colors.textPrimary,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    fontSize: 20,
                    fontWeight: "600",
                  }}
                />
                <Pressable
                  onPress={handleRename}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  })}
                  disabled={renameMutation.isPending}
                >
                  <Text style={{ color: colors.surface, fontWeight: "700" }}>
                    Save
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setIsRenaming(false);
                    setDraftName(template.name);
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700", flex: 1 }}>
                  {template.name}
                </Text>
                <Pressable
                  onPress={() => setIsRenaming(true)}
                  style={({ pressed }) => ({
                    padding: 6,
                    borderRadius: 999,
                    backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                  })}
                >
                  <Ionicons name="pencil" size={20} color={colors.textSecondary} />
                </Pressable>
              </>
            )}
          </View>
          {template.description ? (
            <Text style={{ color: colors.textSecondary }}>{template.description}</Text>
          ) : null}
          {template.splitType ? (
            <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
              Split: {template.splitType.toUpperCase()}
            </Text>
          ) : null}

          <View style={{ marginTop: 8 }}>
            <Text style={{ color: colors.textPrimary, fontWeight: "700", marginBottom: 8 }}>
              Exercises
            </Text>
            {template.exercises.map((exercise) => (
              <ExerciseRow
                key={exercise.id}
                item={exercise}
              />
            ))}
          </View>

          <Pressable
            onPress={() => startMutation.mutate()}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: "#0B1220", fontWeight: "700" }}>Start Workout</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              navigation.navigate("WorkoutTemplateBuilder", {
                templateId: template.id,
              })
            }
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
              Edit Template
            </Text>
          </Pressable>

          <Pressable
            onPress={() => duplicateMutation.mutate(template.id)}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              borderColor: colors.secondary,
              borderWidth: 1,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.secondary, fontWeight: "700" }}>
              Duplicate
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text style={{ color: colors.textSecondary }}>Loading template…</Text>
      )}
    </ScreenContainer>
  );
};

export default WorkoutTemplateDetailScreen;
