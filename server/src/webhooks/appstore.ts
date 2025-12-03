import express from "express";
import {
  decodeNotification,
  findUserByOriginalTransaction,
  fetchSubscriptionStatus,
  recordNotification,
  upsertAppleSubscription,
} from "../services/appstore";
import { query } from "../db";

const router = express.Router();

router.post("/", express.json({ limit: "2mb" }), async (req, res) => {
  const signedPayload = req.body?.signedPayload as string | undefined;
  if (!signedPayload) {
    return res.status(400).json({ error: "Missing signedPayload" });
  }

  try {
    const { payload, transaction, renewalInfo } = decodeNotification(signedPayload);
    const notificationType: string =
      ((payload as { notificationType?: string } | null)?.notificationType ?? "UNKNOWN");
    const originalTransactionId =
      transaction?.originalTransactionId ??
      renewalInfo?.originalTransactionId ??
      (payload as { data?: { originalTransactionId?: string } })?.data?.originalTransactionId ??
      null;

    let userId: string | null = null;
    if (originalTransactionId) {
      userId = await findUserByOriginalTransaction(originalTransactionId);
      if (userId && transaction) {
        await upsertAppleSubscription(userId, transaction, renewalInfo ?? undefined);
      }
    }

    const syncFromStatus = async () => {
      if (!userId || !originalTransactionId) return;
      const status = await fetchSubscriptionStatus(originalTransactionId);
      if (status?.status && status.transaction) {
        await upsertAppleSubscription(
          userId,
          status.transaction,
          status.renewalInfo ?? undefined
        );
      }
    };

    const revokeSubscription = async () => {
      if (!userId) return;
      await query(
        `
          UPDATE users
          SET plan = 'free',
              plan_expires_at = NULL,
              apple_subscription_id = NULL,
              subscription_platform = 'apple',
              updated_at = NOW()
          WHERE id = $1
        `,
        [userId]
      );
    };

    // Run actions that pair with the notification type.
    try {
      switch (notificationType) {
        case "INITIAL_BUY":
        case "DID_RENEW":
        case "DID_CHANGE_RENEWAL_STATUS":
          if (transaction && userId) {
            await upsertAppleSubscription(userId, transaction, renewalInfo ?? undefined);
          } else {
            await syncFromStatus();
          }
          break;
        case "DID_FAIL_TO_RENEW":
          await syncFromStatus();
          break;
        case "EXPIRED":
        case "REFUND":
          await revokeSubscription();
          break;
        default:
          await syncFromStatus();
      }
    } catch (handlerError) {
      console.error("Failed to reconcile App Store notification", notificationType, handlerError);
    }

    await recordNotification({
      userId,
      notificationType,
      transactionId: transaction?.transactionId,
      originalTransactionId,
      payload,
    });

    return res.json({ received: true });
  } catch (err) {
    console.error("Failed to handle App Store notification", err);
    return res.status(500).json({ error: "Failed to process App Store notification" });
  }
});

export default router;
