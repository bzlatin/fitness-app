import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, Platform, ActivityIndicator, Alert } from "react-native";
import { useStripe } from "@stripe/stripe-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";
import { startSubscription } from "../../services/payments";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import type { PlanChoice } from "../../api/subscriptions";

interface PaywallComparisonModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade?: (planType: "monthly" | "yearly") => void;
  triggeredBy?: string; // "recovery" | "templates" | "ai" | "progression"
}

interface FeatureRow {
  name: string;
  free: boolean | string;
  pro: boolean | string;
}

const features: FeatureRow[] = [
  { name: "Workout logging", free: true, pro: true },
  { name: "Saved workout templates", free: "Up to 3", pro: "Unlimited" },
  { name: "AI workout generation", free: false, pro: true },
  { name: "Smart workout suggestions", free: false, pro: true },
  { name: "Muscle focus targeting", free: false, pro: true },
  { name: "Recovery & fatigue tracking", free: false, pro: true },
  { name: "Progressive overload suggestions", free: false, pro: true },
  { name: "Advanced analytics & insights", free: false, pro: true },
  { name: "Body heatmap visualization", free: "Basic", pro: "Detailed" },
];

const PaywallComparisonModal: React.FC<PaywallComparisonModalProps> = ({
  visible,
  onClose,
  onUpgrade,
  triggeredBy,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const stripe = useStripe();
  const isIOS = Platform.OS === "ios";

  const startCheckout = useMutation({
    mutationFn: (plan: PlanChoice) =>
      startSubscription({
        plan,
        stripe,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
      }),
    onError: (err: unknown) => {
      const error = err as { message?: string; code?: string };
      if (error.code === "USER_CANCELLED" || error.message === "USER_CANCELLED") {
        // Silent no-op for user-initiated cancellations
        return;
      }
      Alert.alert(
        isIOS ? "Purchase failed" : "Checkout failed",
        error.message || "Something went wrong. Please try again."
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["subscription", "status"],
      });
      onClose();
      Alert.alert(
        "Success",
        isIOS
          ? "Your Apple subscription is active."
          : "Your subscription is active."
      );
    },
  });

  const handleUpgrade = () => {
    // If onUpgrade callback is provided, use the legacy flow
    if (onUpgrade) {
      onClose();
      onUpgrade(selectedPlan);
      return;
    }

    // Otherwise trigger IAP directly
    const planChoice: PlanChoice = selectedPlan === "yearly" ? "annual" : "monthly";
    startCheckout.mutate(planChoice);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 20,
            width: "100%",
            maxWidth: 500,
            maxHeight: "90%",
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
            flex: 1,
          }}
        >

          {/* Close Button */}
          <Pressable
            onPress={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 10,
              padding: 8,
              backgroundColor: colors.background,
              borderRadius: 20,
              width: 36,
              height: 36,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 20 }}>
              ✕
            </Text>
          </Pressable>

          {/* Scrollable Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            bounces={true}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: 24,
              paddingBottom: 0,
            }}
          >
            {/* Icon */}
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.primary + "20",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 28 }}>🚀</Text>
            </View>

            {/* Title */}
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 24,
                fontFamily: fontFamilies.bold,
                marginBottom: 6,
              }}
            >
              Unlock Your Full Potential
            </Text>

            {/* Subtitle */}
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                marginBottom: 20,
                lineHeight: 20,
              }}
            >
              Get AI-powered workouts, unlimited templates, and advanced recovery insights to achieve your fitness goals faster
            </Text>

            {/* Comparison Table */}
            <View
              style={{
                borderRadius: 12,
                overflow: "hidden",
                marginBottom: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              {/* Table Header */}
              <View
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 1.5,
                  borderBottomColor: colors.border,
                  backgroundColor: colors.background,
                }}
              >
                <View style={{ flex: 2, paddingVertical: 10, paddingHorizontal: 10 }}>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    Feature
                  </Text>
                </View>
                <View
                  style={{
                    flex: 0.8,
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    borderLeftWidth: 1,
                    borderLeftColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontFamily: fontFamilies.semibold,
                    }}
                  >
                    FREE
                  </Text>
                </View>
                <View
                  style={{
                    flex: 0.8,
                    paddingVertical: 10,
                    paddingHorizontal: 4,
                    alignItems: "center",
                    justifyContent: "center",
                    borderLeftWidth: 1,
                    borderLeftColor: colors.border,
                    backgroundColor: colors.primary + "10",
                  }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: 11,
                      fontFamily: fontFamilies.bold,
                    }}
                  >
                    PRO
                  </Text>
                </View>
              </View>

              {/* Table Rows */}
              {features.map((feature, index) => (
                <View
                  key={index}
                  style={{
                    flexDirection: "row",
                    borderBottomWidth:
                      index < features.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    minHeight: 42,
                  }}
                >
                  <View
                    style={{
                      flex: 2,
                      paddingVertical: 10,
                      paddingHorizontal: 10,
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        lineHeight: 18,
                      }}
                    >
                      {feature.name}
                    </Text>
                  </View>
                  <View
                    style={{
                      flex: 0.8,
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                      alignItems: "center",
                      justifyContent: "center",
                      borderLeftWidth: 1,
                      borderLeftColor: colors.border,
                    }}
                  >
                    {typeof feature.free === "string" ? (
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 10,
                          textAlign: "center",
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {feature.free}
                      </Text>
                    ) : feature.free ? (
                      <Text
                        style={{
                          color: "#10b981",
                          fontSize: 16,
                        }}
                      >
                        ✓
                      </Text>
                    ) : (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: 16,
                          opacity: 0.5,
                        }}
                      >
                        ✗
                      </Text>
                    )}
                  </View>
                  <View
                    style={{
                      flex: 0.8,
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                      alignItems: "center",
                      justifyContent: "center",
                      borderLeftWidth: 1,
                      borderLeftColor: colors.border,
                      backgroundColor: colors.primary + "05",
                    }}
                  >
                    {typeof feature.pro === "string" && !feature.free ? (
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 10,
                          textAlign: "center",
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        {feature.pro}
                      </Text>
                    ) : (
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 16,
                        }}
                      >
                        ✓
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Pricing Options */}
            <View style={{ marginBottom: 20, gap: 12 }}>
              {/* Yearly Plan - Best Value */}
              <Pressable
                onPress={() => setSelectedPlan("yearly")}
                style={{
                  backgroundColor: selectedPlan === "yearly" ? colors.primary + "15" : colors.background,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: selectedPlan === "yearly" ? colors.primary : colors.border,
                  position: "relative",
                }}
              >
                {selectedPlan === "yearly" && (
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
                    <Text style={{ color: "#0B1220", fontSize: 14, fontFamily: fontFamilies.bold }}>✓</Text>
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
                  <Text style={{ color: "#0B1220", fontSize: 11, fontFamily: fontFamilies.bold }}>
                    BEST VALUE
                  </Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
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
                onPress={() => setSelectedPlan("monthly")}
                style={{
                  backgroundColor: selectedPlan === "monthly" ? colors.primary + "15" : colors.background,
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: selectedPlan === "monthly" ? colors.primary : colors.border,
                }}
              >
                {selectedPlan === "monthly" && (
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
                    <Text style={{ color: "#0B1220", fontSize: 14, fontFamily: fontFamilies.bold }}>✓</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
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

              {/* Trial Info */}
              <View
                style={{
                  backgroundColor: colors.primary + "10",
                  borderRadius: 8,
                  padding: 12,
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 13,
                    fontFamily: fontFamilies.semibold,
                    textAlign: "center",
                  }}
                >
                  ✨ 7-day free trial included with both plans
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Fixed Bottom Buttons */}
          <View
            style={{
              padding: 20,
              paddingTop: 16,
              backgroundColor: colors.surface,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Pressable
              onPress={handleUpgrade}
              disabled={startCheckout.isPending}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 15,
                borderRadius: 12,
                alignItems: "center",
                marginBottom: 10,
                opacity: pressed || startCheckout.isPending ? 0.7 : 1,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              })}
            >
              {startCheckout.isPending ? (
                <ActivityIndicator color="#0B1220" />
              ) : (
                <Text
                  style={{
                    color: "#0B1220",
                    fontFamily: fontFamilies.bold,
                    fontSize: 16,
                  }}
                >
                  Start Free Trial
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                paddingVertical: 12,
                alignItems: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.medium,
                  fontSize: 14,
                }}
              >
                Maybe Later
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default PaywallComparisonModal;
