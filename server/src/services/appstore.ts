import {
  AppStoreServerAPI,
  Environment,
  JWSRenewalInfoDecodedPayload,
  JWSTransactionDecodedPayload,
  decodeNotificationPayload,
  decodeRenewalInfo,
  decodeTransaction,
} from "@apple/app-store-server-library";
import { query } from "../db";
import { generateId } from "../utils/id";

const APP_STORE_ISSUER_ID = process.env.APP_STORE_ISSUER_ID;
const APP_STORE_KEY_ID = process.env.APP_STORE_KEY_ID;
const APP_STORE_PRIVATE_KEY = process.env.APP_STORE_PRIVATE_KEY;
const APP_STORE_BUNDLE_ID =
  process.env.APP_STORE_BUNDLE_ID ?? process.env.APP_STORE_BUNDLE_IDENTIFIER;
const APP_STORE_ENV = process.env.APP_STORE_ENV ?? "Sandbox";

type PlanChoice = "monthly" | "annual";

const productToPlan: Record<string, PlanChoice | undefined> = {
  pro_monthly_subscription: "monthly",
  pro_annual_subscription: "annual",
};

const resolveEnvironment = () =>
  APP_STORE_ENV.toLowerCase() === "production" ? Environment.PRODUCTION : Environment.SANDBOX;

const getClient = () => {
  if (!APP_STORE_ISSUER_ID || !APP_STORE_KEY_ID || !APP_STORE_PRIVATE_KEY || !APP_STORE_BUNDLE_ID) {
    throw new Error(
      "Missing Apple App Store credentials. Set APP_STORE_ISSUER_ID, APP_STORE_KEY_ID, APP_STORE_PRIVATE_KEY, and APP_STORE_BUNDLE_ID in the environment."
    );
  }

  const sanitizedKey = APP_STORE_PRIVATE_KEY.replace(/\\n/g, "\n");

  return new AppStoreServerAPI(
    APP_STORE_ISSUER_ID,
    APP_STORE_KEY_ID,
    sanitizedKey,
    APP_STORE_BUNDLE_ID,
    resolveEnvironment()
  );
};

export type AppleSubscriptionStatus = {
  status: "active" | "expired" | "in_grace_period" | "revoked";
  plan: "pro" | "free";
  planExpiresAt?: string | null;
  originalTransactionId?: string;
  transactionId?: string;
  productId?: string;
  environment: string;
  interval?: PlanChoice | null;
};

const toStatus = (
  transaction: JWSTransactionDecodedPayload,
  renewalInfo?: JWSRenewalInfoDecodedPayload
): AppleSubscriptionStatus => {
  const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate).toISOString() : null;
  const now = Date.now();
  const isExpired = transaction.expiresDate ? transaction.expiresDate < now : false;
  const inGrace =
    renewalInfo?.gracePeriodExpiresDate && renewalInfo.gracePeriodExpiresDate > now && isExpired;

  let status: AppleSubscriptionStatus["status"] = "active";
  if (inGrace) {
    status = "in_grace_period";
  } else if (renewalInfo?.expirationIntent === "REFUND") {
    status = "revoked";
  } else if (isExpired) {
    status = "expired";
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

export const fetchTransaction = async (transactionId: string) => {
  const client = getClient();
  const transactionInfo = await client.getTransactionInfo(transactionId);
  const transaction = decodeTransaction(transactionInfo.signedTransactionInfo);
  return { transaction, signedTransactionInfo: transactionInfo.signedTransactionInfo };
};

export const fetchSubscriptionStatus = async (originalTransactionId: string) => {
  const client = getClient();
  const statusResponse = await client.getSubscriptionStatus(originalTransactionId);
  const latest =
    statusResponse.data?.[0]?.lastTransactions?.[0] ??
    statusResponse.data?.[0]?.latestTransactions?.[0];

  if (!latest) {
    return null;
  }

  const transaction = decodeTransaction(latest.signedTransactionInfo);
  const renewalInfo = decodeRenewalInfo(latest.signedRenewalInfo);

  return {
    transaction,
    renewalInfo,
    status: toStatus(transaction, renewalInfo),
  };
};

export const upsertAppleSubscription = async (
  userId: string,
  transaction: JWSTransactionDecodedPayload,
  renewalInfo?: JWSRenewalInfoDecodedPayload
) => {
  const plan = productToPlan[transaction.productId];
  if (!plan) {
    throw new Error(`Unknown Apple product: ${transaction.productId}`);
  }

  const status = toStatus(transaction, renewalInfo);

  await query(
    `
      UPDATE users
      SET plan = $2,
          plan_expires_at = $3,
          apple_original_transaction_id = $4,
          apple_subscription_id = $5,
          subscription_platform = 'apple',
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      userId,
      status.plan,
      status.planExpiresAt ?? null,
      transaction.originalTransactionId,
      transaction.transactionId,
    ]
  );

  return status;
};

export const validateAndActivate = async (userId: string, transactionId: string) => {
  const { transaction } = await fetchTransaction(transactionId);
  if (!transaction.originalTransactionId) {
    throw new Error("Apple transaction missing originalTransactionId");
  }
  const status = await fetchSubscriptionStatus(transaction.originalTransactionId);
  const renewalInfo = status?.renewalInfo;

  const updatedStatus = await upsertAppleSubscription(userId, transaction, renewalInfo);
  return {
    ...updatedStatus,
    renewalInfo,
  };
};

export const recordNotification = async (params: {
  userId?: string | null;
  notificationType: string;
  transactionId?: string;
  originalTransactionId?: string;
  payload: unknown;
}) => {
  await query(
    `
      INSERT INTO appstore_notifications (id, user_id, notification_type, transaction_id, original_transaction_id, payload, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `,
    [
      generateId(),
      params.userId ?? null,
      params.notificationType,
      params.transactionId ?? null,
      params.originalTransactionId ?? null,
      params.payload,
    ]
  );
};

export const decodeNotification = (signedPayload: string) => {
  const payload = decodeNotificationPayload(signedPayload);
  const signedTransactionInfo = payload.data?.signedTransactionInfo;
  const signedRenewalInfo = payload.data?.signedRenewalInfo;
  const transaction = signedTransactionInfo ? decodeTransaction(signedTransactionInfo) : null;
  const renewalInfo = signedRenewalInfo ? decodeRenewalInfo(signedRenewalInfo) : null;

  return {
    payload,
    transaction,
    renewalInfo,
  };
};

export const findUserByOriginalTransaction = async (originalTransactionId: string) => {
  const result = await query<{ id: string }>(
    `SELECT id FROM users WHERE apple_original_transaction_id = $1 LIMIT 1`,
    [originalTransactionId]
  );
  return result.rows[0]?.id ?? null;
};
