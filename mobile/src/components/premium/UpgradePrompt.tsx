import React from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { colors } from "../../theme/colors";

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
  feature?: string;
  benefits?: string[];
}

const DEFAULT_BENEFITS = [
  "Unlimited workout templates",
  "AI workout generation",
  "Fatigue & recovery tracking",
  "Smart progression suggestions",
];

/**
 * Modal that prompts free users to upgrade to Pro
 */
const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  visible,
  onClose,
  onUpgrade,
  feature = "AI Workout Generation",
  benefits = DEFAULT_BENEFITS,
}) => {
  const handleUpgrade = () => {
    onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      // TODO: Navigate to upgrade screen when implemented
      console.log("Navigate to upgrade screen");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            width: "100%",
            maxWidth: 400,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          onPress={(e) => e.stopPropagation()}
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
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 28 }}>🚀</Text>
          </View>

          {/* Title */}
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: 24,
              fontWeight: "700",
              marginBottom: 8,
            }}
          >
            Unlock {feature}
          </Text>

          {/* Description */}
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 16,
              marginBottom: 20,
              lineHeight: 22,
            }}
          >
            This feature requires a Pro subscription.
          </Text>

          {/* Benefits */}
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 14,
                fontWeight: "600",
                marginBottom: 12,
              }}
            >
              Upgrade to Pro to get:
            </Text>
            {benefits.map((benefit, index) => (
              <View
                key={index}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text style={{ color: colors.primary, marginRight: 8 }}>✓</Text>
                <Text style={{ color: colors.textSecondary, flex: 1 }}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>

          {/* Pricing */}
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            $4.99/month or $47.99/year • 7-day free trial
          </Text>

          {/* Buttons */}
          <Pressable
            onPress={handleUpgrade}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              marginBottom: 12,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{ color: "#0B1220", fontWeight: "700", fontSize: 16 }}
            >
              Start Free Trial
            </Text>
          </Pressable>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
              Maybe Later
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default UpgradePrompt;
