import { Router } from "express";
import Stripe from "stripe";
import { stripe, resolvePriceId, ensureStripeCustomer, fetchUserBilling, BillingPlan } from "../services/stripe";
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
};

router.get("/status", async (_req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const billing = await fetchUserBilling(userId);
    let stripeStatus: StatusResponse = {
      status: "free",
      plan: billing.plan ?? "free",
      planExpiresAt: billing.plan_expires_at,
    };

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
      stripeStatus = {
        status: subscription.status,
        plan: subscription.status === "active" || subscription.status === "trialing" ? "pro" : "free",
        planExpiresAt: billing.plan_expires_at,
        trialEndsAt,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? undefined,
        currentPeriodEnd: subscription.current_period_end ?? null,
        stripeSubscriptionId: subscription.id,
      };
    }

    return res.json(stripeStatus);
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

export default router;
