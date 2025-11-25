import { apiClient } from "./client";

export type PlanChoice = "monthly" | "annual";

export type SubscriptionStatus = {
  status: string;
  plan: string;
  planExpiresAt?: string | null;
  trialEndsAt?: number | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: number | null;
  stripeSubscriptionId?: string | null;
  currentPriceLookupKey?: string | null;
  currentInterval?: "monthly" | "annual" | null;
  subscriptionPlatform?: "stripe" | "apple" | null;
  appleOriginalTransactionId?: string | null;
  appleEnvironment?: string | null;
};

export type CheckoutSessionPayload = {
  plan: PlanChoice;
};

export const createCheckoutSession = async (payload: CheckoutSessionPayload) => {
  const { data } = await apiClient.post<{
    customerId: string;
    customerEphemeralKeySecret: string;
    paymentIntentClientSecret?: string;
    setupIntentClientSecret?: string;
    subscriptionId: string;
    publishableKey?: string;
  }>("/subscriptions/create-checkout-session", payload);
  return data;
};

export const getSubscriptionStatus = async () => {
  const { data } = await apiClient.get<SubscriptionStatus>("/subscriptions/status");
  return data;
};

export const cancelSubscription = async () => {
  const { data } = await apiClient.post<{
    status: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: number | null;
  }>("/subscriptions/cancel");
  return data;
};

export const createBillingPortalSession = async (returnUrl?: string) => {
  const { data } = await apiClient.post<{ url: string }>("/subscriptions/billing-portal", {
    returnUrl,
  });
  return data;
};

export const switchSubscriptionPlan = async (plan: PlanChoice) => {
  const { data } = await apiClient.post<{
    status: string;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: number | null;
    currentPriceLookupKey?: string | null;
    currentInterval?: PlanChoice | null;
  }>("/subscriptions/switch", { plan });
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
  }>("/subscriptions/ios/status");
  return data;
};
