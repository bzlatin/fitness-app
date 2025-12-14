import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { View, Text, PanResponder, PanResponderGestureState, Pressable } from "react-native";
import Body, { BodyProps } from "react-native-body-highlighter";
import { colors } from "../theme/colors";
import { fontFamilies, typography } from "../theme/typography";
import { MuscleFatigue } from "../types/analytics";
import { formatMuscleGroup } from "../utils/muscleGroupCalculations";
import { readinessFromFatigueScore } from "../utils/fatigueReadiness";

const muscleMap: Record<string, string[]> = {
  chest: ["chest"],
  back: ["upper-back", "trapezius", "lower-back"],
  shoulders: ["deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  legs: ["quadriceps", "hamstring", "calves"],
  glutes: ["gluteal"],
  core: ["abs", "obliques"],
};

const slugToMuscle = Object.entries(muscleMap).reduce<Record<string, string>>(
  (acc, [muscle, slugs]) => {
    slugs.forEach((slug) => (acc[slug] = muscle));
    return acc;
  },
  {}
);

const heatmapColors = [
  "#fef2f2", // padding color for library intensity offset
  "#fee2e2", // lightest (fresh)
  "#fecdd3",
  "#fca5a5",
  "#f87171",
  "#ef4444", // most fatigued
];

const fatigueToIntensity = (readinessPercent: number) => {
  const fatiguePercent = 100 - readinessPercent;
  const bucketCount = heatmapColors.length - 1; // skip padding color
  const bucketSize = 100 / bucketCount;
  return Math.max(1, Math.min(bucketCount, Math.ceil(fatiguePercent / bucketSize)));
};

type Props = {
  data: MuscleFatigue[];
  onSelectMuscle?: (muscleGroup: string) => void;
  side?: "front" | "back";
  gender?: "male" | "female";
  onSideChange?: (side: "front" | "back") => void;
};

const RecoveryBodyMap = ({
  data,
  onSelectMuscle,
  side,
  gender,
  onSideChange,
}: Props) => {
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [internalSide, setInternalSide] = useState<"front" | "back">("front");
  const lastPressTime = useRef<number>(0);

  useEffect(() => {
    if (side) setInternalSide(side);
  }, [side]);

  const activeSide = side ?? internalSide;
  const activeGender = gender ?? "male";

  const bodyData = useMemo(() => {
    const entries: Array<{ slug: any; intensity: number }> = [];
    data.forEach((item) => {
      // Skip muscles with no data to avoid showing them on the heatmap
      if (item.status === "no-data") return;

      const mapped = muscleMap[item.muscleGroup];
      if (!mapped) return;
      const readiness = readinessFromFatigueScore(item.fatigueScore, item.lastTrainedAt, {
        lastSessionSets: item.lastSessionSets,
        lastSessionVolume: item.lastSessionVolume,
        baselineWeeklyVolume: item.baselineVolume,
        recoveryLoad: item.recoveryLoad,
      });
      const intensity = fatigueToIntensity(readiness.percent);
      mapped.forEach((slug) =>
        entries.push({
          slug: slug as any,
          intensity,
        })
      );
    });
    return entries;
  }, [data]);

  const handlePress: BodyProps["onBodyPartPress"] = (part) => {
    // Debounce rapid clicks (library sometimes fires multiple times)
    const now = Date.now();
    if (now - lastPressTime.current < 300) {
      return;
    }
    lastPressTime.current = now;

    const slug = part?.slug;
    const baseMuscle = slug && typeof slug === "string" ? slugToMuscle[slug] ?? slug : null;
    if (!baseMuscle || typeof baseMuscle !== "string") return;

    const formattedName = formatMuscleGroup(baseMuscle);
    setSelectedLabel(formattedName);
    onSelectMuscle?.(baseMuscle);
  };

  const changeSide = useCallback((nextSide: "front" | "back") => {
    onSideChange?.(nextSide);
    if (!side) {
      setInternalSide(nextSide);
    }
  }, [onSideChange, side]);

  const swipeHandler = useCallback(
    (_: any, gestureState: PanResponderGestureState) => {
      const threshold = 24;
      if (gestureState.dx < -threshold) {
        changeSide("back");
      } else if (gestureState.dx > threshold) {
        changeSide("front");
      }
    },
    [changeSide]
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 12,
      onPanResponderRelease: swipeHandler,
      onPanResponderTerminate: swipeHandler,
    })
  ).current;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ ...typography.heading2, color: colors.textPrimary }}>
          Recovery Body Map
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          Swipe to flip front/back, then tap a muscle to see its readiness.
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 2 }}>
        {(["front", "back"] as Array<"front" | "back">).map((option) => {
          const selected = activeSide === option;
          return (
            <Pressable
              key={option}
              onPress={() => changeSide(option)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? `${colors.primary}12` : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontFamily: fontFamilies.semibold,
                  textTransform: "capitalize",
                }}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ alignItems: "center" }} {...panResponder.panHandlers}>
        <Body
          data={bodyData}
          scale={0.95}
          gender={activeGender}
          side={activeSide}
          colors={heatmapColors}
          onBodyPartPress={handlePress}
        />
      </View>
      {selectedLabel && (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: 12,
            textAlign: "center",
          }}
        >
          Selected: {selectedLabel}
        </Text>
      )}
    </View>
  );
};

export default RecoveryBodyMap;
