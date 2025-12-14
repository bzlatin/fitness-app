"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUserBilling = void 0;
const db_1 = require("../db");
const fetchUserBilling = async (userId) => {
    const result = await (0, db_1.query)(`
      SELECT plan,
             plan_expires_at,
             apple_original_transaction_id,
             apple_subscription_id,
             subscription_platform,
             trial_started_at,
             trial_ends_at
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
