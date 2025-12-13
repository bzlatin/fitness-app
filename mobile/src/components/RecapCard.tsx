import { memo, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { RecapHighlight, RecapSessionQuality, RecapSlice } from "../types/analytics";

type RecapCardProps = {
  data?: RecapSlice | null;
  loading?: boolean;
  error?: boolean;
  locked?: boolean;
  onRetry?: () => void;
  onPress?: () => void;
  ctaLabel?: string;
  variant?: "compact" | "expanded";
  style?: ViewStyle;
};

const toneColorMap: Record<RecapHighlight["tone"], string> = {
  positive: colors.primary,
  warning: colors.error,
  info: colors.secondary,
};

const statusColor = (status: RecapSessionQuality["status"]) => {
  if (status === "peak") return colors.primary;
  if (status === "solid") return colors.secondary;
  return colors.error;
};

const RecapCard = ({
  data,
  loading,
  error,
  locked = false,
  onRetry,
  onPress,
  ctaLabel = "View recap",
  variant = "compact",
  style,
}: RecapCardProps) => {
  const isExpanded = variant === "expanded";
  const isLocked = locked && !data && !loading && !error;
  const hasData = !!data && data.quality.length > 0;

  const headline = useMemo(() => {
    if (isLocked) {
      return {
        title: "Pro recap",
        subtitle: "Unlock session quality, volume trends, and highlights",
        tone: "info" as const,
      };
    }
    if (!data) return { title: "Session recap", subtitle: "We’ll populate this after a workout" };
    if (data.qualityDip) {
      return {
        title: "Quality dip spotted",
        subtitle: data.qualityDip.suggestion,
        tone: "warning" as const,
      };
    }
    const primaryHighlight = data.highlights[0];
    if (primaryHighlight) {
      return {
        title: primaryHighlight.title,
        subtitle: primaryHighlight.subtitle ?? "Recent highlight",
        tone: primaryHighlight.tone,
      };
    }
    return {
      title: "Keeping steady",
      subtitle: "Recent sessions look balanced",
      tone: "info" as const,
    };
  }, [data]);

  const meta = useMemo(() => {
    if (!data) return [];
    const items: string[] = [];
    if (data.streak.current > 0) {
      items.push(`${data.streak.current}-day streak`);
    }
    if (data.baselineVolume && data.baselineVolume > 0) {
      items.push(`Baseline ${(data.baselineVolume / 1000).toFixed(1)}k lbs`);
    }
    if (data.quality[0]) {
      items.push(`Last ${data.quality[0].qualityScore}%`);
    }
    return items.slice(0, 3);
  }, [data]);

  const bars = data?.quality.slice(0, 8) ?? [];
  const highlights = data?.highlights.slice(0, isExpanded ? 5 : 2) ?? [];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        isExpanded ? styles.cardExpanded : styles.cardCompact,
        pressed ? styles.cardPressed : null,
        style,
      ]}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Session Quality Recap</Text>
          <Text style={styles.subtitle}>{headline.subtitle}</Text>
        </View>
        {onPress ? (
          <View style={styles.ctaPill}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
            <Ionicons name='chevron-forward' size={16} color={colors.surface} />
          </View>
        ) : null}
      </View>

      {isLocked ? (
        <View style={{ gap: 12 }}>
          <View style={styles.lockedRow}>
            <View style={styles.lockedPill}>
              <Ionicons name='lock-closed' size={14} color={colors.primary} />
              <Text style={styles.lockedPillText}>Pro</Text>
            </View>
            <Text style={styles.lockedText}>Tap to upgrade and view your recap.</Text>
          </View>
          <View style={styles.previewBars}>
            {Array.from({ length: 8 }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.previewBar,
                  { opacity: 0.35 + (index % 3) * 0.18 },
                ]}
              />
            ))}
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Crunching your recap...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name='alert-circle' size={18} color={colors.error} />
          <Text style={styles.errorText}>Couldn&apos;t load recap.</Text>
          {onRetry ? (
            <Pressable onPress={onRetry} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!isLocked && !loading && !error && !hasData ? (
        <View style={styles.emptyRow}>
          <Ionicons name='sparkles-outline' size={18} color={colors.textSecondary} />
          <Text style={styles.emptyText}>Log a workout to see highlights.</Text>
        </View>
      ) : null}

      {!isLocked && hasData ? (
        <>
          <View style={styles.pillRow}>
            <View
              style={[
                styles.tonePill,
                { backgroundColor: toneColorMap[(headline.tone as RecapHighlight["tone"]) || "info"] + "25" },
              ]}
            >
              <Text
                style={[
                  styles.toneText,
                  { color: toneColorMap[(headline.tone as RecapHighlight["tone"]) || "info"] },
                ]}
              >
                {headline.title}
              </Text>
            </View>

            {meta.map((item) => (
              <View key={item} style={styles.metaPill}>
                <Text style={styles.metaText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.qualityRow}>
            {bars.map((entry) => (
              <View
                key={entry.sessionId}
                style={[
                  styles.qualityBar,
                  { backgroundColor: statusColor(entry.status) },
                ]}
              />
            ))}
          </View>

          {isExpanded && highlights.length > 0 ? (
            <View style={{ gap: 10, marginTop: 6 }}>
              {highlights.map((item) => (
                <View key={item.id} style={styles.highlightRow}>
                  <View style={styles.highlightIcon}>
                    <Ionicons
                      name={
                        item.type === "dip"
                          ? "arrow-down-circle"
                          : item.type === "streak"
                          ? "flame"
                          : "trophy"
                      }
                      size={16}
                      color={toneColorMap[item.tone]}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.highlightTitle}>{item.title}</Text>
                    <Text style={styles.highlightSubtitle} numberOfLines={2}>
                      {item.subtitle || item.date}
                    </Text>
                  </View>
                  <Text style={styles.highlightDate}>
                    {new Date(item.date).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  cardCompact: {
    padding: 14,
    gap: 10,
  },
  cardExpanded: {
    padding: 16,
    gap: 12,
  },
  cardPressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    ...typography.heading2,
    color: colors.textPrimary,
    fontSize: 18,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.regular,
    fontSize: 13,
  },
  ctaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  ctaText: {
    color: colors.surface,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.medium,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontFamily: fontFamilies.medium,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.medium,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tonePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: `${colors.secondary}25`,
  },
  toneText: {
    color: colors.secondary,
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
  },
  metaPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.medium,
    fontSize: 12,
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qualityBar: {
    height: 8,
    flex: 1,
    borderRadius: 6,
    backgroundColor: colors.surfaceMuted,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
  },
  lockedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${colors.primary}18`,
    borderWidth: 1,
    borderColor: `${colors.primary}35`,
  },
  lockedPillText: {
    color: colors.primary,
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
  },
  lockedText: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    flex: 1,
    textAlign: "right",
  },
  previewBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewBar: {
    height: 8,
    flex: 1,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  highlightIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.primary}10`,
  },
  highlightTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamilies.semibold,
    fontSize: 14,
  },
  highlightSubtitle: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    marginTop: 2,
  },
  highlightDate: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.medium,
    fontSize: 11,
  },
});

export default memo(RecapCard);
