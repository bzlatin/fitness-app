import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";

interface PlanSelectionStepProps {
  selectedPlan: "free" | "pro";
  onPlanChange: (plan: "free" | "pro") => void;
  onContinueFree: () => void;
  onStartTrial: (planType: "monthly" | "yearly") => void;
  isProcessingPurchase?: boolean;
  selectedBilling?: "monthly" | "yearly";
  onBillingChange?: (billing: "monthly" | "yearly") => void;
  hideCta?: boolean;
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
  isProcessingPurchase = false,
  selectedBilling,
  onBillingChange,
  hideCta = false,
}) => {
  const [internalBilling, setInternalBilling] = React.useState<"monthly" | "yearly">("yearly");
  const billing = selectedBilling ?? internalBilling;
  const setBilling = onBillingChange ?? setInternalBilling;

  return (
    <View style={styles.container}>
      <View style={{ gap: 4, marginBottom: 24 }}>
        <Text style={styles.title}>Unlock Your Full Potential</Text>
        <Text style={styles.subtitle}>
          Choose between Free or unlock everything with Pro to get smart workouts, unlimited templates, and advanced analytics
        </Text>
      </View>

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
            <FeatureItem text="Workout logging" />
            <FeatureItem text="Up to 3 templates" />
            <FeatureItem text="1 free smart workout" highlight />
            <FeatureItem text="Squad features" />
            <FeatureItem text="Workout history" />
            <FeatureItem text="Basic body heatmap" />
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
          <View style={styles.planHeader}>
            <Text style={[styles.planName, styles.proText]}>Pro</Text>
          </View>

          <View style={[styles.divider, styles.proDivider]} />

          <View style={styles.featureList}>
            <FeatureItem text="Unlimited templates" highlight />
            <FeatureItem text="Smart workout generator" highlight />
            <FeatureItem text="Smart suggestions" highlight />
            <FeatureItem text="Recovery tracking" highlight />
            <FeatureItem text="Progressive overload" highlight />
            <FeatureItem text="Advanced analytics" highlight />
            <FeatureItem text="Detailed body heatmap" highlight />
          </View>

          {selectedPlan === "pro" && (
            <View style={[styles.selectedBadge, styles.selectedBadgePro]}>
              <Text style={styles.selectedBadgeTextPro}>Selected</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Pro Plan Pricing Options */}
      {selectedPlan === "pro" && (
        <View style={{ gap: 12, marginBottom: 20 }}>
          {/* Yearly Plan - Best Value */}
          <Pressable
            onPress={() => setBilling("yearly")}
            style={{
              backgroundColor:
                billing === "yearly"
                  ? colors.primary + "15"
                  : colors.background,
              borderRadius: 12,
              padding: 16,
              borderWidth: 2,
              borderColor:
                billing === "yearly" ? colors.primary : colors.border,
              position: "relative",
            }}
          >
            {billing === "yearly" && (
              <View
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  width: 24,
                  height: 24,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#0B1220",
                    fontSize: 14,
                    fontFamily: fontFamilies.bold,
                  }}
                >
                  ✓
                </Text>
              </View>
            )}
            <View
              style={{
                position: "absolute",
                top: -8,
                left: 16,
                backgroundColor: colors.primary,
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  color: "#0B1220",
                  fontSize: 11,
                  fontFamily: fontFamilies.bold,
                }}
              >
                BEST VALUE
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              <View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 20,
                    fontFamily: fontFamilies.bold,
                  }}
                >
                  $49.99/year
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  Save 17% • Just $4.16/month
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Monthly Plan */}
          <Pressable
            onPress={() => setBilling("monthly")}
            style={{
              backgroundColor:
                billing === "monthly"
                  ? colors.primary + "15"
                  : colors.background,
              borderRadius: 12,
              padding: 16,
              borderWidth: 2,
              borderColor:
                billing === "monthly" ? colors.primary : colors.border,
            }}
          >
            {billing === "monthly" && (
              <View
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  backgroundColor: colors.primary,
                  borderRadius: 12,
                  width: 24,
                  height: 24,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#0B1220",
                    fontSize: 14,
                    fontFamily: fontFamilies.bold,
                  }}
                >
                  ✓
                </Text>
              </View>
            )}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 20,
                    fontFamily: fontFamilies.bold,
                  }}
                >
                  $4.99/month
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    marginTop: 2,
                  }}
                >
                  Billed monthly
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      )}

      {/* Trial Info */}
      {selectedPlan === "pro" && (
        <View
          style={{
            backgroundColor: colors.primary + "10",
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: colors.primary + "30",
          }}
        >
          <Text
            style={{
              color: colors.primary,
              fontSize: 13,
              fontFamily: fontFamilies.semibold,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            ✨ 7-day free trial included with both plans • Cancel anytime
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      {!hideCta && (
        <View style={styles.actions}>
          <Pressable
            onPress={() => (selectedPlan === "pro" ? onStartTrial(billing) : onContinueFree())}
            disabled={isProcessingPurchase}
            style={({ pressed }) => [
              styles.primaryButton,
              { opacity: pressed || isProcessingPurchase ? 0.7 : 1 },
            ]}
          >
            {isProcessingPurchase ? (
              <ActivityIndicator color="#0B1220" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {selectedPlan === "pro" ? "Start 7-Day Trial" : "Continue with Free"}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  plansContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
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
    color: "#10b981",
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
