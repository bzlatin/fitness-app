import { useState } from "react";
import { View, Text, Pressable, Switch, Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";

interface NotificationsStepProps {
  notificationsEnabled: boolean;
  onNotificationsEnabledChange: (enabled: boolean) => void;
}

const NotificationsStep = ({
  notificationsEnabled,
  onNotificationsEnabledChange,
}: NotificationsStepProps) => {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnableNotifications = async () => {
    if (!Device.isDevice) {
      Alert.alert(
        "Physical Device Required",
        "Push notifications only work on physical devices, not simulators."
      );
      onNotificationsEnabledChange(true); // Still mark as enabled for onboarding flow
      return;
    }

    setIsRequesting(true);
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();

      if (existingStatus === "granted") {
        onNotificationsEnabledChange(true);
        return;
      }

      const { status } = await Notifications.requestPermissionsAsync();

      if (status === "granted") {
        onNotificationsEnabledChange(true);
      } else {
        Alert.alert(
          "Notifications Disabled",
          "You can enable notifications later in Settings if you change your mind.",
          [{ text: "OK" }]
        );
        onNotificationsEnabledChange(false);
      }
    } catch (error) {
      console.error("[NotificationsStep] Error requesting permissions:", error);
      // In Expo Go, this may fail - just proceed
      onNotificationsEnabledChange(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    if (value) {
      await handleEnableNotifications();
    } else {
      onNotificationsEnabledChange(false);
    }
  };

  const notificationTypes = [
    {
      icon: "🎯",
      title: "Goal Reminders",
      description: "Nudges when your streak or weekly goal is at risk",
    },
    {
      icon: "💪",
      title: "Motivation Boost",
      description: "Gentle reminder if you haven't trained in a while",
    },
    {
      icon: "🎉",
      title: "Celebrations",
      description: "Celebrate when you hit your weekly workout goal",
    },
    {
      icon: "👥",
      title: "Squad Activity",
      description: "Know when squad members comment or react to your workouts",
    },
  ];

  return (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 8 }}>
        <Text
          style={{
            fontSize: 28,
            fontFamily: fontFamilies.bold,
            color: colors.textPrimary,
          }}
        >
          Stay on Track
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: colors.textSecondary,
            lineHeight: 24,
          }}
        >
          Get smart reminders to help you reach your fitness goals. We'll only send what matters—max 3 per week.
        </Text>
      </View>

      {/* Main toggle */}
      <Pressable
        onPress={() => handleToggle(!notificationsEnabled)}
        disabled={isRequesting}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 16,
          borderRadius: 16,
          backgroundColor: notificationsEnabled ? `${colors.primary}15` : colors.surface,
          borderWidth: 2,
          borderColor: notificationsEnabled ? colors.primary : colors.border,
          opacity: pressed || isRequesting ? 0.8 : 1,
        })}
      >
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: fontFamilies.semibold,
              color: colors.textPrimary,
            }}
          >
            Enable Notifications
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.textSecondary,
              marginTop: 4,
            }}
          >
            {notificationsEnabled
              ? "You'll receive helpful reminders"
              : "Tap to enable push notifications"}
          </Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleToggle}
          disabled={isRequesting}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor={notificationsEnabled ? "#fff" : "#f4f3f4"}
        />
      </Pressable>

      {/* Notification types preview */}
      <View style={{ gap: 12 }}>
        <Text
          style={{
            fontSize: 14,
            fontFamily: fontFamilies.semibold,
            color: colors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          What you'll receive
        </Text>

        {notificationTypes.map((type, index) => (
          <View
            key={index}
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: 14,
              borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: notificationsEnabled ? 1 : 0.5,
            }}
          >
            <Text style={{ fontSize: 24, marginRight: 14 }}>{type.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: fontFamilies.semibold,
                  color: colors.textPrimary,
                }}
              >
                {type.title}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {type.description}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Skip option hint */}
      <Text
        style={{
          fontSize: 13,
          color: colors.textSecondary,
          textAlign: "center",
          opacity: 0.7,
        }}
      >
        You can always change this later in Settings
      </Text>
    </View>
  );
};

export default NotificationsStep;
