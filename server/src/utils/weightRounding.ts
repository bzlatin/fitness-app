export type DumbbellRoundDirection = 'nearest' | 'up' | 'down';

const STANDARD_DUMBBELL_WEIGHTS_LB = [
  5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25,
];

export const isDumbbellEquipment = (equipment?: string | null) =>
  typeof equipment === 'string' &&
  equipment.toLowerCase().includes('dumbbell');

export const roundToStandardDumbbellWeight = (
  value: number,
  direction: DumbbellRoundDirection
) => {
  if (!Number.isFinite(value)) return value;
  if (value <= STANDARD_DUMBBELL_WEIGHTS_LB[0]) {
    return STANDARD_DUMBBELL_WEIGHTS_LB[0];
  }

  const maxBase =
    STANDARD_DUMBBELL_WEIGHTS_LB[STANDARD_DUMBBELL_WEIGHTS_LB.length - 1];
  if (value <= maxBase) {
    if (direction === 'up') {
      return (
        STANDARD_DUMBBELL_WEIGHTS_LB.find((weight) => weight >= value) ?? maxBase
      );
    }
    if (direction === 'down') {
      const candidates = STANDARD_DUMBBELL_WEIGHTS_LB.filter(
        (weight) => weight <= value
      );
      return candidates[candidates.length - 1] ?? STANDARD_DUMBBELL_WEIGHTS_LB[0];
    }
    return STANDARD_DUMBBELL_WEIGHTS_LB.reduce((closest, weight) =>
      Math.abs(weight - value) < Math.abs(closest - value) ? weight : closest
    );
  }

  const increment = 5;
  if (direction === 'up') {
    return Math.ceil(value / increment) * increment;
  }
  if (direction === 'down') {
    return Math.floor(value / increment) * increment;
  }
  return Math.round(value / increment) * increment;
};
