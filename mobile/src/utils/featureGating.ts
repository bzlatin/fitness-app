import { User } from "../types/user";

export const FREE_TEMPLATE_LIMIT = 3;

export function canCreateAnotherTemplate(
  user: User | null,
  currentTemplateCount: number,
  options?: { hasProAccess?: boolean }
): boolean {
  const hasPro =
    options?.hasProAccess ??
    (user?.plan === "pro" || user?.plan === "lifetime");
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
  const isGrace = normalizedStatus === "in_grace_period";
  const isExpired =
    normalizedStatus === "expired" || normalizedStatus === "revoked";
  const plan = subscriptionStatus?.plan ?? user?.plan;

  const hasPlan = plan === "pro" || plan === "lifetime";
  return hasPlan && !isGrace && !isExpired;
}

export function isPro(user: User | null): boolean {
  return user?.plan === "pro" || user?.plan === "lifetime";
}
