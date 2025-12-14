import { apiClient } from "./client";

export type PlanChoice = "monthly" | "annual";

export type SubscriptionStatus = {
  status: string;
  plan: string;
  planExpiresAt?: string | null;
  trialEndsAt?: number | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: number | null;
  currentInterval?: "monthly" | "annual" | null;
  subscriptionPlatform?: "apple" | null;
  appleOriginalTransactionId?: string | null;
  appleEnvironment?: string | null;
};

export const getSubscriptionStatus = async () => {
  const { data } = await apiClient.get<SubscriptionStatus>("/subscriptions/status");
  return data;
};

export const validateIosReceipt = async (payload: { transactionId: string }) => {
  const { data } = await apiClient.post<{
    status: string;
    plan: string;
    planExpiresAt?: string | null;
    originalTransactionId?: string;
    transactionId?: string;
    environment?: string;
    currentInterval?: "monthly" | "annual" | null;
  }>("/subscriptions/ios/validate-receipt", payload);
  return data;
};

export const getIosSubscriptionStatus = async () => {
  const { data } = await apiClient.get<{
    status: string;
    plan: string;
    planExpiresAt?: string | null;
    originalTransactionId?: string;
    transactionId?: string;
    environment?: string;
    currentInterval?: "monthly" | "annual" | null;
  }>("/subscriptions/ios/status");
  return data;
};
