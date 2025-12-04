import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { useState } from "react";
import ScreenContainer from "../components/layout/ScreenContainer";
import WorkoutTemplateCard from "../components/workouts/WorkoutTemplateCard";
import {
  useDuplicateTemplate,
  useWorkoutTemplates,
} from "../hooks/useWorkoutTemplates";
import { colors } from "../theme/colors";
import { RootNavigation } from "../navigation/RootNavigator";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { canCreateAnotherTemplate } from "../utils/featureGating";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { fontFamilies } from "../theme/typography";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";

const MyWorkoutsScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { data, isLoading } = useWorkoutTemplates();
  const duplicateMutation = useDuplicateTemplate();
  const { user } = useCurrentUser();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const subscriptionAccess = useSubscriptionAccess();
  const hasProAccess = subscriptionAccess.hasProAccess;

  const templates = data ?? [];
  const templateLimitReached = user
    ? !canCreateAnotherTemplate(user, templates.length, { hasProAccess })
    : false;
  const templateLimit = 3;
  const templatesUsed = templates.length;

  const handleCreateTemplate = () => {
    if (templateLimitReached) {
      setShowPaywallModal(true);
      return;
    }
    navigation.navigate("WorkoutTemplateBuilder", {});
  };

  const handleGenerateWithAI = () => {
    if (!hasProAccess) {
      setShowPaywallModal(true);
      return;
    }
    navigation.navigate("WorkoutGenerator");
  };

  return (
    <ScreenContainer scroll>
      <View style={{ marginVertical: 12 }}>
        <Text
          style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}
        >
          My Workouts
        </Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
          Build templates and start quickly.
        </Text>
      </View>

      {/* Template Counter */}
      {!hasProAccess && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 14,
              }}
            >
              Templates
            </Text>
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {templatesUsed} of {templateLimit} used
            </Text>
          </View>
          {templateLimitReached && (
            <Pressable
              onPress={() => setShowPaywallModal(true)}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text
                style={{
                  color: "#0B1220",
                  fontFamily: fontFamilies.bold,
                  fontSize: 12,
                }}
              >
                Upgrade
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* AI Generation Button (Pro Feature) */}
      <Pressable
        onPress={handleGenerateWithAI}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 12,
          opacity: pressed ? 0.9 : 1,
          flexDirection: "row",
          justifyContent: "center",
        })}
      >
        <Text style={{ fontSize: 18, marginRight: 8 }}>🤖</Text>
        <Text style={{ color: "#0B1220", fontWeight: "700", fontSize: 16 }}>
          Generate with AI
        </Text>
        {!hasProAccess && (
          <View
            style={{
              backgroundColor: "#0B1220",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
              marginLeft: 8,
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>
              PRO
            </Text>
          </View>
        )}
      </Pressable>

      {/* Manual Creation Button */}
      <Pressable
        onPress={handleCreateTemplate}
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 16 }}>
          Build Manually
        </Text>
      </Pressable>

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
          <Text
            style={{
              color: colors.textPrimary,
              fontWeight: "600",
              fontSize: 16,
            }}
          >
            No templates yet
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              marginTop: 6,
              lineHeight: 20,
            }}
          >
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
              navigation.navigate("WorkoutTemplateDetail", {
                templateId: template.id,
              })
            }
            onDuplicate={() => duplicateMutation.mutate(template.id)}
          />
        ))
      )}

      <PaywallComparisonModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
      />
    </ScreenContainer>
  );
};

export default MyWorkoutsScreen;
