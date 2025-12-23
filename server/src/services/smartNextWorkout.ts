import { FatigueResult } from './fatigue';
import {
  buildCanonicalMuscleStats,
  normalizeMuscleGroup,
  READINESS_BLOCKED_THRESHOLD,
  READINESS_FRESH_THRESHOLD,
  READINESS_HIGH_THRESHOLD,
} from './muscleReadiness';
import { RecentWorkout } from './ai/AIProvider.interface';

export type SmartNextWorkoutCandidate = {
  splitKey: string;
  label: string;
  tags: string[];
  reason: string;
  score: number;
};

export type SmartNextWorkoutRecommendation = {
  preferredSplit: string;
  selected: SmartNextWorkoutCandidate;
  alternates: SmartNextWorkoutCandidate[];
  restRecommended: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const uniq = <T,>(items: T[]) => Array.from(new Set(items));

export const normalizeSplitKey = (value?: string | null) => {
  const raw = (value ?? '').toLowerCase().trim();
  if (!raw) return undefined;

  if (raw.includes('chest') && raw.includes('back')) return 'chest_back';
  const hasArmGroup =
    raw.includes('arm') ||
    raw.includes('bicep') ||
    raw.includes('tricep') ||
    raw.includes('bi') ||
    raw.includes('tri');
  const hasShoulders = raw.includes('shoulder') || raw.includes('delt');
  if (hasArmGroup && hasShoulders) return 'arms_shoulders';
  if (raw.includes('push')) return 'push';
  if (raw.includes('pull')) return 'pull';
  if (raw.includes('leg')) return 'legs';
  if (raw.includes('upper')) return 'upper';
  if (raw.includes('lower')) return 'lower';
  if (raw.includes('full')) return 'full_body';
  if (raw.includes('chest')) return 'chest';
  if (raw.includes('back')) return 'back';
  if (raw.includes('shoulder')) return 'shoulders';
  if (raw.includes('arm')) return 'arms';

  return raw.replace(/\s+/g, '_');
};

export const canonicalPreferredSplit = (preferredSplit?: string | null) => {
  const raw = (preferredSplit ?? '').toLowerCase().trim();
  if (!raw) return 'full_body';

  if (raw === 'push_pull_legs' || raw === 'ppl') return 'ppl';
  if (raw === 'ppl_upper_lower' || raw === 'ppl_upper/lower') return 'ppl_upper_lower';
  if (raw === 'arnold' || raw === 'arnold_split' || raw === 'arnold split') {
    return 'arnold_split';
  }
  if (raw === 'upper_lower') return 'upper_lower';
  if (raw === 'full_body') return 'full_body';
  if (raw === 'custom') return 'custom';

  return raw;
};

const splitLabel = (splitKey: string) => {
  const map: Record<string, string> = {
    push: 'Push',
    pull: 'Pull',
    legs: 'Legs',
    upper: 'Upper',
    lower: 'Lower',
    full_body: 'Full Body',
    chest_back: 'Chest/Back',
    arms_shoulders: 'Arms/Shoulders',
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    arms: 'Arms',
  };
  return map[splitKey] ?? splitKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const splitPrimaryMuscles = (splitKey: string): string[] => {
  switch (splitKey) {
    case 'push':
      return ['chest', 'shoulders', 'triceps'];
    case 'pull':
      return ['back', 'biceps'];
    case 'legs':
    case 'lower':
      return ['legs', 'glutes', 'core'];
    case 'upper':
      return ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
    case 'full_body':
      return ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'glutes', 'core'];
    case 'chest_back':
      return ['chest', 'back', 'biceps'];
    case 'arms_shoulders':
      return ['shoulders', 'biceps', 'triceps'];
    case 'chest':
      return ['chest', 'triceps', 'shoulders'];
    case 'back':
      return ['back', 'biceps'];
    case 'shoulders':
      return ['shoulders', 'triceps'];
    case 'arms':
      return ['biceps', 'triceps'];
    default:
      return [];
  }
};

const splitFocusMuscles = (splitKey: string): string[] => {
  switch (splitKey) {
    case 'push':
      return ['chest', 'shoulders'];
    case 'pull':
      return ['back'];
    case 'legs':
    case 'lower':
      return ['legs', 'glutes'];
    case 'upper':
      return ['chest', 'back', 'shoulders'];
    case 'full_body':
      return ['chest', 'back', 'legs', 'glutes'];
    case 'chest_back':
      return ['chest', 'back'];
    case 'arms_shoulders':
      return ['biceps', 'triceps', 'shoulders'];
    case 'chest':
      return ['chest'];
    case 'back':
      return ['back'];
    case 'shoulders':
      return ['shoulders'];
    case 'arms':
      return ['biceps', 'triceps'];
    default:
      return [];
  }
};

const getMuscleReadiness = (
  stats: Map<string, { readiness: number }>,
  muscles: string[]
) => {
  if (muscles.length === 0) {
    return { minReadiness: 100, avgReadiness: 100, readyCount: 0, blockedCount: 0, totalCount: 0 };
  }
  const readinessValues = muscles
    .map((muscle) => stats.get(normalizeMuscleGroup(muscle))?.readiness)
    .filter((value): value is number => typeof value === 'number');
  if (readinessValues.length === 0) {
    return { minReadiness: 100, avgReadiness: 100, readyCount: 0, blockedCount: 0, totalCount: 0 };
  }
  const total = readinessValues.reduce((sum, value) => sum + value, 0);
  const readyCount = readinessValues.filter((value) => value >= 70).length;
  const blockedCount = readinessValues.filter((value) => value <= READINESS_BLOCKED_THRESHOLD).length;
  return {
    minReadiness: Math.min(...readinessValues),
    avgReadiness: total / readinessValues.length,
    readyCount,
    blockedCount,
    totalCount: readinessValues.length,
  };
};

const splitCycleFromPreferred = (preferredSplit: string): string[] => {
  switch (preferredSplit) {
    case 'ppl':
      return ['push', 'pull', 'legs'];
    case 'ppl_upper_lower':
      return ['push', 'pull', 'legs', 'upper', 'lower'];
    case 'arnold_split':
      return ['chest_back', 'arms_shoulders', 'legs'];
    case 'upper_lower':
      return ['upper', 'lower'];
    case 'full_body':
      return ['full_body'];
    default:
      return [];
  }
};

const normalizeRecentSplit = (workout?: RecentWorkout) =>
  normalizeSplitKey(workout?.splitType ?? workout?.templateName);

const countRecentSameSplit = (recentWorkouts: RecentWorkout[], splitKey: string) => {
  return recentWorkouts
    .slice(0, 3)
    .filter((w) => normalizeRecentSplit(w) === splitKey).length;
};

const nextInCycle = (cycle: string[], lastSplit?: string) => {
  if (cycle.length === 0) return undefined;
  if (cycle.length === 1) return cycle[0];

  const last = normalizeSplitKey(lastSplit);
  if (!last) return cycle[0];

  const lastIndex = cycle.findIndex((split) => split === last);
  if (lastIndex === -1) return cycle[0];
  return cycle[(lastIndex + 1) % cycle.length];
};

const previousInCycle = (cycle: string[], lastSplit?: string) => {
  if (cycle.length === 0) return undefined;
  if (cycle.length === 1) return cycle[0];

  const last = normalizeSplitKey(lastSplit);
  if (!last) return cycle[cycle.length - 1];

  const lastIndex = cycle.findIndex((split) => split === last);
  if (lastIndex === -1) return cycle[cycle.length - 1];
  return cycle[(lastIndex - 1 + cycle.length) % cycle.length];
};

const fallbackCandidatesForCustom = (fatigue: FatigueResult | null): string[] => {
  if (!fatigue) return ['full_body', 'upper', 'lower'];

  const stats = buildCanonicalMuscleStats(fatigue);
  const legsReadiness = Math.min(
    stats.get('legs')?.readiness ?? 100,
    stats.get('glutes')?.readiness ?? 100
  );
  const upperReadiness = Math.min(
    stats.get('chest')?.readiness ?? 100,
    stats.get('back')?.readiness ?? 100,
    stats.get('shoulders')?.readiness ?? 100
  );
  const legsBlocked = legsReadiness <= READINESS_BLOCKED_THRESHOLD;
  const upperBlocked = upperReadiness <= READINESS_BLOCKED_THRESHOLD;

  if (legsBlocked && !upperBlocked) return ['upper', 'full_body', 'pull'];
  if (upperBlocked && !legsBlocked) return ['lower', 'full_body', 'legs'];
  return ['full_body', 'upper', 'lower'];
};

export const recommendSmartNextWorkout = (params: {
  preferredSplit?: string | null;
  recentWorkouts: RecentWorkout[];
  fatigue: FatigueResult | null;
  overrides?: {
    sessionDuration?: number;
    avoidMuscles?: string[];
  };
}): SmartNextWorkoutRecommendation => {
  const preferredSplit = canonicalPreferredSplit(params.preferredSplit);
  const cycle = splitCycleFromPreferred(preferredSplit);
  const lastSplit = normalizeRecentSplit(params.recentWorkouts[0]);
  const cycleNext = nextInCycle(cycle, lastSplit);
  const cyclePrev = previousInCycle(cycle, lastSplit);

  const baseCandidates =
    cycle.length > 0
      ? uniq([cycleNext, cyclePrev, ...cycle].filter(Boolean) as string[])
      : fallbackCandidatesForCustom(params.fatigue);

  const avoidMuscles = (params.overrides?.avoidMuscles ?? []).map((m) =>
    normalizeMuscleGroup(m)
  );
  const sessionDuration = params.overrides?.sessionDuration;
  const canonicalStats = buildCanonicalMuscleStats(params.fatigue);

  const rawCandidates = baseCandidates.slice(0, 5).map((splitKey) => {
    const primaryMuscles = splitPrimaryMuscles(splitKey);
    const focusMuscles = splitFocusMuscles(splitKey);
    const readiness = getMuscleReadiness(canonicalStats, focusMuscles);
    const avoidHits = avoidMuscles.filter((m) => primaryMuscles.includes(m));
    const isFullyBlocked =
      readiness.totalCount > 0 && readiness.blockedCount === readiness.totalCount;

    return {
      splitKey,
      primaryMuscles,
      readiness,
      avoidHits,
      isFullyBlocked,
    };
  });

  const readyCandidates = rawCandidates.filter((candidate) => !candidate.isFullyBlocked);
  const hasReadySplit = rawCandidates.some((candidate) => candidate.readiness.readyCount > 0);
  const restRecommended = !hasReadySplit;

  const candidates: SmartNextWorkoutCandidate[] = (
    readyCandidates.length > 0 ? readyCandidates : rawCandidates
  ).map((candidate) => {
    const { splitKey, primaryMuscles, readiness, avoidHits, isFullyBlocked } = candidate;
    const avoidPenalty = avoidHits.length * 18;

    const onCycleBonus = cycleNext && splitKey === cycleNext ? 18 : 0;
    const repetitionPenalty = countRecentSameSplit(params.recentWorkouts, splitKey) * 6;
    const lastSplitPenalty = lastSplit && splitKey === lastSplit ? 24 : 0;

    const readinessPenaltyBase = Math.round((100 - readiness.avgReadiness) * 0.22);
    const readinessPenalty =
      readinessPenaltyBase +
      readiness.blockedCount * 6 +
      (readiness.readyCount > 0 ? -Math.min(12, readiness.readyCount * 4) : 0) +
      (readiness.avgReadiness >= READINESS_FRESH_THRESHOLD ? -6 : 0);

    const timeBias =
      sessionDuration && sessionDuration <= 30
        ? splitKey === 'full_body'
          ? 6
          : splitKey === 'upper' || splitKey === 'lower'
            ? -6
            : 0
        : 0;

    const score =
      100 +
      onCycleBonus +
      timeBias -
      repetitionPenalty -
      lastSplitPenalty -
      avoidPenalty -
      readinessPenalty;

    const tags: string[] = [];
    if (onCycleBonus > 0) tags.push('On-cycle');
    if (avoidHits.length > 0) tags.push(`Avoids ${avoidHits.slice(0, 2).join(' & ')}`);
    if (readiness.minReadiness <= READINESS_HIGH_THRESHOLD) tags.push('High fatigue risk');
    else if (readiness.avgReadiness >= READINESS_FRESH_THRESHOLD) tags.push('Fresh');
    if (sessionDuration && sessionDuration <= 30) tags.push('Quick');
    if (readiness.readyCount > 0) tags.push('Ready focus');
    if (isFullyBlocked) tags.push('Recovery first');
    if (lastSplitPenalty > 0) tags.push('New split');

    const reasonParts: string[] = [];
    if (onCycleBonus > 0) reasonParts.push('Next in your split');
    if (avoidHits.length > 0) reasonParts.push(`Less stress on ${avoidHits.slice(0, 2).join(' & ')}`);
    if (readiness.minReadiness <= READINESS_HIGH_THRESHOLD) reasonParts.push('Adjusted for recovery');
    else if (readiness.avgReadiness >= READINESS_FRESH_THRESHOLD) reasonParts.push('Good recovery window');
    if (readiness.readyCount > 0) reasonParts.push('Uses your most recovered muscles');
    if (sessionDuration && sessionDuration <= 30) reasonParts.push('Fits a short session');
    if (isFullyBlocked) reasonParts.push('Lower fatigue stress');
    if (lastSplitPenalty > 0) reasonParts.push('Varied from your last workout');

    return {
      splitKey,
      label: splitLabel(splitKey),
      tags: tags.slice(0, 3),
      reason: reasonParts.length > 0 ? reasonParts.join(' • ') : 'Best fit for today',
      score: clamp(score, 0, 200),
    };
  });

  const sorted = candidates.sort((a, b) => b.score - a.score);
  const selected = sorted[0] ?? {
    splitKey: 'full_body',
    label: 'Full Body',
    tags: ['Fallback'],
    reason: 'Balanced default when data is limited',
    score: 80,
  };

  return {
    preferredSplit,
    selected,
    alternates: sorted.filter((c) => c.splitKey !== selected.splitKey).slice(0, 2),
    restRecommended,
  };
};
