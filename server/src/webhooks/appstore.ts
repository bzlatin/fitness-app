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

const stripBase64Padding = (value: string) => value.replace(/=+$/g, "");

const base64ToBase64Url = (value: string) =>
  stripBase64Padding(value).replace(/\+/g, "-").replace(/\//g, "_");

const extractSignatureCandidates = (header: string) => {
  const raw = header.trim();
  if (!raw) return [];

  // Accept common patterns:
  // - "sha256=<sig>"
  // - "<sig>"
  // - "t=...,v1=<sig>" (stripe-style)
  // - comma/semicolon separated lists
  const parts = raw.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
  const candidates: string[] = [];

  for (const part of parts) {
    const withoutPrefix = part.replace(/^sha256=/i, "").trim();
    if (withoutPrefix) candidates.push(withoutPrefix);

    const eqIdx = part.indexOf("=");
    if (eqIdx >= 0 && eqIdx < part.length - 1) {
      const afterEq = part.slice(eqIdx + 1).trim();
      if (afterEq) candidates.push(afterEq);
    }
  }

  return Array.from(new Set(candidates.map((c) => c.trim()).filter(Boolean)));
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

  const providedCandidates = extractSignatureCandidates(header);
  if (providedCandidates.length === 0) {
    return { ok: false as const, status: 401, error: "Missing signature value" };
  }

  const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const computedBase64 = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("base64");
  const computedBase64NoPad = stripBase64Padding(computedBase64);
  const computedBase64Url = base64ToBase64Url(computedBase64);
  const computedHex = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");

  const matches = providedCandidates.some((provided) => {
    const normalized = provided.replace(/^sha256=/i, "").trim();
    const normalizedHex = /^[0-9a-fA-F]+$/.test(normalized)
      ? normalized.toLowerCase()
      : normalized;

    return (
      timingSafeEqual(normalized, computedBase64) ||
      timingSafeEqual(normalized, computedBase64NoPad) ||
      timingSafeEqual(normalized, computedBase64Url) ||
      timingSafeEqual(normalizedHex, computedHex)
    );
  });

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
