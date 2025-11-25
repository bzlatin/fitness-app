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
