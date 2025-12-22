"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const appstore_1 = require("../services/appstore");
const db_1 = require("../db");
const router = express_1.default.Router();
const parseJsonWithRawBody = express_1.default.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
});
const timingSafeEqual = (a, b) => {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length)
        return false;
    return crypto_1.default.timingSafeEqual(aBuf, bBuf);
};
const stripBase64Padding = (value) => value.replace(/=+$/g, "");
const base64ToBase64Url = (value) => stripBase64Padding(value).replace(/\+/g, "-").replace(/\//g, "_");
const extractSignatureCandidates = (header) => {
    const raw = header.trim();
    if (!raw)
        return [];
    // Accept common patterns:
    // - "sha256=<sig>"
    // - "<sig>"
    // - "t=...,v1=<sig>" (stripe-style)
    // - comma/semicolon separated lists
    const parts = raw.split(/[,;]+/).map((part) => part.trim()).filter(Boolean);
    const candidates = [];
    for (const part of parts) {
        const withoutPrefix = part.replace(/^sha256=/i, "").trim();
        if (withoutPrefix)
            candidates.push(withoutPrefix);
        const eqIdx = part.indexOf("=");
        if (eqIdx >= 0 && eqIdx < part.length - 1) {
            const afterEq = part.slice(eqIdx + 1).trim();
            if (afterEq)
                candidates.push(afterEq);
        }
    }
    return Array.from(new Set(candidates.map((c) => c.trim()).filter(Boolean)));
};
const maybeVerifyAppStoreConnectSignature = (req) => {
    const secret = process.env.APPSTORE_WEBHOOK_SECRET?.trim();
    if (!secret)
        return { ok: true };
    const header = req.get("x-apple-signature") ??
        req.get("x-apple-webhook-signature") ??
        req.get("x-signature") ??
        "";
    if (!header)
        return {
            ok: false,
            status: 401,
            error: "Missing signature header",
        };
    const providedCandidates = extractSignatureCandidates(header);
    if (providedCandidates.length === 0) {
        return { ok: false, status: 401, error: "Missing signature value" };
    }
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const computedBase64 = crypto_1.default
        .createHmac("sha256", secret)
        .update(raw)
        .digest("base64");
    const computedBase64NoPad = stripBase64Padding(computedBase64);
    const computedBase64Url = base64ToBase64Url(computedBase64);
    const computedHex = crypto_1.default
        .createHmac("sha256", secret)
        .update(raw)
        .digest("hex");
    const matches = providedCandidates.some((provided) => {
        const normalized = provided.replace(/^sha256=/i, "").trim();
        const normalizedHex = /^[0-9a-fA-F]+$/.test(normalized)
            ? normalized.toLowerCase()
            : normalized;
        return (timingSafeEqual(normalized, computedBase64) ||
            timingSafeEqual(normalized, computedBase64NoPad) ||
            timingSafeEqual(normalized, computedBase64Url) ||
            timingSafeEqual(normalizedHex, computedHex));
    });
    if (!matches)
        return { ok: false, status: 401, error: "Invalid signature" };
    return { ok: true };
};
router.post("/", parseJsonWithRawBody, async (req, res) => {
    const body = req.body;
    const signedPayload = body?.signedPayload ?? undefined;
    try {
        // 1) App Store Server Notifications v2 (StoreKit) - uses `signedPayload`.
        if (signedPayload) {
            const { payload, transaction, renewalInfo } = await (0, appstore_1.decodeNotificationSecure)(signedPayload);
            const notificationType = payload?.notificationType ??
                "UNKNOWN";
            const originalTransactionId = transaction?.originalTransactionId ??
                renewalInfo?.originalTransactionId ??
                payload?.data
                    ?.originalTransactionId ??
                undefined;
            let userId = null;
            if (originalTransactionId) {
                userId = await (0, appstore_1.findUserByOriginalTransaction)(originalTransactionId);
                if (userId && transaction) {
                    await (0, appstore_1.upsertAppleSubscription)(userId, transaction, renewalInfo ?? undefined);
                }
            }
            const syncFromStatus = async () => {
                if (!userId || !originalTransactionId)
                    return;
                const status = await (0, appstore_1.fetchSubscriptionStatus)(originalTransactionId);
                if (status?.status && status.transaction) {
                    await (0, appstore_1.upsertAppleSubscription)(userId, status.transaction, status.renewalInfo ?? undefined);
                }
            };
            const revokeSubscription = async () => {
                if (!userId)
                    return;
                await (0, db_1.query)(`
          UPDATE users
          SET plan = 'free',
              plan_expires_at = NULL,
              apple_subscription_id = NULL,
              subscription_platform = 'apple',
              updated_at = NOW()
          WHERE id = $1
        `, [userId]);
            };
            // Run actions that pair with the notification type.
            try {
                switch (notificationType) {
                    case "INITIAL_BUY":
                    case "DID_RENEW":
                    case "DID_CHANGE_RENEWAL_STATUS":
                        if (transaction && userId) {
                            await (0, appstore_1.upsertAppleSubscription)(userId, transaction, renewalInfo ?? undefined);
                        }
                        else {
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
            }
            catch (handlerError) {
                console.error("Failed to reconcile App Store notification", notificationType, handlerError);
            }
            await (0, appstore_1.recordNotification)({
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
        const signatureCheck = maybeVerifyAppStoreConnectSignature(req);
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
    }
    catch (err) {
        console.error("Failed to handle App Store notification", err);
        return res
            .status(500)
            .json({ error: "Failed to process App Store notification" });
    }
});
exports.default = router;
