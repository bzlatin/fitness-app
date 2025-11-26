"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordSubscriptionEvent = exports.ensureStripeCustomer = exports.fetchUserBilling = exports.resolvePriceId = exports.stripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
const db_1 = require("../db");
const id_1 = require("../utils/id");
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PRICE_LOOKUP_MONTHLY = process.env.STRIPE_PRICE_LOOKUP_MONTHLY;
const PRICE_LOOKUP_ANNUAL = process.env.STRIPE_PRICE_LOOKUP_ANNUAL;
if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set. Please add it to your .env.");
}
exports.stripe = new stripe_1.default(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});
const resolvePriceId = (plan) => {
    if (plan === "monthly" && PRICE_LOOKUP_MONTHLY)
        return PRICE_LOOKUP_MONTHLY;
    if (plan === "annual" && PRICE_LOOKUP_ANNUAL)
        return PRICE_LOOKUP_ANNUAL;
    throw new Error(`Missing Stripe price lookup key for ${plan}. Set STRIPE_PRICE_LOOKUP_MONTHLY and STRIPE_PRICE_LOOKUP_ANNUAL in .env.`);
};
exports.resolvePriceId = resolvePriceId;
const fetchUserBilling = async (userId) => {
    const result = await (0, db_1.query)(`
      SELECT email,
             name,
             stripe_customer_id,
             stripe_subscription_id,
             apple_original_transaction_id,
             apple_subscription_id,
             subscription_platform,
             trial_started_at,
             trial_ends_at,
             plan,
             plan_expires_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `, [userId]);
    if (!result.rowCount) {
        throw new Error("User not found");
    }
    return result.rows[0];
};
exports.fetchUserBilling = fetchUserBilling;
const ensureStripeCustomer = async (userId) => {
    const user = await (0, exports.fetchUserBilling)(userId);
    if (user.stripe_customer_id) {
        return {
            customerId: user.stripe_customer_id,
            email: user.email,
            name: user.name,
            currentSubscriptionId: user.stripe_subscription_id ?? undefined,
            trialStartedAt: user.trial_started_at ?? undefined,
            trialEndsAt: user.trial_ends_at ?? undefined,
            subscriptionPlatform: user.subscription_platform ?? undefined,
            appleOriginalTransactionId: user.apple_original_transaction_id ?? undefined,
        };
    }
    const customer = await exports.stripe.customers.create({
        email: user.email ?? undefined,
        name: user.name ?? undefined,
        metadata: { userId },
    });
    await (0, db_1.query)(`
      UPDATE users
      SET stripe_customer_id = $2,
          updated_at = NOW()
      WHERE id = $1
    `, [userId, customer.id]);
    return {
        customerId: customer.id,
        email: customer.email ?? undefined,
        name: customer.name ?? undefined,
        currentSubscriptionId: undefined,
        trialStartedAt: undefined,
        trialEndsAt: undefined,
        subscriptionPlatform: user.subscription_platform ?? undefined,
        appleOriginalTransactionId: user.apple_original_transaction_id ?? undefined,
    };
};
exports.ensureStripeCustomer = ensureStripeCustomer;
const recordSubscriptionEvent = async (userId, eventType, stripeEventId, payload) => {
    await (0, db_1.query)(`
      INSERT INTO subscription_events (id, user_id, event_type, stripe_event_id, payload, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (stripe_event_id) DO NOTHING
    `, [(0, id_1.generateId)(), userId, eventType, stripeEventId, payload]);
};
exports.recordSubscriptionEvent = recordSubscriptionEvent;
