import {
	AppStoreServerAPIClient,
	Environment,
	SignedDataVerifier,
	VerificationException,
	VerificationStatus,
	type JWSRenewalInfoDecodedPayload,
	type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";
import fs from "fs";
import path from "path";
import { query } from "../db";
import { generateId } from "../utils/id";

const APP_STORE_ISSUER_ID = process.env.APP_STORE_ISSUER_ID;
const APP_STORE_KEY_ID = process.env.APP_STORE_KEY_ID;
const APP_STORE_PRIVATE_KEY = process.env.APP_STORE_PRIVATE_KEY;
const APP_STORE_BUNDLE_ID =
	process.env.APP_STORE_BUNDLE_ID ?? process.env.APP_STORE_BUNDLE_IDENTIFIER;
const APP_STORE_ENV = process.env.APP_STORE_ENV ?? "Sandbox";
const APP_STORE_APP_APPLE_ID_RAW = process.env.APP_STORE_APP_APPLE_ID;
const APP_STORE_VERIFY_NOTIFICATIONS_RAW = process.env.APP_STORE_VERIFY_NOTIFICATIONS;
const APP_STORE_ENABLE_ONLINE_VERIFICATION_RAW =
	process.env.APP_STORE_ENABLE_ONLINE_VERIFICATION;
const APP_STORE_ROOT_CA_PEM = process.env.APP_STORE_ROOT_CA_PEM;
const APP_STORE_ROOT_CA_PEM_PATH =
	process.env.APP_STORE_ROOT_CA_PEM_PATH ??
	path.join(__dirname, "..", "certs", "apple-root-cas.pem");

type PlanChoice = "monthly" | "annual";

const productToPlan: Record<string, PlanChoice | undefined> = {
  pro_monthly_subscription: "monthly",
  pro_yearly_subscription: "annual",
};

const resolveEnvironment = () =>
	APP_STORE_ENV.toLowerCase() === "production"
		? Environment.PRODUCTION
		: Environment.SANDBOX;

const resolveAppAppleId = () => {
	if (!APP_STORE_APP_APPLE_ID_RAW) return undefined;
	const parsed = Number(APP_STORE_APP_APPLE_ID_RAW);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid APP_STORE_APP_APPLE_ID: ${APP_STORE_APP_APPLE_ID_RAW}`);
	}
	return parsed;
};

const shouldVerifyNotifications = () => {
	const isProduction = process.env.NODE_ENV === "production";
	if (APP_STORE_VERIFY_NOTIFICATIONS_RAW === undefined) return isProduction;
	return APP_STORE_VERIFY_NOTIFICATIONS_RAW === "true";
};

const shouldEnableOnlineChecks = () => {
	const isProduction = process.env.NODE_ENV === "production";
	if (APP_STORE_ENABLE_ONLINE_VERIFICATION_RAW === undefined) return isProduction;
	return APP_STORE_ENABLE_ONLINE_VERIFICATION_RAW === "true";
};

const extractPemCertificates = (pem: string): Buffer[] => {
	const matches = pem.match(
		/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
	);
	if (!matches || matches.length === 0) {
		throw new Error("No PEM certificates found for App Store verification");
	}
	return matches.map((block) => Buffer.from(`${block}\n`, "utf8"));
};

let cachedRootCAs: Buffer[] | null = null;
const loadAppleRootCAs = () => {
	if (cachedRootCAs) return cachedRootCAs;
	const pem =
		APP_STORE_ROOT_CA_PEM ??
		fs.readFileSync(APP_STORE_ROOT_CA_PEM_PATH, { encoding: "utf8" });
	cachedRootCAs = extractPemCertificates(pem);
	return cachedRootCAs;
};

const createVerifier = (environment: Environment) => {
	if (!APP_STORE_BUNDLE_ID) {
		throw new Error(
			"APP_STORE_BUNDLE_ID is required to verify App Store notifications."
		);
	}

	const enableOnlineChecks = shouldEnableOnlineChecks();
	const appAppleId =
		environment === Environment.PRODUCTION ? resolveAppAppleId() : undefined;

	if (environment === Environment.PRODUCTION && !appAppleId) {
		throw new Error(
			"APP_STORE_APP_APPLE_ID is required to verify App Store notifications in Production."
		);
	}

	return new SignedDataVerifier(
		loadAppleRootCAs(),
		enableOnlineChecks,
		environment,
		APP_STORE_BUNDLE_ID,
		appAppleId
	);
};

const getClient = (environment?: Environment) => {
  if (
    !APP_STORE_ISSUER_ID ||
    !APP_STORE_KEY_ID ||
    !APP_STORE_PRIVATE_KEY ||
    !APP_STORE_BUNDLE_ID
  ) {
    throw new Error(
      "Missing Apple App Store credentials. Set APP_STORE_ISSUER_ID, APP_STORE_KEY_ID, APP_STORE_PRIVATE_KEY, and APP_STORE_BUNDLE_ID in the environment."
    );
  }

  const sanitizedKey = APP_STORE_PRIVATE_KEY.replace(/\\n/g, "\n");

  return new AppStoreServerAPIClient(
    sanitizedKey,
    APP_STORE_KEY_ID,
    APP_STORE_ISSUER_ID,
    APP_STORE_BUNDLE_ID,
    environment ?? resolveEnvironment()
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
  const inGrace =
    renewalInfo?.gracePeriodExpiresDate &&
    renewalInfo.gracePeriodExpiresDate > now &&
    isExpired;

  let status: AppleSubscriptionStatus["status"] = "active";
  if (inGrace) {
    status = "in_grace_period";
  } else if (isExpired) {
    status = "expired";
  } else if (transaction.revocationReason !== undefined) {
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
const decodeSignedPayload = <T>(signedPayload?: string | null): T | null => {
  if (!signedPayload) return null;
  const parts = signedPayload.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch (err) {
    console.error("Failed to decode signed payload", err);
    return null;
  }
};

export const fetchTransaction = async (transactionId: string) => {
  let client = getClient();
  let transactionInfo;

  try {
    // Try with the default environment (production or sandbox based on APP_STORE_ENV)
    transactionInfo = await client.getTransactionInfo(transactionId);
  } catch (error: any) {
    // If we get an error and we're in production mode, try sandbox
    if (resolveEnvironment() === Environment.PRODUCTION) {
      console.log("Production validation failed, retrying with sandbox environment");
      client = getClient(Environment.SANDBOX);
      transactionInfo = await client.getTransactionInfo(transactionId);
    } else {
      throw error;
    }
  }

  const transaction = decodeSignedPayload<JWSTransactionDecodedPayload>(
    transactionInfo.signedTransactionInfo
  );
  if (!transaction) {
    throw new Error("Unable to decode Apple transaction payload");
  }
  return {
    transaction,
    signedTransactionInfo: transactionInfo.signedTransactionInfo,
  };
};

export const fetchSubscriptionStatus = async (
  originalTransactionId: string
) => {
  let client = getClient();
  let statusResponse;

  try {
    // Try with the default environment (production or sandbox based on APP_STORE_ENV)
    statusResponse = await client.getAllSubscriptionStatuses(
      originalTransactionId
    );
  } catch (error: any) {
    // If we get an error and we're in production mode, try sandbox
    if (resolveEnvironment() === Environment.PRODUCTION) {
      console.log("Production status check failed, retrying with sandbox environment");
      client = getClient(Environment.SANDBOX);
      statusResponse = await client.getAllSubscriptionStatuses(
        originalTransactionId
      );
    } else {
      throw error;
    }
  }

  const latest = statusResponse.data?.[0]?.lastTransactions?.[0];

  if (!latest) {
    return null;
  }

  const transaction = decodeSignedPayload<JWSTransactionDecodedPayload>(
    latest.signedTransactionInfo
  );
  const renewalInfo = decodeSignedPayload<JWSRenewalInfoDecodedPayload>(
    latest.signedRenewalInfo
  );

  return {
    transaction,
    renewalInfo,
    status: transaction
      ? toStatus(transaction, renewalInfo ?? undefined)
      : null,
  };
};

export const upsertAppleSubscription = async (
  userId: string,
  transaction: JWSTransactionDecodedPayload,
  renewalInfo?: JWSRenewalInfoDecodedPayload
) => {
  if (!transaction.productId) {
    throw new Error("Apple transaction missing productId");
  }
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

export const validateAndActivate = async (
  userId: string,
  transactionId: string
) => {
  const { transaction } = await fetchTransaction(transactionId);
  if (!transaction.originalTransactionId) {
    throw new Error("Apple transaction missing originalTransactionId");
  }
  const status = await fetchSubscriptionStatus(
    transaction.originalTransactionId
  );
  const renewalInfo = status?.renewalInfo ?? undefined;

  const updatedStatus = await upsertAppleSubscription(
    userId,
    transaction,
    renewalInfo
  );
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
	const payload = decodeSignedPayload<{
		data?: { signedTransactionInfo?: string; signedRenewalInfo?: string };
	}>(signedPayload);
	const signedTransactionInfo = payload?.data?.signedTransactionInfo;
	const signedRenewalInfo = payload?.data?.signedRenewalInfo;
	const transaction = signedTransactionInfo
		? decodeSignedPayload<JWSTransactionDecodedPayload>(signedTransactionInfo)
		: null;
	const renewalInfo = signedRenewalInfo
		? decodeSignedPayload<JWSRenewalInfoDecodedPayload>(signedRenewalInfo)
		: null;

	return {
		payload,
		transaction,
		renewalInfo,
		verified: false as const,
	};
};

export const decodeNotificationSecure = async (signedPayload: string) => {
	if (!shouldVerifyNotifications()) {
		return decodeNotification(signedPayload);
	}

	const preferredEnv = resolveEnvironment();
	const envOrder =
		preferredEnv === Environment.PRODUCTION
			? [Environment.PRODUCTION, Environment.SANDBOX]
			: [Environment.SANDBOX, Environment.PRODUCTION];

	let lastError: unknown = null;
	for (const env of envOrder) {
		try {
			const verifier = createVerifier(env);
			const payload = await verifier.verifyAndDecodeNotification(signedPayload);
			const signedTransactionInfo = payload.data?.signedTransactionInfo;
			const signedRenewalInfo = payload.data?.signedRenewalInfo;

			const transaction = signedTransactionInfo
				? await verifier.verifyAndDecodeTransaction(signedTransactionInfo)
				: null;
			const renewalInfo = signedRenewalInfo
				? await verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo)
				: null;

			return {
				payload,
				transaction,
				renewalInfo,
				verified: true as const,
			};
		} catch (err) {
			lastError = err;
			if (err instanceof VerificationException) {
				if (err.status === VerificationStatus.INVALID_ENVIRONMENT) {
					continue;
				}
			}
			break;
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error("Failed to verify App Store notification payload");
};

export const findUserByOriginalTransaction = async (
  originalTransactionId: string
) => {
  const result = await query<{ id: string }>(
    `SELECT id FROM users WHERE apple_original_transaction_id = $1 LIMIT 1`,
    [originalTransactionId]
  );
  return result.rows[0]?.id ?? null;
};
