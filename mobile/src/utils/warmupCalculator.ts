import { WarmupSetPreferences } from '../types/gym';

export type WarmupSetSpec = {
  targetWeight: number;
  targetReps: number;
  percentage: number;
};

const roundToIncrement = (value: number, increment: number) => {
  if (!Number.isFinite(value)) return value;
  if (!Number.isFinite(increment) || increment <= 0) return value;
  return Math.round(value / increment) * increment;
};

export const calculateWarmupSets = (
  workingWeight: number,
  workingReps?: number,
  preferences?: WarmupSetPreferences
): WarmupSetSpec[] => {
  if (!Number.isFinite(workingWeight) || workingWeight <= 0) return [];
  const numSets = Math.max(0, Math.min(6, Math.trunc(preferences?.numSets ?? 2)));
  if (numSets === 0) return [];

  const normalizedReps =
    typeof workingReps === 'number' && Number.isFinite(workingReps) && workingReps > 0
      ? Math.round(workingReps)
      : undefined;
  const startPercentage = preferences?.startPercentage ?? 50;
  const incrementPercentage = preferences?.incrementPercentage ?? 15;
  const increments = 2.5;
  const repOptions = [
    normalizedReps ? Math.min(8, normalizedReps) : 8,
    normalizedReps ? Math.min(5, Math.max(3, normalizedReps - 3)) : 5,
    2,
    1,
    1,
    1,
  ];

  const seen = new Set<number>();
  const specs: WarmupSetSpec[] = [];

  for (let index = 0; index < numSets; index += 1) {
    const percentage = (startPercentage + incrementPercentage * index) / 100;
    const normalizedPercentage = Math.min(0.95, Math.max(0.2, percentage));
    const rawWeight = workingWeight * normalizedPercentage;
    const rounded = roundToIncrement(rawWeight, increments);
    const targetWeight = Math.max(increments, Math.min(rounded, workingWeight - increments));
    if (targetWeight >= workingWeight) continue;
    if (seen.has(targetWeight)) continue;
    seen.add(targetWeight);

    const fallbackReps =
      normalizedReps !== undefined ? Math.max(1, normalizedReps - index * 2) : 6;
    const targetReps = repOptions[index] ?? fallbackReps;

    specs.push({
      targetWeight,
      targetReps,
      percentage: normalizedPercentage,
    });
  }

  return specs;
};
