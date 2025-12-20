import React from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { UpNextRecommendation, UpNextTemplate } from "../../types/analytics";

// Split type emojis
const SPLIT_EMOJIS: Record<string, string> = {
  push: "💪",
  pull: "🦾",
  legs: "🦵",
  upper: "🏅",
  lower: "🔥",
  full_body: "⚡",
  chest: "💪",
  back: "🦾",
  shoulders: "🏋️",
  arms: "💪",
};

// Fatigue status colors
const FATIGUE_COLORS: Record<UpNextRecommendation["fatigueStatus"], string> = {
  fresh: colors.primary,
  ready: colors.secondary,
  "moderate-fatigue": "#fbbf24",
  "high-fatigue": "#ef4444",
  "no-data": colors.textSecondary,
};

const FATIGUE_LABELS: Record<UpNextRecommendation["fatigueStatus"], string> = {
  fresh: "Fresh",
  ready: "Ready",
  "moderate-fatigue": "Recovering",
  "high-fatigue": "Fatigued",
  "no-data": "No data yet",
};

type UpNextCardProps = {
  recommendation: UpNextRecommendation | null;
  isLoading: boolean;
  isError: boolean;
  onStartTemplate: (templateId: string) => void;
  onGenerate: (splitKey: string) => void;
  onCreate: () => void;
  onSwap: () => void;
  onEditTemplate: (templateId: string) => void;
  onUpgrade: () => void;
  isPro: boolean;
  // Optional override to display a manually selected template
  overrideTemplate?: {
    templateId: string;
    templateName: string;
    exerciseCount: number;
    splitType: string | null;
  } | null;
};

/**
 * UpNextCard - Intelligent workout recommendation card
 *
 * Shows:
 * - Recommended split type (Push, Pull, Legs, etc.)
 * - Matched template (if user has one for this split)
 * - Recovery status indicator
 * - Start / Generate / Swap actions
 *
 * Pro users: Unlimited AI generation
 * Free users: One free AI generation when available
 */
export const UpNextCard: React.FC<UpNextCardProps> = ({
  recommendation,
  isLoading,
  isError,
  onStartTemplate,
  onGenerate,
  onCreate,
  onSwap,
  onEditTemplate,
  onUpgrade,
  isPro,
  overrideTemplate,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 180,
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
        <Text
          style={{
            color: colors.textSecondary,
            marginTop: 12,
            fontFamily: fontFamilies.regular,
          }}
        >
          Finding your next workout...
        </Text>
      </View>
    );
  }

  // Override template - user manually selected a different workout
  if (overrideTemplate) {
    const splitEmoji = overrideTemplate.splitType
      ? SPLIT_EMOJIS[overrideTemplate.splitType] ?? "🎯"
      : "📋";

    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 14,
        }}
      >
        {/* Header: Selected template */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: `${colors.primary}15`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 24 }}>{splitEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                ...typography.heading2,
                color: colors.textPrimary,
                fontSize: 18,
              }}
              numberOfLines={1}
            >
              {overrideTemplate.templateName}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
              {overrideTemplate.exerciseCount} exercises
              {overrideTemplate.splitType ? ` • ${overrideTemplate.splitType}` : ""}
            </Text>
          </View>
          <Pressable
            onPress={onSwap}
            style={({ pressed }) => ({
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.secondary,
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                color: colors.secondary,
                fontFamily: fontFamilies.semibold,
              }}
            >
              Swap
            </Text>
          </Pressable>
        </View>

        {/* Selected template card */}
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: `${colors.primary}30`,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
                numberOfLines={1}
              >
                {overrideTemplate.templateName}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {overrideTemplate.exerciseCount} exercises • Manually selected
              </Text>
            </View>
            <Pressable
              onPress={() => onEditTemplate(overrideTemplate.templateId)}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 8,
                backgroundColor: pressed ? colors.surface : "transparent",
              })}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => onStartTemplate(overrideTemplate.templateId)}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                color: colors.surface,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              Start workout
            </Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          Tap Swap to choose a different workout
        </Text>
      </View>
    );
  }

  // Error state
  if (isError || !recommendation) {
    return (
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 12,
        }}
      >
        <Text style={{ ...typography.title, color: colors.textPrimary }}>
          No saved workouts yet
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          Choose how to get started with your first workout.
        </Text>
        <Pressable
          onPress={onSwap}
          style={({ pressed }) => ({
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.primary,
            alignItems: "center",
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              color: colors.surface,
              fontFamily: fontFamilies.semibold,
            }}
          >
            Get Started
          </Text>
        </Pressable>
      </View>
    );
  }

  const { recommendedSplit, matchedTemplate, fatigueStatus, canGenerateAI, reasoning, daysSinceLastSplit } = recommendation;
  const canGenerateFree = !isPro && canGenerateAI;
  const splitEmoji = SPLIT_EMOJIS[recommendedSplit.splitKey] ?? "🎯";
  const fatigueColor = FATIGUE_COLORS[fatigueStatus];
  const fatigueLabel = FATIGUE_LABELS[fatigueStatus];

  // Has a matching template to use (must have score >= 85 to be a true match)
  const hasMatchedTemplate = matchedTemplate && matchedTemplate.matchScore >= 85;

  // Filter out tags that duplicate the fatigue status shown in the header
  const fatigueRelatedTags = ["Fresh", "High fatigue risk", "Recovering"];
  const filteredTags = recommendedSplit.tags.filter(
    (tag) => !fatigueRelatedTags.includes(tag)
  );

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 14,
      }}
    >
      {/* Header: Split recommendation with emoji */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: `${colors.primary}15`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 24 }}>{splitEmoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              ...typography.heading2,
              color: colors.textPrimary,
              fontSize: 18,
            }}
          >
            {recommendedSplit.label} Day
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: fatigueColor,
              }}
            />
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {fatigueLabel}
              {daysSinceLastSplit !== null && daysSinceLastSplit > 0
                ? ` • ${daysSinceLastSplit}d since last`
                : ""}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onSwap}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.secondary,
            backgroundColor: colors.surfaceMuted,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text
            style={{
              color: colors.secondary,
              fontFamily: fontFamilies.semibold,
            }}
          >
            Swap
          </Text>
        </Pressable>
      </View>

      {/* Reason badges - only show non-fatigue tags since fatigue is shown in header */}
      {filteredTags.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {filteredTags.slice(0, 3).map((tag) => (
            <View
              key={tag}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.medium,
                  fontSize: 12,
                }}
              >
                {tag}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Template match section */}
      {hasMatchedTemplate ? (
        <View
          style={{
            padding: 14,
            borderRadius: 14,
            backgroundColor: colors.surfaceMuted,
            borderWidth: 1,
            borderColor: `${colors.primary}30`,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
                numberOfLines={1}
              >
                {matchedTemplate.templateName}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {matchedTemplate.exerciseCount} exercises • {matchedTemplate.matchReason}
              </Text>
            </View>
            <Pressable
              onPress={() => onEditTemplate(matchedTemplate.templateId)}
              style={({ pressed }) => ({
                padding: 8,
                borderRadius: 8,
                backgroundColor: pressed ? colors.surface : "transparent",
              })}
            >
              <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => onStartTemplate(matchedTemplate.templateId)}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text
              style={{
                color: colors.surface,
                fontFamily: fontFamilies.semibold,
                fontSize: 16,
              }}
            >
              Start workout
            </Text>
          </Pressable>
        </View>
      ) : (
        // No matching template - show generation options
        <View style={{ gap: 10 }}>
          <View
            style={{
              padding: 14,
              borderRadius: 14,
              backgroundColor: colors.surfaceMuted,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
              No saved {recommendedSplit.label.toLowerCase()} template found.{" "}
              {isPro || canGenerateFree
                ? "Generate a smart workout or create your own."
                : "Create one or upgrade to generate smart workouts."}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            {/* Generate smart workout button */}
            <Pressable
              onPress={() => {
                if (canGenerateAI || isPro) {
                  onGenerate(recommendedSplit.splitKey);
                } else {
                  onUpgrade();
                }
              }}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: isPro || canGenerateFree ? colors.primary : colors.surfaceMuted,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: isPro || canGenerateFree ? 0 : 1,
                borderColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              })}
            >
              {!isPro && (
                <View
                  style={{
                    backgroundColor: canGenerateFree ? "#0B1220" : colors.primary,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      color: canGenerateFree ? colors.primary : "#0B1220",
                      fontSize: 9,
                      fontWeight: "700",
                    }}
                  >
                    {canGenerateFree ? "1 FREE" : "PRO"}
                  </Text>
                </View>
              )}
              <Text
                style={{
                  color: isPro || canGenerateFree ? colors.surface : colors.primary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
              >
                Generate
              </Text>
            </Pressable>

            {/* Create manually button */}
            <Pressable
              onPress={onCreate}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 20,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
              >
                Create
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Reasoning footer */}
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 12,
          textAlign: "center",
          marginTop: 4,
        }}
      >
        {reasoning}
      </Text>
    </View>
  );
};

export default UpNextCard;
