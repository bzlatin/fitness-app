import { MuscleFatigue } from "../types/analytics";
import { colors } from "../theme/colors";

const clamp = (val: number, min: number, max: number) =>
  Math.min(Math.max(val, min), max);

// Legacy status colors - kept for backward compatibility if needed
export const fatigueStatusColors: Record<MuscleFatigue["status"], string> = {
  "high-fatigue": "#ef4444",
  "moderate-fatigue": "#f97316",
  optimal: "#22c55e",
  "under-trained": "#38bdf8",
  "no-data": colors.textSecondary,
};

/**
 * Generates a red-based gradient color based on readiness percentage
 * Lower readiness (more fatigued) = brighter red
 * Higher readiness (less fatigued) = lighter pink/white
 */
export const getReadinessColor = (readinessPercent: number): string => {
  const percent = clamp(readinessPercent, 0, 100);

  if (percent <= 25) {
    // 0-25%: Bright red (very fatigued) - interpolate from #ff0000 to #ff3333
    const ratio = percent / 25;
    const r = 255;
    const g = Math.round(ratio * 51);
    const b = Math.round(ratio * 51);
    return `rgba(${r}, ${g}, ${b}, ${0.9 + ratio * 0.1})`;
  } else if (percent <= 50) {
    // 25-50%: Medium red (moderately fatigued) - interpolate from #ff3333 to #ff6666
    const ratio = (percent - 25) / 25;
    const r = 255;
    const g = Math.round(51 + ratio * 51);
    const b = Math.round(51 + ratio * 51);
    return `rgba(${r}, ${g}, ${b}, ${0.85 - ratio * 0.1})`;
  } else if (percent <= 75) {
    // 50-75%: Light red/pink (slightly fatigued) - interpolate from #ff6666 to #ffb3b3
    const ratio = (percent - 50) / 25;
    const r = 255;
    const g = Math.round(102 + ratio * 77);
    const b = Math.round(102 + ratio * 77);
    return `rgba(${r}, ${g}, ${b}, ${0.75 - ratio * 0.15})`;
  } else {
    // 75-100%: Very light pink/white (fresh) - interpolate from #ffb3b3 to #ffe6e6
    const ratio = (percent - 75) / 25;
    const r = 255;
    const g = Math.round(179 + ratio * 51);
    const b = Math.round(179 + ratio * 51);
    return `rgba(${r}, ${g}, ${b}, ${0.6 - ratio * 0.2})`;
  }
};

export const readinessFromFatigueScore = (score: number) => {
  const percent = Math.round(clamp(120 - (score - 70) * 1.2, 0, 100));
  const label =
    percent >= 85
      ? "Fresh"
      : percent >= 65
      ? "Ready"
      : percent >= 45
      ? "Caution"
      : "Fatigued";

  // Use new gradient color based on readiness percentage
  const color = getReadinessColor(percent);

  return { percent, label, color };
};
