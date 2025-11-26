"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserByOriginalTransaction = exports.decodeNotification = exports.recordNotification = exports.validateAndActivate = exports.upsertAppleSubscription = exports.fetchSubscriptionStatus = exports.fetchTransaction = void 0;
const app_store_server_library_1 = require("@apple/app-store-server-library");
const db_1 = require("../db");
const id_1 = require("../utils/id");
const APP_STORE_ISSUER_ID = process.env.APP_STORE_ISSUER_ID;
const APP_STORE_KEY_ID = process.env.APP_STORE_KEY_ID;
const APP_STORE_PRIVATE_KEY = process.env.APP_STORE_PRIVATE_KEY;
const APP_STORE_BUNDLE_ID = process.env.APP_STORE_BUNDLE_ID ?? process.env.APP_STORE_BUNDLE_IDENTIFIER;
const APP_STORE_ENV = process.env.APP_STORE_ENV ?? "Sandbox";
const productToPlan = {
    pro_monthly_subscription: "monthly",
    pro_yearly_subscription: "annual",
};
const resolveEnvironment = () => APP_STORE_ENV.toLowerCase() === "production"
    ? app_store_server_library_1.Environment.PRODUCTION
    : app_store_server_library_1.Environment.SANDBOX;
const getClient = () => {
    if (!APP_STORE_ISSUER_ID ||
        !APP_STORE_KEY_ID ||
        !APP_STORE_PRIVATE_KEY ||
        !APP_STORE_BUNDLE_ID) {
        throw new Error("Missing Apple App Store credentials. Set APP_STORE_ISSUER_ID, APP_STORE_KEY_ID, APP_STORE_PRIVATE_KEY, and APP_STORE_BUNDLE_ID in the environment.");
    }
    const sanitizedKey = APP_STORE_PRIVATE_KEY.replace(/\\n/g, "\n");
    return new app_store_server_library_1.AppStoreServerAPIClient(sanitizedKey, APP_STORE_KEY_ID, APP_STORE_ISSUER_ID, APP_STORE_BUNDLE_ID, resolveEnvironment());
};
const toStatus = (transaction, renewalInfo) => {
    if (!transaction.productId) {
        throw new Error("Apple transaction missing productId");
    }
    const expiresAt = transaction.expiresDate
        ? new Date(transaction.expiresDate).toISOString()
        : null;
    const now = Date.now();
    const isExpired = transaction.expiresDate
        ? transaction.expiresDate < now
        : false;
    const inGrace = renewalInfo?.gracePeriodExpiresDate &&
        renewalInfo.gracePeriodExpiresDate > now &&
        isExpired;
    let status = "active";
    if (inGrace) {
        status = "in_grace_period";
    }
    else if (isExpired) {
        status = "expired";
    }
    else if (transaction.revocationReason !== undefined) {
        status = "revoked";
    }
    return {
        status,
        plan: status === "expired" || status === "revoked" ? "free" : "pro",
        planExpiresAt: expiresAt,
        originalTransactionId: transaction.originalTransactionId,
        transactionId: transaction.transactionId,
        productId: transaction.productId,
        environment: APP_STORE_ENV,
        interval: productToPlan[transaction.productId] ?? null,
    };
};
// Best-effort decode for signed JWS payloads (Apple signs with JWS; we just need the JSON body)
const decodeSignedPayload = (signedPayload) => {
    if (!signedPayload)
        return null;
    const parts = signedPayload.split(".");
    if (parts.length < 2)
        return null;
    try {
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json);
    }
    catch (err) {
        console.error("Failed to decode signed payload", err);
        return null;
    }
};
const fetchTransaction = async (transactionId) => {
    const client = getClient();
    const transactionInfo = await client.getTransactionInfo(transactionId);
    const transaction = decodeSignedPayload(transactionInfo.signedTransactionInfo);
    if (!transaction) {
        throw new Error("Unable to decode Apple transaction payload");
    }
    return {
        transaction,
        signedTransactionInfo: transactionInfo.signedTransactionInfo,
    };
};
exports.fetchTransaction = fetchTransaction;
const fetchSubscriptionStatus = async (originalTransactionId) => {
    const client = getClient();
    const statusResponse = await client.getAllSubscriptionStatuses(originalTransactionId);
    const latest = statusResponse.data?.[0]?.lastTransactions?.[0];
    if (!latest) {
        return null;
    }
    const transaction = decodeSignedPayload(latest.signedTransactionInfo);
    const renewalInfo = decodeSignedPayload(latest.signedRenewalInfo);
    return {
        transaction,
        renewalInfo,
        status: transaction
            ? toStatus(transaction, renewalInfo ?? undefined)
            : null,
    };
};
exports.fetchSubscriptionStatus = fetchSubscriptionStatus;
const upsertAppleSubscription = async (userId, transaction, renewalInfo) => {
    if (!transaction.productId) {
        throw new Error("Apple transaction missing productId");
    }
    const plan = productToPlan[transaction.productId];
    if (!plan) {
        throw new Error(`Unknown Apple product: ${transaction.productId}`);
    }
    const status = toStatus(transaction, renewalInfo);
    await (0, db_1.query)(`
      UPDATE users
      SET plan = $2,
          plan_expires_at = $3,
          apple_original_transaction_id = $4,
          apple_subscription_id = $5,
          subscription_platform = 'apple',
          updated_at = NOW()
      WHERE id = $1
    `, [
        userId,
        status.plan,
        status.planExpiresAt ?? null,
        transaction.originalTransactionId,
        transaction.transactionId,
    ]);
    return status;
};
exports.upsertAppleSubscription = upsertAppleSubscription;
const validateAndActivate = async (userId, transactionId) => {
    const { transaction } = await (0, exports.fetchTransaction)(transactionId);
    if (!transaction.originalTransactionId) {
        throw new Error("Apple transaction missing originalTransactionId");
    }
    const status = await (0, exports.fetchSubscriptionStatus)(transaction.originalTransactionId);
    const renewalInfo = status?.renewalInfo ?? undefined;
    const updatedStatus = await (0, exports.upsertAppleSubscription)(userId, transaction, renewalInfo);
    return {
        ...updatedStatus,
        renewalInfo,
    };
};
exports.validateAndActivate = validateAndActivate;
const recordNotification = async (params) => {
    await (0, db_1.query)(`
      INSERT INTO appstore_notifications (id, user_id, notification_type, transaction_id, original_transaction_id, payload, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
        (0, id_1.generateId)(),
        params.userId ?? null,
        params.notificationType,
        params.transactionId ?? null,
        params.originalTransactionId ?? null,
        params.payload,
    ]);
};
exports.recordNotification = recordNotification;
const decodeNotification = (signedPayload) => {
    const payload = decodeSignedPayload(signedPayload);
    const signedTransactionInfo = payload?.data?.signedTransactionInfo;
    const signedRenewalInfo = payload?.data?.signedRenewalInfo;
    const transaction = signedTransactionInfo
        ? decodeSignedPayload(signedTransactionInfo)
        : null;
    const renewalInfo = signedRenewalInfo
        ? decodeSignedPayload(signedRenewalInfo)
        : null;
    return {
        payload,
        transaction,
        renewalInfo,
    };
};
exports.decodeNotification = decodeNotification;
const findUserByOriginalTransaction = async (originalTransactionId) => {
    const result = await (0, db_1.query)(`SELECT id FROM users WHERE apple_original_transaction_id = $1 LIMIT 1`, [originalTransactionId]);
    return result.rows[0]?.id ?? null;
};
exports.findUserByOriginalTransaction = findUserByOriginalTransaction;
