import { Pressable, Switch, Text, View } from "react-native";
import { colors } from "../../theme/colors";
import { fontFamilies, typography } from "../../theme/typography";
import { TrainingSplit, TRAINING_SPLIT_LABELS } from "../../types/onboarding";

interface TrainingStyleStepProps {
  selectedSplit?: TrainingSplit;
  onSplitChange: (split: TrainingSplit) => void;
  isPro: boolean;
  rirEnabled: boolean;
  onRirChange: (value: boolean) => void;
}

const SPLIT_DESCRIPTIONS: Record<TrainingSplit, string> = {
  push_pull_legs: "Split workouts into push, pull, and leg days (3-6x/week)",
  upper_lower: "Alternate between upper and lower body (2-4x/week)",
  ppl_upper_lower: "Push, pull, legs, then upper and lower days (4-6x/week)",
  arnold_split: "Chest/Back, Bi/Tri/Shoulders, Legs (3-6x/week)",
  full_body: "Train all major muscle groups each session (2-3x/week)",
  custom: "Create your own training split",
};

const TrainingStyleStep = ({
  selectedSplit,
  onSplitChange,
  isPro,
  rirEnabled,
  onRirChange,
}: TrainingStyleStepProps) => {
  const splits: TrainingSplit[] = [
    "push_pull_legs",
    "ppl_upper_lower",
    "upper_lower",
    "arnold_split",
    "full_body",
    "custom",
  ];

  return (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        <Text style={{ ...typography.heading1, color: colors.textPrimary }}>
          Choose your training split
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          This determines how you'll organize your workouts throughout the week.
        </Text>
      </View>

      <View style={{ gap: 12 }}>
        {splits.map((split) => {
          const isSelected = selectedSplit === split;
          return (
            <Pressable
              key={split}
              onPress={() => onSplitChange(split)}
              style={({ pressed }) => ({
                padding: 16,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? `${colors.primary}15` : colors.surfaceMuted,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary : "transparent",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSelected && (
                    <View
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: colors.surface,
                      }}
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontFamily: fontFamilies.semibold,
                      fontSize: 16,
                    }}
                  >
                    {TRAINING_SPLIT_LABELS[split]}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      marginTop: 2,
                    }}
                  >
                    {SPLIT_DESCRIPTIONS[split]}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: `${colors.secondary}15`,
          borderWidth: 1,
          borderColor: `${colors.secondary}30`,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 15,
              }}
            >
              Smart Progressive Overload
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: colors.primary,
              }}
            >
              <Text
                style={{
                  color: '#0B1220',
                  fontSize: 11,
                  fontFamily: fontFamilies.bold,
                }}
              >
                PRO
              </Text>
            </View>
          </View>
          {!isPro && (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.primary + '20',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16 }}>🔒</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          Pro-only: we'll analyze your performance and suggest weight increases when you're ready to progress. You can enable or disable this in settings anytime.
        </Text>
      </View>

      <View
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: `${colors.primary}12`,
          borderWidth: 1,
          borderColor: `${colors.primary}30`,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                color: colors.textPrimary,
                fontFamily: fontFamilies.semibold,
                fontSize: 15,
              }}
            >
              Track RIR
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: colors.primary,
              }}
            >
              <Text
                style={{
                  color: "#0B1220",
                  fontSize: 11,
                  fontFamily: fontFamilies.bold,
                }}
              >
                PRO
              </Text>
            </View>
          </View>
          {isPro ? (
            <Switch
              value={rirEnabled}
              onValueChange={onRirChange}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor={rirEnabled ? "#fff" : "#f4f3f4"}
            />
          ) : (
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.primary + "20",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16 }}>🔒</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          Log reps in reserve per set. Keep this on to see RIR inputs during workouts.
        </Text>
      </View>

      <View
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: `${colors.primary}15`,
          borderWidth: 1,
          borderColor: `${colors.primary}30`,
        }}
      >
        <Text
          style={{
            color: colors.textPrimary,
            fontFamily: fontFamilies.semibold,
            fontSize: 15,
            marginBottom: 4,
          }}
        >
          You're almost done!
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>
          After completing this step, we'll personalize your workout experience based on your preferences.
        </Text>
      </View>
    </View>
  );
};

export default TrainingStyleStep;
