import express from "express";
import {
  decodeNotification,
  findUserByOriginalTransaction,
  recordNotification,
  upsertAppleSubscription,
} from "../services/appstore";

const router = express.Router();

router.post("/", express.json({ limit: "2mb" }), async (req, res) => {
  const signedPayload = req.body?.signedPayload as string | undefined;
  if (!signedPayload) {
    return res.status(400).json({ error: "Missing signedPayload" });
  }

  try {
    const { payload, transaction, renewalInfo } = decodeNotification(signedPayload);
    const originalTransactionId = transaction?.originalTransactionId;
    const notificationType = payload.notificationType ?? "UNKNOWN";

    let userId: string | null = null;
    if (originalTransactionId) {
      userId = await findUserByOriginalTransaction(originalTransactionId);
      if (userId && transaction) {
        await upsertAppleSubscription(userId, transaction, renewalInfo ?? undefined);
      }
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
