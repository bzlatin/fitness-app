import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import ScreenContainer from "../components/layout/ScreenContainer";
import ExerciseRow from "../components/workouts/ExerciseRow";
import { fetchTemplate, updateTemplate } from "../api/templates";
import { startSessionFromTemplate } from "../api/sessions";
import { useDeleteTemplate, useDuplicateTemplate, templatesKey, useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { RootRoute, RootStackParamList } from "../navigation/types";
import { colors } from "../theme/colors";
import { Visibility } from "../types/social";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const WorkoutTemplateDetailScreen = () => {
  const route = useRoute<RootRoute<"WorkoutTemplateDetail">>();
  const navigation = useNavigation<Nav>();
  const { data: listData } = useWorkoutTemplates();
  const duplicateMutation = useDuplicateTemplate();
  const deleteMutation = useDeleteTemplate();
  const queryClient = useQueryClient();

  const detailQueryKey = [...templatesKey, route.params.templateId];

  const templateQuery = useQuery({
    queryKey: detailQueryKey,
    queryFn: () => fetchTemplate(route.params.templateId),
    initialData: () =>
      listData?.find((t) => t.id === route.params.templateId),
    enabled: !deleteMutation.isPending,
  });

  const startMutation = useMutation({
    mutationFn: () => startSessionFromTemplate(route.params.templateId),
    onSuccess: (session) => {
      setStartModalVisible(false);
      navigation.navigate("WorkoutSession", {
        templateId: route.params.templateId,
        sessionId: session.id,
        initialVisibility: liveVisibility,
      });
    },
  });

  const template = templateQuery.data;
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(template?.name ?? "");
  const [startModalVisible, setStartModalVisible] = useState(false);
  const [liveVisibility, setLiveVisibility] = useState<Visibility>("private");

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

  const confirmDelete = () => {
    if (!template) return;
    Alert.alert(
      "Delete template?",
      "This will remove the workout and all of its exercises. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(template.id, {
              onSuccess: () => {
                queryClient.removeQueries({ queryKey: detailQueryKey });
                queryClient.invalidateQueries({ queryKey: templatesKey });
                navigation.goBack();
              },
            });
          },
        },
      ]
    );
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
            onPress={() => setStartModalVisible(true)}
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

          <Pressable
            onPress={confirmDelete}
            style={({ pressed }) => ({
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              borderColor: colors.error,
              borderWidth: 1,
              opacity: pressed ? 0.9 : 1,
            })}
            disabled={deleteMutation.isPending}
          >
            <Text style={{ color: colors.error, fontWeight: "700" }}>
              Delete Template
            </Text>
          </Pressable>
        </View>
        ) : (
        <Text style={{ color: colors.textSecondary }}>Loading template…</Text>
      )}
      <Modal visible={startModalVisible} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: 20,
          }}
        >
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
            <Text style={{ color: colors.textPrimary, fontSize: 20, fontWeight: "700" }}>
              Set live visibility
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              Choose who can see you going live. You can change this mid-session at any time.
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { value: "private", label: "Private", helper: "Just you" },
                { value: "followers", label: "Friends", helper: "Gym buddies" },
                { value: "squad", label: "Squad", helper: "Your crew" },
              ].map((option) => {
                const active = liveVisibility === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setLiveVisibility(option.value as Visibility)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? "rgba(34,197,94,0.12)" : colors.surfaceMuted,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <Text
                      style={{
                        textAlign: "center",
                        color: active ? colors.primary : colors.textPrimary,
                        fontWeight: "700",
                      }}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={{
                        textAlign: "center",
                        color: colors.textSecondary,
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {option.helper}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              style={({ pressed }) => ({
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.primary,
                alignItems: "center",
                opacity: pressed || startMutation.isPending ? 0.86 : 1,
              })}
            >
              <Text style={{ color: "#0B1220", fontWeight: "700" }}>
                {startMutation.isPending ? "Starting..." : "Begin workout"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStartModalVisible(false)}
              disabled={startMutation.isPending}
              style={({ pressed }) => ({
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                opacity: pressed || startMutation.isPending ? 0.9 : 1,
              })}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

export default WorkoutTemplateDetailScreen;
