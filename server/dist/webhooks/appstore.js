"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const appstore_1 = require("../services/appstore");
const router = express_1.default.Router();
router.post("/", express_1.default.json({ limit: "2mb" }), async (req, res) => {
    const signedPayload = req.body?.signedPayload;
    if (!signedPayload) {
        return res.status(400).json({ error: "Missing signedPayload" });
    }
    try {
        const { payload, transaction, renewalInfo } = (0, appstore_1.decodeNotification)(signedPayload);
        const originalTransactionId = transaction?.originalTransactionId;
        const notificationType = (payload?.notificationType ?? "UNKNOWN");
        let userId = null;
        if (originalTransactionId) {
            userId = await (0, appstore_1.findUserByOriginalTransaction)(originalTransactionId);
            if (userId && transaction) {
                await (0, appstore_1.upsertAppleSubscription)(userId, transaction, renewalInfo ?? undefined);
            }
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
