import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";

interface PlanSelectionStepProps {
  selectedPlan: "free" | "pro";
  onPlanChange: (plan: "free" | "pro") => void;
  onContinueFree: () => void;
  onStartTrial: () => void;
}

interface FeatureItemProps {
  text: string;
  highlight?: boolean;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ text, highlight }) => (
  <View style={styles.featureItem}>
    <Text
      style={[
        styles.checkmark,
        highlight && { color: colors.primary },
      ]}
    >
      ✓
    </Text>
    <Text
      style={[
        styles.featureText,
        highlight && { color: colors.textPrimary, fontFamily: fontFamilies.semibold },
      ]}
    >
      {text}
    </Text>
  </View>
);

const PlanSelectionStep: React.FC<PlanSelectionStepProps> = ({
  selectedPlan,
  onPlanChange,
  onContinueFree,
  onStartTrial,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose Your Plan</Text>
      <Text style={styles.subtitle}>
        Start with Free or unlock everything with Pro
      </Text>

      <View style={styles.plansContainer}>
        {/* Free Plan Card */}
        <Pressable
          onPress={() => onPlanChange("free")}
          style={[
            styles.planCard,
            selectedPlan === "free" && styles.planCardSelected,
          ]}
        >
          <View style={styles.planHeader}>
            <Text style={styles.planName}>Free</Text>
            <Text style={styles.planPrice}>$0/mo</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureList}>
            <FeatureItem text="3 workout templates" />
            <FeatureItem text="Unlimited logging" />
            <FeatureItem text="Squad features" />
            <FeatureItem text="Workout history" />
            <FeatureItem text="Basic analytics" />
          </View>

          {selectedPlan === "free" && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeText}>Selected</Text>
            </View>
          )}
        </Pressable>

        {/* Pro Plan Card */}
        <Pressable
          onPress={() => onPlanChange("pro")}
          style={[
            styles.planCard,
            styles.proCard,
            selectedPlan === "pro" && styles.planCardSelectedPro,
          ]}
        >
          {/* Best Value Badge */}
          <View style={styles.bestValueBadge}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>

          <View style={styles.planHeader}>
            <Text style={[styles.planName, styles.proText]}>Pro</Text>
            <Text style={[styles.planPrice, styles.proText]}>$4.99/mo</Text>
          </View>

          <Text style={styles.planSubprice}>or $49.99/year</Text>

          <View style={[styles.divider, styles.proDivider]} />

          <View style={styles.featureList}>
            <FeatureItem text="Unlimited templates" highlight />
            <FeatureItem text="AI workout generation" highlight />
            <FeatureItem text="Recovery intelligence" highlight />
            <FeatureItem text="Progressive overload" highlight />
            <FeatureItem text="Advanced analytics" highlight />
          </View>

          {selectedPlan === "pro" && (
            <View style={[styles.selectedBadge, styles.selectedBadgePro]}>
              <Text style={styles.selectedBadgeTextPro}>Selected</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          onPress={selectedPlan === "pro" ? onStartTrial : onContinueFree}
          style={({ pressed }) => [
            styles.primaryButton,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {selectedPlan === "pro" ? "Start 7-Day Trial" : "Continue with Free"}
          </Text>
        </Pressable>

        {selectedPlan === "pro" && (
          <Text style={styles.disclaimer}>
            Cancel anytime during trial. $4.99/mo after trial ends.
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 28,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  plansContainer: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 32,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.border,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "10",
  },
  proCard: {
    borderColor: colors.primary + "40",
    backgroundColor: colors.primary + "05",
  },
  planCardSelectedPro: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "15",
  },
  planHeader: {
    marginBottom: 8,
  },
  planName: {
    fontSize: 20,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
  },
  proText: {
    color: colors.primary,
  },
  planSubprice: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  proDivider: {
    backgroundColor: colors.primary + "30",
  },
  featureList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkmark: {
    color: colors.success || "#10b981",
    fontSize: 16,
    fontFamily: fontFamilies.bold,
  },
  featureText: {
    color: colors.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  bestValueBadge: {
    position: "absolute",
    top: -10,
    right: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueText: {
    color: "#0B1220",
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    letterSpacing: 0.5,
  },
  selectedBadge: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  selectedBadgeText: {
    color: "#0B1220",
    fontSize: 12,
    fontFamily: fontFamilies.semibold,
  },
  selectedBadgePro: {
    backgroundColor: colors.primary,
  },
  selectedBadgeTextPro: {
    color: "#0B1220",
  },
  actions: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#0B1220",
    fontSize: 17,
    fontFamily: fontFamilies.bold,
  },
  disclaimer: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
});

export default PlanSelectionStep;
