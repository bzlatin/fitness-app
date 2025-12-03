"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const appstore_1 = require("../services/appstore");
const db_1 = require("../db");
const router = express_1.default.Router();
router.post("/", express_1.default.json({ limit: "2mb" }), async (req, res) => {
    const signedPayload = req.body?.signedPayload;
    if (!signedPayload) {
        return res.status(400).json({ error: "Missing signedPayload" });
    }
    try {
        const { payload, transaction, renewalInfo } = (0, appstore_1.decodeNotification)(signedPayload);
        const notificationType = (payload?.notificationType ?? "UNKNOWN");
        const originalTransactionId = transaction?.originalTransactionId ??
            renewalInfo?.originalTransactionId ??
            payload?.data?.originalTransactionId ??
            null;
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
    catch (err) {
        console.error("Failed to handle App Store notification", err);
        return res.status(500).json({ error: "Failed to process App Store notification" });
    }
});
exports.default = router;
