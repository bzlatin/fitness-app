import React from "react";
import { View, Text, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { RootNavigation } from "../../navigation/RootNavigator";

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
  const navigation = useNavigation<RootNavigation>();
  const insets = useSafeAreaInsets();

  const handleUpgrade = () => {
    onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigation.navigate("Upgrade");
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <Pressable
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onPress={onClose}
          />
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              width: "88%",
              maxWidth: 380,
              maxHeight: "75%",
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                padding: 20,
                paddingBottom: 24,
              }}
              showsVerticalScrollIndicator={true}
              bounces={false}
            >
            {/* Icon */}
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.primary + "20",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 24 }}>🚀</Text>
            </View>

            {/* Title */}
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                fontWeight: "700",
                marginBottom: 6,
              }}
            >
              Unlock {feature}
            </Text>

            {/* Description */}
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                marginBottom: 16,
                lineHeight: 20,
              }}
            >
              This feature requires a Pro subscription.
            </Text>

            {/* Benefits */}
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 13,
                  fontWeight: "600",
                  marginBottom: 10,
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
                    marginBottom: 6,
                  }}
                >
                  <Text style={{ color: colors.primary, marginRight: 8, fontSize: 14 }}>✓</Text>
                  <Text style={{ color: colors.textSecondary, flex: 1, fontSize: 13, lineHeight: 18 }}>
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>

            {/* Pricing */}
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              $4.99/month or $49.99/year • 7-day free trial
            </Text>

            {/* Buttons */}
            <Pressable
              onPress={handleUpgrade}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                paddingVertical: 13,
                borderRadius: 12,
                alignItems: "center",
                marginBottom: 10,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text
                style={{ color: "#0B1220", fontWeight: "700", fontSize: 15 }}
              >
                Start Free Trial
              </Text>
            </Pressable>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
                Maybe Later
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default UpgradePrompt;
