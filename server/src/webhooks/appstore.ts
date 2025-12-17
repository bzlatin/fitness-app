import express from "express";
import crypto from "crypto";
import {
  decodeNotificationSecure,
  findUserByOriginalTransaction,
  fetchSubscriptionStatus,
  recordNotification,
  upsertAppleSubscription,
} from "../services/appstore";
import { query } from "../db";

const router = express.Router();

type RawBodyRequest = express.Request & { rawBody?: Buffer };

const parseJsonWithRawBody = express.json({
  limit: "2mb",
  verify: (req, _res, buf) => {
    (req as RawBodyRequest).rawBody = buf;
  },
});

const timingSafeEqual = (a: string, b: string) => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const maybeVerifyAppStoreConnectSignature = (req: RawBodyRequest) => {
  const secret = process.env.APPSTORE_WEBHOOK_SECRET?.trim();
  if (!secret) return { ok: true as const };

  const header =
    req.get("x-apple-signature") ??
    req.get("x-apple-webhook-signature") ??
    req.get("x-signature") ??
    "";
  if (!header)
    return {
      ok: false as const,
      status: 401,
      error: "Missing signature header",
    };

  const provided = header.replace(/^sha256=/i, "").trim();
  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const computedBase64 = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("base64");
  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");

  const matches =
    timingSafeEqual(provided, computedBase64) ||
    timingSafeEqual(provided, computedHex) ||
    timingSafeEqual(provided, `sha256=${computedBase64}`) ||
    timingSafeEqual(provided, `sha256=${computedHex}`);

  if (!matches)
    return { ok: false as const, status: 401, error: "Invalid signature" };
  return { ok: true as const };
};

router.post("/", parseJsonWithRawBody, async (req, res) => {
  const body = req.body as Record<string, unknown> | undefined;
  const signedPayload =
    (body?.signedPayload as string | undefined) ?? undefined;

  try {
    // 1) App Store Server Notifications v2 (StoreKit) - uses `signedPayload`.
    if (signedPayload) {
      const { payload, transaction, renewalInfo } =
        await decodeNotificationSecure(signedPayload);
      const notificationType: string =
        (payload as { notificationType?: string } | null)?.notificationType ??
        "UNKNOWN";
      const originalTransactionId: string | undefined =
        transaction?.originalTransactionId ??
        renewalInfo?.originalTransactionId ??
        (payload as { data?: { originalTransactionId?: string } })?.data
          ?.originalTransactionId ??
        undefined;

      let userId: string | null = null;
      if (originalTransactionId) {
        userId = await findUserByOriginalTransaction(originalTransactionId);
        if (userId && transaction) {
          await upsertAppleSubscription(
            userId,
            transaction,
            renewalInfo ?? undefined
          );
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
              await upsertAppleSubscription(
                userId,
                transaction,
                renewalInfo ?? undefined
              );
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
        console.error(
          "Failed to reconcile App Store notification",
          notificationType,
          handlerError
        );
      }

      await recordNotification({
        userId,
        notificationType,
        transactionId: transaction?.transactionId,
        originalTransactionId,
        payload,
      });

      return res.json({ received: true });
    }

    // 2) App Store Connect Webhooks (build status, TestFlight feedback, etc).
    // These do not include `signedPayload`. We acknowledge quickly so deliveries show as succeeded.
    const signatureCheck = maybeVerifyAppStoreConnectSignature(
      req as RawBodyRequest
    );
    if (!signatureCheck.ok) {
      return res
        .status(signatureCheck.status)
        .json({ error: signatureCheck.error });
    }

    // eslint-disable-next-line no-console
    console.log("[AppStoreConnectWebhook] Received event", {
      keys: body ? Object.keys(body) : [],
    });
    return res.json({ received: true });
  } catch (err) {
    console.error("Failed to handle App Store notification", err);
    return res
      .status(500)
      .json({ error: "Failed to process App Store notification" });
  }
});

export default router;
