import express from "express";
import Stripe from "stripe";
import { stripe, recordSubscriptionEvent } from "../services/stripe";
import { query } from "../db";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET is not set. Please add it to your .env.");
}

const router = express.Router();

const findUserIdByCustomer = async (customerId: string) => {
  const result = await query<{ id: string }>(
    `SELECT id FROM users WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId]
  );
  return result.rows[0]?.id;
};

const updateUserPlanFromSubscription = async (userId: string, subscription: Stripe.Subscription) => {
  const isActive = subscription.status === "active" || subscription.status === "trialing";
  const planExpiresAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;

  await query(
    `
      UPDATE users
      SET plan = COALESCE($2, plan),
          plan_expires_at = $3,
          stripe_subscription_id = $4,
          trial_started_at = COALESCE(trial_started_at, $5),
          trial_ends_at = COALESCE(trial_ends_at, $6),
          subscription_platform = 'stripe',
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      userId,
      isActive ? "pro" : null,
      planExpiresAt,
      subscription.id,
      subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
      subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    ]
  );
};

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).send("Missing Stripe signature");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Invalid Stripe signature", err);
      return res.status(400).send("Invalid signature");
    }

    const handleWithUser = async (customerId: string, handler: (userId: string) => Promise<void>) => {
      const userId = await findUserIdByCustomer(customerId);
      if (!userId) return;
      await handler(userId);
      await recordSubscriptionEvent(userId, event.type, event.id, event);
    };

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;
          await handleWithUser(customerId, async (userId) => {
            await updateUserPlanFromSubscription(userId, subscription);
            if (event.type === "customer.subscription.deleted") {
              await query(
                `
                  UPDATE users
                  SET plan = 'free',
                      plan_expires_at = NULL,
                      stripe_subscription_id = NULL,
                      subscription_platform = NULL,
                      updated_at = NOW()
                  WHERE id = $1
                `,
                [userId]
              );
            }
          });
          break;
        }
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = invoice.subscription as string | null;
          const customerId = invoice.customer as string | null;
          if (customerId && subscriptionId) {
            await handleWithUser(customerId, async (userId) => {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              await updateUserPlanFromSubscription(userId, subscription);
            });
          }
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const customerId = invoice.customer as string | null;
          if (customerId) {
            await handleWithUser(customerId, async () => Promise.resolve());
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error("Error handling Stripe webhook", err);
      return res.status(500).send("Webhook handling failed");
    }

    return res.json({ received: true });
  }
);

export default router;
