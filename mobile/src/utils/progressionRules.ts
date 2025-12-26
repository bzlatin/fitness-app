import { FitnessGoal } from '../types/onboarding';
import { WorkoutSet } from '../types/workouts';

export type WeightUnit = 'lb' | 'kg';

export type RepRange = {
  min: number;
  max: number;
};

export type NextWeightSuggestion = {
  weight: number;
  repRange: RepRange;
  goal: FitnessGoal;
};

type DumbbellRoundDirection = 'nearest' | 'up' | 'down';

const GOAL_PRIORITY: FitnessGoal[] = [
  'strength',
  'build_muscle',
  'endurance',
  'lose_weight',
  'general_fitness',
];

const GOAL_REP_RANGES: Record<FitnessGoal, RepRange> = {
  strength: { min: 3, max: 6 },
  build_muscle: { min: 6, max: 12 },
  endurance: { min: 12, max: 20 },
  lose_weight: { min: 8, max: 15 },
  general_fitness: { min: 8, max: 12 },
};

const STANDARD_DUMBBELL_WEIGHTS_LB = [
  5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25,
];

const INCREASE_SMALL = 0.05;
const DECREASE_SMALL = 0.05;

export const resolvePrimaryGoal = (
  goals?: FitnessGoal[] | null
): FitnessGoal => {
  if (!goals || goals.length === 0) {
    return 'general_fitness';
  }
  const prioritized = GOAL_PRIORITY.find((goal) => goals.includes(goal));
  return prioritized ?? goals[0];
};

export const getRepRangeForGoal = (goal: FitnessGoal): RepRange =>
  GOAL_REP_RANGES[goal];

const roundToIncrement = (value: number, unit: WeightUnit) => {
  const increment = unit === 'kg' ? 1 : 2.5;
  if (!Number.isFinite(value)) return value;
  return Math.round(value / increment) * increment;
};

const isDumbbellEquipment = (equipment?: string) =>
  typeof equipment === 'string' &&
  equipment.toLowerCase().includes('dumbbell');

const roundToStandardDumbbellWeight = (
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

const getSetReps = (set: WorkoutSet) => {
  if (typeof set.actualReps === 'number' && set.actualReps > 0) {
    return set.actualReps;
  }
  if (typeof set.targetReps === 'number' && set.targetReps > 0) {
    return set.targetReps;
  }
  return undefined;
};

const getSetWeight = (set: WorkoutSet) => {
  if (typeof set.actualWeight === 'number' && set.actualWeight > 0) {
    return set.actualWeight;
  }
  if (typeof set.targetWeight === 'number' && set.targetWeight > 0) {
    return set.targetWeight;
  }
  return undefined;
};

export const calculateNextWeightSuggestion = ({
  workingSets,
  goal,
  unit = 'lb',
  fallbackWeight,
  equipment,
}: {
  workingSets: WorkoutSet[];
  goal: FitnessGoal;
  unit?: WeightUnit;
  fallbackWeight?: number;
  equipment?: string;
}): NextWeightSuggestion | null => {
  if (!workingSets.length) return null;

  const repRange = getRepRangeForGoal(goal);
  const reps = workingSets
    .map(getSetReps)
    .filter((value): value is number => value !== undefined);
  if (reps.length === 0) return null;

  const weights = workingSets
    .map(getSetWeight)
    .filter((value): value is number => value !== undefined);
  const workingWeight =
    weights.length > 0 ? Math.max(...weights) : fallbackWeight;
  if (!workingWeight || !Number.isFinite(workingWeight) || workingWeight <= 0) {
    return null;
  }

  const minReps = Math.min(...reps);
  const maxReps = Math.max(...reps);
  let suggestedWeight = workingWeight;

  if (minReps >= repRange.max + 3) {
    const bump =
      goal === 'endurance' ? INCREASE_SMALL : INCREASE_SMALL * 2;
    suggestedWeight = workingWeight * (1 + bump);
  } else if (minReps >= repRange.max && maxReps <= repRange.max + 2) {
    suggestedWeight = workingWeight * (1 + INCREASE_SMALL);
  } else if (
    goal === 'lose_weight' &&
    maxReps > repRange.max &&
    minReps >= repRange.min
  ) {
    suggestedWeight = workingWeight * (1 + INCREASE_SMALL);
  } else if (minReps < repRange.min - 2) {
    suggestedWeight = workingWeight * (1 - DECREASE_SMALL);
  }

  const direction: DumbbellRoundDirection =
    suggestedWeight > workingWeight
      ? 'up'
      : suggestedWeight < workingWeight
      ? 'down'
      : 'nearest';
  const rounded =
    unit === 'lb' && isDumbbellEquipment(equipment)
      ? roundToStandardDumbbellWeight(suggestedWeight, direction)
      : roundToIncrement(suggestedWeight, unit);
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return null;
  }

  return {
    weight: rounded,
    repRange,
    goal,
  };
};
