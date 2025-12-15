import { User } from '../types/user';

export const FREE_TEMPLATE_LIMIT = 3;
export const FREE_AI_WORKOUT_GENERATION_LIMIT = 1;

export function canCreateAnotherTemplate(
  user: User | null,
  currentTemplateCount: number,
  options?: { hasProAccess?: boolean }
): boolean {
  const hasPro =
    options?.hasProAccess ??
    (user?.plan === 'pro' || user?.plan === 'lifetime');
  if (hasPro) {
    return true;
  }

  return currentTemplateCount < FREE_TEMPLATE_LIMIT;
}

export function hasProAccess(
  user: User | null,
  subscriptionStatus?: { status?: string | null; plan?: string | null }
): boolean {
  const normalizedStatus = subscriptionStatus?.status
    ?.toLowerCase()
    .trim() as string | undefined;
  const isGrace = normalizedStatus === 'in_grace_period';
  const isExpired =
    normalizedStatus === 'expired' || normalizedStatus === 'revoked';
  const plan = subscriptionStatus?.plan ?? user?.plan;

  const hasPlan = plan === 'pro' || plan === 'lifetime';
  return hasPlan && !isGrace && !isExpired;
}

export function isPro(user: User | null): boolean {
  return user?.plan === 'pro' || user?.plan === 'lifetime';
}

export function getAiWorkoutGenerationsUsed(user: User | null): number {
  return Math.max(0, Number(user?.aiGenerationsUsedCount ?? 0));
}

export function getAiWorkoutGenerationsRemaining(
  user: User | null,
  options?: { hasProAccess?: boolean }
): number {
  const isLifetime = user?.plan === 'lifetime';
  if (isLifetime) return Number.POSITIVE_INFINITY;

  const isProPlan = user?.plan === 'pro';
  const expiresAtRaw = user?.planExpiresAt ?? null;
  const expiresAtMs = expiresAtRaw ? Date.parse(expiresAtRaw) : Number.NaN;
  const hasValidExpiry = Number.isFinite(expiresAtMs);
  const isExpired = hasValidExpiry && expiresAtMs < Date.now();

  const hasPro =
    options?.hasProAccess ??
    (isProPlan ? !isExpired : false);
  if (hasPro) return Number.POSITIVE_INFINITY;

  // If the profile says the user is Pro but access isn't active (expired/grace),
  // don't grant the free-tier AI trial.
  if (isProPlan) return 0;

  return Math.max(0, FREE_AI_WORKOUT_GENERATION_LIMIT - getAiWorkoutGenerationsUsed(user));
}

export function canGenerateAiWorkout(
  user: User | null,
  options?: { hasProAccess?: boolean }
): boolean {
  return getAiWorkoutGenerationsRemaining(user, options) > 0;
}
