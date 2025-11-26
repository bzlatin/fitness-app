import Stripe from "stripe";
import { query } from "../db";
import { generateId } from "../utils/id";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_LOOKUP_MONTHLY = process.env.STRIPE_PRICE_LOOKUP_MONTHLY;
const PRICE_LOOKUP_ANNUAL = process.env.STRIPE_PRICE_LOOKUP_ANNUAL;

if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set. Please add it to your .env.");
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export type BillingPlan = "monthly" | "annual";

export const resolvePriceId = (plan: BillingPlan) => {
  if (plan === "monthly" && PRICE_LOOKUP_MONTHLY) return PRICE_LOOKUP_MONTHLY;
  if (plan === "annual" && PRICE_LOOKUP_ANNUAL) return PRICE_LOOKUP_ANNUAL;
  throw new Error(
    `Missing Stripe price lookup key for ${plan}. Set STRIPE_PRICE_LOOKUP_MONTHLY and STRIPE_PRICE_LOOKUP_ANNUAL in .env.`
  );
};

type UserBillingRow = {
  email: string | null;
  name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  apple_original_transaction_id: string | null;
  apple_subscription_id: string | null;
  subscription_platform: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  plan: string | null;
  plan_expires_at: string | null;
};

export const fetchUserBilling = async (userId: string) => {
  const result = await query<UserBillingRow>(
    `
      SELECT email,
             name,
             stripe_customer_id,
             stripe_subscription_id,
             apple_original_transaction_id,
             apple_subscription_id,
             subscription_platform,
             trial_started_at,
             trial_ends_at,
             plan,
             plan_expires_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  if (!result.rowCount) {
    throw new Error("User not found");
  }
  return result.rows[0];
};

export const ensureStripeCustomer = async (userId: string) => {
  const user = await fetchUserBilling(userId);

  if (user.stripe_customer_id) {
    return {
      customerId: user.stripe_customer_id,
      email: user.email,
      name: user.name,
      currentSubscriptionId: user.stripe_subscription_id ?? undefined,
      trialStartedAt: user.trial_started_at ?? undefined,
      trialEndsAt: user.trial_ends_at ?? undefined,
      subscriptionPlatform: user.subscription_platform ?? undefined,
      appleOriginalTransactionId: user.apple_original_transaction_id ?? undefined,
    };
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { userId },
  });

  await query(
    `
      UPDATE users
      SET stripe_customer_id = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [userId, customer.id]
  );

  return {
    customerId: customer.id,
    email: customer.email ?? undefined,
    name: customer.name ?? undefined,
    currentSubscriptionId: undefined,
    trialStartedAt: undefined,
    trialEndsAt: undefined,
    subscriptionPlatform: user.subscription_platform ?? undefined,
    appleOriginalTransactionId: user.apple_original_transaction_id ?? undefined,
  };
};

export const recordSubscriptionEvent = async (
  userId: string,
  eventType: string,
  stripeEventId: string,
  payload: unknown
) => {
  await query(
    `
      INSERT INTO subscription_events (id, user_id, event_type, stripe_event_id, payload, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (stripe_event_id) DO NOTHING
    `,
    [generateId(), userId, eventType, stripeEventId, payload]
  );
};
