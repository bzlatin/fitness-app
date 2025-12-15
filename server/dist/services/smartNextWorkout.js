"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recommendSmartNextWorkout = exports.canonicalPreferredSplit = exports.normalizeSplitKey = void 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const uniq = (items) => Array.from(new Set(items));
const normalizeSplitKey = (value) => {
    const raw = (value ?? '').toLowerCase().trim();
    if (!raw)
        return undefined;
    if (raw.includes('push'))
        return 'push';
    if (raw.includes('pull'))
        return 'pull';
    if (raw.includes('leg'))
        return 'legs';
    if (raw.includes('upper'))
        return 'upper';
    if (raw.includes('lower'))
        return 'lower';
    if (raw.includes('full'))
        return 'full_body';
    if (raw.includes('chest'))
        return 'chest';
    if (raw.includes('back'))
        return 'back';
    if (raw.includes('shoulder'))
        return 'shoulders';
    if (raw.includes('arm'))
        return 'arms';
    return raw.replace(/\s+/g, '_');
};
exports.normalizeSplitKey = normalizeSplitKey;
const canonicalPreferredSplit = (preferredSplit) => {
    const raw = (preferredSplit ?? '').toLowerCase().trim();
    if (!raw)
        return 'full_body';
    if (raw === 'push_pull_legs' || raw === 'ppl')
        return 'ppl';
    if (raw === 'upper_lower')
        return 'upper_lower';
    if (raw === 'full_body')
        return 'full_body';
    if (raw === 'custom')
        return 'custom';
    return raw;
};
exports.canonicalPreferredSplit = canonicalPreferredSplit;
const splitLabel = (splitKey) => {
    const map = {
        push: 'Push',
        pull: 'Pull',
        legs: 'Legs',
        upper: 'Upper',
        lower: 'Lower',
        full_body: 'Full Body',
        chest: 'Chest',
        back: 'Back',
        shoulders: 'Shoulders',
        arms: 'Arms',
    };
    return map[splitKey] ?? splitKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
const splitPrimaryMuscles = (splitKey) => {
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
const splitCycleFromPreferred = (preferredSplit) => {
    switch (preferredSplit) {
        case 'ppl':
            return ['push', 'pull', 'legs'];
        case 'upper_lower':
            return ['upper', 'lower'];
        case 'full_body':
            return ['full_body'];
        default:
            return [];
    }
};
const averageFatigueScore = (fatigue, muscles) => {
    if (!fatigue || muscles.length === 0)
        return 95;
    const byMuscle = new Map(fatigue.perMuscle.map((m) => [m.muscleGroup, m.fatigueScore]));
    const scores = muscles.map((m) => byMuscle.get(m) ?? 95);
    return scores.reduce((a, b) => a + b, 0) / scores.length;
};
const countRecentSameSplit = (recentWorkouts, splitKey) => {
    return recentWorkouts
        .slice(0, 3)
        .filter((w) => (0, exports.normalizeSplitKey)(w.splitType) === splitKey).length;
};
const nextInCycle = (cycle, lastSplit) => {
    if (cycle.length === 0)
        return undefined;
    if (cycle.length === 1)
        return cycle[0];
    const last = (0, exports.normalizeSplitKey)(lastSplit);
    if (!last)
        return cycle[0];
    const lastIndex = cycle.findIndex((split) => split === last);
    if (lastIndex === -1)
        return cycle[0];
    return cycle[(lastIndex + 1) % cycle.length];
};
const previousInCycle = (cycle, lastSplit) => {
    if (cycle.length === 0)
        return undefined;
    if (cycle.length === 1)
        return cycle[0];
    const last = (0, exports.normalizeSplitKey)(lastSplit);
    if (!last)
        return cycle[cycle.length - 1];
    const lastIndex = cycle.findIndex((split) => split === last);
    if (lastIndex === -1)
        return cycle[cycle.length - 1];
    return cycle[(lastIndex - 1 + cycle.length) % cycle.length];
};
const fallbackCandidatesForCustom = (fatigue) => {
    if (!fatigue)
        return ['full_body', 'upper', 'lower'];
    const byMuscle = new Map(fatigue.perMuscle.map((m) => [m.muscleGroup, m]));
    const legsFatigued = (byMuscle.get('legs')?.fatigued ?? false) || (byMuscle.get('glutes')?.fatigued ?? false);
    const upperFatigued = (byMuscle.get('chest')?.fatigued ?? false) ||
        (byMuscle.get('back')?.fatigued ?? false) ||
        (byMuscle.get('shoulders')?.fatigued ?? false);
    if (legsFatigued && !upperFatigued)
        return ['upper', 'full_body', 'pull'];
    if (upperFatigued && !legsFatigued)
        return ['lower', 'full_body', 'legs'];
    return ['full_body', 'upper', 'lower'];
};
const recommendSmartNextWorkout = (params) => {
    const preferredSplit = (0, exports.canonicalPreferredSplit)(params.preferredSplit);
    const cycle = splitCycleFromPreferred(preferredSplit);
    const lastSplit = params.recentWorkouts[0]?.splitType;
    const cycleNext = nextInCycle(cycle, lastSplit);
    const cyclePrev = previousInCycle(cycle, lastSplit);
    const baseCandidates = cycle.length > 0
        ? uniq([cycleNext, cyclePrev, ...cycle].filter(Boolean))
        : fallbackCandidatesForCustom(params.fatigue);
    const avoidMuscles = (params.overrides?.avoidMuscles ?? []).map((m) => m.toLowerCase());
    const sessionDuration = params.overrides?.sessionDuration;
    const candidates = baseCandidates.slice(0, 5).map((splitKey) => {
        const primaryMuscles = splitPrimaryMuscles(splitKey);
        const avgFatigue = averageFatigueScore(params.fatigue, primaryMuscles);
        const avoidHits = avoidMuscles.filter((m) => primaryMuscles.includes(m));
        const avoidPenalty = avoidHits.length * 18;
        const onCycleBonus = cycleNext && splitKey === cycleNext ? 18 : 0;
        const repetitionPenalty = countRecentSameSplit(params.recentWorkouts, splitKey) * 6;
        const fatiguePenalty = avgFatigue >= 140 ? 26 : avgFatigue >= 125 ? 16 : avgFatigue >= 110 ? 8 : avgFatigue <= 80 ? -8 : 0;
        const timeBias = sessionDuration && sessionDuration <= 30
            ? splitKey === 'full_body'
                ? 6
                : splitKey === 'upper' || splitKey === 'lower'
                    ? -6
                    : 0
            : 0;
        const score = 100 + onCycleBonus + timeBias - repetitionPenalty - avoidPenalty - fatiguePenalty;
        const tags = [];
        if (onCycleBonus > 0)
            tags.push('On-cycle');
        if (avoidHits.length > 0)
            tags.push(`Avoids ${avoidHits.slice(0, 2).join(' & ')}`);
        if (avgFatigue >= 125)
            tags.push('High fatigue risk');
        else if (avgFatigue <= 80)
            tags.push('Fresh');
        if (sessionDuration && sessionDuration <= 30)
            tags.push('Quick');
        const reasonParts = [];
        if (onCycleBonus > 0)
            reasonParts.push('Next in your split');
        if (avoidHits.length > 0)
            reasonParts.push(`Less stress on ${avoidHits.slice(0, 2).join(' & ')}`);
        if (avgFatigue >= 125)
            reasonParts.push('Adjusted for recovery');
        else if (avgFatigue <= 80)
            reasonParts.push('Good recovery window');
        if (sessionDuration && sessionDuration <= 30)
            reasonParts.push('Fits a short session');
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
    };
};
exports.recommendSmartNextWorkout = recommendSmartNextWorkout;
