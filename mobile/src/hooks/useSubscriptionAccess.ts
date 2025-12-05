import { useQuery } from "@tanstack/react-query";
import {
  SubscriptionStatus,
  getSubscriptionStatus,
} from "../api/subscriptions";
import { useCurrentUser } from "./useCurrentUser";
import { User } from "../types/user";

const normalizeDate = (value?: number | string | null) => {
  if (!value) return null;
  const timestamp =
    typeof value === "number" && value < 2_000_000_000
      ? value * 1000
      : typeof value === "number"
      ? value
      : Date.parse(value);
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeStatus = (status?: string | null) =>
  status?.toLowerCase() ?? null;

export const computeSubscriptionAccess = (
  user: User | null,
  status?: SubscriptionStatus
) => {
  const plan = status?.plan ?? user?.plan ?? "free";
  const hasProPlan = plan === "pro" || plan === "lifetime";
  let normalizedStatus = normalizeStatus(status?.status);

  if (hasProPlan && (!normalizedStatus || normalizedStatus === "free")) {
    normalizedStatus = "active";
  }

  const isGrace = normalizedStatus === "in_grace_period";
  const isExpired =
    normalizedStatus === "expired" || normalizedStatus === "revoked";
  const isTrial =
    normalizedStatus === "trialing" || Boolean(status?.trialEndsAt);
  const hasProAccess = hasProPlan && !isGrace && !isExpired;
  const expiryDate = normalizeDate(
    status?.planExpiresAt ?? status?.currentPeriodEnd ?? null
  );

  return {
    status: normalizedStatus,
    hasProPlan,
    hasProAccess,
    isTrial,
    isGrace,
    isExpired,
    trialEndsAt: normalizeDate(status?.trialEndsAt ?? null),
    currentPeriodEnd: normalizeDate(
      status?.currentPeriodEnd ?? status?.planExpiresAt ?? null
    ),
    subscriptionPlatform: status?.subscriptionPlatform ?? null,
    appleEnvironment: status?.appleEnvironment ?? null,
    expiredOn: isExpired ? expiryDate : null,
    raw: status,
  };
};

export const useSubscriptionAccess = () => {
  const { user } = useCurrentUser();

  const statusQuery = useQuery({
    queryKey: ["subscription", "status"],
    queryFn: getSubscriptionStatus,
    staleTime: 30000,
    retry: 1,
    enabled: Boolean(user),
  });

  const derived = computeSubscriptionAccess(user, statusQuery.data);
  const hasProAccess = statusQuery.isError ? false : derived.hasProAccess;

  return {
    ...statusQuery,
    ...derived,
    hasProAccess,
  };
};
