import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
  Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../theme/colors";
import { fontFamilies } from "../theme/typography";

export type ProgressionSuggestion = {
  exerciseId: string;
  exerciseName: string;
  currentWeight: number;
  suggestedWeight: number;
  increment: number;
  reason: string;
  confidence: "high" | "medium" | "low";
};

export type ProgressionData = {
  templateId: string;
  templateName: string;
  hasSignificantData: boolean;
  suggestions: ProgressionSuggestion[];
  readyForProgression: boolean;
};

type ProgressionSuggestionModalProps = {
  visible: boolean;
  data: ProgressionData | null;
  onClose: () => void;
  onApplyAll: () => void;
  onApplySelected: (exerciseIds: string[]) => void;
  isApplying?: boolean;
  progressiveOverloadEnabled?: boolean;
  onToggleProgressiveOverload?: (enabled: boolean) => void;
  isUpdatingPreference?: boolean;
  isPro?: boolean;
  onUpgrade?: () => void;
};

const ProgressionSuggestionModal = ({
  visible,
  data,
  onClose,
  onApplyAll,
  onApplySelected,
  isApplying = false,
  progressiveOverloadEnabled = true,
  onToggleProgressiveOverload,
  isUpdatingPreference = false,
  isPro = true,
  onUpgrade,
}: ProgressionSuggestionModalProps) => {
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(
    new Set()
  );
  const [progressionEnabled, setProgressionEnabled] = useState(
    progressiveOverloadEnabled
  );

  useEffect(() => {
    setProgressionEnabled(progressiveOverloadEnabled);
  }, [progressiveOverloadEnabled]);

  if (!data) return null;

  const toggleExercise = (exerciseId: string) => {
    const newSet = new Set(selectedExercises);
    if (newSet.has(exerciseId)) {
      newSet.delete(exerciseId);
    } else {
      newSet.add(exerciseId);
    }
    setSelectedExercises(newSet);
  };

  const selectAll = () => {
    const allIds = new Set(
      data.suggestions
        .filter((s) => s.increment > 0)
        .map((s) => s.exerciseId)
    );
    setSelectedExercises(allIds);
  };

  const deselectAll = () => {
    setSelectedExercises(new Set());
  };

  const handleToggleProgression = (next: boolean) => {
    setProgressionEnabled(next);
    onToggleProgressiveOverload?.(next);
  };

  const handleApply = () => {
    if (selectedExercises.size === 0) {
      onApplyAll();
    } else {
      onApplySelected(Array.from(selectedExercises));
    }
  };

  const weightedSuggestions = data.suggestions.filter((s) => s.increment > 0);
  const bodyweightSuggestions = data.suggestions.filter((s) => s.increment === 0);
  const hasWeightedSuggestions = weightedSuggestions.length > 0;
  const hasBodyweightSuggestions = bodyweightSuggestions.length > 0;

  const confidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return colors.primary;
      case "medium":
        return colors.secondary;
      case "low":
        return colors.textSecondary;
      default:
        return colors.textSecondary;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={onClose}
          style={{ flex: 1 }}
          disabled={isApplying}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: "85%",
            borderWidth: 1,
            borderColor: colors.border,
            position: "relative",
          }}
        >
          {/* Free user overlay */}
          {!isPro && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(11, 18, 32, 0.97)",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                zIndex: 10,
                padding: 24,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: colors.primary + "20",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Ionicons name="lock-closed" size={32} color={colors.primary} />
              </View>
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: 24,
                  fontFamily: fontFamilies.bold,
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                Progressive Overload
              </Text>
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 15,
                  lineHeight: 22,
                  textAlign: "center",
                  marginBottom: 24,
                  paddingHorizontal: 20,
                }}
              >
                Get smart weight progression suggestions based on your training history. Upgrade to Pro to unlock this feature.
              </Text>
              <View
                style={{
                  backgroundColor: colors.surfaceMuted,
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  width: "100%",
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                    marginBottom: 12,
                  }}
                >
                  What you'll get:
                </Text>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, flex: 1 }}>
                      Smart weight progression tracking
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, flex: 1 }}>
                      Personalized load recommendations
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    <Text style={{ color: colors.textSecondary, flex: 1 }}>
                      Auto-apply increases to workouts
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  onClose();
                  onUpgrade?.();
                }}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  paddingVertical: 16,
                  paddingHorizontal: 32,
                  borderRadius: 14,
                  width: "100%",
                  alignItems: "center",
                  marginBottom: 12,
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.surface,
                    fontFamily: fontFamilies.bold,
                    fontSize: 16,
                  }}
                >
                  Upgrade to Pro
                </Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  paddingVertical: 12,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Maybe Later
                </Text>
              </Pressable>
            </View>
          )}

          {/* Header with gradient */}
          <LinearGradient
            colors={["rgba(34, 197, 94, 0.15)", "transparent"]}
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingHorizontal: 20,
              paddingBottom: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${colors.primary}20`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="trending-up" size={22} color={colors.primary} />
                </View>
                <View>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: 20,
                      fontFamily: fontFamilies.bold,
                    }}
                  >
                    Ready to Progress
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {data.templateName}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={onClose}
                disabled={isApplying}
                style={({ pressed }) => ({
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: pressed
                    ? colors.surfaceMuted
                    : "transparent",
                  opacity: isApplying ? 0.5 : 1,
                })}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>

            {/* Info banner */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: `${colors.primary}15`,
                borderRadius: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: `${colors.primary}30`,
              }}
            >
              <Ionicons
                name="information-circle"
                size={20}
                color={colors.primary}
              />
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 12,
                  flex: 1,
                  lineHeight: 16,
                }}
              >
                Based on your last 3 sessions, you're ready to increase weight
              </Text>
            </View>
          </LinearGradient>

          {/* Suggestions list */}
          <ScrollView
            style={{
              paddingHorizontal: 20,
              paddingTop: 16,
            }}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {hasWeightedSuggestions && (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      fontFamily: fontFamilies.semibold,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Weight Progressions
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={selectAll}
                      disabled={isApplying}
                      style={({ pressed }) => ({
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: pressed
                          ? colors.surfaceMuted
                          : "transparent",
                        opacity: isApplying ? 0.5 : 1,
                      })}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 11,
                          fontFamily: fontFamilies.semibold,
                        }}
                      >
                        Select all
                      </Text>
                    </Pressable>
                    {selectedExercises.size > 0 && (
                      <Pressable
                        onPress={deselectAll}
                        disabled={isApplying}
                        style={({ pressed }) => ({
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor: pressed
                            ? colors.surfaceMuted
                            : "transparent",
                          opacity: isApplying ? 0.5 : 1,
                        })}
                      >
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 11,
                            fontFamily: fontFamilies.semibold,
                          }}
                        >
                          Clear
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {weightedSuggestions.map((suggestion, index) => {
                  const isSelected = selectedExercises.has(
                    suggestion.exerciseId
                  );
                  return (
                    <Pressable
                      key={suggestion.exerciseId}
                      onPress={() => toggleExercise(suggestion.exerciseId)}
                      disabled={isApplying}
                      style={({ pressed }) => ({
                        marginBottom: 12,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        backgroundColor: isSelected
                          ? `${colors.primary}10`
                          : colors.surfaceMuted,
                        padding: 16,
                        opacity: pressed || isApplying ? 0.8 : 1,
                      })}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        {/* Checkbox */}
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: isSelected
                              ? colors.primary
                              : colors.border,
                            backgroundColor: isSelected
                              ? colors.primary
                              : "transparent",
                            alignItems: "center",
                            justifyContent: "center",
                            marginTop: 2,
                          }}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color={colors.surface}
                            />
                          )}
                        </View>

                        {/* Exercise info */}
                        <View style={{ flex: 1 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 6,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.textPrimary,
                                fontSize: 16,
                                fontFamily: fontFamilies.semibold,
                                flex: 1,
                              }}
                            >
                              {suggestion.exerciseName}
                            </Text>
                            <View
                              style={{
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                backgroundColor: `${confidenceColor(suggestion.confidence)}20`,
                              }}
                            >
                              <Text
                                style={{
                                  color: confidenceColor(suggestion.confidence),
                                  fontSize: 10,
                                  fontFamily: fontFamilies.bold,
                                  textTransform: "uppercase",
                                  letterSpacing: 0.5,
                                }}
                              >
                                {suggestion.confidence}
                              </Text>
                            </View>
                          </View>

                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: 12,
                              marginBottom: 10,
                              lineHeight: 16,
                            }}
                          >
                            {suggestion.reason}
                          </Text>

                          {/* Weight change visualization */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <View style={{ alignItems: "center" }}>
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  fontSize: 10,
                                  marginBottom: 2,
                                }}
                              >
                                Current
                              </Text>
                              <Text
                                style={{
                                  color: colors.textPrimary,
                                  fontSize: 18,
                                  fontFamily: fontFamilies.bold,
                                }}
                              >
                                {suggestion.currentWeight}
                                <Text style={{ fontSize: 12 }}>lb</Text>
                              </Text>
                            </View>

                            <Ionicons
                              name="arrow-forward"
                              size={16}
                              color={colors.primary}
                            />

                            <View style={{ alignItems: "center" }}>
                              <Text
                                style={{
                                  color: colors.textSecondary,
                                  fontSize: 10,
                                  marginBottom: 2,
                                }}
                              >
                                Suggested
                              </Text>
                              <Text
                                style={{
                                  color: colors.primary,
                                  fontSize: 18,
                                  fontFamily: fontFamilies.bold,
                                }}
                              >
                                {suggestion.suggestedWeight}
                                <Text style={{ fontSize: 12 }}>lb</Text>
                              </Text>
                            </View>

                            <View
                              style={{
                                marginLeft: "auto",
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: `${colors.primary}15`,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.primary,
                                  fontSize: 14,
                                  fontFamily: fontFamilies.bold,
                                }}
                              >
                                +{suggestion.increment}lb
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            )}

            {hasBodyweightSuggestions && (
              <>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontFamily: fontFamilies.semibold,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginTop: hasWeightedSuggestions ? 8 : 0,
                    marginBottom: 12,
                  }}
                >
                  Rep Progressions
                </Text>

                {bodyweightSuggestions.map((suggestion) => (
                  <View
                    key={suggestion.exerciseId}
                    style={{
                      marginBottom: 12,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                      padding: 16,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <Ionicons
                        name="body"
                        size={18}
                        color={colors.secondary}
                      />
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 16,
                          fontFamily: fontFamilies.semibold,
                          flex: 1,
                        }}
                      >
                        {suggestion.exerciseName}
                      </Text>
                      <View
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          backgroundColor: `${colors.secondary}20`,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.secondary,
                            fontSize: 10,
                            fontFamily: fontFamilies.bold,
                            textTransform: "uppercase",
                          }}
                        >
                          BODYWEIGHT
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        lineHeight: 16,
                      }}
                    >
                      {suggestion.reason}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </ScrollView>

          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: colors.surfaceMuted,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontFamily: fontFamilies.semibold,
                  }}
                >
                  Progressive overload updates
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginTop: 2,
                    lineHeight: 16,
                  }}
                >
                  Turn these suggestions on or off. If you disable them, we'll stop showing this pop up.
                </Text>
              </View>
              <Switch
                value={progressionEnabled}
                disabled={isApplying || isUpdatingPreference}
                onValueChange={handleToggleProgression}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={progressionEnabled ? "#fff" : "#f4f3f4"}
              />
            </View>
          </View>

          {/* Action buttons */}
          <View
            style={{
              padding: 20,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              gap: 10,
            }}
          >
            <Pressable
              onPress={handleApply}
              disabled={isApplying}
              style={({ pressed }) => ({
                paddingVertical: 16,
                borderRadius: 14,
                backgroundColor: colors.primary,
                alignItems: "center",
                opacity: pressed || isApplying ? 0.9 : 1,
              })}
            >
              {isApplying ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={colors.surface}
                  />
                  <Text
                    style={{
                      color: colors.surface,
                      fontFamily: fontFamilies.bold,
                      fontSize: 16,
                    }}
                  >
                    {selectedExercises.size > 0
                      ? `Apply Selected & Start (${selectedExercises.size})`
                      : "Apply All & Start Workout"}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={onClose}
              disabled={isApplying}
              style={({ pressed }) => ({
                paddingVertical: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed
                  ? colors.surfaceMuted
                  : "transparent",
                alignItems: "center",
                opacity: isApplying ? 0.5 : 1,
              })}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontFamily: fontFamilies.semibold,
                  fontSize: 15,
                }}
              >
                Maybe Later (Start without changes)
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ProgressionSuggestionModal;
