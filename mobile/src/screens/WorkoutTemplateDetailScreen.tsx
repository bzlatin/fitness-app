import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Pressable, Text, View } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import ExerciseRow from "../components/workouts/ExerciseRow";
import { fetchTemplate } from "../api/templates";
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

  return (
    <ScreenContainer scroll>
      {template ? (
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
            {template.name}
          </Text>
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
              <ExerciseRow key={exercise.id} item={exercise} />
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
