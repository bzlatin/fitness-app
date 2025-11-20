import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import ScreenContainer from "../components/layout/ScreenContainer";
import WorkoutTemplateCard from "../components/workouts/WorkoutTemplateCard";
import { useDuplicateTemplate, useWorkoutTemplates } from "../hooks/useWorkoutTemplates";
import { colors } from "../theme/colors";
import { RootNavigation } from "../navigation/RootNavigator";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { canCreateAnotherTemplate } from "../utils/featureGating";

const MyWorkoutsScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { data, isLoading } = useWorkoutTemplates();
  const duplicateMutation = useDuplicateTemplate();
  const { user } = useCurrentUser();

  const templates = data ?? [];
  const templateLimitReached = !canCreateAnotherTemplate(user, templates.length);

  const handleCreateTemplate = () => {
    if (templateLimitReached) {
      Alert.alert(
        "Free limit reached",
        "You’ve reached the free template limit. Upgrades coming soon."
      );
      return;
    }
    navigation.navigate("WorkoutTemplateBuilder", {});
  };

  return (
    <ScreenContainer scroll>
      <View style={{ marginVertical: 12 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
          My Workouts
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
          Build templates and start quickly.
        </Text>
      </View>

      <Pressable
        onPress={handleCreateTemplate}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 16,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ color: "#0B1220", fontWeight: "700", fontSize: 16 }}>
          New Workout
        </Text>
      </Pressable>
      {templateLimitReached ? (
        <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
          You’ve reached the free template limit. Upgrades coming soon.
        </Text>
      ) : null}

      {isLoading ? (
        <View style={{ marginTop: 20 }}>
          <ActivityIndicator color={colors.secondary} />
        </View>
      ) : null}

      {!isLoading && templates.length === 0 ? (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 16 }}>
            No templates yet
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 6, lineHeight: 20 }}>
            Create your first workout template to jump into sessions faster.
          </Text>
          <Pressable
            onPress={handleCreateTemplate}
            style={({ pressed }) => ({
              marginTop: 12,
              paddingVertical: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.secondary,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ color: colors.secondary, fontWeight: "700" }}>
              Build Template
            </Text>
          </Pressable>
        </View>
      ) : (
        templates.map((template) => (
          <WorkoutTemplateCard
            key={template.id}
            template={template}
            onPress={() =>
              navigation.navigate("WorkoutTemplateDetail", { templateId: template.id })
            }
            onDuplicate={() => duplicateMutation.mutate(template.id)}
          />
        ))
      )}
    </ScreenContainer>
  );
};

export default MyWorkoutsScreen;
