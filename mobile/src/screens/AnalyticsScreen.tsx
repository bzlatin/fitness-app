import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import ScreenContainer from "../components/layout/ScreenContainer";
import VolumeChart from "../components/VolumeChart";
import { fetchAdvancedAnalytics } from "../api/analytics";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { formatMuscleGroup } from "../utils/muscleGroupCalculations";
import { useCurrentUser } from "../hooks/useCurrentUser";
import PaywallComparisonModal from "../components/premium/PaywallComparisonModal";
import { RootNavigation } from "../navigation/RootNavigator";
import type { AdvancedAnalytics } from "../types/analytics";
import type { ApiClientError } from "../api/client";
import { useSubscriptionAccess } from "../hooks/useSubscriptionAccess";

const AnalyticsScreen = () => {
  const navigation = useNavigation<RootNavigation>();
  const { user } = useCurrentUser();
  const subscriptionAccess = useSubscriptionAccess();
  const isPro = subscriptionAccess.hasProAccess;
  const isGraceOrExpired = subscriptionAccess.isGrace || subscriptionAccess.isExpired;

  const [timeRange, setTimeRange] = useState<4 | 8 | 12>(4);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  const {
    data: analytics,
    isLoading,
    isRefetching,
    refetch,
    isError,
  } = useQuery<AdvancedAnalytics, ApiClientError>({
    queryKey: ["advancedAnalytics", timeRange],
    queryFn: () => fetchAdvancedAnalytics(timeRange),
    enabled: isPro,
    retry: false,
    onError: (err: any) => {
      if (err?.status === 403 || err?.requiresUpgrade) {
        setShowPaywallModal(true);
      }
    },
  });

  const handleMuscleToggle = (muscle: string) => {
    setSelectedMuscles((prev) => {
      if (prev.includes(muscle)) {
        return prev.filter((m) => m !== muscle);
      }
      return [...prev, muscle];
    });
  };

  const handleClearSelection = () => {
    setSelectedMuscles([]);
  };

  if (!isPro) {
    return (
      <ScreenContainer>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.paywallContainer}>
            <View style={styles.paywallIconContainer}>
              <Ionicons name='bar-chart' size={40} color={colors.primary} />
            </View>
            <Text style={styles.paywallTitle}>Advanced Analytics</Text>
            <Text style={styles.paywallDescription}>
              {isGraceOrExpired
                ? "Your subscription is inactive. Update billing to unlock advanced analytics."
                : "Track weekly volume, muscle group balance, and volume PRs with Pro"}
            </Text>
            <Pressable
              onPress={() => navigation.navigate("Upgrade")}
              style={styles.upgradeButton}
            >
              <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
            </Pressable>
          </View>

          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>Included Features</Text>
            {[
              "Weekly volume per muscle group (last 12 weeks)",
              "Push vs Pull volume balance indicator",
              "Most/least trained muscle groups",
              "Volume PR tracking per muscle group",
              "Muscle group frequency heatmap",
            ].map((feature, idx) => (
              <View key={idx} style={styles.featureRow}>
                <Ionicons
                  name='checkmark-circle'
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <PaywallComparisonModal
          visible={showPaywallModal}
          onClose={() => setShowPaywallModal(false)}
          triggeredBy='analytics'
        />
      </ScreenContainer>
    );
  }

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isError || !analytics) {
    return (
      <ScreenContainer>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.errorContainer}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
        >
          <Ionicons
            name='alert-circle'
            size={48}
            color={colors.textSecondary}
          />
          <Text style={styles.errorTitle}>Failed to load analytics</Text>
          <Pressable onPress={() => refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const {
    weeklyVolumeData,
    muscleGroupSummaries,
    pushPullBalance,
    volumePRs,
    frequencyHeatmap,
  } = analytics;

  const totalTrackedVolume =
    pushPullBalance.pushVolume +
    pushPullBalance.pullVolume +
    pushPullBalance.legVolume +
    pushPullBalance.otherVolume;

  const hasAnalyticsData =
    weeklyVolumeData.length > 0 ||
    muscleGroupSummaries.length > 0 ||
    volumePRs.length > 0 ||
    frequencyHeatmap.length > 0 ||
    totalTrackedVolume > 0;

  const pushPullRatioDisplay = (() => {
    const hasPush = pushPullBalance.pushVolume > 0;
    const hasPull = pushPullBalance.pullVolume > 0;

    if (!hasPush && !hasPull) {
      return "—";
    }
    if (hasPush && !hasPull) {
      return ">9:1";
    }
    if (!hasPush && hasPull) {
      return "<0.1:1";
    }
    return `${pushPullBalance.pushPullRatio.toFixed(1)}:1`;
  })();

  if (!hasAnalyticsData) {
    return (
      <ScreenContainer
        scroll
        showGradient
        showTopGradient
        paddingTop={20}
        includeTopInset={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Advanced Analytics</Text>
          <Text style={styles.headerSubtitle}>
            Track your volume, balance, and progress
          </Text>
        </View>

        <View style={styles.emptyState}>
          <Ionicons
            name='bar-chart-outline'
            size={56}
            color={colors.textSecondary}
          />
          <Text style={styles.emptyTitle}>No workout data yet</Text>
          <Text style={styles.emptySubtitle}>
            Log your first workout to see analytics
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scroll
      showGradient
      showTopGradient
      paddingTop={20}
      includeTopInset={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Advanced Analytics</Text>
        <Text style={styles.headerSubtitle}>
          Track your volume, balance, and progress
        </Text>
      </View>

      {/* Time Range Selector */}
      <View style={styles.timeRangeWrapper}>
        <View style={styles.timeRangeContainer}>
          {([4, 8, 12] as const).map((weeks) => (
            <Pressable
              key={weeks}
              onPress={() => setTimeRange(weeks)}
              style={[
                styles.timeRangeButton,
                timeRange === weeks && styles.timeRangeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.timeRangeButtonText,
                  timeRange === weeks && styles.timeRangeButtonTextActive,
                ]}
              >
                {weeks} Weeks
              </Text>
            </Pressable>
          ))}
        </View>
        {selectedMuscles.length > 0 && (
          <Pressable
            onPress={handleClearSelection}
            style={styles.clearFilterButton}
          >
            <Text style={styles.clearFilterText}>Clear Filter</Text>
          </Pressable>
        )}
      </View>

      {/* Weekly Volume Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly Volume by Muscle Group</Text>
        <VolumeChart
          data={weeklyVolumeData}
          selectedMuscles={
            selectedMuscles.length > 0 ? selectedMuscles : undefined
          }
          onMuscleToggle={handleMuscleToggle}
          weeks={timeRange}
        />
      </View>

      {/* Push/Pull Balance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push/Pull Balance</Text>
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceColumn}>
              <Text style={styles.balanceLabel}>Push Volume</Text>
              <Text style={[styles.balanceValue, { color: colors.primary }]}>
                {(pushPullBalance.pushVolume / 1000).toFixed(1)}k lbs
              </Text>
            </View>
            <View style={styles.balanceRatioContainer}>
              <Text style={styles.balanceRatio}>{pushPullRatioDisplay}</Text>
            </View>
            <View style={[styles.balanceColumn, styles.balanceColumnRight]}>
              <Text style={styles.balanceLabel}>Pull Volume</Text>
              <Text style={[styles.balanceValue, { color: "#38BDF8" }]}>
                {(pushPullBalance.pullVolume / 1000).toFixed(1)}k lbs
              </Text>
            </View>
          </View>

          <View style={styles.balanceStatusContainer}>
            <View
              style={[
                styles.balanceStatusBadge,
                {
                  backgroundColor:
                    pushPullBalance.balanceStatus === "balanced"
                      ? colors.primary + "20"
                      : "#F59E0B20",
                },
              ]}
            >
              <Text
                style={[
                  styles.balanceStatusText,
                  {
                    color:
                      pushPullBalance.balanceStatus === "balanced"
                        ? colors.primary
                        : "#F59E0B",
                  },
                ]}
              >
                {pushPullBalance.balanceStatus === "balanced"
                  ? "Balanced"
                  : pushPullBalance.balanceStatus === "push-heavy"
                  ? "Push-Heavy"
                  : "Pull-Heavy"}
              </Text>
            </View>
          </View>

          <View style={styles.recommendationsContainer}>
            {pushPullBalance.recommendations.map((rec, idx) => (
              <Text key={idx} style={styles.recommendationText}>
                • {rec}
              </Text>
            ))}
          </View>

          <View style={styles.legVolumeContainer}>
            <View style={styles.legVolumeRow}>
              <Text style={styles.legVolumeLabel}>Leg Volume</Text>
              <Text style={styles.legVolumeValue}>
                {(pushPullBalance.legVolume / 1000).toFixed(1)}k lbs
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Muscle Group Summaries */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Muscle Group Summary ({timeRange} weeks)
        </Text>
        {muscleGroupSummaries.slice(0, 8).map((summary) => (
          <View key={summary.muscleGroup} style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryMuscle}>
                {formatMuscleGroup(summary.muscleGroup)}
              </Text>
              <Text style={styles.summaryVolume}>
                {(summary.totalVolume / 1000).toFixed(1)}k lbs
              </Text>
            </View>
            <View style={styles.summaryDetails}>
              <Text style={styles.summaryDetailsText}>
                {summary.totalSets} sets • {summary.workoutCount} workouts
              </Text>
              <Text style={styles.summaryDetailsText}>
                Avg: {(summary.averageVolumePerWorkout / 1000).toFixed(1)}k lbs/workout
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Volume PRs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Volume Personal Records</Text>
        {volumePRs.slice(0, 6).map((pr) => (
          <View key={pr.muscleGroup} style={styles.prCard}>
            <View style={styles.prHeader}>
              <Text style={styles.prMuscle}>
                {formatMuscleGroup(pr.muscleGroup)}
              </Text>
              <View
                style={[
                  styles.prBadge,
                  {
                    backgroundColor:
                      pr.percentOfPR >= 80
                        ? colors.primary + "20"
                        : pr.percentOfPR >= 50
                        ? "#F59E0B20"
                        : "#EF444420",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.prBadgeText,
                    {
                      color:
                        pr.percentOfPR >= 80
                          ? colors.primary
                          : pr.percentOfPR >= 50
                          ? "#F59E0B"
                          : "#EF4444",
                    },
                  ]}
                >
                  {pr.percentOfPR}% of PR
                </Text>
              </View>
            </View>
            <View style={styles.prDetails}>
              <View>
                <Text style={styles.prDetailsText}>
                  PR: {(pr.peakVolume / 1000).toFixed(1)}k lbs
                </Text>
                <Text style={styles.prDetailsText}>
                  {new Date(pr.peakWeekDate).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.prCurrent}>
                Current: {(pr.currentVolume / 1000).toFixed(1)}k lbs
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Frequency Heatmap Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training Frequency</Text>
        {frequencyHeatmap.slice(0, 6).map((freq) => (
          <View key={freq.muscleGroup} style={styles.frequencyCard}>
            <View style={styles.frequencyRow}>
              <Text style={styles.frequencyMuscle}>
                {formatMuscleGroup(freq.muscleGroup)}
              </Text>
              <View style={styles.frequencyDetails}>
                <Text style={styles.frequencyValue}>
                  {freq.weeklyFrequency}x/week
                </Text>
                {freq.mostTrainedDay && (
                  <Text style={styles.frequencyDay}>
                    Usually {freq.mostTrainedDay}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  paywallContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
  },
  paywallIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary + "20",
    marginBottom: 24,
  },
  paywallTitle: {
    fontSize: 24,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  paywallDescription: {
    textAlign: "center",
    fontSize: 16,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  upgradeButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontFamily: fontFamilies.semibold,
    color: colors.surface,
  },
  featuresContainer: {
    marginTop: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureText: {
    marginLeft: 12,
    flex: 1,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 16,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: fontFamilies.medium,
    color: colors.textPrimary,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    fontFamily: fontFamilies.semibold,
    color: colors.surface,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  emptyState: {
    paddingHorizontal: 16,
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: "center",
  },
  timeRangeWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  timeRangeContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  timeRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeRangeButtonText: {
    fontSize: 14,
    fontFamily: fontFamilies.semibold,
    color: colors.textSecondary,
  },
  timeRangeButtonTextActive: {
    color: colors.surface,
  },
  clearFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary + "20",
    borderWidth: 1,
    borderColor: colors.primary,
    alignSelf: "flex-start",
  },
  clearFilterText: {
    fontSize: 13,
    fontFamily: fontFamilies.semibold,
    color: colors.primary,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  balanceCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  balanceColumn: {
    flex: 1,
  },
  balanceColumnRight: {
    alignItems: "flex-end",
  },
  balanceLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 24,
    fontFamily: fontFamilies.bold,
  },
  balanceRatioContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  balanceRatio: {
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    color: colors.textPrimary,
  },
  balanceStatusContainer: {
    marginBottom: 12,
  },
  balanceStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  balanceStatusText: {
    fontSize: 12,
    fontFamily: fontFamilies.semibold,
  },
  recommendationsContainer: {
    marginBottom: 12,
  },
  recommendationText: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  legVolumeContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legVolumeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legVolumeLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  legVolumeValue: {
    fontSize: 16,
    fontFamily: fontFamilies.bold,
    color: "#EF4444",
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 12,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryMuscle: {
    fontSize: 16,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  summaryVolume: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.primary,
  },
  summaryDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryDetailsText: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  prCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 12,
  },
  prHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  prMuscle: {
    fontSize: 16,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  prBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  prBadgeText: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
  },
  prDetails: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  prDetailsText: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
  prCurrent: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    color: colors.textSecondary,
  },
  frequencyCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 12,
  },
  frequencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  frequencyMuscle: {
    fontSize: 16,
    fontFamily: fontFamilies.semibold,
    color: colors.textPrimary,
  },
  frequencyDetails: {
    alignItems: "flex-end",
  },
  frequencyValue: {
    fontSize: 14,
    fontFamily: fontFamilies.bold,
    color: colors.primary,
  },
  frequencyDay: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
  },
});

export default AnalyticsScreen;
