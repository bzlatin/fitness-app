import { Router } from "express";
import { fetchSubscriptionStatus as fetchAppleSubscriptionStatus, validateAndActivate } from "../services/appstore";
import { z } from "zod";
import { validateBody } from "../middleware/validate";
import { subscriptionWriteLimiter } from "../middleware/rateLimit";
import { fetchUserBilling } from "../services/billing";

const router = Router();

const validateReceiptSchema = z
  .object({
    transactionId: z.string().trim().min(1).max(512),
  })
  .strip();

type StatusResponse = {
  status: string;
  plan: string;
  planExpiresAt?: string | null;
  trialEndsAt?: number | null;
  currentInterval?: "monthly" | "annual" | null;
  subscriptionPlatform?: "apple" | null;
  appleOriginalTransactionId?: string | null;
  appleEnvironment?: string | null;
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
      subscriptionPlatform: billing.subscription_platform === "apple" ? "apple" : null,
      appleOriginalTransactionId: billing.apple_original_transaction_id,
      appleEnvironment: null,
    };

    if (
      (billing.subscription_platform === "apple" ||
        billing.apple_original_transaction_id) &&
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

    return res.json(baseStatus);
  } catch (err) {
    console.error("Failed to fetch subscription status", err);
    return res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

router.post("/ios/validate-receipt", subscriptionWriteLimiter, validateBody(validateReceiptSchema), async (req, res) => {
  const userId = res.locals.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const transactionId = req.body.transactionId;

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
