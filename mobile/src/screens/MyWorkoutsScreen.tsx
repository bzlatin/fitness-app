import { useNavigation } from "@react-navigation/native";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import ScreenContainer from "../components/layout/ScreenContainer";
import WorkoutTemplateCard from "../components/workouts/WorkoutTemplateCard";
import {
  useDuplicateTemplate,
  useWorkoutTemplates,
} from "../hooks/useWorkoutTemplates";
import { colors } from "../theme/colors";
import { RootNavigation } from "../navigation/RootNavigator";
import { useCurrentUser } from "../hooks/useCurrentUser";
import {
  canCreateAnotherTemplate,
  canGenerateAiWorkout,
  getAiWorkoutGenerationsRemaining,
} from "../utils/featureGating";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { fontFamilies } from "../theme/typography";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";

const MyWorkoutsScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { data, isLoading } = useWorkoutTemplates();
  const duplicateMutation = useDuplicateTemplate();
  const { user } = useCurrentUser();
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paywallTrigger, setPaywallTrigger] = useState<"templates" | "ai" | null>(
    null
  );
  const subscriptionAccess = useSubscriptionAccess();
  const hasProAccess = subscriptionAccess.hasProAccess;
  const aiRemaining = getAiWorkoutGenerationsRemaining(user, { hasProAccess });
  const canUseAi = canGenerateAiWorkout(user, { hasProAccess });
  const aiFreeAvailable = !hasProAccess && aiRemaining > 0;
  const aiFreeUsed = !hasProAccess && aiRemaining === 0;
  const [showAiTooltip, setShowAiTooltip] = useState(false);

  const templates = data ?? [];
  const templateLimitReached = user
    ? !canCreateAnotherTemplate(user, templates.length, { hasProAccess })
    : false;
  const templateLimit = 3;
  const templatesUsed = templates.length;

  useEffect(() => {
    const load = async () => {
      if (!aiFreeAvailable) {
        setShowAiTooltip(false);
        return;
      }
      const dismissed = await AsyncStorage.getItem(
        "push-pull.ai-free-tooltip-dismissed"
      );
      setShowAiTooltip(!dismissed);
    };
    void load();
  }, [aiFreeAvailable]);

  const handleCreateTemplate = () => {
    if (templateLimitReached) {
      setPaywallTrigger("templates");
      setShowPaywallModal(true);
      return;
    }
    navigation.navigate("WorkoutTemplateBuilder", {});
  };

  const handleGenerateWithAI = () => {
    if (!canUseAi) {
      setPaywallTrigger("ai");
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

      {/* AI Free-Tier Tooltip */}
      {showAiTooltip && aiFreeAvailable && (
        <Pressable
          onPress={handleGenerateWithAI}
          style={({ pressed }) => ({
            backgroundColor: `${colors.primary}12`,
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: `${colors.primary}35`,
            marginBottom: 12,
            opacity: pressed ? 0.95 : 1,
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
          })}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              backgroundColor: `${colors.primary}22`,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            <Text style={{ fontSize: 18 }}>✨</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 4,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.bold,
                  fontSize: 14,
                }}
              >
                Try a smart workout
              </Text>
              <Pressable
                onPress={async () => {
                  await AsyncStorage.setItem(
                    "push-pull.ai-free-tooltip-dismissed",
                    "1"
                  );
                  setShowAiTooltip(false);
                }}
                style={({ pressed }) => ({
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: pressed ? `${colors.primary}1F` : "transparent",
                })}
                hitSlop={10}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 16 }}>✕</Text>
              </Pressable>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}>
              Generate 1 workout made for you. Upgrade any time for unlimited.
            </Text>
          </View>
        </Pressable>
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
          Generate for me
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
              {aiFreeAvailable ? "1 FREE" : "PRO"}
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
        onClose={() => {
          setShowPaywallModal(false);
          setPaywallTrigger(null);
        }}
        triggeredBy={paywallTrigger ?? undefined}
        aiFreeUsed={paywallTrigger === "ai" ? aiFreeUsed : undefined}
        aiFreeRemaining={
          paywallTrigger === "ai" && Number.isFinite(aiRemaining)
            ? aiRemaining
            : undefined
        }
      />
    </ScreenContainer>
  );
};

export default MyWorkoutsScreen;
