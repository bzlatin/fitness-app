import { Router } from "express";
import Stripe from "stripe";
import { stripe, resolvePriceId, ensureStripeCustomer, fetchUserBilling, BillingPlan } from "../services/stripe";
import { fetchSubscriptionStatus as fetchAppleSubscriptionStatus, validateAndActivate } from "../services/appstore";
import { query } from "../db";
import { generateId } from "../utils/id";

const router = Router();

type StatusResponse = {
  status: string;
  plan: string;
  planExpiresAt?: string | null;
  trialEndsAt?: number | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: number | null;
  stripeSubscriptionId?: string | null;
  currentPriceLookupKey?: string | null;
  currentInterval?: BillingPlan | null;
  subscriptionPlatform?: "stripe" | "apple" | null;
  appleOriginalTransactionId?: string | null;
  appleEnvironment?: string | null;
};

const getSubscriptionPlanDetails = (subscription: Stripe.Subscription) => {
  const firstItem = subscription.items.data[0];
  const lookupKey = firstItem?.price?.lookup_key ?? null;
  const interval = (firstItem?.price?.recurring?.interval ?? null) as Stripe.Price.Recurring.Interval | string | null;
  const mappedInterval: BillingPlan | null =
    interval === "year" || interval === "yearly" || interval === "annual"
      ? "annual"
      : interval === "month" || interval === "monthly"
      ? "monthly"
      : null;
  return {
    lookupKey,
    interval: mappedInterval,
  };
};

router.get("/status", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const billing = await fetchUserBilling(userId);
    const baseStatus: StatusResponse = {
      status: "free",
      plan: billing.plan ?? "free",
      planExpiresAt: billing.plan_expires_at,
      subscriptionPlatform: billing.subscription_platform as StatusResponse["subscriptionPlatform"],
      appleOriginalTransactionId: billing.apple_original_transaction_id,
      appleEnvironment: null,
    };

    if (
      (billing.subscription_platform === "apple" || billing.apple_original_transaction_id) &&
      billing.apple_original_transaction_id
    ) {
      try {
        const appleStatus = await fetchAppleSubscriptionStatus(billing.apple_original_transaction_id);
        if (appleStatus?.status) {
          const statusPayload: StatusResponse = {
            ...baseStatus,
            status: appleStatus.status.status,
            plan: appleStatus.status.plan,
            planExpiresAt: appleStatus.status.planExpiresAt ?? billing.plan_expires_at,
            subscriptionPlatform: "apple",
            appleOriginalTransactionId: billing.apple_original_transaction_id,
            appleEnvironment: appleStatus.status.environment,
            currentInterval: appleStatus.status.interval ?? null,
          };
          return res.json(statusPayload);
        }
      } catch (err) {
        console.error("Failed to fetch Apple subscription status", err);
      }
    }

    if (billing.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(
        billing.stripe_subscription_id,
        {
          expand: ["latest_invoice.payment_intent"],
        }
      );
      const trialEndsAt =
        subscription.trial_end !== null && subscription.trial_end !== undefined
          ? subscription.trial_end
          : billing.trial_ends_at
          ? Math.floor(new Date(billing.trial_ends_at).getTime() / 1000)
          : null;
      const planMeta = getSubscriptionPlanDetails(subscription);
      const stripeStatus: StatusResponse = {
        status: subscription.status,
        plan: subscription.status === "active" || subscription.status === "trialing" ? "pro" : "free",
        planExpiresAt: billing.plan_expires_at,
        trialEndsAt,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? undefined,
        currentPeriodEnd: subscription.current_period_end ?? null,
        stripeSubscriptionId: subscription.id,
        currentPriceLookupKey: planMeta.lookupKey,
        currentInterval: planMeta.interval,
        subscriptionPlatform: "stripe",
        appleEnvironment: null,
      };
      return res.json(stripeStatus);
    }

    return res.json(baseStatus);
  } catch (err) {
    console.error("Failed to fetch subscription status", err);
    return res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

router.post("/create-checkout-session", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const plan = (req.body?.plan ?? "monthly") as BillingPlan;
  if (plan !== "monthly" && plan !== "annual") {
    return res.status(400).json({ error: "Invalid plan" });
  }

  try {
    const priceId = resolvePriceId(plan);
    const billing = await ensureStripeCustomer(userId);
    if (billing.subscriptionPlatform === "apple" || billing.appleOriginalTransactionId) {
      return res
        .status(400)
        .json({ error: "Manage iOS subscriptions through Apple. Cancel on your device first." });
    }
    const shouldApplyTrial = !billing.currentSubscriptionId && !billing.trialStartedAt;

    const subscription = await stripe.subscriptions.create({
      customer: billing.customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      trial_period_days: shouldApplyTrial ? 7 : undefined,
      metadata: {
        userId,
        plan,
      },
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
    });

    const latestInvoice = subscription.latest_invoice;
    const paymentIntent =
      typeof latestInvoice === "string"
        ? null
        : (latestInvoice?.payment_intent as Stripe.PaymentIntent | null);
    const setupIntent =
      typeof subscription.pending_setup_intent === "string"
        ? null
        : ((subscription.pending_setup_intent as Stripe.SetupIntent | null) ?? null);

    if (!paymentIntent?.client_secret && !setupIntent?.client_secret) {
      return res.status(500).json({ error: "Missing payment intent or setup intent for subscription" });
    }

    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: billing.customerId },
      { apiVersion: "2023-10-16" }
    );

    await query(
      `
        UPDATE users
        SET stripe_subscription_id = $2,
            trial_started_at = COALESCE(trial_started_at, $3),
            trial_ends_at = COALESCE(trial_ends_at, $4),
            subscription_platform = 'stripe',
            updated_at = NOW()
        WHERE id = $1
      `,
      [
        userId,
        subscription.id,
        subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      ]
    );

    return res.json({
      customerId: billing.customerId,
      customerEphemeralKeySecret: ephemeralKey.secret,
      paymentIntentClientSecret: paymentIntent?.client_secret,
      setupIntentClientSecret: setupIntent?.client_secret,
      subscriptionId: subscription.id,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  } catch (err) {
    console.error("Failed to create checkout session", err);
    return res.status(500).json({ error: "Failed to start checkout" });
  }
});

router.post("/cancel", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const billing = await fetchUserBilling(userId);
    if (billing.subscription_platform === "apple") {
      return res.status(400).json({
        error:
          "Subscriptions purchased via Apple must be managed in your iOS settings. Use Manage Subscription on your device.",
      });
    }
    if (!billing.stripe_subscription_id) {
      return res.status(400).json({ error: "No active subscription to cancel" });
    }

    const subscription = await stripe.subscriptions.update(billing.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    await query(
      `
        UPDATE users
        SET plan_expires_at = to_timestamp($2),
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId, subscription.current_period_end ?? null]
    );

    return res.json({
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.current_period_end,
    });
  } catch (err) {
    console.error("Failed to cancel subscription", err);
    return res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

router.post("/billing-portal", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const returnUrl =
    req.body?.returnUrl ??
    process.env.BILLING_PORTAL_RETURN_URL ??
    "https://example.com/billing-return";

  try {
    const billing = await ensureStripeCustomer(userId);
    if (billing.subscriptionPlatform === "apple" || billing.appleOriginalTransactionId) {
      return res.status(400).json({
        error:
          "Apple subscriptions are managed in the App Store. Open your iOS subscription settings to update billing.",
      });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: billing.customerId,
      return_url: returnUrl,
    });

    await query(
      `
        INSERT INTO subscription_events (id, user_id, event_type, stripe_event_id, payload, created_at)
        VALUES ($1, $2, $3, NULL, $4, NOW())
      `,
      [generateId(), userId, "billing_portal.session.created", session]
    );

    return res.json({ url: session.url });
  } catch (err) {
    console.error("Failed to create billing portal session", err);
    return res.status(500).json({ error: "Failed to create billing portal session" });
  }
});

router.post("/switch", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const plan = (req.body?.plan ?? "monthly") as BillingPlan;
  if (plan !== "monthly" && plan !== "annual") {
    return res.status(400).json({ error: "Invalid plan" });
  }

  try {
    const billing = await fetchUserBilling(userId);
    if (billing.subscription_platform === "apple" || billing.apple_original_transaction_id) {
      return res
        .status(400)
        .json({ error: "Switch plans from your Apple subscription in Settings on iOS." });
    }
    if (!billing.stripe_subscription_id) {
      return res
        .status(400)
        .json({ error: "No active subscription to switch. Start a subscription first." });
    }

    const priceId = resolvePriceId(plan);
    const subscription = await stripe.subscriptions.retrieve(billing.stripe_subscription_id, {
      expand: ["items"],
    });
    const item = subscription.items.data[0];
    if (!item?.id) {
      return res.status(500).json({ error: "Subscription item missing" });
    }

    const updated = await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: item.id,
          price: priceId,
        },
      ],
      proration_behavior: "create_prorations",
    });

    const planMeta = getSubscriptionPlanDetails(updated);
    await query(
      `
        UPDATE users
        SET plan = 'pro',
            plan_expires_at = to_timestamp($2),
            subscription_platform = 'stripe',
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId, updated.current_period_end ?? null]
    );

    return res.json({
      status: updated.status,
      cancelAtPeriodEnd: updated.cancel_at_period_end ?? undefined,
      currentPeriodEnd: updated.current_period_end ?? null,
      currentPriceLookupKey: planMeta.lookupKey,
      currentInterval: planMeta.interval,
    });
  } catch (err) {
    console.error("Failed to switch subscription", err);
    return res.status(500).json({ error: "Failed to switch subscription" });
  }
});

router.post("/ios/validate-receipt", async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const transactionId = req.body?.transactionId as string | undefined;
  if (!transactionId) {
    return res.status(400).json({ error: "transactionId is required" });
  }

  try {
    const status = await validateAndActivate(userId, transactionId);
    return res.json({
      status: status.status,
      plan: status.plan,
      planExpiresAt: status.planExpiresAt,
      originalTransactionId: status.originalTransactionId,
      transactionId: status.transactionId,
      environment: status.environment,
      currentInterval: status.interval ?? null,
    });
  } catch (err) {
    console.error("Failed to validate Apple receipt", err);
    return res.status(500).json({ error: "Failed to validate receipt with Apple" });
  }
});

router.get("/ios/status", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const billing = await fetchUserBilling(userId);
    if (!billing.apple_original_transaction_id) {
      return res.status(404).json({ error: "No Apple subscription found for this user" });
    }

    const status = await fetchAppleSubscriptionStatus(billing.apple_original_transaction_id);
    if (!status || !status.status) {
      return res.status(404).json({ error: "No Apple subscription status available" });
    }
    const statusInfo = status.status;

    return res.json({
      status: statusInfo.status,
      plan: statusInfo.plan,
      planExpiresAt: statusInfo.planExpiresAt,
      originalTransactionId: statusInfo.originalTransactionId,
      transactionId: statusInfo.transactionId,
      environment: statusInfo.environment,
      currentInterval: statusInfo.interval ?? null,
    });
  } catch (err) {
    console.error("Failed to fetch Apple subscription status", err);
    return res.status(500).json({ error: "Failed to fetch Apple subscription status" });
  }
});

export default router;
