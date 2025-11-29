import React, { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/colors";
import { fontFamilies } from "../../theme/typography";

interface TrialBannerProps {
  trialEndsAt: string; // ISO timestamp
  onUpgrade: () => void;
}

const TrialBanner: React.FC<TrialBannerProps> = ({ trialEndsAt, onUpgrade }) => {
  const daysRemaining = useMemo(() => {
    const now = new Date().getTime();
    const trialEnd = new Date(trialEndsAt).getTime();
    const diff = trialEnd - now;

    if (diff <= 0) return 0;

    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [trialEndsAt]);

  // Don't show banner if trial has expired
  if (daysRemaining <= 0) {
    return null;
  }

  const getDaysText = () => {
    if (daysRemaining === 1) return "1 day left";
    return `${daysRemaining} days left`;
  };

  return (
    <LinearGradient
      colors={[colors.primary + "20", colors.primary + "10"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.banner}
    >
      <View style={styles.leftSection}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>⏱️</Text>
        </View>
        <View>
          <Text style={styles.daysText}>{getDaysText()} in trial</Text>
          <Text style={styles.subtext}>
            Enjoying Pro? Upgrade to keep your access
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onUpgrade}
        style={({ pressed }) => [
          styles.upgradeButton,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={styles.upgradeButtonText}>Upgrade</Text>
      </Pressable>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  icon: {
    fontSize: 18,
  },
  daysText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fontFamilies.semibold,
    marginBottom: 2,
  },
  subtext: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  upgradeButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: "#0B1220",
    fontSize: 14,
    fontFamily: fontFamilies.bold,
  },
});

export default TrialBanner;
